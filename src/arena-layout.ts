// Shared running surface for scenery and gameplay.
export function arenaGround(height: number, count: number, row: number): number {
  return height * ((row + .92) / count);
}

export function arenaElementScale(height: number, count: number): number {
  // Two-player artwork and jump heights share the panorama's 300px lane.
  return count === 1 ? 1 : height / count / 300;
}
