import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceMagicTrail, TRAIL_LIFE } from './magic-trail.ts';

test('a second jump pulls the fresh ribbon toward the character and keeps its root attached', () => {
  const points = [{ x: -8, y: -62, age: 0 }, { x: -40, y: -62, age: .16 }];
  const next = advanceMagicTrail(points, .02, 270, -65, -50, true);
  assert.deepEqual(next.at(-1), { x: -8, y: -77, age: 0 });
  assert.ok(Math.abs(next[0].y + 77) < 3);
  assert.ok(next[0].y < next[1].y);
  assert.equal(next[0].x, -13.4);
});

test('landing releases a short tail without adding new points and expired points disappear', () => {
  const next = advanceMagicTrail([{ x: -8, y: -17, age: 0 }], .02, 270, 0, -5, false);
  assert.equal(next.length, 1);
  assert.ok(next[0].y > -17);
  assert.deepEqual(advanceMagicTrail(next, TRAIL_LIFE, 270, 0, 0, false), []);
});

test('the first active frame starts at the current height without a ground-level segment', () => {
  assert.deepEqual(advanceMagicTrail([], .02, 270, -90, -90, true), [
    { x: -8, y: -102, age: 0 }
  ]);
});
