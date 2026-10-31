import { type DifficultyKey } from './rules.ts';
import type { Action } from './network.ts';

export type DeliveryState = 'device-only' | 'pending' | 'published' | 'needs-retry' | 'storage-error';
export interface FinishPayload { token: string; heroes: number[]; logs: Action[][] }
export interface PendingFinish { id: string; payload: FinishPayload; state: DeliveryState; error?: string }
export interface PendingRanking {
  id: string; token?: string; player: number; name: string; score: number;
  difficulty: DifficultyKey; timestamp: number; provenance?: 'verified' | 'offline';
  deviceOnly?: boolean; state?: DeliveryState; error?: string;
}
export interface LocalScoreEntry { name: string; score: number; id?: string; player?: number; provenance?: 'verified' | 'offline' }
const LOCAL_STORAGE_KEY_PREFIX = 'jump-records-';
const PENDING_SYNC_KEY = 'jump-pending-sync';
const FINISH_KEY = 'jump-pending-finishes';
export const TOP_RANKING_LIMIT = 20;
export class RankingApiError extends Error {
  status: number; code: string; retryable: boolean;
  constructor(status: number, code: string, message: string, retryable: boolean) { super(message); this.status=status; this.code=code; this.retryable=retryable; }
}
function read<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  const list: unknown = JSON.parse(raw);
  if (!Array.isArray(list)) throw new Error('Повреждено хранилище результатов');
  return list as T[];
}
function write(key: string, entries: unknown[]): void { localStorage.setItem(key, JSON.stringify(entries)); if (typeof window !== 'undefined') window.dispatchEvent(new Event('ranking-delivery')); }
function savePublished(item: PendingRanking): void {
  const rows = read<PendingRanking>('jump-published');
  const receipt = { ...item, state: item.deviceOnly ? 'device-only' as const : 'published' as const, provenance: item.provenance === 'offline' || !item.token ? 'offline' as const : 'verified' as const };
  delete receipt.token;
  write('jump-published', [...rows.filter(row => row.id !== item.id || row.player !== item.player), receipt]);
}
export function getLocalRecords(difficulty: DifficultyKey): LocalScoreEntry[] {
  try { return read<LocalScoreEntry>(`${LOCAL_STORAGE_KEY_PREFIX}${difficulty}`).slice(0, TOP_RANKING_LIMIT); } catch { return []; }
}
export function saveLocalRecord(name: string, score: number, difficulty: DifficultyKey, id?: string, player?: number): void {
  const list = read<LocalScoreEntry>(`${LOCAL_STORAGE_KEY_PREFIX}${difficulty}`);
  if (id) { const index = list.findIndex(e => e.id === id && e.player === player); if (index >= 0) list.splice(index, 1); }
  list.push({ name: name.trim(), score, id, player, provenance: 'offline' });
  list.sort((a, b) => b.score - a.score);
  write(`${LOCAL_STORAGE_KEY_PREFIX}${difficulty}`, list.slice(0, TOP_RANKING_LIMIT));
}
export function getPendingRankings(): PendingRanking[] { return read<PendingRanking>(PENDING_SYNC_KEY); }
export function getPendingFinishes(): PendingFinish[] { return read<PendingFinish>(FINISH_KEY); }
export function queuePendingRanking(entry: PendingRanking): void {
  const list = getPendingRankings();
  const index = list.findIndex(e => e.id === entry.id && e.player === entry.player);
  if (index >= 0) list[index] = entry; else list.push(entry);
  write(PENDING_SYNC_KEY, list);
}
export function removePendingRanking(id: string, player: number): void {
  write(PENDING_SYNC_KEY, getPendingRankings().filter(e => e.id !== id || e.player !== player));
}
export function queueJourneyFinish(id: string, payload: FinishPayload): void {
  const list = getPendingFinishes();
  if (!list.some(e => e.id === id)) list.push({ id, payload, state: 'pending' });
  write(FINISH_KEY, list);
}
export type ApiPostFn = (path: string, body?: unknown) => Promise<unknown>;
function permanent(error: unknown): boolean { return error instanceof RankingApiError && !error.retryable; }
async function deliverFinish(id: string, apiPost: ApiPostFn): Promise<void> {
  const list = getPendingFinishes();
  const finish = list.find(e => e.id === id);
  if (!finish || finish.state === 'published') return;
  try {
    await apiPost(`attempts/${id}/finish`, finish.payload);
    finish.state = 'published'; delete finish.error;
  } catch (error) {
    finish.state = permanent(error) ? 'needs-retry' : 'pending'; finish.error = String(error);
    write(FINISH_KEY, list); throw error;
  }
  write(FINISH_KEY, list);
}
async function deliverName(item: PendingRanking, apiPost: ApiPostFn): Promise<void> {
  if (item.deviceOnly) return;
  if (item.token && item.provenance !== 'offline') await deliverFinish(item.id, apiPost);
  const { id, token, player, name, score, difficulty } = item;
  if (item.provenance === 'offline' || !token) await apiPost('results/offline', { id, player, name, score, difficulty });
  else await apiPost('results', { id, token, player, name });
}
export interface RankingSubmission { ok: boolean; offline: boolean; state?: DeliveryState; error?: string; provenance?: 'verified' | 'offline' }
export async function submitRankingResult(
  entry: Omit<PendingRanking, 'timestamp'>,
  apiPost: ApiPostFn,
  isOnline = typeof navigator !== 'undefined' ? navigator.onLine !== false : true
): Promise<RankingSubmission> {
  const name = entry.name.trim();
  if (!name || [...name].length > 20 || /[\x00-\x1f\x7f]/.test(name)) return { ok: false, offline: false, error: 'Имя должно содержать от 1 до 20 символов' };
  const payload: PendingRanking = { ...entry, name, timestamp: Date.now(), state: 'pending' };
  try {
    saveLocalRecord(name, entry.score, entry.difficulty, entry.id, entry.player);
    if (entry.deviceOnly) { savePublished({...payload, state: 'device-only'}); return { ok: true, offline: true, state: 'device-only' }; }
    queuePendingRanking(payload);
  } catch (error) { return { ok: false, offline: true, state: 'storage-error', error: `Не удалось сохранить на устройстве: ${String(error)}` }; }
  if (!isOnline) return { ok: true, offline: true, state: 'pending' };
  try {
    await deliverName(payload, apiPost);
    savePublished(payload);
    removePendingRanking(entry.id, entry.player);
    return { ok: true, offline: false, state: 'published', provenance: payload.provenance === 'offline' || !payload.token ? 'offline' : 'verified' };
  } catch (error) {
    payload.error = String(error); payload.state = permanent(error) ? 'needs-retry' : 'pending';
    try { queuePendingRanking(payload); } catch (storageError) { return { ok: false, offline: true, state: 'storage-error', error: String(storageError) }; }
    return { ok: !permanent(error), offline: true, state: payload.state, error: String(error) };
  }
}
// Explicit user action: expired/rejected proof is never silently changed to offline.
export function publishPendingOffline(id: string, player: number): void {
  const item = getPendingRankings().find(e => e.id === id && e.player === player);
  if (!item || item.deviceOnly) throw new Error('Результат недоступен для публикации');
  item.provenance = 'offline'; item.state = 'pending'; delete item.token; delete item.error;
  queuePendingRanking(item);
}
let syncing: Promise<number> | undefined;
export async function syncPendingRankings(apiPost: ApiPostFn, isOnline = typeof navigator !== 'undefined' ? navigator.onLine !== false : true): Promise<number> {
  if (!isOnline) return 0;
  if (syncing) return syncing;
  syncing = (async () => {
    let synced = 0;
    for (const finish of getPendingFinishes()) {
      if (finish.state === 'pending') { try { await deliverFinish(finish.id, apiPost); } catch { /* independent finishes continue */ } }
    }
    for (const item of getPendingRankings()) {
      if (item.state === 'needs-retry') continue;
      try { await deliverName(item, apiPost); savePublished(item); removePendingRanking(item.id, item.player); synced++; }
      catch (error) { item.state = permanent(error) ? 'needs-retry' : 'pending'; item.error = String(error); queuePendingRanking(item); }
    }
    return synced;
  })();
  try { return await syncing; } finally { syncing = undefined; }
}
export function retryPendingRanking(id: string, player: number): void {
  const item = getPendingRankings().find(e => e.id === id && e.player === player);
  if (!item) return;
  item.state = 'pending'; queuePendingRanking(item);
  const finishes = getPendingFinishes(); const finish = finishes.find(e => e.id === id);
  if (finish && finish.state !== 'published') finish.state = 'pending';
  write(FINISH_KEY, finishes);
}

