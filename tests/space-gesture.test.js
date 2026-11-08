import test from 'node:test';
import assert from 'node:assert/strict';
import {SpaceGestureBridge,POSE_ACTIONS,PERMIT_MS,ARM_MS} from '../src/spacedynamics/gesture-bridge.js';
const event=(hand,gesture,t,source='synthetic',phase='start')=>
 ({type:'overstrings.gesture',version:1,source,handedness:hand,gesture,
   phase,timestamp_ms:t});
test('off by default and host action vocabulary is bounded',()=>{
 const g=new SpaceGestureBridge();
 assert.equal(g.arm('spacedynamics.push',1000),false);
 assert.equal(g.synthetic('right','open',1020).accepted,false);
 assert.equal(Object.keys(POSE_ACTIONS).length,2);
});
test('synthetic demo cannot run without separate permission',()=>{
 const g=new SpaceGestureBridge();
 assert.throws(()=>g.enable(1000,{source:'synthetic'}),/opt-in/);
 g.enable(1000,{source:'webxr'});
 g.arm('spacedynamics.push',1010);
 assert.equal(g.synthetic('right','open',1020).reason,'demo_disabled');
 assert.equal(g.ingest(event('right','open',1050),1050).reason,'source_denied');
 assert.equal(g.armed,false);
});
test('one-shot synthetic sentence dispatches exactly one action and disarms',()=>{
 const calls=[];
 const g=new SpaceGestureBridge({onAction:id=>calls.push(id)});
 g.enable(1000,{source:'synthetic',allowSyntheticDemo:true});
 assert.equal(g.arm('spacedynamics.select-next',1010),true);
 assert.equal(g.synthetic('left','open',1140).reason,'step_completed');
 assert.equal(g.synthetic('right','pinch',1320).accepted,true);
 assert.deepEqual(calls,['spacedynamics.select-next']);
 assert.equal(g.armed,false);
 assert.equal(g.synthetic('right','pinch',1400).accepted,false);
 assert.equal(g.arm('spacedynamics.invalid',1410),false);
});
test('wrong phrase, tracking loss, and unsupported mode fail closed',()=>{
 const calls=[];
 const g=new SpaceGestureBridge({onAction:id=>calls.push(id)});
 g.enable(1000,{source:'synthetic',allowSyntheticDemo:true});
 g.arm('spacedynamics.push',1001);
 assert.equal(g.synthetic('right','pinch',1020).reason,'unexpected_symbol');
 assert.equal(g.armed,false);
 g.arm('spacedynamics.push',2000);
 assert.equal(g.ingest(event('right','open',2070,'synthetic','lost'),2070).reason,'tracking_lost');
 assert.equal(g.armed,false);assert.deepEqual(calls,[]);
});
test('one-shot expiry, permission expiry, and revoke',()=>{
 const g=new SpaceGestureBridge();
 g.enable(1000,{source:'webxr'});g.arm('spacedynamics.push',1100);
 g.tick(1100+ARM_MS);
 assert.equal(g.armed,false);assert.equal(g.enabled,true);
 g.arm('spacedynamics.push',1000+PERMIT_MS-100);
 g.tick(1000+PERMIT_MS);
 assert.equal(g.enabled,false);assert.equal(g.armed,false);
 g.enable(400000,{source:'webxr'});g.disable();
 assert.equal(g.enabled,false);
});
test('XR frame lacking tracking cannot produce a spatial action',()=>{
 let calls=0;
 const g=new SpaceGestureBridge({onAction:()=>calls++});
 g.enable(10,{source:'webxr'});g.arm('spacedynamics.push',20);
 g.sample(null,null,null,25);
 assert.equal(g.armed,false);assert.equal(calls,0);
});
test('real gesture tracker requires a debounced held hand and handles lost data',()=>{
 const g=new SpaceGestureBridge();g.enable(0,{source:'webxr'});
 g.arm('spacedynamics.select-next',1);
 const hand={wrist:{x:0,y:0,z:0},'thumb-tip':{x:-.1,y:.1,z:0}};
 for(const [i,f] of ['index-finger','middle-finger','ring-finger','pinky-finger'].entries()){
   const x=-.03+i*.02;
   hand[f+'-metacarpal']={x,y:.02,z:0};
   hand[f+'-phalanx-proximal']={x,y:.052,z:0};
   hand[f+'-tip']={x,y:.11,z:0};
 }
 assert.deepEqual(g.updateHand('left',hand,100),[]);
 const recognized=g.updateHand('left',hand,220);
 assert.ok(recognized.some(e=>e.phase==='start'&&e.gesture==='open'));
 assert.equal(g.armed,true);
 g.updateHand('left',null,500);
 assert.equal(g.armed,false);
});
