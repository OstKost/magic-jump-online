import { readFileSync, writeFileSync } from 'node:fs';
import { OnlineEngine } from '../src/online-engine.ts';
import { route, worldOrder, DIFFICULTIES, type DifficultyKey } from '../src/rules.ts';
const seed=42;
const engines=[0,1].map(player=>new OnlineEngine(seed,player,0,undefined));
const logs:{tick:number;player:number;kind:'cast'|'jump'|'duck';pressed:boolean}[]=[];
for(let tick=0;tick<3000;tick++){
  if(tick%110===0)logs.push({tick,player:0,kind:'cast',pressed:true});
  if(tick%83===0)logs.push({tick,player:0,kind:'jump',pressed:true});
  if(tick%101===0)logs.push({tick,player:1,kind:'duck',pressed:true});
  if(tick%101===44)logs.push({tick,player:1,kind:'duck',pressed:false});
}
let cursor=0;
for(let tick=0;tick<3000;tick++){
  while(cursor<logs.length&&logs[cursor].tick===tick){const a=logs[cursor++];engines[a.player].input(a.kind,a.pressed);}
  engines.forEach(engine=>engine.step());
}
fixture('rules.json', {seed,routes:[route(seed,0),route(seed,1)],logs,players:engines.map(e=>e.body)});

// A separate matrix covers every catalog world, difficulty and multiple seeds.
// --check verifies both fixtures without modifying either file.

function fixture(name: string, value: unknown) {
  const path = new URL(`../server/testdata/${name}`, import.meta.url);
  const data = JSON.stringify(value, null, name === 'parity.json' ? undefined : 2) + '\n';
  if (process.argv.includes('--check')) {
    if (readFileSync(path, 'utf8') !== data) throw new Error(`Fixture drift: ${name}`);
  } else writeFileSync(path, data);
}
const cases = [];
for (const seed of [0, 42, 987654321]) for (const world of [0, 1, 2, 3, 4]) for (const difficulty of ['easy', 'medium', 'hard'] as DifficultyKey[]) {
  const engines = [0, 1].map(player => new OnlineEngine(seed, player, world, difficulty));
  const logs = [];
  const snapshots = [];
  const ticks = DIFFICULTIES[difficulty].levelSeconds * 50;
  for (let tick = 0; tick < ticks; tick++) {
    for (let player = 0; player < 2; player++) {
      const input = (kind: 'cast' | 'jump' | 'duck' | 'dash', pressed = true) => {
        logs.push({ tick, player, kind, pressed }); engines[player].input(kind, pressed);
      };
      if (tick % 29 === player) input('cast');
      if (tick % 67 === player || tick % 67 === 14 + player) input('jump');
      if (tick % 113 === player) input('dash');
      if (tick % 101 === player) input('duck');
      if (tick % 101 === 24 + player) input('duck', false);
    }
    engines.forEach(engine => engine.step());
    if (tick % 137 === 0 || tick === ticks - 1) snapshots.push({ tick: tick + 1, players: engines.map(e => {
      const { y, velocity, lives, score, roundScore, grounded, jumps, readyAt, readyDashAt, dashUntil, duck, held, immune, fallUntil } = e.body;
      return { y, velocity, lives, score, roundScore, grounded: !!grounded, jumps, readyAt, readyDashAt, dashUntil, duck, held, immune, fallUntil: fallUntil ?? 0 };
    }) });
  }
  cases.push({ seed, world, order: worldOrder(seed), difficulty, ticks, logs, snapshots, routes: [route(seed, 0, difficulty), route(seed, 1, difficulty)] });
}
fixture('parity.json', cases);
