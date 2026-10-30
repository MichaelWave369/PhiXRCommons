import http from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';

export async function createSignalingServer({ port = 8787, host = '127.0.0.1' } = {}) {
  const rooms = new Map();
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    } else { res.writeHead(404); res.end('Not found'); }
  });
  const wss = new WebSocketServer({ server, maxPayload: 16384 });
  function send(ws, msg) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); }
  function partner(ws) { return ws.room ? (rooms.get(ws.room) || []).find(other => other !== ws) : null; }
  function leave(ws) {
    if (!ws.room) return;
    const remaining = (rooms.get(ws.room) || []).filter(other => other !== ws);
    if (remaining.length) {
      // Always promote the remaining explorer to seat 1 so the next pairing
      // has exactly one WebRTC offer initiator, even when the original host exits.
      remaining[0].role = 1;
      rooms.set(ws.room, remaining);
      send(remaining[0], { type: 'peer-left', role: 1 });
    }
    else rooms.delete(ws.room);
    ws.room = null;
  }
  wss.on('connection', ws => {
    ws.room = null;
    ws.name = 'Explorer';
    ws.countWindow = Date.now();
    ws.count = 0;
    ws.lastPose = 0;
    ws.on('message', raw => {
      const now = Date.now();
      if (now - ws.countWindow >= 1000) { ws.countWindow = now; ws.count = 0; }
      if (++ws.count > 60) { ws.close(1008, 'Rate limit'); return; }
      let msg;
      try { msg = JSON.parse(raw.toString()); }
      catch { send(ws, { type: 'error', message: 'Invalid JSON' }); return; }
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'join') {
        if (ws.room) return;
        const room = String(msg.room || '').toUpperCase();
        if (!/^[A-Z0-9]{8}$/.test(room)) { send(ws, { type: 'error', fatal: true, message: 'Invalid room code.' }); return; }
        const members = rooms.get(room) || [];
        if (members.length >= 2) { send(ws, { type: 'error', fatal: true, message: 'Room full: maximum two explorers.' }); return; }
        ws.name = String(msg.name || 'Explorer').replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 24) || 'Explorer';
        ws.room = room;
        ws.role = members.length + 1;
        members.push(ws);
        rooms.set(room, members);
        send(ws, { type: 'welcome', room, role: ws.role, count: members.length, peerName: members[0] === ws ? null : members[0].name });
        if (members.length === 2) send(members[0], { type: 'peer-joined', role: 2, name: ws.name });
        return;
      }
      if (!ws.room) return;
      const peer = partner(ws);
      if (!peer) return;
      if (msg.type === 'signal') {
        const p = msg.payload;
        if (!p || typeof p !== 'object') return;
        const d = p.description, c = p.candidate;
        if (!(d && ['offer', 'answer'].includes(d.type) && typeof d.sdp === 'string') &&
            !(c && typeof c.candidate === 'string')) return;
        send(peer, { type: 'signal', payload: p });
      } else if (msg.type === 'pose') {
        if (now - ws.lastPose < 60) return;
        const p = msg.pose;
        const valid = n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 100;
        if (!p || ![p.x, p.y, p.z, p.qx, p.qy, p.qz, p.qw].every(valid)) return;
        ws.lastPose = now;
        send(peer, { type: 'pose', pose: {
          x:p.x,y:p.y,z:p.z,qx:p.qx,qy:p.qz,qw:p.qw,
          hands: Array.isArray(p.hands) ? p.hands.slice(0,2).filter(h => h && [h.x,h.y,h.z].every(valid)).map(h => ({x:h.x,y:h.y,z:h.z})) : []
        }});
      } else if (msg.type === 'share-state') {
        send(peer, { type: 'share-state', active: msg.active === true });
      }
    });
    ws.on('close', () => leave(ws));
    ws.on('error', () => leave(ws));
  });
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(port, host, ok); });
  return { server, wss, rooms, close: async () => {
    for (const client of wss.clients) client.terminate();
    await new Promise(ok => wss.close(ok));
    await new Promise(ok => server.close(ok));
  }};
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  createSignalingServer({ port: Number(process.env.PORT || 8787), host: process.env.HOST || '127.0.0.1' })
    .then(({ server }) => console.log('PhiXRCommons signal: ws://' + server.address().address + ':' + server.address().port))
    .catch(e => { console.error(e); process.exitCode = 1; });
}
