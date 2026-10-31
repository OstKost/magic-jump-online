import test from 'node:test';
import assert from 'node:assert/strict';
import { moveBody, collectBonus } from './terrain.ts';
import { OnlineEngine } from './online-engine.ts';
import { route, WORLDS, DIFFICULTIES, type DifficultyKey } from './rules.ts';

test('platforms catch descending feet, allow ascent and restore both jumps',()=>{
  const platform={kind:'platform',x:160,width:480,height:90};
  const body={y:-95,velocity:300,jumps:2,grounded:false};
  assert.equal(moveBody(body,[platform],0,20),'land');
  assert.equal(body.y,-90);assert.equal(body.jumps,0);assert.equal(body.grounded,true);
  body.y=-80;body.velocity=-600;
  moveBody(body,[platform],0,40);assert.ok(body.y< -90);assert.equal(body.grounded,false);
  body.y=-90;body.velocity=0;
  moveBody(body,[{...platform,x:-300}],0,60);assert.ok(body.y> -90);assert.equal(body.grounded,false);
});
test('gap falling resets once and grants a recovery interval',()=>{
  const body={y:209,velocity:300,jumps:2,grounded:false,fallUntil:0};
  assert.equal(moveBody(body,[{kind:'gap',x:160,width:260}],0,500),'fall');
  assert.equal(body.y,0);assert.equal(body.fallUntil,1100);
  assert.equal(moveBody(body,[{kind:'gap',x:160,width:260}],0,520),undefined);
  assert.equal(body.y,0);
});
test('elevated bonus collection uses its own height',()=>{
  assert.equal(collectBonus(-90,false,'none',125),true);
  assert.equal(collectBonus(0,false,'none',125),false);
});
test('every upper route is reachable by a single timed jump at every world speed',()=>{
  for(const difficulty of ['easy','medium','hard'] as DifficultyKey[])for(const world of WORLDS){
    const speed=world.speed*DIFFICULTIES[difficulty].speedMultiplier;
    const body={y:0,velocity:-650,jumps:1,grounded:false};
    const platform={kind:'platform',x:490,width:480,height:90};
    const gap={kind:'gap',x:580,width:260};
    let landed=false;
    for(let tick=1;tick<180;tick++){
      const event=moveBody(body,[platform,gap],speed,tick*20);
      landed ||= body.grounded&&body.y===-90;
      assert.notEqual(event,'fall');
      platform.x-=speed*.02;gap.x-=speed*.02;
    }
    assert.equal(landed,true);
  }
});
test('generated sections have equal opportunities and complete seven-bonus upper chains',()=>{
  for(let seed=0;seed<100;seed++){
    const plans=[0,1,2,3].map(player=>route(seed,player,'hard'));
    const inventory=(plan:typeof plans[number])=>plan.map(o=>`${o.kind}:${o.width??0}:${o.height??0}`).sort();
    for(const plan of plans)assert.deepEqual(inventory(plan),inventory(plans[0]));
    for(const platform of plans[0].filter(o=>o.kind==='platform')){
      assert.equal(plans[0].filter(o=>o.at===platform.at&&o.kind==='bonus').length,7);
      assert.equal(platform.height,90);
    }
  }
});
test('simulation awards a collected bonus once and elevated shots miss floor enemies',()=>{
  const engine=new OnlineEngine(42,0,0,'easy');engine.plan.length=0;
  engine.body.y=-90;engine.body.grounded=true;
  engine.items=[{kind:'platform',x:160,width:480,height:90,variant:0,obstacle:'none',passed:false},{kind:'bonus',x:170,height:125,variant:0,obstacle:'none',passed:false},{kind:'enemy',x:180,variant:0,obstacle:'ground',passed:false}];
  engine.input('cast');engine.step();assert.equal(engine.body.score,25);engine.step();assert.equal(engine.body.score,25);
  assert.equal(engine.items.find(o=>o.kind==='enemy')?.defeatedAt,undefined);
});
