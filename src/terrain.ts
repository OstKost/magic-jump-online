/** Logical world coordinates: y=0 is the floor, negative y is above it. */
export interface TerrainObject { kind: string; x: number; width?: number; height?: number; passed?: boolean }
export interface TerrainBody { y: number; velocity: number; jumps: number; grounded?: boolean; fallUntil?: number; dashActive?: boolean }
export function moveBody(body: TerrainBody, objects: readonly TerrainObject[], speed: number, elapsed: number): 'fall' | 'land' | undefined {
  if ((body.fallUntil ?? 0) > elapsed) { body.y = 0; body.velocity = 0; body.grounded = true; return; }
  const previous = body.y;
  if (!body.dashActive) {
    body.velocity += 38;
  } else {
    body.velocity = Math.min(body.velocity, 10);
  }
  const next = previous + body.velocity * .02;
  const contains = (o: TerrainObject) => Math.abs(o.x - speed * .02 - 160) < (o.width ?? 32) / 2;
  const gap = !body.dashActive && objects.some(o => o.kind === 'gap' && contains(o));
  let surface = gap ? Infinity : 0;
  for (const o of objects) {
    const top = -(o.height ?? 110);
    if (o.kind === 'platform' && contains(o) && previous <= top + .1 && next >= top && body.velocity >= 0) surface = Math.min(surface, top);
  }
  body.grounded = next >= surface && body.velocity >= 0;
  body.y = body.grounded ? surface : next;
  if (body.grounded) { body.velocity = 0; body.jumps = 0; }
  if (body.y > 210) { body.y = 0; body.velocity = 0; body.jumps = 0; body.grounded = true; body.fallUntil = elapsed + 600; return 'fall'; }
  if (body.grounded && previous < surface - 1) return 'land';
}
export function collectBonus(y: number, ducking: boolean, obstacle: string, height?: number): boolean {
  if (height !== undefined) return Math.abs(y + height - 35) < 42;
  return obstacle === 'overhead' ? ducking && y === 0 : obstacle === 'none' ? y < -130 && y > -230 : y < -35 && y > -146;
}
