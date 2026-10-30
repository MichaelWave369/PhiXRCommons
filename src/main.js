import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { RoomClient, createRoomCode, normalizeRoom } from './network.js';
import { readThumbstick, snapTurnStep } from './locomotion.js';
import './style.css';

const $ = id => document.getElementById(id);
const ui = {
  url: $('server-url'), room: $('room-code'), name: $('display-name'),
  join: $('join'), leave: $('leave'), generate: $('generate'), copyRoom: $('copy-room'),
  stunUrl: $('stun-url'), turnUrl: $('turn-url'), turnUser: $('turn-user'), turnPass: $('turn-pass'),
  rtc: $('rtc-state'), ice: $('ice-state'),
  mic: $('mic'), share: $('share'), shareWindow: $('share-window'),
  status: $('connection-status'), dot: $('status-dot'), count: $('seat-count'),
  seat1: $('seat-one'), seat2: $('seat-two'), message: $('message'),
};
ui.url.value = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'ws://127.0.0.1:8787' : '';
ui.room.value = createRoomCode();
ui.name.value = 'Explorer';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050e1d);
scene.fog = new THREE.FogExp2(0x050e1d, 0.016);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.04, 200);
const rig = new THREE.Group();
rig.add(camera);
scene.add(rig);
camera.position.set(0, 3.2, 9.5);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.getElementById('world').appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.target.set(0, 1.95, -2.0);
orbit.maxDistance = 20;
orbit.minDistance = 3;
orbit.maxPolarAngle = Math.PI * 0.49;
const ambient = new THREE.HemisphereLight(0x8fceff, 0x152332, 2.0);
scene.add(ambient);
const mainLight = new THREE.PointLight(0x51e9de, 110, 28);
mainLight.position.set(0, 6, -2);
scene.add(mainLight);
const violetLight = new THREE.PointLight(0x825bea, 65, 24);
violetLight.position.set(-5, 4, 4);
scene.add(violetLight);