export interface FlowPlayer {
  index: number;
  heroIndex: number;
  heroName: string;
  score: number;
  lives: number;
  isWinner: boolean;
}

export interface RankingFlowState {
  activePlayerIndex: number;
  isComplete: boolean;
  isSkipConfirmOpen: boolean;
  savedPlayers: Set<number>;
  skippedPlayers: Set<number>;
}

export class RankingFlowController {
  private players: FlowPlayer[];
  private difficulty: DifficultyKey;
  private attemptId: string;
  private token?: string;
  private deviceOnly: boolean;
  readonly submissions = new Map<number, RankingSubmission>();
  private state: RankingFlowState;

  constructor(
    players: { heroIndex: number; heroName: string; score: number; lives: number }[],
    difficulty: DifficultyKey = 'medium',
    attemptId: string = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    token?: string,
    deviceOnly = false
  ) {
    const maxScore = Math.max(...players.map(p => p.score), 0);
    this.players = players.map((p, i) => ({
      index: i,
      heroIndex: p.heroIndex,
      heroName: p.heroName,
      score: p.score,
      lives: p.lives,
      isWinner: p.score === maxScore && p.score > 0,
    }));
    this.difficulty = difficulty;
    this.attemptId = attemptId;
    this.token = token;
    this.deviceOnly = deviceOnly;
    this.state = {
      activePlayerIndex: 0,
      isComplete: this.players.length === 0,
      isSkipConfirmOpen: false,
      savedPlayers: new Set<number>(),
      skippedPlayers: new Set<number>(),
    };
  }

