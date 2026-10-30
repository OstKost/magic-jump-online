import { test } from 'node:test';
import assert from 'node:assert/strict';
import { obstacleCollision, award, hit, newPlayer, schedule, route, winner, GRAVITY, JUMP_VELOCITY, canJump, jumpVelocity, DIFFICULTIES, type DifficultyKey } from './rules.ts';
test('damage has one second immunity and never goes below zero',()=>{const p=newPlayer();assert.equal(hit(p,0),true);assert.equal(hit(p,500),false);assert.equal(p.lives,2);hit(p,1000);hit(p,2000);assert.equal(hit(p,3000),false);assert.equal(p.lives,0);});
test('ghost players earn reduced points; next level resets lives and keeps total',()=>{const p=newPlayer();award(p,10);award(p,25);assert.equal(p.score,35);hit(p,0);hit(p,1000);hit(p,2000);award(p,25);assert.equal(p.score,55);const next=newPlayer(p.score);assert.equal(next.lives,3);assert.equal(next.roundScore,0);assert.equal(next.score,55);});
test('winner follows total points and supports draw',()=>{const a=newPlayer(100),b=newPlayer(100);assert.equal(winner([a,b]),null);award(b,25);assert.equal(winner([a,b]),1);award(a,50);assert.equal(winner([a,b]),0);});
test('identical seeds give identical fair schedules with safe spacing',()=>{assert.deepEqual(schedule(42),schedule(42));for(let seed=0;seed<100;seed++){const events=schedule(seed).filter(s=>s.kind==='obstacle');for(let i=1;i<events.length;i++)assert.ok(events[i].at-events[i-1].at>=1700);assert.ok(events[0].at>=2200);assert.ok(events.at(-1)!.at+(1150-120)/270*1000<60000);}});
test('jump clears obstacles and reaches bonus height',()=>{const maxHeight=JUMP_VELOCITY**2/(2*GRAVITY);const flight=-2*JUMP_VELOCITY/GRAVITY;assert.ok(maxHeight>100);assert.ok(flight<1.7);});
test('double jump allows two jumps and prevents third until landing',()=>{
  assert.equal(canJump(0, 0, false), true);
  assert.equal(canJump(0, 0, true), false);
  const first = jumpVelocity(0, 0);
  assert.deepEqual(first, { velocity: JUMP_VELOCITY, jumps: 1, isDouble: false });
  assert.equal(canJump(-20, first!.jumps, false), true);
  const second = jumpVelocity(-20, first!.jumps);
  assert.deepEqual(second, { velocity: JUMP_VELOCITY, jumps: 2, isDouble: true });
  assert.equal(canJump(-50, second!.jumps, false), false);
  const third = jumpVelocity(-50, second!.jumps);
  assert.equal(third, null);
  const singleMaxHeight = JUMP_VELOCITY ** 2 / (2 * GRAVITY);
  assert.ok(singleMaxHeight * 2 > 200);
});
test('duck clears overhead obstacles but cannot clear ground obstacles',()=>{
  assert.equal(obstacleCollision(0,false,'overhead'),true);
  assert.equal(obstacleCollision(0,true,'overhead'),false);
  assert.equal(obstacleCollision(0,true,'ground'),true);
  assert.equal(obstacleCollision(0,false,'ground'),true);
  assert.equal(obstacleCollision(-44,false,'ground'),false);
  assert.equal(obstacleCollision(-80,false,'overhead'),true);
  assert.equal(obstacleCollision(-112,false,'overhead'),false);
  assert.equal(obstacleCollision(-15,true,'overhead'),true);
  assert.equal(obstacleCollision(0,false,'none'),false);
  assert.equal(obstacleCollision(-50,false,'none'),false);
});
test('schedule mixes overhead and ground obstacles and clear double-jump bonuses when there are no obstacles',()=>{
  let overhead=0,ground=0,clearBonuses=0;
  for(let seed=0;seed<100;seed++){
    const plan=schedule(seed);
    for(const event of plan){
      if(event.kind==='obstacle'){
        if(event.obstacle==='overhead'){
          overhead++;
          for(const bonus of plan.filter(s=>s.kind==='bonus'&&s.at===event.at)) assert.equal(bonus.obstacle,'overhead');
        }else ground++;
      }else if(event.kind==='bonus'&&event.obstacle==='none'){
        clearBonuses++;
        assert.equal(plan.some(s=>s.kind==='obstacle'&&s.at===event.at),false);
      }
    }
  }
  assert.ok(overhead>0&&ground>0&&clearBonuses>0);
});

