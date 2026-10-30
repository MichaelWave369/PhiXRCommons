import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createSignalingServer } from '../server/index.js';
import { RoomClient } from '../src/network.js';

function nextMessage(ws, type, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.off('message', handler); reject(new Error('Timed out: ' + type)); }, timeoutMs);
    function handler(buf) {
      const msg = JSON.parse(buf.toString());
      if (msg.type !== type) return;
      clearTimeout(timer);
      ws.off('message', handler);
      resolve(msg);
    }
    ws.on('message', handler);
  });
}
test('host departure promotes guest and a replacement connects as seat 2', async t => {
  const app = await createSignalingServer({ host: '127.0.0.1', port: 0 });
  t.after(() => app.close());
  const url = 'ws://127.0.0.1:' + app.server.address().port;
  async function join(name) {
    const ws = new WebSocket(url);
    t.after(() => ws.terminate());
    await new Promise((ok, fail) => { ws.once('open', ok); ws.once('error', fail); });
    const welcome = nextMessage(ws, 'welcome');
    ws.send(JSON.stringify({ type:'join',room:'LEAVE222',name }));
    return { ws, welcome: await welcome };
  }
  const a = await join('A');
  const b = await join('B');
  assert.equal(a.welcome.role,1);
  assert.equal(b.welcome.role,2);
  const promoted = nextMessage(b.ws,'peer-left');
  a.ws.terminate();
  assert.equal((await promoted).role,1);
  const joined = nextMessage(b.ws,'peer-joined');
  const c = await join('C');
  assert.equal(c.welcome.role,2);
  assert.equal((await joined).name,'C');
});

test('receiver unmute re-emits stream after late WebRTC sender starts', async t => {
  const savedStream = globalThis.MediaStream;
  const savedPeer = globalThis.RTCPeerConnection;
  class FakeStream {
    constructor() {this.tracks = [];}
    getTracks() {return this.tracks;}
    addTrack(t) {this.tracks.push(t);}
    removeTrack(t) {this.tracks=this.tracks.filter(x=>x!==t);}
  }
  class FakePeer {
    constructor() {this.transceivers=[];this.connectionState='new';}
    addTransceiver(kind) {
      const t={receiver:{track:{kind}},sender:{replaceTrack:async()=>{}}};
      this.transceivers.push(t);return t;
    }
    getTransceivers(){return this.transceivers;}
    close(){}
  }
  globalThis.MediaStream=FakeStream;
  globalThis.RTCPeerConnection=FakePeer;
  t.after(()=>{globalThis.MediaStream=savedStream;globalThis.RTCPeerConnection=savedPeer;});
  const published=[];
  const client=new RoomClient({onRemoteStream:s=>published.push(s?.getTracks().length||0)});
  const pc=client.ensurePeer();
  const track=new EventTarget();
  track.kind='video';
  pc.ontrack({track});
  assert.deepEqual(published,[1]);
  track.dispatchEvent(new Event('unmute'));
  assert.deepEqual(published,[1,1]);
  track.dispatchEvent(new Event('mute'));
  assert.deepEqual(published,[1,1,1]);
  client.closePeer();
  assert.equal(published.at(-1),0);
});
