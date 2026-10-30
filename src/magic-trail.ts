export interface TrailPoint { x: number; y: number; age: number }
export const TRAIL_LIFE = .24;

/** Keep the fresh ribbon close to its source while the older tip drifts away. */
export function advanceMagicTrail(
  points: TrailPoint[], dt: number, speed: number, lift: number,
  previousLift: number, active: boolean
): TrailPoint[] {
  const movement = lift - previousLift;
  const next = points.filter(point => point.age + dt < TRAIL_LIFE).map(point => {
    const age = point.age + dt;
    const follow = Math.max(0, 1 - age / TRAIL_LIFE);
    return { x: point.x - speed * dt, y: point.y + movement * follow * follow, age };
  });
  if (active) next.push({ x: -8, y: lift - 12, age: 0 });
  return next;
}
