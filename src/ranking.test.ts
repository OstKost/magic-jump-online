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

  assert.deepEqual(res, { ok: true, offline: false });
  assert.equal(calledPath, 'results');
  assert.equal(calledBody.name, 'Sofia');
  assert.equal(calledBody.score, 800);
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

  assert.deepEqual(res, { ok: true, offline: true });
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
