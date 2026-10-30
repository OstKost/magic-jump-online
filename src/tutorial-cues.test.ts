import test from 'node:test';
import assert from 'node:assert/strict';
import { cueOffset, cueFrame, consumeCue, type TutorialCue } from './tutorial-cues.ts';
import { DIFFICULTIES, GRAVITY, JUMP_VELOCITY, obstacleCollision } from './rules.ts';

test('recommended jump clears the whole collision window on every difficulty', () => {
  for (const config of Object.values(DIFFICULTIES)) {
    const speed=270*config.speedMultiplier;
    let x=160+cueOffset('jump',speed), y=0, velocity=JUMP_VELOCITY;
    while(x>125){
      velocity+=GRAVITY*.02;y=Math.min(0,y+velocity*.02);x-=speed*.02;
      if(Math.abs(x-160)<28)assert.equal(obstacleCollision(y,false,'ground'),false,config.key);
    }
    assert.ok(cueOffset('duck',speed)>28);
  }
});
test('only the nearest matching cue for this player consumes an accepted action', () => {
  const make=(row:number,action:TutorialCue['action'],x=250)=>({x,cue:{row,action,offset:90} as TutorialCue});
  const items=[make(0,'jump'),make(1,'jump'),make(0,'duck'),make(0,'jump',600),make(0,'jump',260)];
  consumeCue(items,0,'jump',270,100);
  assert.deepEqual(items.map(i=>i.cue.fadingAt),[100,undefined,undefined,undefined,undefined]);
});
test('double cue waits for the second jump and permits its delay', () => {
  const item={x:241,cue:{row:0,action:'double',offset:135} as TutorialCue};
  consumeCue([item],0,'jump',270,20);assert.equal(item.cue.fadingAt,undefined);
  consumeCue([item],0,'double',270,220);assert.equal(item.cue.fadingAt,220);
});
test('missed cues fade over 150ms and game time freezes bob and fade on pause', () => {
  const cue:TutorialCue={row:0,action:'duck',offset:54};
  const start=cueFrame(cue,180,270,100);
  assert.equal(start.alpha,.7);
  assert.deepEqual(cueFrame(cue,180,270,100),start);
  assert.equal(cueFrame(cue,180,270,175).alpha,.35);
  assert.equal(cueFrame(cue,180,270,250).alpha,0);
});
