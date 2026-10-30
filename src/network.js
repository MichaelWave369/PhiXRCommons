/* Room coordination over WebSocket; media is encrypted peer-to-peer WebRTC. */
export function normalizeRoom(value) {
  return String(value || '').trim().toUpperCase();
}
export function createRoomCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(bytes, n => alphabet[n % alphabet.length]).join('');
}
export class RoomClient {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.socket = null;
    this.pc = null;
    this.role = null;
    this.room = null;
    this.name = 'Explorer';
    this.peerName = null;
    this.videoTrack = null;
    this.audioTrack = null;
    this.remoteStream = new MediaStream();
    this.pendingCandidates = [];
  }
  emit(event, data) { this.callbacks[event]?.(data); }
  send(data) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(data));
  }
  async connect(url, room, name) {
    this.disconnect();
    this.room = normalizeRoom(room);
    this.name = String(name || 'Explorer').trim().slice(0, 24) || 'Explorer';
    if (!/^[A-Z0-9]{8}$/.test(this.room)) throw new Error('Room code needs 8 letters or numbers.');
    if (!/^wss:\/\//i.test(url) && !/^ws:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(url))
      throw new Error('Use wss:// or local development ws://localhost.');
    this.emit('onStatus', { phase: 'connecting' });
    const ws = new WebSocket(url);
    this.socket = ws;
    ws.addEventListener('open', () => {
      if (this.socket === ws) this.send({ type: 'join', room: this.room, name: this.name });
    });
    ws.addEventListener('message', async event => {
      if (this.socket !== ws) return;
      try { await this.handle(JSON.parse(event.data)); }
      catch (error) { this.emit('onError', error.message || String(error)); }
    });
    ws.addEventListener('error', () => {
      if (this.socket === ws) this.emit('onError', 'Signaling connection failed.');
    });
    ws.addEventListener('close', () => {
      if (this.socket !== ws) return;
      this.closePeer();
      this.socket = null;
      this.role = null;
      this.emit('onStatus', { phase: 'offline' });
    });
  }
  async handle(msg) {
    switch (msg.type) {
      case 'welcome':
        this.role = msg.role;
        this.peerName = msg.peerName || null;
        this.emit('onStatus', { phase: 'joined', role: msg.role, room: this.room, count: msg.count, peerName: this.peerName });
        return;
      case 'peer-joined':
        this.peerName = msg.name || 'Explorer';
        this.emit('onStatus', { phase: 'paired', role: this.role, room: this.room, count: 2, peerName: this.peerName });
        if (this.role === 1) {
          const pc = this.ensurePeer();
          await pc.setLocalDescription(await pc.createOffer());
          this.send({ type: 'signal', payload: { description: pc.localDescription } });
        }
        return;
      case 'signal': await this.handleSignal(msg.payload); return;
      case 'pose': this.emit('onPeerPose', msg.pose); return;
      case 'share-state': this.emit('onRemoteShareState', Boolean(msg.active)); return;
      case 'peer-left':
        this.closePeer();
        this.peerName = null;
        this.emit('onPeerLeft');
        this.emit('onStatus', { phase: 'joined', role: this.role, room: this.room, count: 1 });
        return;
      case 'error':
        this.emit('onError', msg.message || 'Room error');
        if (msg.fatal) this.disconnect();
        return;
      default: return;
    }
  }
  ensurePeer() {
    if (this.pc) return this.pc;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    this.pc = pc;
    pc.addTransceiver('audio', { direction: 'sendrecv' });
    pc.addTransceiver('video', { direction: 'sendrecv' });
    pc.onicecandidate = e => {
      if (e.candidate) this.send({ type: 'signal', payload: { candidate: e.candidate.toJSON() } });
    };
    pc.onconnectionstatechange = () => this.emit('onConnection', pc.connectionState);
    pc.ontrack = e => {
      if (!this.remoteStream.getTracks().includes(e.track)) this.remoteStream.addTrack(e.track);
      this.emit('onRemoteStream', this.remoteStream);
    };
    this.attachMedia().catch(e => this.emit('onError', e.message));
    return pc;
  }
  async handleSignal(payload) {
    if (!payload || typeof payload !== 'object') return;
    const pc = this.ensurePeer();
    if (payload.description) {
      await pc.setRemoteDescription(payload.description);
      for (const c of this.pendingCandidates.splice(0)) await pc.addIceCandidate(c);
      if (payload.description.type === 'offer') {
        await pc.setLocalDescription(await pc.createAnswer());
        this.send({ type: 'signal', payload: { description: pc.localDescription } });
      }
    } else if (payload.candidate) {
      if (pc.remoteDescription) await pc.addIceCandidate(payload.candidate);
      else this.pendingCandidates.push(payload.candidate);
    }
  }
  async attachMedia() {
    if (!this.pc) return;
    const tracks = this.pc.getTransceivers();
    const audio = tracks.find(t => t.receiver.track.kind === 'audio');
    const video = tracks.find(t => t.receiver.track.kind === 'video');
    await Promise.all([audio?.sender.replaceTrack(this.audioTrack), video?.sender.replaceTrack(this.videoTrack)]);
  }
  async setMicrophone(active) {
    if (!active) { this.audioTrack?.stop(); this.audioTrack = null; }
    else if (!this.audioTrack) {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      this.audioTrack = s.getAudioTracks()[0];
    }
    await this.attachMedia();
    return Boolean(this.audioTrack);
  }
  async share(stream) {
    const track = stream?.getVideoTracks()[0];
    if (!track) throw new Error('No video track available.');
    this.videoTrack?.stop();
    this.videoTrack = track;
    track.addEventListener('ended', () => {
      if (this.videoTrack === track) this.stopSharing();
    }, { once: true });
    await this.attachMedia();
    this.send({ type: 'share-state', active: true });
  }
  async stopSharing() {
    const track = this.videoTrack;
    this.videoTrack = null;
    if (track) track.stop();
    await this.attachMedia();
    this.send({ type: 'share-state', active: false });
  }
  sendPose(pose) { if (this.role) this.send({ type: 'pose', pose }); }
  closePeer() {
    this.pc?.close();
    this.pc = null;
    for (const track of this.remoteStream.getTracks()) this.remoteStream.removeTrack(track);
    this.pendingCandidates = [];
    this.emit('onRemoteStream', null);
    this.emit('onRemoteShareState', false);
  }
  disconnect() {
    this.socket?.close();
    this.socket = null;
    this.closePeer();
    this.role = null;
    this.peerName = null;
    this.videoTrack?.stop();
    this.audioTrack?.stop();
    this.videoTrack = null;
    this.audioTrack = null;
    this.emit('onStatus', { phase: 'offline' });
  }
}
