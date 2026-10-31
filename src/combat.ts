/** Combat distances use the same logical pixels as the runner scene. */
export const SPELL_COOLDOWN_MS = 500;
export const SPELL_SPEED = 700;
export const SPELL_RANGE = 650;
export const ENEMY_REWARD = 25;
export const ENEMY_FALL_MS = 680;

export const DASH_COOLDOWN_MS = 2000;
export const DASH_DURATION_MS = 240;
export const DASH_DISTANCE_PX = 160;

export const ENEMIES = [
  [{ key: 'ninja', name: 'Ниндзя' }, { key: 'archer', name: 'Лучник' }],
  [{ key: 'gingerbread', name: 'Пряничный страж' }, { key: 'slime', name: 'Мармеладный слизень' }],
  [{ key: 'robot', name: 'Робот' }, { key: 'alien', name: 'Пришелец' }],
  [{ key: 'kikimora', name: 'Кикимора' }, { key: 'vodyanoy', name: 'Водяной' }],
  [{ key: 'sandworm', name: 'Песчаный червь' }, { key: 'desert-guard', name: 'Страж пустыни' }],
] as const;

export const SPELLS = {
  sofia: { name: 'Водяная сфера', color: 0x71cce8 },
  stella: { name: 'Огненный шар', color: 0xefaa76 },
  air: { name: 'Порыв ветра', color: 0xa2e0da },
  earth: { name: 'Камень', color: 0xa9c78c },
  kai: { name: 'Молния', color: 0xa855f7 },
  leya: { name: 'Сгусток листьев', color: 0x22c55e },
} as const;

export interface Projectile { x: number; distance: number; row: number }
export interface CombatTarget { x: number; row: number; defeated: boolean }

/** Swept collision prevents a fast projectile skipping an enemy between frames. */
export function firstSpellTarget<T extends CombatTarget>(
  targets: readonly T[], row: number, from: number, to: number, radius = 28,
): T | undefined {
  return targets.filter(target => !target.defeated && target.row === row &&
    target.x + radius >= from && target.x - radius <= to)
    .sort((a, b) => a.x - b.x)[0];
}

export function canCast(elapsed: number, readyAt: number): boolean {
  return elapsed >= readyAt;
}

export function canDash(elapsed: number, readyAt: number): boolean {
  return elapsed >= readyAt;
}