  get totalPlayers(): number {
    return this.players.length;
  }

  get activeIndex(): number {
    return this.state.activePlayerIndex;
  }

  get isComplete(): boolean {
    return this.state.isComplete;
  }

  get isSkipConfirmOpen(): boolean {
    return this.state.isSkipConfirmOpen;
  }

  get currentPlayer(): FlowPlayer | undefined {
    return this.players[this.state.activePlayerIndex];
  }

  requestSkip(): void {
    if (this.state.isComplete) return;
    this.state.isSkipConfirmOpen = true;
  }

  cancelSkip(): void {
    this.state.isSkipConfirmOpen = false;
  }

  confirmSkip(): FlowPlayer | undefined {
    if (!this.state.isSkipConfirmOpen || this.state.isComplete) return undefined;
    const current = this.currentPlayer;
    if (current) {
      this.state.skippedPlayers.add(current.index);
    }
    this.state.isSkipConfirmOpen = false;
    this.advance();
    return current;
  }

  async saveCurrentPlayer(
    name: string,
    apiPost: ApiPostFn,
    isOnline?: boolean
  ): Promise<RankingSubmission> {
    const current = this.currentPlayer;
    if (!current || this.state.isComplete) {
      return { ok: false, offline: false, error: 'Игрок не найден' };
    }
    const res = await submitRankingResult(
      {
        id: this.attemptId,
        token: this.token,
        player: current.index,
        name,
        score: current.score,
        difficulty: this.difficulty,
        deviceOnly: this.deviceOnly,
      },
      apiPost,
      isOnline
    );
    if (res.ok) {
      this.submissions.set(current.index, res);
      this.state.savedPlayers.add(current.index);
      this.advance();
    }
    return res;
  }

  advance(): void {
    if (this.state.activePlayerIndex + 1 < this.players.length) {
      this.state.activePlayerIndex++;
    } else {
      this.state.isComplete = true;
    }
  }

  hasSaved(playerIndex: number): boolean {
    return this.state.savedPlayers.has(playerIndex);
  }

  hasSkipped(playerIndex: number): boolean {
    return this.state.skippedPlayers.has(playerIndex);
  }
}

