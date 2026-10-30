export const LEVEL_SECONDS = 60;
export const JUMP_VELOCITY = -650;
export const GRAVITY = 1900;
export const WORLDS = [
  { name: 'Конфетный мир', icon: '🍭', subtitle: 'Там, где растут леденцы', sky: 0xf8dfea, ground: 0xe8b1c4, accent: '#e16b9b', speed: 270, obstacles: ['🍬', '🍭', '🌳'], bonus: '🍬' },
  { name: 'Волшебный лес', icon: '🌲', subtitle: 'Навстречу лесным секретам', sky: 0xe0eddf, ground: 0x9fbc96, accent: '#568c69', speed: 310, obstacles: ['🌳', '🌿', '🪵'], bonus: '🍓' },
  { name: 'Далёкий космос', icon: '🪐', subtitle: 'Выше самых ярких звёзд', sky: 0x292d50, ground: 0x66628e, accent: '#9081d9', speed: 350, obstacles: ['☄️', '⭐', '🪨'], bonus: '💎' },
];
export interface Player { lives: number; score: number; roundScore: number; invulnerable: number }
export function newPlayer(score = 0): Player { return { lives: 3, score, roundScore: 0, invulnerable: 0 }; }
export function award(p: Player, points: number) { const earned = p.lives > 0 ? points : Math.floor(points * .8); p.score += earned; p.roundScore += earned; }
export function hit(p: Player, time: number) { if (p.lives > 0 && time >= p.invulnerable) { p.lives--; p.invulnerable = time + 1000; return true; } return false; }
export function winner(players: Player[]): number | null { if (!players.length) return null; const best=Math.max(...players.map(p=>p.score)); const leaders=players.flatMap((p,i)=>p.score===best?[i]:[]); return leaders.length===1?leaders[0]:null; }
export type ObstacleType = 'ground' | 'overhead';
export function obstacleCollision(y: number, ducking: boolean, type: ObstacleType): boolean {
  const feet = -y;
  const head = feet + (ducking ? 66 : 102);
  const bottom = type === 'overhead' ? 76 : 0;
  const top = type === 'overhead' ? 112 : 43;
  return feet < top && head > bottom;
}
export interface Spawn { at: number; kind: 'obstacle' | 'bonus'; variant: number; obstacle?: ObstacleType }
export function schedule(seed: number): Spawn[] {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const result: Spawn[] = [];
  for (let at = 2200; at < 55000; at += 1700 + random() * 700) {
    const variant = Math.floor(random() * 4);
    result.push({ at, kind: 'obstacle', variant: variant % 3, obstacle: variant === 3 ? 'overhead' : 'ground' });
    if (random() > .25) result.push({ at, kind: 'bonus', variant: 0, obstacle: variant === 3 ? 'overhead' : 'ground' });
  }
  return result;
}

/** Equal opportunities and timing; each lane receives a different block order. */
export function route(seed: number, player: number): Spawn[] {
  const source = schedule(seed);
  const obstacles = source.filter(s => s.kind === 'obstacle');
  if (!obstacles.length) return [];
  const shift = player % obstacles.length;
  return obstacles.flatMap((slot, i) => {
    const block = obstacles[(i + shift) % obstacles.length];
    const events: Spawn[] = [{ ...block, at: slot.at }];
    if (source.some(s => s.kind === 'bonus' && s.at === block.at)) {
      events.push({ at: slot.at, kind: 'bonus', variant: 0, obstacle: block.obstacle });
    }
    return events;
  });
}
