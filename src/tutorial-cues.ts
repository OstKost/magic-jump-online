export type CueAction = 'jump' | 'double' | 'duck';
export interface TutorialCue {
  row: number;
  action: CueAction;
  offset: number;
  fadingAt?: number;
}
// Lead times include the 28px collision approach and a full safe jump arc.
export function cueOffset(action: CueAction, speed: number): number {
  return speed * (action === 'duck' ? .2 : action === 'double' ? .5 : .33);
}
export function cueInRange(cue: TutorialCue, x: number, speed: number): boolean {
  const seconds = (x - cue.offset - 160) / speed;
  return seconds <= .12 && seconds >= -(cue.action === 'double' ? .3 : .1);
}
export function consumeCue<T extends { x: number; cue?: TutorialCue }>(items: T[], row: number, action: CueAction, speed: number, time: number): void {
  const nearest = items.filter(item => item.cue && item.cue.row === row && item.cue.action === action && item.cue.fadingAt === undefined && cueInRange(item.cue, item.x, speed))
    .sort((a, b) => Math.abs(a.x - a.cue!.offset - 160) - Math.abs(b.x - b.cue!.offset - 160))[0];
  if (nearest?.cue) nearest.cue.fadingAt = time;
}
export function cueFrame(cue: TutorialCue, x: number, speed: number, time: number) {
  if (cue.fadingAt === undefined && x - cue.offset < 160 - speed * (cue.action === 'double' ? .3 : .1)) cue.fadingAt = time;
  const progress = cue.fadingAt === undefined ? 0 : Math.min(1, (time - cue.fadingAt) / 150);
  return { x: x - cue.offset, bob: 4 * Math.sin(time * Math.PI * 2 / 1500), alpha: .95 * (1 - progress) };
}
