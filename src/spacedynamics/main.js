import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import {LAYERS,createWorld,addBody,applyImpulse,stepWorld,addressAt,decodeAddress,snapshot} from './core.js';
import './style.css';
import {SpaceClient} from './space-client.js';
import {hydrateSpaceWorld} from './protocol.js';
import {createRoomCode} from '../network.js';
import {SpaceGestureBridge} from './gesture-bridge.js';

const $ = id => document.getElementById(id);
let world = createWorld();
let selected = 'orb-1';
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07101d);
scene.fog = new THREE.Fog(0x07101d,18,46);
const camera = new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.04,100);
camera.position.set(8,6,12);
const renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('space').appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));
const orbit = new OrbitControls(camera,renderer.domElement);
orbit.enableDamping = true;
orbit.target.set(0,2,-.4);
orbit.minDistance = 3;
orbit.maxDistance = 27;
orbit.update();
scene.add(new THREE.HemisphereLight(0x91f2ff,0x111724,2.3));
const light = new THREE.PointLight(0x65ddcf,120,32);
light.position.set(0,8,1);scene.add(light);
const rim = new THREE.PointLight(0x6b6bff,55,20);
rim.position.set(-5,4,-5);scene.add(rim);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(12,12),
  new THREE.MeshStandardMaterial({color:0x102532,metalness:.3,roughness:.65,side:THREE.DoubleSide}));
floor.rotation.x=-Math.PI/2;
floor.position.y=-.012;scene.add(floor);
const grid = new THREE.GridHelper(12,12,0x57dbce,0x28556b);
grid.position.y=.004;scene.add(grid);
const border = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(12,8,12)),
  new THREE.LineBasicMaterial({color:0x298d93,transparent:true,opacity:.35}));
border.position.y=4;scene.add(border);
const geometry = new THREE.IcosahedronGeometry(1,2);
const colors = [0x5ce7d6,0x7fa7ff,0xffd380,0xc5a8ff,0x9ff0ff];
const meshes = new Map();

const roomLabel=$('space-state');
let lerpFrom=new Map(),lastNetworkFrame=0;
const spaceClient=new SpaceClient({
  status(info){
    if(info.phase==='joined')roomLabel.textContent='ROOM '+info.room+' · '+(info.role===1?'HOST':'GUEST')+' · SERVER PHYSICS';
    else if(info.phase==='connecting')roomLabel.textContent='CONNECTING TO SPACE SERVER…';
    else roomLabel.textContent='SOLO MODE · LOCAL WORLD';
    updateSpaceControls();
  },
  error(msg){roomLabel.textContent=msg;},
  receipt(msg){if(msg.accepted===false)roomLabel.textContent='ACTION DENIED · '+msg.code;},
  peerJoined(){roomLabel.textContent='SECOND EXPLORER CONNECTED · SHARED WORLD';},
  snapshot(packet){
    lerpFrom=new Map([...meshes].map(([id,mesh])=>[id,mesh.position.clone()]));
    world=hydrateSpaceWorld(packet);
    lastNetworkFrame=performance.now();
    if(!world.bodies.some(b=>b.id===selected))selected=world.bodies[0]?.id||null;
    $('gravity').value=String(world.gravity);$('field').value=world.field;
    $('pause').textContent=world.paused?'RESUME':'PAUSE';
    updateSpaceControls();
  }
});
function updateSpaceControls(){
  const guest=spaceClient.connected&&spaceClient.role!==1;
  for(const id of ['gravity','field','pause','reset'])$(id).disabled=guest;
  $('space-join').disabled=spaceClient.connected;
  $('space-leave').disabled=!spaceClient.ws;
}
$('space-server').value=location.hostname==='localhost'||location.hostname==='127.0.0.1'?'ws://127.0.0.1:8787':'';
$('space-room').value=createRoomCode();
$('space-generate').addEventListener('click',()=>{$('space-room').value=createRoomCode();});
$('space-join').addEventListener('click',()=>{
  try{spaceClient.connect($('space-server').value,$('space-room').value);}
  catch(error){roomLabel.textContent=error.message;}
});
$('space-leave').addEventListener('click',()=>spaceClient.disconnect());
addEventListener('beforeunload',()=>spaceClient.disconnect());

