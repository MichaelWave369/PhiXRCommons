import test from 'node:test';
import assert from 'node:assert/strict';
import { makeIceServers, DEFAULT_STUN } from '../src/ice-config.js';
import { readThumbstick, snapTurnStep } from '../src/locomotion.js';

test('STUN default and custom TURN relay', () => {
  assert.deepEqual(makeIceServers(), [{ urls: DEFAULT_STUN }]);
  assert.deepEqual(makeIceServers({ stunUrl: '', turnUrl: 'turns:relay.example:5349?transport=tcp', turnUsername: 'guest', turnCredential: 'one-time-pass' }), [
    { urls: 'turns:relay.example:5349?transport=tcp', username: 'guest', credential: 'one-time-pass' }
  ]);
});
test('do not accept credentials hidden inside ICE URLs or incomplete TURN fields', () => {
  assert.throws(() => makeIceServers({turnUrl:'turn:user:pass@host',turnUsername:'u',turnCredential:'p'}));
  assert.throws(() => makeIceServers({turnUrl:'turn:relay.example',turnUsername:'u'}), /username and password/);
  assert.throws(() => makeIceServers({stunUrl:'',turnUrl:''}), /STUN or TURN/);
  assert.throws(() => makeIceServers({stunUrl:'https://example.com'}), /stun/);
});
test('Quest two-axis and four-axis controller stick formats', () => {
  assert.deepEqual(readThumbstick([0, 0, 0.9, -0.5]), {x:0.9/Math.hypot(0.9,-0.5), y:-0.5/Math.hypot(0.9,-0.5)});
  assert.deepEqual(readThumbstick([0.1,-0.05]),{x:0,y:0});
  assert.deepEqual(readThumbstick([0, -1]),{x:0,y:-1});
  assert.deepEqual(readThumbstick(undefined),{x:0,y:0});
});
test('snap turn fires once per stick push and re-arms after release', () => {
  const first=snapTurnStep(0.9,true);
  assert.deepEqual(first,{degrees:-30,armed:false});
  assert.deepEqual(snapTurnStep(0.9,false),{degrees:0,armed:false});
  assert.deepEqual(snapTurnStep(0,false),{degrees:0,armed:true});
  assert.equal(snapTurnStep(-0.9,true).degrees,30);
});
