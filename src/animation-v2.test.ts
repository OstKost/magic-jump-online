import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnimationV2, chooseSpell, actionRandom } from './animation-v2.ts';
import { availableCharacters } from './characters.ts';

test('Sensei is available immediately without unlocking secret heroes', () => {
  assert.deepEqual(availableCharacters(false).map(x => x.index), [0,1,2,3,6]);
});
test('double jump preserves the first jump element and a new jump chooses again', () => {
  let choice = .99;
  const animation = new AnimationV2(() => choice);
  animation.beginJump(false); assert.equal(animation.jump, 'fire');
  choice = 0;
  animation.beginJump(true); assert.equal(animation.jump, 'fire');
  animation.beginJump(false); assert.equal(animation.jump, 'air');
  animation.beginSlide(); assert.equal(animation.slide, 'water');
  choice = .99; animation.beginSlide(); assert.equal(animation.slide, 'earth');
});
test('super attacks have a ten percent boundary and normal attacks cover four elements', () => {
  assert.equal(chooseSpell(() => .09999), 'harmony');
  for(const [roll, element] of [[.1,'fire'],[.3,'water'],[.6,'air'],[.9,'earth']] as const) assert.equal(chooseSpell(() => roll), element);
});
test('cast animation expires and hurt takes priority', () => {
  const animation = new AnimationV2(() => 0);
  animation.cast(100);
  const state = {hurt:false,airborne:false,double:false,duck:false,velocity:0};
  assert.equal(animation.frame(220,state),'cast-harmony-01');
  assert.match(animation.frame(220,{...state,hurt:true}),/^hit-/);
  assert.match(animation.frame(460,state),/^run-/);
  assert.deepEqual(Array.from({length:20},actionRandom(42)),Array.from({length:20},actionRandom(42)));
});

test('Stella has a ten percent burst boundary and both regular attacks', async () => {
  const { chooseStellaSpell, StellaAnimation } = await import('./animation-v2.ts');
  assert.equal(chooseStellaSpell(() => .099), 'burst');
  assert.equal(chooseStellaSpell(() => .1), 'projectile');
  assert.equal(chooseStellaSpell(() => .8), 'wave');
  const animation = new StellaAnimation(() => .05);
  animation.cast(100);
  assert.equal(animation.stellaSpell, 'burst');
  const state = { hurt: false, airborne: false, double: false, duck: false, velocity: 0 };
  assert.equal(animation.frame(100, state), 'cast-burst-00');
  assert.equal(animation.frame(450, state), 'cast-burst-03');
  assert.equal(animation.frame(500, { ...state, idle: true }), 'idle-02');
  assert.equal(animation.frame(500, { ...state, hurt: true }), 'hit-00');
  assert.equal(animation.frame(1200, { ...state, hurt: true }), 'hit-06');
});