function syncMeshes() {
  for(const body of world.bodies) {
    if(!meshes.has(body.id)) {
      const material = new THREE.MeshStandardMaterial({
        color:colors[(Number(body.id.split('-')[1])-1)%colors.length],
        emissive:0x0d3038,metalness:.45,roughness:.22
      });
      const mesh = new THREE.Mesh(geometry,material);
      mesh.userData.bodyId=body.id;
      scene.add(mesh);meshes.set(body.id,mesh);
    }
    const mesh=meshes.get(body.id);
    mesh.position.set(body.p.x,body.p.y,body.p.z);
    if(spaceClient.connected&&lerpFrom.has(body.id)){
      const alpha=Math.min(1,(performance.now()-lastNetworkFrame)/120);
      mesh.position.lerpVectors(lerpFrom.get(body.id),
        new THREE.Vector3(body.p.x,body.p.y,body.p.z),alpha);
    }
    mesh.scale.setScalar(body.r);
    mesh.material.emissive.setHex(body.id===selected?0x399d89:0x0d3038);
  }
  for(const [id,mesh] of meshes) {
    if(world.bodies.some(b=>b.id===id))continue;
    scene.remove(mesh);mesh.material.dispose();meshes.delete(id);
  }
}
const selectionRing=new THREE.Mesh(
  new THREE.TorusGeometry(1,.038,8,64),
  new THREE.MeshBasicMaterial({color:0xa8fff0,transparent:true,opacity:.85}));
scene.add(selectionRing);
function setSelected(id) {
  if(world.bodies.some(b=>b.id===id))selected=id;
  showInspector();
}
function showInspector() {
  const b=world.bodies.find(b=>b.id===selected);
  if(!b){$('inspector').textContent='No orb selected';return;}
  const id=addressAt(b.p,$('layer').value||'matter');
  const addr=id?decodeAddress(id):null;
  $('inspector').textContent=
    'OBJECT   '+b.id+'\n'+
    'ADDRESS  '+(id||'OUTSIDE INDEXED VOLUME')+'\n'+
    'LAYER    '+(addr?addr.layerName:'N/A')+'\n'+
    'CELL     '+(addr?addr.x+','+addr.y+','+addr.z:'N/A')+'\n'+
    'POSITION '+[b.p.x,b.p.y,b.p.z].map(n=>n.toFixed(2)).join(', ')+' m\n'+
    'VELOCITY '+Math.hypot(b.v.x,b.v.y,b.v.z).toFixed(2)+' m/s\n'+
    'TIME     '+world.elapsed.toFixed(2)+' s';
  selectionRing.visible=true;
  selectionRing.position.set(b.p.x,b.p.y,b.p.z);
  selectionRing.scale.setScalar(b.r*1.32);
}
for(const layer of LAYERS) {
  const option=document.createElement('option');option.value=layer;option.textContent=layer.toUpperCase();
  $('layer').appendChild(option);
}
$('gravity').addEventListener('change',()=>{const value=Number($('gravity').value);if(spaceClient.connected)spaceClient.command('gravity',{value});else world.gravity=value;});
$('field').addEventListener('change',()=>{const value=$('field').value;if(spaceClient.connected)spaceClient.command('field',{value});else world.field=value;});
$('layer').addEventListener('change',showInspector);
$('pause').addEventListener('click',()=>{
  if(spaceClient.connected){spaceClient.command('pause');return;}
  world.paused=!world.paused;
  $('pause').textContent=world.paused?'RESUME':'PAUSE';
});
$('reset').addEventListener('click',()=>{
  if(spaceClient.connected){spaceClient.command('reset');return;}
  world=createWorld();selected='orb-1';
  $('gravity').value=String(world.gravity);$('field').value=world.field;
  $('pause').textContent='PAUSE';showInspector();
});
$('add').addEventListener('click',()=>{
  if(spaceClient.connected){spaceClient.command('add');return;}
  const id=addBody(world);
  $('status').textContent=id?'Created '+id+' locally. Not network-synced.':'Local orb limit reached (24).';
  if(id)setSelected(id);
});
$('push').addEventListener('click',()=>{
  if(spaceClient.connected){spaceClient.command('push',{id:selected,vector:{x:0,y:4,z:-3}});return;}
  if(applyImpulse(world,selected,{x:0,y:4,z:-3}))$('status').textContent='Applied a local impulse to '+selected+'.';
});
$('export').addEventListener('click',()=>{
  const data=JSON.stringify(snapshot(world),null,2);
  const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='phi-space-dynamics-r1.json';
  a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});

