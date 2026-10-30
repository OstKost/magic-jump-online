import { DIFFICULTIES, type DifficultyKey } from './rules.ts';

export interface PendingRanking {
  id: string;
  token?: string;
  player: number;
  name: string;
  score: number;
  difficulty: DifficultyKey;
  timestamp: number;
}

export interface LocalScoreEntry {
  name: string;
  score: number;
}

const LOCAL_STORAGE_KEY_PREFIX = 'jump-records-';
const PENDING_SYNC_KEY = 'jump-pending-sync';
export const TOP_RANKING_LIMIT = 20;

export function getLocalRecords(difficulty: DifficultyKey): LocalScoreEntry[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${difficulty}`);
    if (!raw) return [];
    const list = JSON.parse(raw) as LocalScoreEntry[];
    if (!Array.isArray(list)) return [];
    return list.slice(0, TOP_RANKING_LIMIT);
  } catch {
    return [];
  }
}

export function saveLocalRecord(name: string, score: number, difficulty: DifficultyKey): void {
  const cleanName = name.trim();
  if (!cleanName || score < 0) return;
  try {
    const list = getLocalRecords(difficulty);
    list.push({ name: cleanName, score });
    list.sort((a, b) => b.score - a.score);
    const top = list.slice(0, TOP_RANKING_LIMIT);
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${difficulty}`, JSON.stringify(top));
  } catch {}
}

export function getPendingRankings(): PendingRanking[] {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as PendingRanking[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function queuePendingRanking(entry: PendingRanking): void {
  try {
    const list = getPendingRankings();
    // Avoid duplicate queue entries for the same match/id and player
    const existingIndex = list.findIndex(item => item.id === entry.id && item.player === entry.player);
    if (existingIndex >= 0) {
      list[existingIndex] = entry;
    } else {
      list.push(entry);
    }
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(list));
  } catch {}
}

export function removePendingRanking(id: string, player: number): void {
  try {
    const list = getPendingRankings().filter(item => !(item.id === id && item.player === player));
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(list));
  } catch {}
}

export type ApiPostFn = (path: string, body?: unknown) => Promise<unknown>;

export async function submitRankingResult(
  entry: {
    id: string;
    token?: string;
    player: number;
    name: string;
    score: number;
    difficulty: DifficultyKey;
  },
  apiPost: ApiPostFn,
  isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true
): Promise<{ ok: boolean; offline: boolean; error?: string }> {
  const trimmedName = entry.name.trim();
  if (!trimmedName) {
    return { ok: false, offline: false, error: 'Имя не должно быть пустым' };
  }

  // Always store locally so user's device immediately has the record
  saveLocalRecord(trimmedName, entry.score, entry.difficulty);

  const payload: PendingRanking = {
    id: entry.id,
    token: entry.token,
    player: entry.player,
    name: trimmedName,
    score: entry.score,
    difficulty: entry.difficulty,
    timestamp: Date.now(),
  };

  if (!isOnline) {
    queuePendingRanking(payload);
    return { ok: true, offline: true };
  }

  try {
    await apiPost('results', {
      id: entry.id,
      token: entry.token,
      player: entry.player,
      name: trimmedName,
      score: entry.score,
      difficulty: entry.difficulty,
    });
    // If it was in the pending queue previously, remove it
    removePendingRanking(entry.id, entry.player);
    return { ok: true, offline: false };
  } catch {
    // Network failed or server unreachable: queue for later sync
    queuePendingRanking(payload);
    return { ok: true, offline: true };
  }
}

export async function syncPendingRankings(
  apiPost: ApiPostFn,
  isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true
): Promise<number> {
  if (!isOnline) return 0;
  const pending = getPendingRankings();
  if (!pending.length) return 0;

  let synced = 0;
  for (const item of pending) {
    try {
      await apiPost('results', {
        id: item.id,
        token: item.token,
        player: item.player,
        name: item.name,
        score: item.score,
        difficulty: item.difficulty,
      });
      removePendingRanking(item.id, item.player);
      synced++;
    } catch (err: unknown) {
      // 409 Conflict means it's already recorded in DB
      const errMsg = String(err);
      if (errMsg.includes('409') || errMsg.includes('уже записан')) {
        removePendingRanking(item.id, item.player);
        synced++;
      } else {
        // Stop syncing if connection dropped
        break;
      }
    }
  }
  return synced;
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
  private state: RankingFlowState;

  constructor(
    players: { heroIndex: number; heroName: string; score: number; lives: number }[],
    difficulty: DifficultyKey = 'medium',
    attemptId: string = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    token?: string
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
  ): Promise<{ ok: boolean; offline: boolean; error?: string }> {
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
      },
      apiPost,
      isOnline
    );
    if (res.ok) {
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
