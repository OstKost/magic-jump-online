export const LEVEL_SECONDS = 60;
export const JUMP_VELOCITY = -650;
export const GRAVITY = 1900;
export const MAX_JUMPS = 2;

export type DifficultyKey = 'easy' | 'medium' | 'hard';

export interface DifficultyConfig {
  key: DifficultyKey;
  name: string;
  badge: string;
  icon: string;
  levelSeconds: number;
  lives: number;
  speedMultiplier: number;
  minInterval: number;
  randInterval: number;
  description: string;
  obstacleLabel: string;
}

export const DIFFICULTIES: Record<DifficultyKey, DifficultyConfig> = {
  easy: {
    key: 'easy',
    name: 'Лёгкий',
    badge: 'Для самых маленьких',
    icon: '🌸',
    levelSeconds: 20,
    lives: 4,
    speedMultiplier: 0.9,
    minInterval: 1700,
    randInterval: 700,
    description: '20 секунд · 4 жизни · спокойная скорость ×0.9',
    obstacleLabel: 'Препятствия как обычно',
  },
  medium: {
    key: 'medium',
    name: 'Средний',
    badge: 'Золотая середина',
    icon: '⭐',
    levelSeconds: 40,
    lives: 3,
    speedMultiplier: 1.0,
    minInterval: 1450,
    randInterval: 600,
    description: '40 секунд · 3 жизни · обычная скорость ×1.0',
    obstacleLabel: 'Препятствий чуть больше',
  },
  hard: {
    key: 'hard',
    name: 'Сложный',
    badge: 'Испытание стихий',
    icon: '🔥',
    levelSeconds: 50,
    lives: 3,
    speedMultiplier: 1.05,
    minInterval: 1200,
    randInterval: 500,
    description: '50 секунд · 3 жизни · скорость ×1.05 · частые препятствия',
    obstacleLabel: 'Частые препятствия (по силам 8–10 лет)',
  },
};

export function canJump(y: number, jumps: number, ducking = false): boolean {
  if (ducking) return false;
  return y >= -0.1 || jumps < MAX_JUMPS;
}
export function jumpVelocity(y: number, jumps: number): { velocity: number; jumps: number; isDouble: boolean } | null {
  if (y >= -0.1) {
    return { velocity: JUMP_VELOCITY, jumps: 1, isDouble: false };
  }
  if (jumps < MAX_JUMPS) {
    return { velocity: JUMP_VELOCITY, jumps: Math.max(jumps + 1, 2), isDouble: true };
  }
  return null;
}
export const WORLDS = [
  { name: 'Горы небожителей', icon: '⛰️', subtitle: 'Над облаками, к горным храмам', sky: 0xb5d2ef, ground: 0x736653, accent: '#b87842', speed: 270, obstacles: ['🪨', '🌿', '🪵'], bonus: '🍁' },
  { name: 'Конфетный мир', icon: '🍭', subtitle: 'Там, где растут леденцы', sky: 0xf8dfea, ground: 0xe8b1c4, accent: '#e16b9b', speed: 310, obstacles: ['🍬', '🍭', '🌳'], bonus: '🍬' },
  { name: 'Млечный путь', icon: '🪐', subtitle: 'Выше самых ярких звёзд', sky: 0x292d50, ground: 0x66628e, accent: '#9081d9', speed: 350, obstacles: ['☄️', '⭐', '🪨'], bonus: '💎' },
];
export interface Player { lives: number; score: number; roundScore: number; invulnerable: number }
export function newPlayer(score = 0, lives = 3): Player { return { lives, score, roundScore: 0, invulnerable: 0 }; }
export function award(p: Player, points: number) { const earned = p.lives > 0 ? points : Math.floor(points * .8); p.score += earned; p.roundScore += earned; }
export function hit(p: Player, time: number) { if (p.lives > 0 && time >= p.invulnerable) { p.lives--; p.invulnerable = time + 1000; return true; } return false; }
export function winner(players: Player[]): number | null { if (!players.length) return null; const best=Math.max(...players.map(p=>p.score)); const leaders=players.flatMap((p,i)=>p.score===best?[i]:[]); return leaders.length===1?leaders[0]:null; }
export type ObstacleType = 'ground' | 'overhead' | 'none';
export function obstacleCollision(y: number, ducking: boolean, type: ObstacleType): boolean {
  if (type === 'none') return false;
  const feet = -y;
  const head = feet + (ducking ? 66 : 102);
  const bottom = type === 'overhead' ? 76 : 0;
  const top = type === 'overhead' ? 112 : 43;
  return feet < top && head > bottom;
}
export interface Spawn { at: number; kind: 'obstacle' | 'bonus'; variant: number; obstacle?: ObstacleType }
export function schedule(seed: number, difficulty?: DifficultyKey): Spawn[] {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const result: Spawn[] = [];
  let minInterval = 1700;
  let randInterval = 700;
  let maxAt = 55000;

  if (difficulty === 'easy') {
    minInterval = 1700;
    randInterval = 700;
    maxAt = 16000;
  } else if (difficulty === 'medium') {
    minInterval = 1450;
    randInterval = 600;
    maxAt = 36000;
  } else if (difficulty === 'hard') {
    minInterval = 1200;
    randInterval = 500;
    maxAt = 46000;
  }

  for (let at = 2200; at < maxAt; at += minInterval + random() * randInterval) {
    const variant = Math.floor(random() * 5);
    if (variant === 4) {
      result.push({ at, kind: 'bonus', variant: 0, obstacle: 'none' });
    } else {
      const obstacle: ObstacleType = variant === 3 ? 'overhead' : 'ground';
      result.push({ at, kind: 'obstacle', variant: variant % 3, obstacle });
      if (random() > .25) result.push({ at, kind: 'bonus', variant: 0, obstacle });
    }
  }
  return result;
}

/** Equal opportunities and timing; each lane receives a different block order. */
export function route(seed: number, player: number, difficulty?: DifficultyKey): Spawn[] {
  const source = schedule(seed, difficulty);
  const times = [...new Set(source.map(s => s.at))].sort((a, b) => a - b);
  if (!times.length) return [];
  const shift = player % times.length;
  const blocks = times.map(at => source.filter(s => s.at === at));
  return times.flatMap((targetAt, i) => {
    const block = blocks[(i + shift) % blocks.length];
    return block.map(e => ({ ...e, at: targetAt }));
  });
}
