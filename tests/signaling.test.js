import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createSignalingServer } from '../server/index.js';

async function setup(t) {
  const app = await createSignalingServer({ host: '127.0.0.1', port: 0 });
  t.after(() => app.close());
  const url = 'ws://127.0.0.1:' + app.server.address().port;
  function join(code, name) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => reject(new Error('Room reply timeout')), 3000);
      ws.on('open', () => ws.send(JSON.stringify({ type: 'join', room: code, name })));
      ws.on('message', buffer => {
        const msg = JSON.parse(buffer.toString());
        if (msg.type === 'welcome' || msg.type === 'error') {
          clearTimeout(timer);
          resolve({ ws, msg });
        }
      });
      ws.on('error', reject);
      t.after(() => ws.terminate());
    });
  }
  return { app, join };
}
test('two seats join and third is rejected', async t => {
  const { join } = await setup(t);
  const a = await join('ABCD2345','Alice');
  const b = await join('ABCD2345','Bob');
  const c = await join('ABCD2345','Third');
  assert.equal(a.msg.role,1);
  assert.equal(b.msg.role,2);
  assert.equal(b.msg.peerName,'Alice');
  assert.equal(c.msg.fatal,true);
  assert.match(c.msg.message,/full/i);
});
test('room isolation and malformed code', async t => {
  const { app, join } = await setup(t);
  assert.equal((await join('ABCD2345','A')).msg.role,1);
  assert.equal((await join('EFGH6789','B')).msg.role,1);
  assert.equal((await join('SHORT','C')).msg.fatal,true);
  assert.equal(app.rooms.size,2);
});
test('share state relays to partner', async t => {
  const { join } = await setup(t);
  const a = await join('JOIN2026','A');
  const b = await join('JOIN2026','B');
  const got = new Promise((resolve,reject) => {
    const timer=setTimeout(()=>reject(new Error('No relay')),3000);
    b.ws.on('message',buffer => {
      const msg=JSON.parse(buffer.toString());
      if (msg.type==='share-state') { clearTimeout(timer); resolve(msg); }
    });
  });
  a.ws.send(JSON.stringify({type:'share-state',active:true}));
  assert.deepEqual(await got,{type:'share-state',active:true});
});
test('pose is bounded and only forwarded in same room', async t => {
  const { join } = await setup(t);
  const a = await join('SAFE2026','A');
  const b = await join('SAFE2026','B');
  const isolated = await join('OTHER123','C');
  const got = new Promise((resolve,reject) => {
    const timer=setTimeout(()=>reject(new Error('Pose not received')),3000);
    b.ws.on('message',buf=>{
      const msg=JSON.parse(buf.toString());
      if(msg.type==='pose'){clearTimeout(timer);resolve(msg);}
    });
  });
  const bad={x:Infinity,y:0,z:0,qx:0,qy:0,qz:0,qw:1};
  a.ws.send(JSON.stringify({type:'pose',pose:bad}));
  const valid={x:0,y:1.6,z:0,qx:0,qy:0,qz:0,qw:1,hands:[]};
  a.ws.send(JSON.stringify({type:'pose',pose:valid}));
  assert.equal((await got).pose.y,1.6);
  assert.equal(isolated.msg.role,1);
});
