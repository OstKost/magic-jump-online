import test from 'node:test';
import assert from 'node:assert/strict';
import { OBSTACLE_ANIMATIONS, obstacleAnimationKey, obstacleFrame, obstacleFrameRect, obstaclePhase, overheadVariant } from './obstacle-animations.ts';

test('both renderers select the same overhead variants from event time, including reused world artwork', () => {
  for (let world=0;world<5;world++) {
    const variants=new Set<number>();
    for (let at=0;at<1900*8;at+=1900) {
      const variant=overheadVariant(world,at);
      variants.add(variant);
      assert.equal(obstacleAnimationKey(world,'obstacle','overhead',0,at),`overhead-${world}-${variant}`);
    }
    assert.equal(variants.size,world>=3?2:4);
  }
});

test('spawn phase is deterministic across lanes and decorrelates consecutive events', () => {
  assert.equal(obstaclePhase(2200,-90),obstaclePhase(2200,-90));
  assert.notEqual(obstaclePhase(2200),obstaclePhase(2220));
});

test('all idle cycles loop within eight isolated frames and freeze at a fixed game time', () => {
  for (const animation of Object.values(OBSTACLE_ANIMATIONS)) {
    assert.equal(animation.count,8);
    assert.equal(obstacleFrame(animation,0,3),obstacleFrame(animation,8000/animation.fps,3));
    for (let elapsed=0;elapsed<3000;elapsed+=20) {
      const frame=obstacleFrame(animation,elapsed,5);
      assert.ok(frame>=0&&frame<8);
      assert.equal(frame,obstacleFrame(animation,elapsed,5));
      const rect=obstacleFrameRect(animation,frame);
      assert.equal(rect.x%animation.width,0);
      assert.equal(rect.y%animation.height,0);
    }
  }
});

test('defeat at time zero uses the three retained defeat frames and clamps after the last', () => {
  for (const animation of Object.values(OBSTACLE_ANIMATIONS).filter(a=>a.defeatStart!==null)) {
    assert.equal(obstacleFrame(animation,0,7,0),8);
    assert.equal(obstacleFrame(animation,160,7,0),9);
    assert.equal(obstacleFrame(animation,320,7,0),10);
    assert.equal(obstacleFrame(animation,2000,7,0),10);
  }
});

test('every world variant and enemy has an animation with padded frame geometry', async () => {
  const { ENEMIES } = await import('./combat.ts');
  const { readFileSync } = await import('node:fs');
  const keys = new Set<string>();
  for(let world=0;world<5;world++) {
    for(let variant=0;variant<3;variant++)keys.add(obstacleAnimationKey(world,'obstacle','ground',variant,2200));
    for(let variant=0;variant<4;variant++)keys.add(obstacleAnimationKey(world,'obstacle','overhead',0,variant*1900));
    for(const enemy of ENEMIES[world])keys.add(`enemy-${enemy.key}`);
  }
  assert.equal(keys.size,35);
  for(const key of keys) {
    const animation=OBSTACLE_ANIMATIONS[key];
    assert.ok(animation,`Missing animation: ${key}`);
    const png=readFileSync(new URL(`../public${animation.path}`,import.meta.url));
    assert.equal(png.readUInt32BE(16),animation.width*4,key);
    assert.equal(png.readUInt32BE(20),animation.height*(animation.defeatStart===null?2:3),key);
    assert.ok(animation.originX>4&&animation.originY>4,key);
  }
});
