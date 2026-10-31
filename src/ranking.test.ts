import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getLocalRecords,
  saveLocalRecord,
  getPendingRankings,
  queuePendingRanking,
  removePendingRanking,
  submitRankingResult,
  syncPendingRankings,
  RankingFlowController,
  TOP_RANKING_LIMIT,
} from './ranking.ts';

// In-memory mock localStorage for Node test runner
const memoryStorage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => memoryStorage.get(key) ?? null,
  setItem: (key: string, val: string) => { memoryStorage.set(key, val); },
  removeItem: (key: string) => { memoryStorage.delete(key); },
  clear: () => { memoryStorage.clear(); },
};
// @ts-expect-error Mocking global localStorage
globalThis.localStorage = mockLocalStorage;

beforeEach(() => {
  memoryStorage.clear();
});

test('local records: stores and sorts descending, truncates to top 20', () => {
  for (let i = 1; i <= 25; i++) {
    saveLocalRecord(`Player ${i}`, i * 50, 'medium');
  }

  const records = getLocalRecords('medium');
  assert.equal(records.length, TOP_RANKING_LIMIT);
  assert.equal(records[0].name, 'Player 25');
  assert.equal(records[0].score, 1250);
  assert.equal(records[19].name, 'Player 6');
  assert.equal(records[19].score, 300);
});

test('submitRankingResult: when online, calls api and does not queue', async () => {
  let calledPath = '';
  let calledBody: any = null;
  const mockApi = async (path: string, body?: unknown) => {
    calledPath = path;
    calledBody = body;
    return { ok: true };
  };

  const res = await submitRankingResult(
    {
      id: 'match-1',
      token: 'tok-1',
      player: 0,
      name: 'Sofia',
      score: 800,
      difficulty: 'easy',
    },
    mockApi,
    true
  );

  assert.deepEqual(res, { ok: true, offline: false, state: 'published', provenance: 'verified' });
  assert.equal(calledPath, 'results');
  assert.equal(calledBody.name, 'Sofia');
  assert.equal(calledBody.score, undefined);
  assert.equal(getPendingRankings().length, 0);

  // Local record must also be saved
  const local = getLocalRecords('easy');
  assert.equal(local.length, 1);
  assert.equal(local[0].name, 'Sofia');
  assert.equal(local[0].score, 800);
});

test('submitRankingResult: when offline or api fails, queues to pending sync', async () => {
  const failingApi = async () => {
    throw new Error('Network error');
  };

  const res = await submitRankingResult(
    {
      id: 'offline-m1',
      player: 1,
      name: 'Stella',
      score: 450,
      difficulty: 'hard',
    },
    failingApi,
    false // offline
  );

  assert.deepEqual(res, { ok: true, offline: true, state: 'pending' });
  const pending = getPendingRankings();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].name, 'Stella');
  assert.equal(pending[0].score, 450);
  assert.equal(pending[0].player, 1);
  assert.equal(pending[0].difficulty, 'hard');

  // Also saved to local device records
  const local = getLocalRecords('hard');
  assert.equal(local.length, 1);
  assert.equal(local[0].name, 'Stella');
});

test('syncPendingRankings: uploads queued records when back online', async () => {
  queuePendingRanking({
    id: 'off-1',
    player: 0,
    name: 'Kai',
    score: 600,
    difficulty: 'medium',
    timestamp: Date.now(),
  });
  queuePendingRanking({
    id: 'off-2',
    player: 1,
    name: 'Leya',
    score: 550,
    difficulty: 'medium',
    timestamp: Date.now(),
  });

  const uploaded: any[] = [];
  const mockApi = async (path: string, body?: unknown) => {
    uploaded.push({ path, body });
    return { ok: true };
  };

  const count = await syncPendingRankings(mockApi, true);
  assert.equal(count, 2);
  assert.equal(uploaded.length, 2);
  assert.equal(uploaded[0].body.name, 'Kai');
  assert.equal(uploaded[1].body.name, 'Leya');
  assert.equal(getPendingRankings().length, 0);
});

test('RankingFlowController: handles 2-player turn-by-turn with skip confirmation', async () => {
  const mockApi = async () => ({ ok: true });
  const controller = new RankingFlowController(
    [
      { heroIndex: 0, heroName: 'Sofia', score: 300, lives: 0 },
      { heroIndex: 1, heroName: 'Stella', score: 500, lives: 0 },
    ],
    'medium',
    'test-attempt'
  );

  // Both players lost (lives: 0), player 1 (Stella) had higher score
  assert.equal(controller.totalPlayers, 2);
  assert.equal(controller.isComplete, false);
  assert.equal(controller.activeIndex, 0);
  assert.equal(controller.currentPlayer?.heroName, 'Sofia');
  assert.equal(controller.currentPlayer?.isWinner, false);

  // Player 1 saves their rating
  const res1 = await controller.saveCurrentPlayer('Alice', mockApi, true);
  assert.equal(res1.ok, true);
  assert.equal(controller.hasSaved(0), true);

  // Now active player is Player 2 (Stella)
  assert.equal(controller.activeIndex, 1);
  assert.equal(controller.currentPlayer?.heroName, 'Stella');
  assert.equal(controller.currentPlayer?.isWinner, true);
  assert.equal(controller.isComplete, false);

  // Player 2 clicks Skip -> requires confirmation
  controller.requestSkip();
  assert.equal(controller.isSkipConfirmOpen, true);

  // If Player 2 cancels skip:
  controller.cancelSkip();
  assert.equal(controller.isSkipConfirmOpen, false);
  assert.equal(controller.isComplete, false);

  // Player 2 requests skip again and confirms
  controller.requestSkip();
  const skipped = controller.confirmSkip();
  assert.equal(skipped?.heroName, 'Stella');
  assert.equal(controller.hasSkipped(1), true);

  // All players processed
  assert.equal(controller.isComplete, true);
});

