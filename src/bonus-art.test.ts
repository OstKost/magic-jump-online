import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BONUS_FRAME_COUNT,
  BONUS_FRAME_MS,
  BONUS_FLOAT_AMPLITUDE,
  BONUS_FLOAT_PERIOD_MS,
  getBonusFloatOffset,
  getBonusGlowAlpha,
  getBonusFrameIndex,
  drawBonusGlow,
  drawSparkleStar,
  drawBonusFrame
} from './bonus-art.ts';

test('bonus frame configuration has 3 frames with consistent duration', () => {
  assert.equal(BONUS_FRAME_COUNT, 3);
  assert.ok(BONUS_FRAME_MS >= 150 && BONUS_FRAME_MS <= 240);
});

test('getBonusFloatOffset produces gentle vertical oscillation bounded by amplitude', () => {
  const amp = BONUS_FLOAT_AMPLITUDE;
  for (let t = 0; t <= 3200; t += 80) {
    const offset = getBonusFloatOffset(t, 0);
    assert.ok(offset >= -amp - 1e-9 && offset <= amp + 1e-9, `Offset ${offset} out of bounds at t=${t}`);
  }
});

test('different initial phases make bonus floating asynchronous', () => {
  const time = 400;
  const off1 = getBonusFloatOffset(time, 0);
  const off2 = getBonusFloatOffset(time, Math.PI / 2);
  const off3 = getBonusFloatOffset(time, Math.PI);
  assert.ok(Math.abs(off1 - off2) > 1.0, `off1 (${off1}) and off2 (${off2}) should be distinct`);
  assert.ok(Math.abs(off1 - off3) > 1.0, `off1 (${off1}) and off3 (${off3}) should be distinct`);
});

test('getBonusFloatOffset is strictly periodic over BONUS_FLOAT_PERIOD_MS', () => {
  const phase = 1.25;
  const t0 = 350;
  const v0 = getBonusFloatOffset(t0, phase);
  const v1 = getBonusFloatOffset(t0 + BONUS_FLOAT_PERIOD_MS, phase);
  assert.ok(Math.abs(v0 - v1) < 1e-9, `Periodicity violated: ${v0} vs ${v1}`);
});

test('getBonusGlowAlpha stays strictly within configured opacity bounds', () => {
  const min = 0.45, max = 0.68;
  for (let t = 0; t <= 2400; t += 60) {
    const a = getBonusGlowAlpha(t, 0, min, max);
    assert.ok(a >= min - 1e-9 && a <= max + 1e-9, `Alpha ${a} out of bounds at t=${t}`);
  }
});

test('getBonusFrameIndex deterministically cycles through 0, 1, 2', () => {
  assert.equal(getBonusFrameIndex(0), 0);
  assert.equal(getBonusFrameIndex(BONUS_FRAME_MS), 1);
  assert.equal(getBonusFrameIndex(BONUS_FRAME_MS * 2), 2);
  assert.equal(getBonusFrameIndex(BONUS_FRAME_MS * 3), 0);
  assert.equal(getBonusFrameIndex(BONUS_FRAME_MS * 4), 1);

  // Offset shift
  assert.equal(getBonusFrameIndex(0, BONUS_FRAME_MS), 1);
  assert.equal(getBonusFrameIndex(0, BONUS_FRAME_MS * 2), 2);
});

test('bonus canvas drawing functions execute without throwing on 2D context mock', () => {
  const calls: string[] = [];
  const mockCtx = {
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('beginPath'),
    closePath: () => calls.push('closePath'),
    arc: () => calls.push('arc'),
    fill: () => calls.push('fill'),
    stroke: () => calls.push('stroke'),
    fillRect: () => calls.push('fillRect'),
    clearRect: () => calls.push('clearRect'),
    moveTo: () => calls.push('moveTo'),
    lineTo: () => calls.push('lineTo'),
    translate: () => calls.push('translate'),
    scale: () => calls.push('scale'),
    ellipse: () => calls.push('ellipse'),
    fillText: () => calls.push('fillText'),
    drawImage: () => calls.push('drawImage'),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    font: '',
    textAlign: '',
    textBaseline: '',
    fillStyle: ''
  } as unknown as CanvasRenderingContext2D;

  drawBonusGlow(mockCtx, 64);
  drawSparkleStar(mockCtx, 32, 32);
  drawBonusFrame(mockCtx, 0, 0);
  drawBonusFrame(mockCtx, 0, 1);
  drawBonusFrame(mockCtx, 0, 2);

  assert.ok(calls.includes('save'));
  assert.ok(calls.includes('restore'));
  assert.ok(calls.includes('fill'));
});
