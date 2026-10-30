import { test } from 'node:test';
import assert from 'node:assert/strict';
import { obstacleCollision, award, hit, newPlayer, schedule, route, winner, GRAVITY, JUMP_VELOCITY } from './rules.ts';
test('damage has one second immunity and never goes below zero',()=>{const p=newPlayer();assert.equal(hit(p,0),true);assert.equal(hit(p,500),false);assert.equal(p.lives,2);hit(p,1000);hit(p,2000);assert.equal(hit(p,3000),false);assert.equal(p.lives,0);});
test('ghost players earn reduced points; next level resets lives and keeps total',()=>{const p=newPlayer();award(p,10);award(p,25);assert.equal(p.score,35);hit(p,0);hit(p,1000);hit(p,2000);award(p,25);assert.equal(p.score,55);const next=newPlayer(p.score);assert.equal(next.lives,3);assert.equal(next.roundScore,0);assert.equal(next.score,55);});
test('winner follows total points and supports draw',()=>{const a=newPlayer(100),b=newPlayer(100);assert.equal(winner([a,b]),null);award(b,25);assert.equal(winner([a,b]),1);award(a,50);assert.equal(winner([a,b]),0);});
test('identical seeds give identical fair schedules with safe spacing',()=>{assert.deepEqual(schedule(42),schedule(42));for(let seed=0;seed<100;seed++){const events=schedule(seed).filter(s=>s.kind==='obstacle');for(let i=1;i<events.length;i++)assert.ok(events[i].at-events[i-1].at>=1700);assert.ok(events[0].at>=2200);assert.ok(events.at(-1)!.at+(1150-120)/270*1000<60000);}});
test('jump clears obstacles and reaches bonus height',()=>{const maxHeight=JUMP_VELOCITY**2/(2*GRAVITY);const flight=-2*JUMP_VELOCITY/GRAVITY;assert.ok(maxHeight>100);assert.ok(flight<1.7);});
test('duck clears overhead obstacles but cannot clear ground obstacles',()=>{
  assert.equal(obstacleCollision(0,false,'overhead'),true);
  assert.equal(obstacleCollision(0,true,'overhead'),false);
  assert.equal(obstacleCollision(0,true,'ground'),true);
  assert.equal(obstacleCollision(0,false,'ground'),true);
  assert.equal(obstacleCollision(-44,false,'ground'),false);
  assert.equal(obstacleCollision(-80,false,'overhead'),true);
  assert.equal(obstacleCollision(-112,false,'overhead'),false);
  assert.equal(obstacleCollision(-15,true,'overhead'),true);
});
test('schedule mixes overhead and ground obstacles and places duck bonuses below overhead obstacles',()=>{
  let overhead=0,ground=0;
  for(let seed=0;seed<100;seed++){
    const plan=schedule(seed);
    for(const event of plan.filter(s=>s.kind==='obstacle')){
      if(event.obstacle==='overhead'){
        overhead++;
        for(const bonus of plan.filter(s=>s.kind==='bonus'&&s.at===event.at)) assert.equal(bonus.obstacle,'overhead');
      }else ground++;
    }
  }
  assert.ok(overhead>0&&ground>0);
});

test('independent routes preserve timing, action counts and available scores',()=>{
 for(let seed=0;seed<100;seed++){const plans=[0,1,2,3].map(i=>route(seed,i));const summarize=(plan:ReturnType<typeof route>)=>({times:plan.filter(s=>s.kind==='obstacle').map(s=>s.at),ground:plan.filter(s=>s.kind==='obstacle'&&s.obstacle==='ground').length,overhead:plan.filter(s=>s.kind==='obstacle'&&s.obstacle==='overhead').length,bonus:plan.filter(s=>s.kind==='bonus').length});for(const plan of plans)assert.deepEqual(summarize(plan),summarize(plans[0]));}
 assert.notDeepEqual(route(42,0),route(42,1));
});