const poseBridge=new SpaceGestureBridge({
 onAction(id){
   if(id==='spacedynamics.select-next'){
     if(!world.bodies.length)return;
     const index=world.bodies.findIndex(b=>b.id===selected);
     setSelected(world.bodies[(index+1)%world.bodies.length].id);
   }
   if(id==='spacedynamics.push'){
     if(!world.bodies.some(b=>b.id===selected))return;
     const vector={x:0,y:4,z:-3};
     const applied=spaceClient.connected?spaceClient.command('push',{id:selected,vector})
       :applyImpulse(world,selected,vector);
     if(!applied)$('gesture-status').textContent='Recognized; push not applied.';
   }
 },
 onStatus(message){$('gesture-status').textContent=message;}
});
function poseTexture(heading,sub){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#082532';ctx.fillRect(0,0,512,256);
 ctx.strokeStyle='#70e6cf';ctx.lineWidth=8;ctx.strokeRect(12,12,488,232);
 ctx.fillStyle='#a1ffe7';ctx.font='bold 38px sans-serif';ctx.textAlign='center';
 ctx.fillText(heading,256,113);ctx.font='24px sans-serif';ctx.fillText(sub,256,165);
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
}
const posePad=new THREE.Mesh(new THREE.PlaneGeometry(1.5,.67),
 new THREE.MeshBasicMaterial({map:poseTexture('ΦPOSE DISABLED','ENABLE IN PANEL'),side:THREE.DoubleSide}));
posePad.position.set(0,1.45,-2.4);scene.add(posePad);
let displayedPoseState='';
function refreshPoseControls(){
 const now=performance.now();poseBridge.tick(now);
 $('gesture-enable').disabled=poseBridge.enabled;
 $('gesture-arm').disabled=!poseBridge.enabled;
 $('gesture-disable').disabled=!poseBridge.enabled;
 $('gesture-synthetic').disabled=poseBridge.enabled;
 $('gesture-action').disabled=poseBridge.armed;
 $('gesture-demo').hidden=!$('gesture-synthetic').checked;
 const label=poseBridge.armed?'ΦPOSE ARMED':poseBridge.enabled?'ARM ΦPOSE':'ΦPOSE DISABLED';
 if(label!==displayedPoseState){
   displayedPoseState=label;
   posePad.material.map?.dispose();
   posePad.material.map=poseTexture(label,poseBridge.enabled?'TRIGGER TO ARM':'ENABLE IN PANEL');
   posePad.material.needsUpdate=true;
 }
}
function armFromXR(){
 if(poseBridge.enabled)poseBridge.arm($('gesture-action').value,performance.now());
 refreshPoseControls();
}
$('gesture-enable').addEventListener('click',()=>{
 const demo=$('gesture-synthetic').checked;
 poseBridge.enable(performance.now(),{source:demo?'synthetic':'webxr',allowSyntheticDemo:demo});
 refreshPoseControls();
});
$('gesture-arm').addEventListener('click',()=>{armFromXR();});
$('gesture-disable').addEventListener('click',()=>{poseBridge.disable();refreshPoseControls();});
$('gesture-synthetic').addEventListener('change',()=>{poseBridge.disable('Source changed; re-enable');refreshPoseControls();});
$('gesture-action').addEventListener('change',()=>{
 poseBridge.cancel('Action changed; re-arm');refreshPoseControls();
});
for(const button of document.querySelectorAll('[data-pose-symbol]')){
 button.addEventListener('click',()=>{
   const result=poseBridge.synthetic(button.dataset.poseHand,button.dataset.poseSymbol,performance.now());
   if(!result.accepted && result.reason!=='step_completed')
     $('gesture-status').textContent='Demo token: '+result.reason;
   refreshPoseControls();
 });
}
refreshPoseControls();

