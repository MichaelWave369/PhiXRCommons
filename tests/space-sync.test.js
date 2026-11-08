import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {createSignalingServer} from '../server/index.js';
import {validateSpaceCommand,validSpaceState,hydrateSpaceWorld} from '../src/spacedynamics/protocol.js';
import {spaceEndpoint} from '../src/spacedynamics/space-client.js';
function inbox(ws){
  const queue=[],waiters=[];
  ws.on('message',buf=>{
    const msg=JSON.parse(buf.toString());
    const i=waiters.findIndex(w=>w.type===msg.type&&w.check(msg));
    if(i>=0){const w=waiters.splice(i,1)[0];clearTimeout(w.timer);w.resolve(msg);}
    else queue.push(msg);
  });
  return {next(type,check=()=>true){
    const i=queue.findIndex(m=>m.type===type&&check(m));
    if(i>=0)return Promise.resolve(queue.splice(i,1)[0]);
    return new Promise((resolve,reject)=>{
      const w={type,check,resolve,timer:null};
      w.timer=setTimeout(()=>{waiters.splice(waiters.indexOf(w),1);reject(new Error('Timeout '+type));},2500);
      waiters.push(w);
    });
  }};
}
async function fixture(t){
  const app=await createSignalingServer({port:0,host:'127.0.0.1'});
  t.after(()=>app.close());
  const url='ws://127.0.0.1:'+app.server.address().port+'/space';
  async function join(code='ROOM2026'){
    const ws=new WebSocket(url);t.after(()=>ws.terminate());
    const box=inbox(ws);
    await new Promise((res,rej)=>{ws.once('open',res);ws.once('error',rej);});
    ws.send(JSON.stringify({type:'space-join',room:code}));
    return {ws,box,hello:await box.next('space-welcome')};
  }
  return {join,url,app};
}
test('strict command validation and secure endpoint requirements',()=>{
  assert.equal(spaceEndpoint('wss://example.org'),'wss://example.org/space');
  assert.equal(spaceEndpoint('ws://localhost:8787/space'),'ws://localhost:8787/space');
  assert.throws(()=>spaceEndpoint('ws://remote.example.org'));
  assert.throws(()=>spaceEndpoint('wss://user:password@example.org'));
  assert.equal(validateSpaceCommand({type:'space-command',seq:1,action:'add'}).action,'add');
  assert.equal(validateSpaceCommand({type:'space-command',seq:1,action:'add',extra:true}),null);
  assert.equal(validateSpaceCommand({type:'space-command',seq:1,action:'push',id:'orb-1',
    vector:{x:Infinity,y:0,z:0}}),null);
  assert.equal(validateSpaceCommand({type:'space-command',seq:1,action:'gravity',value:900}),null);
});
test('shared authoritative state, two-seat cap and valid hydration',async t=>{
  const {join,url}=await fixture(t);
  const a=await join(),b=await join();
  assert.equal(a.hello.role,1);assert.equal(b.hello.role,2);
  const state=await b.box.next('space-state');
  assert.ok(validSpaceState(state));assert.equal(state.epoch,a.hello.epoch);
  assert.equal(hydrateSpaceWorld(state).bodies.length,4);
  const third=new WebSocket(url);t.after(()=>third.terminate());const box=inbox(third);
  await new Promise(res=>third.once('open',res));
  third.send(JSON.stringify({type:'space-join',room:'ROOM2026'}));
  assert.equal((await box.next('space-error')).code,'room_full');
});
test('guest allowed pushes, host-only settings, replay denial and room isolation',async t=>{
  const {join}=await fixture(t);
  const a=await join('MAIN2026'),b=await join('MAIN2026'),c=await join('ISOL2026');
  const baseline=await a.box.next('space-state');
  const isolated=await c.box.next('space-state');
  assert.notEqual(baseline.epoch,isolated.epoch);
  b.ws.send(JSON.stringify({type:'space-command',seq:1,action:'reset'}));
  assert.equal((await b.box.next('space-receipt',m=>m.seq===1)).code,'host_only');
  b.ws.send(JSON.stringify({type:'space-command',seq:2,action:'push',
    id:'orb-1',vector:{x:0,y:3,z:0}}));
  assert.equal((await b.box.next('space-receipt',m=>m.seq===2)).accepted,true);
  b.ws.send(JSON.stringify({type:'space-command',seq:2,action:'add'}));
  assert.equal((await b.box.next('space-receipt',m=>m.code==='stale_sequence')).accepted,false);
  a.ws.send(JSON.stringify({type:'space-command',seq:1,action:'gravity',value:0}));
  assert.equal((await a.box.next('space-receipt',m=>m.seq===1)).accepted,true);
  assert.ok(validSpaceState(await b.box.next('space-state',m=>m.world.gravity===0)));
});
test('guest promoted on host disconnect, canonical world preserved',async t=>{
  const {join}=await fixture(t);
  const a=await join('LEAV2026'),b=await join('LEAV2026');
  const original=await b.box.next('space-state');
  a.ws.send(JSON.stringify({type:'space-command',seq:1,action:'gravity',value:0}));
  await a.box.next('space-receipt',m=>m.seq===1);
  a.ws.terminate();
  assert.equal((await b.box.next('space-peer-left')).role,1);
  b.ws.send(JSON.stringify({type:'space-command',seq:1,action:'field',value:'center'}));
  assert.equal((await b.box.next('space-receipt',m=>m.seq===1)).accepted,true);
  const state=await b.box.next('space-state',m=>m.world.field==='center');
  assert.equal(state.world.gravity,0);assert.equal(state.epoch,original.epoch);
});
