/** Action choices persist for the whole action, independent of render frequency. */
export const ELEMENTS = ['fire', 'water', 'air', 'earth'] as const;
export type Element = typeof ELEMENTS[number];
export type SpellElement = Element | 'harmony';
export const pickElement = <T>(choices: readonly T[], random = Math.random): T => choices[Math.min(choices.length - 1, Math.floor(Math.max(0, random()) * choices.length))];
export function chooseSpell(random = Math.random): SpellElement {
  return random() < .1 ? 'harmony' : pickElement(ELEMENTS, random);
}
export class AnimationV2 {
  idle: Element;
  jump: 'air' | 'fire' = 'air';
  slide: 'water' | 'earth' = 'water';
  spell: SpellElement = 'fire';
  castAt = -Infinity;
  private random: () => number;
  constructor(random = Math.random) { this.random = random; this.idle = pickElement(ELEMENTS, random); }
  beginJump(isDouble: boolean) { if (!isDouble) this.jump = pickElement(['air', 'fire'] as const, this.random); }
  beginSlide() { this.slide = pickElement(['water', 'earth'] as const, this.random); }
  cast(now: number) { this.spell = chooseSpell(this.random); this.castAt = now; return this.spell; }
  frame(now: number, state: { hurt: boolean; airborne: boolean; double: boolean; duck: boolean; velocity: number; idle?: boolean }) {
    const phase = (count: number, ms: number) => String(Math.floor(now / ms) % count).padStart(2, '0');
    if (state.hurt) return `hit-${phase(5, 130)}`;
    if (now - this.castAt < 360) return `cast-${this.spell}-${String(Math.min(2, Math.floor((now-this.castAt)/120))).padStart(2,'0')}`;
    if (state.airborne) return state.double ? `flip-${this.jump}-${phase(3, 100)}` : `jump-${this.jump}-${state.velocity < -150 ? '00' : state.velocity < 150 ? '01' : '02'}`;
    if (state.duck) return `duck-${this.slide}-${phase(3, 110)}`;
    if (state.idle) return `idle-${this.idle}-${phase(4, 180)}`;
    return `run-${phase(8, 83)}`;
  }
}

/** Stable action RNG allows all spectators to show the same elemental cast. */
export function actionRandom(seed: number) {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}

export type StellaSpell = 'projectile' | 'wave' | 'burst';
export function chooseStellaSpell(random = Math.random): StellaSpell {
  return random() < .1 ? 'burst' : pickElement(['projectile', 'wave'] as const, random);
}
export class StellaAnimation extends AnimationV2 {
  stellaSpell: StellaSpell = 'projectile';
  private stellaRandom: () => number;
  private hurtAt = -Infinity;
  private flipAt = 0;
  constructor(random = Math.random) { super(random); this.stellaRandom = random; }
  override cast(now: number) { this.stellaSpell = chooseStellaSpell(this.stellaRandom); this.castAt = now; return this.spell; }
  override frame(now: number, state: Parameters<AnimationV2['frame']>[1]) {
    const phase = (count: number, ms: number) => String(Math.floor(now / ms) % count).padStart(2, '0');
    if (state.hurt) {
      if (!Number.isFinite(this.hurtAt)) this.hurtAt = now;
      return `hit-${String(Math.min(6, Math.floor((now-this.hurtAt)/90))).padStart(2,'0')}`;
    }
    this.hurtAt = -Infinity;
    if (now-this.castAt < 360) {
      const count = this.stellaSpell === 'projectile' ? 5 : this.stellaSpell === 'wave' ? 3 : 4;
      return `cast-${this.stellaSpell}-${String(Math.min(count-1,Math.floor((now-this.castAt)/360*count))).padStart(2,'0')}`;
    }
    if (state.airborne) {
      if (state.double) { if (!this.flipAt) this.flipAt = now; return `flip-${String(Math.min(4,Math.floor((now-this.flipAt)/90))).padStart(2,'0')}`; }
      return `jump-${state.velocity < -150 ? '00' : state.velocity < 150 ? '01' : '03'}`;
    }
    this.flipAt = 0;
    if (state.duck) return `duck-${phase(7,90)}`;
    return state.idle ? `idle-${phase(4,180)}` : `run-${phase(8,83)}`;
  }
}
