import test from 'node:test';
import assert from 'node:assert/strict';
import {AXIS,CELL_COUNT,LAYERS,encodeAddress,decodeAddress,addressAt,createWorld,stepWorld,addBody,applyImpulse,snapshot} from '../src/spacedynamics/core.js';

test('12^4 spatial-layer addresses are unique and round-trip', () => {
  assert.equal(CELL_COUNT,20736);
  assert.equal(LAYERS.length,12);
  const all=new Set();
  for(let l=0;l<12;l++)for(let x=0;x<12;x++)for(let y=0;y<12;y++)for(let z=0;z<12;z++){
    const id=encodeAddress(x,y,z,l);
    assert.deepEqual(decodeAddress(id),{id,x,y,z,layer:l,layerName:LAYERS[l]});
    all.add(id);
  }
  assert.equal(all.size,CELL_COUNT);
});
test('addresses reject invalid coordinates and missing spatial data',()=>{
  assert.throws(()=>encodeAddress(-1,0,0),RangeError);
  assert.throws(()=>encodeAddress(0,12,0),RangeError);
  assert.throws(()=>encodeAddress(0,0,0,'made-up'),RangeError);
  assert.throws(()=>decodeAddress('SD-20736'),RangeError);
  assert.throws(()=>decodeAddress('junk'),RangeError);
  assert.equal(addressAt({x:7,y:0,z:0}),null);
  assert.equal(addressAt({x:NaN,y:0,z:0}),null);
  assert.equal(addressAt({x:-6,y:-6,z:-6}),'SD-00000');
  assert.equal(addressAt({x:6,y:6,z:6},'experimental'),'SD-20735');
});
test('fixed timestep is reproducible and gravity respects pause',()=>{
  const a=createWorld(),b=createWorld();
  for(let i=0;i<120;i++){stepWorld(a,1/60);stepWorld(b,1/60);}
  assert.deepEqual(snapshot(a),snapshot(b));
  assert.ok(a.elapsed>1.9);
  a.paused=true;
  const before=snapshot(a);
  stepWorld(a,.1);
  assert.deepEqual(snapshot(a),before);
});
test('zero gravity conserves initial vertical velocity in empty field',()=>{
  const w=createWorld();w.gravity=0;
  const y=w.bodies[0].p.y;
  stepWorld(w,.1);
  assert.equal(w.bodies[0].p.y,y);
});
test('bodies remain above floor and bounded during a long simulation',()=>{
  const w=createWorld();
  for(let i=0;i<900;i++)stepWorld(w,1/60);
  for(const b of w.bodies) {
    assert.ok(b.p.y >= b.r - 1e-7);
    assert.ok(b.p.y <= 8-b.r+1e-7);
    assert.ok(Math.abs(b.p.x) < 6.01);
    assert.ok(Math.abs(b.p.z) < 6.01);
  }
});
test('bounded impulses and object cap',()=>{
  const w=createWorld();
  assert.equal(applyImpulse(w,'missing',{x:1,y:0,z:0}),false);
  assert.equal(applyImpulse(w,'orb-1',{x:0,y:0,z:0}),false);
  const v=w.bodies[0].v.x;
  assert.ok(applyImpulse(w,'orb-1',{x:100,y:0,z:0}));
  assert.equal(w.bodies[0].v.x,v+8);
  for(let i=0;i<20;i++)assert.ok(addBody(w));
  assert.equal(w.bodies.length,24);
  assert.equal(addBody(w),null);
  assert.equal(snapshot(w).truth,'ILLUSTRATIVE_SIMULATION_NOT_MEASURED');
});
