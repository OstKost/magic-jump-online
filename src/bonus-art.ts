import { WORLDS } from './rules.ts';

export const BONUS_FRAME_COUNT = 3;
export const BONUS_FRAME_MS = 180;
export const BONUS_FLOAT_AMPLITUDE = 3.5;
export const BONUS_FLOAT_PERIOD_MS = 1600;

/**
 * Calculates vertical bobbing offset in pixels for a floating bonus.
 */
export function getBonusFloatOffset(
  timeMs: number,
  phase: number,
  amplitude = BONUS_FLOAT_AMPLITUDE,
  periodMs = BONUS_FLOAT_PERIOD_MS
): number {
  return Math.sin((timeMs * Math.PI * 2) / periodMs + phase) * amplitude;
}

/**
 * Calculates pulsing alpha for the bonus glow halo.
 */
export function getBonusGlowAlpha(
  timeMs: number,
  phase: number,
  minAlpha = 0.45,
  maxAlpha = 0.68,
  periodMs = 1200
): number {
  const norm = (Math.sin((timeMs * Math.PI * 2) / periodMs + phase) + 1) / 2;
  return minAlpha + norm * (maxAlpha - minAlpha);
}

/**
 * Calculates the current animation frame index (0, 1, or 2).
 */
export function getBonusFrameIndex(timeMs: number, offsetMs = 0): number {
  const raw = Math.floor((timeMs + offsetMs) / BONUS_FRAME_MS) % BONUS_FRAME_COUNT;
  return (raw + BONUS_FRAME_COUNT) % BONUS_FRAME_COUNT;
}

/**
 * Draws a soft 4-point sparkle star / diamond twinkle flare.
 */
export function drawSparkleStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR = 9, innerR = 3) {
  ctx.save();
  const radial = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR * 1.4);
  radial.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  radial.addColorStop(0.35, 'rgba(255, 230, 140, 0.6)');
  radial.addColorStop(1, 'rgba(255, 200, 80, 0)');
  ctx.fillStyle = radial;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR * 1.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle - 0.28) * innerR, cy + Math.sin(angle - 0.28) * innerR);
    ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
    ctx.lineTo(cx + Math.cos(angle + 0.28) * innerR, cy + Math.sin(angle + 0.28) * innerR);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Draws a soft glowing radial aura.
 */
export function drawBonusGlow(ctx: CanvasRenderingContext2D, size = 64, color = 'rgba(255, 220, 120, ') {
  ctx.save();
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, `${color}0.75)`);
  grad.addColorStop(0.35, `${color}0.42)`);
  grad.addColorStop(0.7, `${color}0.14)`);
  grad.addColorStop(1, `${color}0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}

/**
 * Draws the base icon of a bonus for a given world.
 */
function drawBaseIcon(ctx: CanvasRenderingContext2D, world: number, baseImage?: CanvasImageSource) {
  if (world >= 3 && baseImage) {
    ctx.drawImage(baseImage, 6, 6, 52, 52);
  } else {
    ctx.font = '36px Arial, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(WORLDS[world]?.bonus ?? '⭐', 32, 34);
  }
}

/**
 * Renders one of the 3 animation frames for a bonus onto a 64x64 canvas region.
 * Frame 0: Base bonus item in neutral state.
 * Frame 1: Bonus item with 3D turn/compression and diagonal glint sheen.
 * Frame 2: Bonus item with radiant 4-point sparkle star at the peak/corner.
 */
export function drawBonusFrame(
  ctx: CanvasRenderingContext2D,
  world: number,
  frame: number,
  baseImage?: CanvasImageSource
) {
  ctx.clearRect(0, 0, 64, 64);
  if (frame === 0) {
    drawBaseIcon(ctx, world, baseImage);
  } else if (frame === 1) {
    ctx.save();
    // Slight horizontal compression simulating 3D turn / gleam tilt
    ctx.translate(32, 32);
    ctx.scale(0.92, 1.0);
    ctx.translate(-32, -32);
    drawBaseIcon(ctx, world, baseImage);

    // Diagonal glint highlight
    const glint = ctx.createLinearGradient(14, 14, 46, 46);
    glint.addColorStop(0, 'rgba(255, 255, 255, 0)');
    glint.addColorStop(0.5, 'rgba(255, 255, 255, 0.65)');
    glint.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glint;
    ctx.beginPath();
    ctx.ellipse(32, 32, 22, 12, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    drawBaseIcon(ctx, world, baseImage);
    // Sparkling diamond twinkle star on top-right shoulder
    drawSparkleStar(ctx, 44, 16, 9, 3);
  }
}

/**
 * Pre-generates the bonus textures and 3-frame spritesheets in Phaser.
 */
export function createBonusTextures(scene: Phaser.Scene) {
  if (!scene.textures.exists('bonus-glow')) {
    const glowTex = scene.textures.createCanvas('bonus-glow', 64, 64);
    if (glowTex) {
      drawBonusGlow(glowTex.context, 64);
      glowTex.refresh();
    }
  }

  for (let w = 0; w < WORLDS.length; w++) {
    const key = `bonus-anim-${w}`;
    if (!scene.textures.exists(key)) {
      const tex = scene.textures.createCanvas(key, 192, 64);
      if (tex) {
        let baseImage: CanvasImageSource | undefined;
        if (w >= 3 && scene.textures.exists(`bonus-${w}`)) {
          baseImage = scene.textures.get(`bonus-${w}`).getSourceImage() as CanvasImageSource;
        }
        for (let frame = 0; frame < BONUS_FRAME_COUNT; frame++) {
          tex.context.save();
          tex.context.translate(frame * 64, 0);
          drawBonusFrame(tex.context, w, frame, baseImage);
          tex.context.restore();
          tex.add(frame, 0, frame * 64, 0, 64, 64);
        }
        tex.refresh();
      }
    }
  }
}
