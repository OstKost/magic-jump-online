import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ELEMENT_FIREFLY_PALETTES,
  createFirefly,
  updateFirefly,
  type Firefly,
} from './menu-fireflies.ts';

test('firefly palettes contain all 5 elements with harmonious colors', () => {
  assert.equal(ELEMENT_FIREFLY_PALETTES.length, 5);
  const elements = ELEMENT_FIREFLY_PALETTES.map(p => p.element);
  assert.deepEqual(elements, ['water', 'fire', 'air', 'earth', 'lightning']);
});

test('createFirefly initializes within bounds and assigns elemental palette', () => {
  const f = createFirefly(800, 600, 0);
  assert.ok(f.x >= 0 && f.x <= 800);
  assert.ok(f.y >= 0 && f.y <= 600);
  assert.equal(f.palette.element, 'water');
  assert.equal(f.trail.length, 0);

  const f1 = createFirefly(800, 600, 1);
  assert.equal(f1.palette.element, 'fire');
});

test('updateFirefly moves firefly, builds trail and limits trail length', () => {
  const f = createFirefly(800, 600, 0);
  const startX = f.x;
  const startY = f.y;

  updateFirefly(f, 0.1, 800, 600, 5);
  assert.notEqual(f.x, startX);
  assert.notEqual(f.y, startY);
  assert.equal(f.trail.length, 1);
  assert.equal(f.trail[0].x, startX);
  assert.equal(f.trail[0].y, startY);

  // Advance multiple steps
  for (let i = 0; i < 10; i++) {
    updateFirefly(f, 0.1, 800, 600, 5);
  }
  assert.equal(f.trail.length, 5);
  assert.ok(f.trail[0].alpha > f.trail[4].alpha);
});

test('updateFirefly wraps smoothly around borders with buffer', () => {
  const f: Firefly = {
    x: 830,
    y: 300,
    vx: 100,
    vy: 0,
    baseRadius: 3,
    palette: ELEMENT_FIREFLY_PALETTES[0],
    phase: 0,
    pulseSpeed: 2,
    trail: [],
  };

  updateFirefly(f, 0.1, 800, 600, 5);
  // After exceeding width + 24 (824), wraps to -24
  assert.ok(f.x < 10);
});