test('RankingFlowController: solo player can save and finish', async () => {
  const mockApi = async () => ({ ok: true });
  const controller = new RankingFlowController(
    [{ heroIndex: 2, heroName: 'Kai', score: 950, lives: 3 }],
    'hard',
    'solo-attempt'
  );

  assert.equal(controller.totalPlayers, 1);
  assert.equal(controller.currentPlayer?.heroName, 'Kai');

  const res = await controller.saveCurrentPlayer('SoloChamp', mockApi, true);
  assert.equal(res.ok, true);
  assert.equal(controller.isComplete, true);
  assert.equal(controller.hasSaved(0), true);
});

test('finish survives reload and is acknowledged before a queued name', async () => {
  const { queueJourneyFinish, getPendingFinishes } = await import('./ranking.ts');
  queueJourneyFinish('journey', { token: 'proof', heroes: [0], logs: [[], [], []] });
  await submitRankingResult({ id: 'journey', token: 'proof', player: 0, name: 'Hero', score: 50, difficulty: 'easy' }, async () => {}, false);
  const paths: string[] = [];
  assert.equal(getPendingFinishes()[0].payload.logs.length, 3);
  assert.equal(await syncPendingRankings(async path => { paths.push(path); }, true), 1);
  assert.deepEqual(paths, ['attempts/journey/finish', 'results']);
  assert.equal(getPendingFinishes()[0].state, 'published');
});

test('permanent proof error does not block later entries or silently publish offline', async () => {
  const { RankingApiError, publishPendingOffline } = await import('./ranking.ts');
  for (const id of ['bad', 'good']) queuePendingRanking({ id, token: 'proof', player: 0, name: id, score: 20, difficulty: 'easy', timestamp: 1 });
  const paths: string[] = [];
  assert.equal(await syncPendingRankings(async (path, body: any) => {
    paths.push(path); if (body.id === 'bad') throw new RankingApiError(403, 'proof_unavailable', 'Expired', false);
  }, true), 1);
  assert.equal(getPendingRankings()[0].state, 'needs-retry');
  assert.ok(!paths.includes('results/offline'));
  publishPendingOffline('bad', 0);
  await syncPendingRankings(async path => { paths.push(path); }, true);
  assert.equal(paths.at(-1), 'results/offline');
});

test('storage failure is explicit and defeat never queues a shared result', async () => {
  const original = mockLocalStorage.setItem;
  mockLocalStorage.setItem = () => { throw new Error('Quota exceeded'); };
  try {
    const result = await submitRankingResult({ id: 'x', player: 0, name: 'Hero', score: 1, difficulty: 'easy' }, async () => {}, false);
    assert.equal(result.ok, false); assert.equal(result.state, 'storage-error');
  } finally { mockLocalStorage.setItem = original; }
  let calls = 0;
  const result = await submitRankingResult({ id: 'defeat', player: 0, name: 'Hero', score: 1, difficulty: 'easy', deviceOnly: true }, async () => { calls++; });
  assert.equal(result.state, 'device-only'); assert.equal(calls, 0); assert.equal(getPendingRankings().length, 0);
});

test('lost finish stays durable and names wait for a successful finish retry', async () => {
  const { queueJourneyFinish, getPendingFinishes, RankingApiError } = await import('./ranking.ts');
  queueJourneyFinish('lost', { token: 'proof', heroes: [1], logs: [[{ tick: 4, player: 0, kind: 'jump', pressed: true }], [], []] });
  const paths: string[] = [];
  const entry = { id: 'lost', token: 'proof', player: 0, name: 'Hero', score: 10, difficulty: 'easy' as const };
  const result = await submitRankingResult(entry, async path => { paths.push(path); throw new RankingApiError(503, 'database_unavailable', 'Retry later', true); });
  assert.equal(result.state, 'pending'); assert.deepEqual(paths, ['attempts/lost/finish']);
  assert.equal(getPendingFinishes()[0].payload.logs[0][0].tick, 4);
  assert.equal(await syncPendingRankings(async path => { paths.push(path); }), 1);
  assert.deepEqual(paths, ['attempts/lost/finish', 'attempts/lost/finish', 'results']);
  assert.equal(getPendingRankings().length, 0);
});


test('published receipts survive reload and resync without duplicating a player', async () => {
  const entry = {id: 'receipt', token: 'proof', player: 0, name: 'Hero', score: 12, difficulty: 'easy' as const};
  await submitRankingResult(entry, async () => ({}), false);
  await syncPendingRankings(async () => ({}), true);
  await syncPendingRankings(async () => ({}), true);
  const receipts = JSON.parse(localStorage.getItem('jump-published')!);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].provenance, 'verified');
  assert.equal(receipts[0].state, 'published');
  assert.equal(receipts[0].token, undefined);
  assert.equal(getPendingRankings().length, 0);
});

test('offline publication and defeated device receipts retain distinct labels', async () => {
  await submitRankingResult({id: 'offline', player: 0, name: 'Offline', score: 12, difficulty: 'easy'}, async () => ({}), true);
  await submitRankingResult({id: 'defeat', player: 0, name: 'Local', score: 3, difficulty: 'easy', deviceOnly: true}, async () => { throw new Error('must not send'); }, true);
  const receipts = JSON.parse(localStorage.getItem('jump-published')!);
  assert.equal(receipts[0].provenance, 'offline');
  assert.equal(receipts[1].state, 'device-only');
});
