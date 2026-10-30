import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canCast, firstSpellTarget } from './combat.ts';

test('spell cooldown becomes ready exactly at its boundary', () => {
  assert.equal(canCast(1999, 2000), false);
  assert.equal(canCast(2000, 2000), true);
});

test('swept spell collision selects the nearest undefeated enemy in its lane', () => {
  const targets = [
    { x: 250, row: 0, defeated: false },
    { x: 180, row: 1, defeated: false },
    { x: 190, row: 0, defeated: true },
    { x: 220, row: 0, defeated: false },
  ];
  assert.equal(firstSpellTarget(targets, 0, 160, 300), targets[3]);
  assert.equal(firstSpellTarget(targets, 0, 300, 400), undefined);
  assert.equal(firstSpellTarget(targets, 0, 160, 180), undefined);
});

test('enemy routes are deterministic, contain both types and never carry a bonus', async () => {
  const { route } = await import('./rules.ts');
  const types = new Set<number>();
  for(let seed=0;seed<50;seed++){
    const first=route(seed,0,'medium'),second=route(seed,1,'medium');
    assert.deepEqual(first,route(seed,0,'medium'));
    const blockCounts=(plan:typeof first)=>plan.map(e=>`${e.kind}:${e.variant}`).sort();
    assert.deepEqual(blockCounts(first),blockCounts(second));
    for(const enemy of first.filter(e=>e.kind==='enemy')){
      types.add(enemy.variant);
      assert.equal(enemy.obstacle,'ground');
      assert.equal(first.some(e=>e.kind==='bonus'&&e.at===enemy.at),false);
    }
  }
  assert.deepEqual([...types].sort(),[0,1]);
});

test('every world has two distinct enemy types', async () => {
  const { ENEMIES } = await import('./combat.ts');
  const { WORLDS } = await import('./rules.ts');
  assert.equal(ENEMIES.length, WORLDS.length);
  for (const enemies of ENEMIES) assert.equal(new Set(enemies.map(enemy => enemy.key)).size, 2);
});
