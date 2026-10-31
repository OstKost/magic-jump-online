import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Journey } from './journey.ts';

test('two players choose distinct heroes in order from all four options',()=>{
  for(let first=0;first<4;first++)for(let second=0;second<4;second++){
    const flow=new Journey();assert.equal(flow.choose(first),true);assert.equal(flow.confirm(),false);
    assert.equal(flow.choosing,1);assert.notEqual(flow.selected[0],flow.selected[1]);
    assert.equal(flow.choose(second),first!==second);
    if(first!==second){assert.deepEqual(flow.selected,[first,second]);assert.equal(flow.confirm(),true);}
  }
});
test('one player cannot start the game alone or signal for the other player',()=>{
  const flow=new Journey();assert.equal(flow.markReady(0),false);assert.equal(flow.markReady(0),false);
  assert.equal(flow.markReady(4),false);assert.deepEqual(flow.ready,[true,false]);assert.equal(flow.markReady(1),true);
  flow.resetReady();assert.deepEqual(flow.ready,[false,false]);assert.equal(flow.markReady(1),false);assert.equal(flow.markReady(0),true);
});
test('new journey clears both readiness and previous hero selection',()=>{
  const flow=new Journey();flow.choose(3);flow.confirm();flow.choose(2);flow.markReady(0);flow.markReady(1);flow.reset();
  assert.equal(flow.choosing,0);assert.deepEqual(flow.selected,[0,1]);assert.deepEqual(flow.ready,[false,false]);
  for(const invalid of [-1,7,1.5,NaN])assert.equal(flow.choose(invalid),false);
});

test('secret heroes Kai and Leya can be chosen for both players',()=>{
  const journey=new Journey();
  assert.equal(journey.choose(4),true); // Kai
  assert.equal(journey.confirm(),false);
  assert.equal(journey.choose(5),true); // Leya
  assert.equal(journey.confirm(),true);
  assert.deepEqual(journey.selected,[4,5]);
});

test('solo journey needs one selection and one ready signal',()=>{
  const journey=new Journey();journey.reset(1);
  assert.equal(journey.choose(3),true);
  assert.equal(journey.confirm(),true);
  assert.equal(journey.markReady(1),false);
  assert.equal(journey.markReady(0),true);
  assert.deepEqual(journey.selected,[3]);
});
