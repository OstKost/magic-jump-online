import { actionRandom, chooseStellaSpell } from './animation-v2.ts';
import { moveBody, collectBonus } from './terrain.ts';
import { DIFFICULTIES, JUMP_VELOCITY, route, obstacleCollision, type DifficultyKey } from './rules.ts';

export interface OnlineBody {
  grounded?: boolean; fallUntil?: number; dashActive?: boolean; lives: number; score: number; roundScore: number; y: number; velocity: number;
  duck: boolean; held: boolean; immune: number; readyAt: number; readyDashAt: number; dashUntil: number; jumps: number;
}
export interface OnlineItem {
  width?: number; height?: number; x: number; kind: string; obstacle: string; variant: number; passed: boolean; defeatedAt?: number;
}
export interface OnlineShot { y: number; x: number; distance: number; burstAt?: number }

/** A single player's simulation. No clock, transport or remote state dependencies. */
export class OnlineEngine {
  tick = 0;
  next = 0;
  items: OnlineItem[] = [];
  projectiles: OnlineShot[] = [];
  readonly plan;
  readonly body: OnlineBody;

  readonly world: number;
  readonly player: number;
  readonly hero: number;
  readonly difficulty: DifficultyKey | undefined;
  constructor(seed: number, player: number, world: number, difficulty: DifficultyKey | undefined, score = 0, hero = player) {
    this.player=player;this.hero=hero;this.world=world;this.difficulty=difficulty;
    this.plan = route(seed, player, difficulty);
    this.body = { lives: (difficulty?DIFFICULTIES[difficulty].lives:3), score, roundScore: 0, y: 0, velocity: 0, duck: false, held: false, immune: 0, readyAt: 0, readyDashAt: 0, dashUntil: 0, jumps: 0 };
  }

  get finished() { return this.tick >= (this.difficulty?DIFFICULTIES[this.difficulty].levelSeconds:60) * 50; }

  input(kind: 'jump' | 'duck' | 'cast' | 'dash', pressed = false) {
    if (this.finished) return;
    const p = this.body;
    if (kind === 'duck') p.held = pressed;
    if (kind === 'jump' && p.y<=0 && !p.held && (p.grounded || p.y >= -.1 || p.jumps < 2)) {
      p.jumps = p.grounded || p.y >= -.1 ? 1 : 2;
      p.velocity = JUMP_VELOCITY;
    }
    if (kind === 'cast' && this.tick * 20 >= p.readyAt) {
      p.readyAt = this.tick * 20 + 500;
      this.projectiles.push({ x: 160, distance: 0, y: p.y - 30, ...(this.hero===1&&chooseStellaSpell(actionRandom(p.readyAt+this.player*7919))==='burst'?{burstAt:this.tick*20+360}:{}) });
    }
    if (kind === 'dash' && this.tick * 20 >= p.readyDashAt) {
      p.readyDashAt = this.tick * 20 + 2000;
      p.dashUntil = this.tick * 20 + 240;
    }
  }

  step() {
    if (this.finished) return;
    const elapsed = ++this.tick * 20;
    const speed = [270, 310, 350, 350, 350][this.world] * (this.difficulty?DIFFICULTIES[this.difficulty].speedMultiplier:1);
    const p = this.body;
    const award = (points: number) => {
      const earned = p.lives === 0 ? Math.floor(points * .8) : points;
      p.score += earned; p.roundScore += earned;
    };
    while (this.next < this.plan.length && this.plan[this.next].at <= elapsed) {
      const event = this.plan[this.next++];
      this.items.push({ ...event, obstacle: event.obstacle ?? 'none', x: 1150+(event.offset??0), passed: false });
    }
    p.dashActive = elapsed < p.dashUntil;
    const motion=moveBody(p,this.items,speed,elapsed);
    if(motion==='fall' && p.lives>0 && elapsed>=p.immune && elapsed >= p.dashUntil){p.lives--;p.immune=elapsed+1000;}
    p.duck=!!p.grounded&&p.held;
    this.projectiles = this.projectiles.filter(shot => {
      if(shot.burstAt!==undefined){
        if(elapsed<shot.burstAt)return true;
        const target=this.items.filter(o=>o.kind==='enemy'&&!o.passed&&o.x>=0&&o.x<=1150).sort((a,b)=>Math.abs(a.x-160)-Math.abs(b.x-160))[0];
        if(target){target.passed=true;target.defeatedAt=elapsed;award(25);}
        return false;
      }
      const from = shot.x;
      const travel = Math.min(14, 650 - shot.distance);
      shot.x += travel; shot.distance += travel;
      const target = this.items.filter(o => o.kind === 'enemy' && Math.abs(shot.y+35)<65 && !o.passed && o.x + 28 >= from && o.x - 28 <= shot.x + speed * .02).sort((a, b) => a.x - b.x)[0];
      if (target) { target.passed = true; target.defeatedAt = elapsed; award(25); return false; }
      return shot.distance < 650;
    });
    const dashX = elapsed < p.dashUntil ? 160 + 160 * Math.sin(Math.pow((elapsed - (p.dashUntil - 240)) / 240, .75) * Math.PI) : 160;
    for (const o of this.items) {
      o.x -= speed * .02;
      if (!o.passed && (Math.abs(o.x - 160) < (o.kind === 'bonus' ? 30 : 28) || Math.abs(o.x - dashX) < (o.kind === 'bonus' ? 32 : 30))) {
        if ((o.kind === 'obstacle' || o.kind === 'enemy') && obstacleCollision(p.y, p.duck, o.obstacle as 'ground' | 'overhead' | 'none')) {
          o.passed = true;
          if (o.kind === 'enemy' && p.duck) {
            o.defeatedAt = elapsed;
            award(25);
          } else if (elapsed < p.dashUntil) {
            award(15);
          } else if (p.lives > 0 && elapsed >= p.immune) {
            p.lives--; p.immune = elapsed + 1000;
          }
        }
        if (o.kind === 'bonus' && collectBonus(p.y,p.duck,o.obstacle,o.height)) {
          award(25); o.passed = true;
        }
      }
      if(elapsed >= p.dashUntil && (o.kind==='puddle'||o.kind==='fire')&&(Math.abs(o.x-160)<(o.width??260)/2||Math.abs(o.x-dashX)<(o.width??260)/2)&&p.y>-25&&p.lives>0&&elapsed>=p.immune){p.lives--;p.immune=elapsed+1000;}
      if (!o.passed && o.x < 120) { if (o.kind === 'obstacle') award(10); o.passed = true; }
    }
    this.items = this.items.filter(o => o.x >= -Math.max(50,o.width??0));
  }
}
