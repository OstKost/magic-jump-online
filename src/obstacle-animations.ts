import { animationData } from './obstacle-animation-data.ts';

export interface ObstacleAnimation {
  path: string;
  width: number;
  height: number;
  originX: number;
  originY: number;
  scale: number;
  fps: number;
  count: number;
  defeatStart: number | null;
}

export const OBSTACLE_ANIMATIONS: Readonly<Record<string, ObstacleAnimation>> = animationData;

/** Use the event's time, not lane order or wall time, in both renderers. */
export function overheadVariant(world: number, at: number): number {
  return Math.abs(Math.floor(at / 1900)) % (world >= 3 ? 2 : 4);
}

export function obstacleAnimationKey(world: number, kind: string, obstacle: string, variant: number, at: number, enemyKey?: string): string {
  if (kind === 'enemy') return `enemy-${enemyKey}`;
  if (obstacle === 'overhead') return `overhead-${world}-${overheadVariant(world, at)}`;
  return world >= 3 ? `ground-${world}-${variant % 3}` : ['rock', 'stakes', 'log'][variant % 3];
}

export function obstaclePhase(at: number, offset = 0): number {
  return Math.abs(Math.round(at / 20) + Math.round(offset)) % 8;
}

export function obstacleFrame(animation: ObstacleAnimation, elapsed: number, phase: number, defeatedAt?: number): number {
  if (defeatedAt !== undefined && animation.defeatStart !== null) {
    return animation.defeatStart + Math.min(2, Math.floor(Math.max(0, elapsed - defeatedAt) / 160));
  }
  return (Math.floor(Math.max(0, elapsed) * animation.fps / 1000) + phase) % animation.count;
}

export function obstacleFrameRect(animation: ObstacleAnimation, frame: number) {
  return { x: frame % 4 * animation.width, y: Math.floor(frame / 4) * animation.height, width: animation.width, height: animation.height };
}