export function openSkipConfirm(
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
): void {
  const dialog = document.querySelector<HTMLElement>('#confirm-skip-dialog');
  const desc = document.querySelector<HTMLElement>('#confirm-skip-desc');
  const yesBtn = document.querySelector<HTMLButtonElement>('#confirm-skip-yes');
  const cancelBtn = document.querySelector<HTMLButtonElement>('#confirm-skip-cancel');
  const backdrop = document.querySelector<HTMLElement>('#confirm-skip-backdrop');

  if (!dialog || !yesBtn || !cancelBtn) {
    if (typeof window !== 'undefined' && window.confirm(message)) {
      onConfirm();
    } else {
      onCancel?.();
    }
    return;
  }

  if (desc) desc.textContent = message;
  dialog.hidden = false;

  const cleanup = () => {
    dialog.hidden = true;
    yesBtn.onclick = null;
    cancelBtn.onclick = null;
    if (backdrop) backdrop.onclick = null;
  };

  yesBtn.onclick = () => {
    cleanup();
    onConfirm();
  };

  cancelBtn.onclick = () => {
    cleanup();
    onCancel?.();
  };

  if (backdrop) {
    backdrop.onclick = () => {
      cleanup();
      onCancel?.();
    };
  }
}

export function rankingDeliveryMessage(result: RankingSubmission): string {
  if (!result.ok) return result.error ?? 'Не удалось сохранить. Повторите попытку.';
  if (result.state === 'device-only') return 'Сохранено только на этом устройстве.';
  if (result.state === 'published') return `В общем рейтинге · ${result.provenance === 'verified' ? 'подтверждён сервером' : 'офлайн, без проверки'}.`;
  return 'Сохранено на устройстве; ожидает отправки.';
}

// Shared recovery view survives navigation and reload; textContent keeps names inert.
export function mountRankingRecovery(target: HTMLElement, apiPost: ApiPostFn): void {
  const render = () => {
    target.replaceChildren();
    const heading = document.createElement('h3'); heading.textContent = 'Мои результаты и отправка'; target.append(heading);
    try {
      const pending = getPendingRankings();
      const rows = [...read<PendingRanking>('jump-published').filter(row => !pending.some(p => p.id === row.id && p.player === row.player)), ...pending];
      if (!rows.length) { const p = document.createElement('p'); p.textContent = 'Нет результатов, ожидающих отправки.'; target.append(p); }
      for (const row of rows) {
        const card = document.createElement('div'); card.className = 'delivery-row';
        const text = document.createElement('p');
        text.textContent = `${row.name} · Игрок ${row.player + 1} · ${row.score}: ${rankingDeliveryMessage({ok: row.state !== 'needs-retry', offline: row.state !== 'published', state: row.state, provenance: row.provenance, error: row.state === 'needs-retry' ? 'Нужно повторить: ' + (row.error ?? 'подтверждение отклонено') : undefined})}`;
        card.append(text);
        if (row.state !== 'published' && row.state !== 'device-only') {
          const action = (label: string, change: () => void) => {
            const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = label;
            button.onclick = async () => { button.disabled = true; try { change(); await syncPendingRankings(apiPost); render(); } catch { target.textContent = 'Ошибка хранилища. Сохранность результата не подтверждена. Освободите место и повторите.'; } };
            card.append(button);
          };
          action('Повторить отправку', () => retryPendingRanking(row.id, row.player));
          if (row.state === 'needs-retry') action('Опубликовать офлайн · без проверки', () => publishPendingOffline(row.id, row.player));
        }
        target.append(card);
      }
      for (const finish of getPendingFinishes().filter(row => row.state !== 'published' && !pending.some(p => p.id === row.id))) {
        const p = document.createElement('p'); p.textContent = `Журнал путешествия: ${finish.state === 'needs-retry' ? 'нужно повторить проверку' : 'ожидает отправки'}. Имя ещё не записано.`; target.append(p);
      }
    } catch { target.textContent = 'Ошибка хранилища. Сохранность результатов не подтверждена.'; }
  };
  window.addEventListener('ranking-delivery', render); render();
}
