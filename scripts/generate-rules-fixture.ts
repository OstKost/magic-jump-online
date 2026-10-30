import { firstSpellTarget } from '../src/combat.ts';
import {writeFileSync} from 'node:fs';
import {route,obstacleCollision,award,hit,newPlayer} from '../src/rules.ts';
const seed=42;const routes=[route(seed,0),route(seed,1)];
const readyAt=[0,0];let shots:{x:number;distance:number;row:number}[]=[];
const players=[newPlayer(),newPlayer()];const bodies=players.map(()=>({y:0,velocity:0,held:false,ducking:false,jumps:0}));
const logs:{tick:number;player:number;kind:string;pressed:boolean}[]=[];
for(let tick=0;tick<3000;tick++){if(tick%110===0)logs.push({tick,player:0,kind:'cast',pressed:true});if(tick%83===0)logs.push({tick,player:0,kind:'jump',pressed:true});if(tick%101===0)logs.push({tick,player:1,kind:'duck',pressed:true});if(tick%101===44)logs.push({tick,player:1,kind:'duck',pressed:false});}
const items:{x:number;player:number;kind:string;obstacle:'ground'|'overhead'|'none';passed:boolean}[]=[];const next=[0,0];let cursor=0;
for(let tick=0;tick<3000;tick++){
 while(cursor<logs.length&&logs[cursor].tick===tick){
  const a=logs[cursor++];const b=bodies[a.player];
  if(a.kind==='cast'){if(tick*20>=readyAt[a.player]){readyAt[a.player]=tick*20+2000;shots.push({x:160,distance:0,row:a.player});}continue;}
  if(a.kind==='duck')b.held=a.pressed;
  else if(!b.held){
   if(b.y>=-.1){b.velocity=-650;b.jumps=1;}
   else if(b.jumps<2){b.velocity=-650;b.jumps=2;}
  }
 }
 const elapsed=(tick+1)*20;
 routes.forEach((plan,i)=>{while(next[i]<plan.length&&plan[next[i]].at<=elapsed){const e=plan[next[i]++];items.push({x:1150,player:i,kind:e.kind,obstacle:e.obstacle??'ground',passed:false})}});
 bodies.forEach(b=>{b.velocity+=1900*.02;b.y=Math.min(0,b.y+b.velocity*.02);if(b.y===0){b.velocity=0;b.jumps=0;}b.ducking=b.y===0&&b.held});
 for(const shot of shots){
  const from=shot.x,travel=Math.min(14,650-shot.distance);shot.x+=travel;shot.distance+=travel;
  const targets=items.filter(i=>i.kind==='enemy'&&!i.passed).map(item=>({x:item.x-270*.02,row:item.player,defeated:false,item}));
  const target=firstSpellTarget(targets,shot.row,from-270*.02,shot.x);
  if(target){target.item.passed=true;award(players[shot.row],25);shot.distance=650;}
 }
 shots=shots.filter(shot=>shot.distance<650);
 for(const o of items){o.x-=270*.02;const b=bodies[o.player],p=players[o.player];if(!o.passed&&Math.abs(o.x-160)<(o.kind==='bonus'?30:28)){if((o.kind==='obstacle'||o.kind==='enemy')&&obstacleCollision(b.y,b.ducking,o.obstacle)){o.passed=true;hit(p,elapsed)}if(o.kind==='bonus'&&(o.obstacle==='overhead'?b.ducking&&b.y===0:o.obstacle==='none'?b.y< -130&&b.y> -230:b.y< -35&&b.y> -146)){award(p,25);o.passed=true}}if(!o.passed&&o.x<120){if(o.kind==='obstacle')award(p,10);o.passed=true}}
}
writeFileSync(new URL('../server/testdata/rules.json',import.meta.url),JSON.stringify({seed,routes,logs,players},null,2)+'\n');