test('double-jump bonus is reachable only with a double jump',()=>{
  const singleApex = JUMP_VELOCITY ** 2 / (2 * GRAVITY);
  assert.ok(singleApex < 130);
  let y = 0, velocity = -650, reached = false;
  for (let t = 0; t < 50; t++) {
    velocity += GRAVITY * 0.02;
    y = Math.min(0, y + velocity * 0.02);
    if (t === 15) velocity = -650;
    if (y < -130 && y > -230) reached = true;
  }
  assert.equal(reached, true);
});

test('independent routes preserve timing, action counts and available scores',()=>{
 for(let seed=0;seed<100;seed++){
   const plans=[0,1,2,3].map(i=>route(seed,i));
   const summarize=(plan:ReturnType<typeof route>)=>({
     slots:[...new Set(plan.map(s=>s.at))].sort((a,b)=>a-b),
     ground:plan.filter(s=>s.kind==='obstacle'&&s.obstacle==='ground').length,
     overhead:plan.filter(s=>s.kind==='obstacle'&&s.obstacle==='overhead').length,
     clearBonuses:plan.filter(s=>s.kind==='bonus'&&s.obstacle==='none').length,
     bonus:plan.filter(s=>s.kind==='bonus').length
   });
   for(const plan of plans)assert.deepEqual(summarize(plan),summarize(plans[0]));
 }
 assert.notDeepEqual(route(42,0),route(42,1));
});

test('difficulties configure distinct seconds, lives, speeds and obstacle intervals',()=>{
  assert.equal(DIFFICULTIES.easy.levelSeconds, 20);
  assert.equal(DIFFICULTIES.easy.lives, 4);
  assert.equal(DIFFICULTIES.easy.speedMultiplier, 0.9);

  assert.equal(DIFFICULTIES.medium.levelSeconds, 40);
  assert.equal(DIFFICULTIES.medium.lives, 3);
  assert.equal(DIFFICULTIES.medium.speedMultiplier, 1.0);

  assert.equal(DIFFICULTIES.hard.levelSeconds, 50);
  assert.equal(DIFFICULTIES.hard.lives, 3);
  assert.equal(DIFFICULTIES.hard.speedMultiplier, 1.05);

  const easyPlayer = newPlayer(0, DIFFICULTIES.easy.lives);
  assert.equal(easyPlayer.lives, 4);

  for (let seed = 0; seed < 50; seed++) {
    const easyPlan = schedule(seed, 'easy').filter(s => s.kind === 'obstacle');
    for (let i = 1; i < easyPlan.length; i++) assert.ok(easyPlan[i].at - easyPlan[i - 1].at >= 1700);
    assert.ok(easyPlan.at(-1)!.at <= 16000);

    const medPlan = schedule(seed, 'medium').filter(s => s.kind === 'obstacle');
    for (let i = 1; i < medPlan.length; i++) assert.ok(medPlan[i].at - medPlan[i - 1].at >= 1450);
    assert.ok(medPlan.at(-1)!.at <= 36000);

    const hardPlan = schedule(seed, 'hard').filter(s => s.kind === 'obstacle');
    for (let i = 1; i < hardPlan.length; i++) assert.ok(hardPlan[i].at - hardPlan[i - 1].at >= 1200);
    assert.ok(hardPlan.at(-1)!.at <= 46000);
  }
});

test('world order keeps tutorial first and visits each world once deterministically', async () => {
  const { worldOrder, WORLDS } = await import('./rules.ts');
  const orders = new Set<string>();
  for (let seed = 0; seed < 100; seed++) {
    const order = worldOrder(seed);
    assert.equal(order[0], 0);
    assert.deepEqual([...order].sort(), WORLDS.map((_, i) => i));
    assert.deepEqual(order, worldOrder(seed));
    orders.add(order.join(','));
  }
  assert.ok(orders.size > 1);
});

test('world shuffle matches the server seed fixture', async () => {
  const { worldOrder } = await import('./rules.ts');
  assert.deepEqual(worldOrder(42), [0, 3, 4, 1, 2]);
});