const raycaster=new THREE.Raycaster();
const pointer=new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown',event=>{
  if(renderer.xr.isPresenting)return;
  pointer.set(event.clientX/innerWidth*2-1,-(event.clientY/innerHeight)*2+1);
  raycaster.setFromCamera(pointer,camera);
  const hit=raycaster.intersectObjects([...meshes.values()],false)[0];
  if(hit)setSelected(hit.object.userData.bodyId);
});
for(let i=0;i<2;i++){
  const controller=renderer.xr.getController(i);
  const laser=new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-5)]),
    new THREE.LineBasicMaterial({color:0x8effdf}));
  controller.add(laser);scene.add(controller);
  controller.addEventListener('select',()=>{
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    const direction=new THREE.Vector3(0,0,-1).applyQuaternion(
      new THREE.Quaternion().setFromRotationMatrix(controller.matrixWorld));
    raycaster.ray.direction.copy(direction);
    if(raycaster.intersectObject(posePad,false).length){armFromXR();return;}
    const hit=raycaster.intersectObjects([...meshes.values()],false)[0];
    if(hit){
      const id=hit.object.userData.bodyId;setSelected(id);
      const impulse={x:direction.x*5,y:direction.y*5,z:direction.z*5};
      if(spaceClient.connected)spaceClient.command('push',{id,vector:impulse});
      else applyImpulse(world,id,impulse);
    }
  });
}
renderer.xr.addEventListener('sessionstart',()=>{
  $('status').textContent='QUEST MODE · POINT AND TRIGGER TO SELECT/PUSH · ROOM SYNC OFF';
});
renderer.xr.addEventListener('sessionend',()=>{
  poseBridge.disable('XR session ended; gestures disabled.');
  refreshPoseControls();
  $('status').textContent='LOCAL DEMO · NO MULTIPLAYER SYNC OR INPUT BRIDGE';
});
let last=0,frame=0,gestureFrame=0;
renderer.setAnimationLoop((time,xrFrame)=>{
  if(renderer.xr.isPresenting&&poseBridge.armed)
    poseBridge.sample(xrFrame,renderer.xr.getSession(),renderer.xr.getReferenceSpace(),time);
  else poseBridge.tick(time);
  if(++gestureFrame%30===0)refreshPoseControls();
  const dt=last?Math.min((time-last)/1000,.1):0;
  last=time;
  if(!spaceClient.connected)stepWorld(world,dt);
  syncMeshes();
  const body=world.bodies.find(b=>b.id===selected);
  selectionRing.visible=Boolean(body);
  if(body) {
    selectionRing.position.set(body.p.x,body.p.y,body.p.z);
    selectionRing.scale.setScalar(body.r*1.32);
    selectionRing.rotation.y+=dt*.4;
  }
  if(++frame%12===0)showInspector();
  if(!renderer.xr.isPresenting)orbit.update();
  renderer.render(scene,camera);
});
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});
showInspector();