function material(color, opacity = 1) {
  return new THREE.MeshStandardMaterial({ color, transparent: opacity < 1, opacity, metalness: .6, roughness: .3, side: THREE.DoubleSide });
}
function addMesh(parent, geometry, mat, x=0, y=0, z=0) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(x,y,z);
  parent.add(mesh);
  return mesh;
}
function textTexture(text, subtitle = '', accent = '#79eee6') {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#071927'; ctx.fillRect(0, 0, 1024, 512);
  ctx.strokeStyle = accent; ctx.lineWidth = 6; ctx.strokeRect(18,18,988,476);
  ctx.fillStyle = accent; ctx.font = 'bold 66px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(text.slice(0, 24), 512, 229);
  ctx.fillStyle = '#adcad5'; ctx.font = '28px sans-serif';
  ctx.fillText(subtitle.slice(0, 44), 512, 300);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function textPlane(parent, text, subtitle, width, height, x, y, z, accent) {
  const mesh = addMesh(parent, new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({
    map: textTexture(text, subtitle, accent), side: THREE.DoubleSide,
  }), x, y, z);
  return mesh;
}

// Architecture: floating circular hall with a sky dome, glowing rim and starfield.
const floor = addMesh(scene, new THREE.CylinderGeometry(10.5,10.6,.24,96), material(0x0b2132),0,-.13,-1.5);
const inlay = new THREE.MeshBasicMaterial({ color: 0x3bcec3, transparent: true, opacity: .63 });
for (const radius of [3.1,6.4,9.7]) {
  const ring = addMesh(scene,new THREE.TorusGeometry(radius,.045,7,128),inlay,0,.02,-1.5);
  ring.rotation.x = Math.PI/2;
}
for(let i=0;i<16;i++) {
  const angle = i/16*Math.PI*2;
  const x=Math.cos(angle)*9.5, z=Math.sin(angle)*9.5-1.5;
  addMesh(scene,new THREE.CylinderGeometry(.12,.18,5,9),material(i%2?0x214c65:0x266967),x,2.5,z);
  addMesh(scene,new THREE.SphereGeometry(.18,10,10),new THREE.MeshBasicMaterial({color:0x76f5e4}),x,5,z);
}
for(let i=0;i<260;i++) {
  const a = i * 2.399963, h= 5+(i%17)*.65, r=23+(i%11)*2;
  addMesh(scene,new THREE.SphereGeometry(i%5===0?.065:.035,5,4),new THREE.MeshBasicMaterial({color:i%3===0?0x9fc9ff:0x83d9d4}),Math.cos(a)*r,h,Math.sin(a)*r);
}
const central = addMesh(scene,new THREE.IcosahedronGeometry(.85,2),material(0x45a9ad,.26),0,2.65,-2.1);
const centralRing = addMesh(scene,new THREE.TorusGeometry(1.55,.022,5,110),new THREE.MeshBasicMaterial({color:0x57e2d4}),0,2.65,-2.1);
textPlane(scene,'Φ XR COMMONS','TWO WORLDS · ONE ROOM',3.5,.9,0,5.5,-6.1,'#6eeadf');

function makeScreen(x,number) {
  const group = new THREE.Group(); group.position.set(x,2.5,-6); scene.add(group);
  const frame = addMesh(group,new THREE.BoxGeometry(4.25,2.6,.16),material(0x1c5764));
  frame.material.emissive = new THREE.Color(0x0a3339);
  const surface = addMesh(group,new THREE.PlaneGeometry(3.96,2.30),new THREE.MeshBasicMaterial({map:textTexture('SCREEN '+number,'AWAITING AN OPT-IN FEED')}),0,0,.1);
  const pedestal = addMesh(scene,new THREE.CylinderGeometry(.28,.62,1.14,8),material(0x1c4c58),x,.57,-6);
  pedestal.rotation.y = Math.PI/8;
  textPlane(group,'PLAYER '+number,'LIVE VIEW PORT',2.8,.33,0,-1.57,.1,'#59c9ca');
  return {surface};
}
const screens=[makeScreen(-3.1,1),makeScreen(3.1,2)];
function setScreenMessage(n,title,subtitle) {
  const mat=screens[n-1].surface.material;
  mat.map?.dispose();
  mat.map=textTexture(title,subtitle);
  mat.color.set(0xffffff);
  mat.needsUpdate=true;
}
let remoteVideo=null, remoteTexture=null, remoteShareActive=false;
function clearRemoteVideo() {
  if(remoteVideo) { remoteVideo.pause(); remoteVideo.srcObject=null; remoteVideo=null; }
  if(remoteTexture) { remoteTexture.dispose(); remoteTexture=null; }
}
function showRemoteMedia(stream) {
  clearRemoteVideo();
  const role=client.role === 1 ? 2 : 1;
  if (!client.role || !stream?.getVideoTracks().length) {
    if(client.role) setScreenMessage(role,'AWAITING FEED','PEER MUST CHOOSE TO SHARE');
    return;
  }
  remoteVideo=document.createElement('video');
  remoteVideo.autoplay=true; remoteVideo.playsInline=true; remoteVideo.muted=true;
  remoteVideo.srcObject=new MediaStream(stream.getVideoTracks());
  remoteVideo.play().catch(()=>note('Tap a screen to permit video playback.'));
  remoteTexture = new THREE.VideoTexture(remoteVideo);
  remoteTexture.colorSpace = THREE.SRGBColorSpace;
  screens[role-1].surface.material.map?.dispose();
  screens[role-1].surface.material.map=remoteTexture;
  screens[role-1].surface.material.needsUpdate=true;
}
const audioPlayback = document.createElement('audio');
audioPlayback.autoplay=true; audioPlayback.playsInline=true;
document.body.appendChild(audioPlayback);

// A seated remote silhouette with head + two animated hand markers.
const remoteAvatar = new THREE.Group(); scene.add(remoteAvatar); remoteAvatar.visible=false;
const torso=addMesh(remoteAvatar,new THREE.CapsuleGeometry(.24,.65,4,9),material(0x44aaa8,.85),0,1.08,0);
const head=addMesh(remoteAvatar,new THREE.SphereGeometry(.27,20,16),material(0xb5e5ee),0,1.68,0);
const hands=[-1,1].map(side=>addMesh(remoteAvatar,new THREE.SphereGeometry(.13,12,9),material(0x72ffe6),side*.45,1.2,.15));
const halo=addMesh(remoteAvatar,new THREE.TorusGeometry(.36,.027,8,50),new THREE.MeshBasicMaterial({color:0x66f0e1}),0,2.18,0);
halo.rotation.x = Math.PI/2;

const interactive=[];
function createConsoleButton(label,x,handler) {
  const body=addMesh(scene,new THREE.BoxGeometry(1.6,.56,.13),material(0x174a53),x,1.28,-1.15);
  textPlane(scene,label,'TRIGGER TO ACT',1.44,.4,x,1.28,-1.05,'#6eeadf');
  interactive.push({ mesh:body, handler });
}
createConsoleButton('MICROPHONE',2.6,()=>toggleMic());
createConsoleButton('SHARE VIEW',4.4,()=>toggleShare());
createConsoleButton('STOP SHARE',6.2,()=>{ if(client.videoTrack) toggleShare(); });
textPlane(scene,'FIELD CONSOLE','POINT + TRIGGER',4,.55,4.4,2,-1.1,'#85c8fc');
const statusBoard=textPlane(scene,'FIELD LINK','OFFLINE · EXPLORE THE GALLERY',3.8,.72,0,3.8,-5.2,'#79eee6');
function updateFieldBoard(title,subtitle) {
  statusBoard.material.map?.dispose();
  statusBoard.material.map=textTexture(title,subtitle);
  statusBoard.material.needsUpdate=true;
}

// Synchronized remote head pose uses bounded offsets from a fixed opposite seat.
function updateRemotePose(p) {
  if(!remoteAvatar.visible) return;
  remoteAvatar.position.set(client.role===1?2.1:-2.1,0,.3);
  head.position.set(THREE.MathUtils.clamp(p.x*.15,-.3,.3),1.68+THREE.MathUtils.clamp((p.y-1.65)*.25,-.45,.45),THREE.MathUtils.clamp(p.z*.08,-.3,.3));
  head.quaternion.set(p.qx,p.qy,p.qz,p.qw);
  const remoteHands=Array.isArray(p.hands)?p.hands:[];
  hands.forEach((hand,i)=>{
    hand.visible=Boolean(remoteHands[i]);
    if(remoteHands[i]) {
      const h=remoteHands[i];
      hand.position.set(THREE.MathUtils.clamp(h.x*.3,-1.2,1.2),THREE.MathUtils.clamp(h.y,0.35,2.6),THREE.MathUtils.clamp(h.z*.2,-.8,.8));
    }
  });
}

function note(text) { ui.message.textContent=text; }
let rtcPhase='idle', icePhase='idle';
function diagnostics() {
  ui.rtc.textContent=rtcPhase.toUpperCase();
  ui.ice.textContent=icePhase.toUpperCase();
  if(icePhase==='failed') {
    updateFieldBoard('ICE CONNECTION FAILED','CHECK STUN/TURN CONFIGURATION');
    note('ICE failed: the headsets may need a TURN relay. Check the Advanced Connection settings and rejoin.');
  }
}
function status(info) {
  const joined=info.phase==='joined'||info.phase==='paired';
  ui.dot.classList.toggle('online',joined);
  ui.join.disabled=joined||info.phase==='connecting';
  ui.leave.disabled=!joined;
  ui.mic.disabled=!joined;
  ui.share.disabled=!joined;
  ui.shareWindow.disabled=!joined||!navigator.mediaDevices?.getDisplayMedia;
  ui.count.textContent=(info.count||0)+' / 2';
  ui.status.textContent=info.phase==='connecting'?'Connecting to signal server…':joined?'Connected to room '+info.room:'Offline gallery mode';
  if(!joined) {
    rtcPhase='idle'; icePhase='idle'; diagnostics();
    updateFieldBoard(info.phase==='connecting'?'LINKING ROOM':'FIELD LINK',info.phase==='connecting'?'CONNECTING TO SIGNAL SERVER':'OFFLINE · EXPLORE THE GALLERY');
  } else updateFieldBoard('ROOM '+info.room,info.count===2?'TWO EXPLORERS LINKED':'WAITING FOR SECOND EXPLORER');
  if(!joined) {
    remoteAvatar.visible=false; ui.seat1.textContent='Awaiting explorer'; ui.seat2.textContent='Awaiting explorer';
    ui.mic.textContent='MIC OFF'; ui.share.textContent='SHARE VIEW';
    return;
  }
  ui.seat1.textContent=info.role===1?client.name:(info.peerName||'Awaiting explorer');
  ui.seat2.textContent=info.role===2?client.name:(info.peerName||'Awaiting explorer');
  if(info.count===1) {
    if(info.role===1) ui.seat2.textContent='Awaiting explorer';
    else ui.seat1.textContent='Awaiting explorer';
  }
  remoteAvatar.visible=info.count===2;
  setScreenMessage(info.role,'YOUR STATION',client.videoTrack?'BROADCASTING':'READY TO SHARE');
  if(info.count===1) {
    setScreenMessage(info.role===1?2:1,'AWAITING PEER','JOIN USING SAME ROOM CODE');
  }
  note(info.count===2?'Peer arrived! WebRTC negotiating…':'Room joined. Share the code with the second Quest.');
}
const client=new RoomClient({
  onStatus:status,
  onError: note,
  onConnection: s => {
    rtcPhase=s; diagnostics();
    if(s==='connected') {
      updateFieldBoard('PEER CONNECTED','VOICE + VIDEO READY WHEN SHARED');
      note('Peer-to-peer connection established.');
    } else if(s==='failed') {
      updateFieldBoard('PEER CONNECTION FAILED','CHECK SIGNAL AND TURN RELAY');
      note('WebRTC failed. Try a TURN relay in Advanced Connection and rejoin.');
    } else note('WebRTC: '+s);
    if(s==='connected' && client.videoTrack) client.send({type:'share-state',active:true});
  },
  onIceStatus: s => {
    icePhase=s;
    diagnostics();
  },
  onPeerPose:updateRemotePose,
  onPeerLeft:()=>{remoteAvatar.visible=false;remoteShareActive=false;clearRemoteVideo();},
  onRemoteShareState:active=>{
    remoteShareActive=active;
    if(active && client.remoteStream.getVideoTracks().length) showRemoteMedia(client.remoteStream);
    else {
      clearRemoteVideo();
      if(client.role) setScreenMessage(client.role===1?2:1,'AWAITING FEED','PEER MUST CHOOSE TO SHARE');
    }
  },
  onRemoteStream: stream=>{
    const audio=stream?.getAudioTracks()||[];
    audioPlayback.srcObject=audio.length?new MediaStream(audio):null;
    if(audio.length) audioPlayback.play().catch(()=>note('Tap to unlock peer audio playback.'));
    if(remoteShareActive && stream && stream.getVideoTracks().length) showRemoteMedia(stream);
    else {clearRemoteVideo(); if(client.role) setScreenMessage(client.role===1?2:1,'AWAITING FEED','NO VIDEO TRACK');}
  },
});
ui.generate.addEventListener('click',()=>{ui.room.value=createRoomCode();});
ui.copyRoom.addEventListener('click',async()=>{
  try {
    const code=normalizeRoom(ui.room.value);
    if(!/^[A-Z0-9]{8}$/.test(code)) throw new Error('Generate or enter an eight-character room code first.');
    await navigator.clipboard.writeText(code);
    note('Room code copied. Only share it with your invited explorer.');
  } catch(e){ note('Copy failed: '+e.message); }
});
ui.join.addEventListener('click',async()=>{
  try {
    const room=normalizeRoom(ui.room.value||createRoomCode()); ui.room.value=room;
    const url=ui.url.value.trim();
    if(!url) throw new Error('Enter your self-hosted wss:// signaling address first.');
    client.setIceServers({
      stunUrl:ui.stunUrl.value,turnUrl:ui.turnUrl.value,
      turnUsername:ui.turnUser.value,turnCredential:ui.turnPass.value
    });
    await client.connect(url,room,ui.name.value);
  } catch(e) {note(e.message);}
});
ui.leave.addEventListener('click',()=>client.disconnect());
async function toggleMic() {
  try {
    const enabled=await client.setMicrophone(!client.audioTrack);
    ui.mic.textContent=enabled?'MIC ON':'MIC OFF';
    note(enabled?'Microphone enabled.':'Microphone muted.');
  } catch(e) {note('Microphone: '+e.message);}
}
async function toggleShare(windowTab=false) {
  try {
    if(client.videoTrack) {
      await client.stopSharing(); ui.share.textContent='SHARE VIEW';
      setScreenMessage(client.role,'YOUR STATION','READY TO SHARE');
      note('Broadcast stopped.');
      return;
    }
    if(!client.role) throw new Error('Join a room before sharing.');
    let stream;
    if(windowTab) {
      if(!navigator.mediaDevices?.getDisplayMedia) throw new Error('This browser cannot capture a window/tab.');
      stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
    } else {
      if(!renderer.domElement.captureStream) throw new Error('WebXR canvas capture is unsupported here.');
      stream=renderer.domElement.captureStream(15);
    }
    await client.share(stream);
    ui.share.textContent='STOP SHARE';
    setScreenMessage(client.role,'BROADCAST LIVE','OPT-IN VIEW SHARING');
    note('Sharing selected video feed. In headset browsers, canvas capture may be limited.');
  } catch(e) {note('Screen share: '+e.message);}
}
ui.mic.addEventListener('click',()=>toggleMic());
ui.share.addEventListener('click',()=>toggleShare());
ui.shareWindow.addEventListener('click',()=>toggleShare(true));

const raycaster=new THREE.Raycaster();
const pointer=new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown',e=>{
  if(renderer.xr.isPresenting) return;
  pointer.set((e.clientX/innerWidth)*2-1,-(e.clientY/innerHeight)*2+1);
  raycaster.setFromCamera(pointer,camera);
  const hit=raycaster.intersectObjects(interactive.map(x=>x.mesh))[0];
  if(hit) interactive.find(x=>x.mesh===hit.object)?.handler();
});
const controllers=[];
for(let i=0;i<2;i++){
  const c=renderer.xr.getController(i);
  c.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,-6)]),new THREE.LineBasicMaterial({color:0x6ff6e4})));
  c.addEventListener('select',()=>{
    raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);
    const q=new THREE.Quaternion().setFromRotationMatrix(c.matrixWorld);
    raycaster.ray.direction.set(0,0,-1).applyQuaternion(q);
    const hit=raycaster.intersectObjects(interactive.map(x=>x.mesh))[0];
    if(hit) interactive.find(x=>x.mesh===hit.object)?.handler();
  });
  rig.add(c);
  const grip=renderer.xr.getControllerGrip(i);
  grip.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.075,1),new THREE.MeshBasicMaterial({color:0x81e8dd})));
  rig.add(grip);
  controllers.push(c);
}
const tempPos=new THREE.Vector3(),tempQ=new THREE.Quaternion();
const moveForward=new THREE.Vector3(), moveRight=new THREE.Vector3(), upAxis=new THREE.Vector3(0,1,0);
const beforeTurn=new THREE.Vector3(), afterTurn=new THREE.Vector3();
let lastPose=0, lastFrameTime=0, turnArmed=true;
renderer.xr.addEventListener('sessionstart',()=>{
  turnArmed=true;
  lastFrameTime=0;
  note('Quest comfort: left stick moves; right stick snap turns 30°. Trigger selects console buttons.');
});
renderer.xr.addEventListener('sessionend',()=>{ lastFrameTime=0; turnArmed=true; });
renderer.setAnimationLoop((time,frame)=>{
  const sec=time*.001;
  central.rotation.y=sec*.19;
  central.rotation.z=sec*.11;
  centralRing.rotation.y=sec*.15;
  halo.rotation.z=sec*.3;
  const dt=lastFrameTime?Math.min((time-lastFrameTime)/1000,0.05):0;
  lastFrameTime=time;
  if(!renderer.xr.isPresenting) orbit.update();
  else {
    const session=renderer.xr.getSession();
    const sources=Array.from(session?.inputSources||[]);
    const left=sources.find(s=>s.handedness==='left'&&s.gamepad);
    const right=sources.find(s=>s.handedness==='right'&&s.gamepad);
    const xrView=renderer.xr.getCamera(camera);
    if(left&&dt>0) {
      const stick=readThumbstick(left.gamepad.axes);
      if(stick.x||stick.y){
        xrView.getWorldDirection(moveForward);
        moveForward.y=0;
        if(moveForward.lengthSq()>0.01){
          moveForward.normalize();
          moveRight.copy(moveForward).cross(upAxis).normalize();
          rig.position.addScaledVector(moveRight,stick.x*dt*1.45);
          rig.position.addScaledVector(moveForward,-stick.y*dt*1.45);
          rig.position.x=THREE.MathUtils.clamp(rig.position.x,-8,8);
          rig.position.z=THREE.MathUtils.clamp(rig.position.z,-9.5,6.5);
        }
      }
    }
    const turnAxis=right?readThumbstick(right.gamepad.axes).x:0;
    const turn=snapTurnStep(turnAxis,turnArmed);
    turnArmed=turn.armed;
    if(turn.degrees) {
      xrView.getWorldPosition(beforeTurn);
      rig.rotation.y+=THREE.MathUtils.degToRad(turn.degrees);
      rig.updateMatrixWorld(true);
      xrView.getWorldPosition(afterTurn);
      rig.position.add(beforeTurn.sub(afterTurn));
    }
  }
  if(client.role && time-lastPose>=110){
    lastPose=time;
    const view=renderer.xr.isPresenting?renderer.xr.getCamera(camera):camera;
    view.getWorldPosition(tempPos); view.getWorldQuaternion(tempQ);
    const handPos=controllers.map(c=>{
      if(!renderer.xr.isPresenting) return null;
      const p=new THREE.Vector3(); c.getWorldPosition(p);
      return {x:p.x,y:p.y,z:p.z};
    }).filter(Boolean);
    client.sendPose({x:tempPos.x,y:tempPos.y,z:tempPos.z,qx:tempQ.x,qy:tempQ.y,qz:tempQ.z,qw:tempQ.w,hands:handPos});
  }
  renderer.render(scene,camera);
});
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});
addEventListener('beforeunload',()=>client.disconnect());
note('Offline gallery is ready. Enter your WSS server to meet a second headset.');
