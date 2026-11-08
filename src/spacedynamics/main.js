import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import {LAYERS,createWorld,addBody,applyImpulse,stepWorld,addressAt,decodeAddress,snapshot} from './core.js';
import './style.css';

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
$('gravity').addEventListener('change',()=>{world.gravity=Number($('gravity').value);});
$('field').addEventListener('change',()=>{world.field=$('field').value;});
$('layer').addEventListener('change',showInspector);
$('pause').addEventListener('click',()=>{
  world.paused=!world.paused;
  $('pause').textContent=world.paused?'RESUME':'PAUSE';
});
$('reset').addEventListener('click',()=>{
  world=createWorld();selected='orb-1';
  $('gravity').value=String(world.gravity);$('field').value=world.field;
  $('pause').textContent='PAUSE';showInspector();
});
$('add').addEventListener('click',()=>{
  const id=addBody(world);
  $('status').textContent=id?'Created '+id+' locally. Not network-synced.':'Local orb limit reached (24).';
  if(id)setSelected(id);
});
$('push').addEventListener('click',()=>{
  if(applyImpulse(world,selected,{x:0,y:4,z:-3}))$('status').textContent='Applied a local impulse to '+selected+'.';
});
$('export').addEventListener('click',()=>{
  const data=JSON.stringify(snapshot(world),null,2);
  const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='phi-space-dynamics-r1.json';
  a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
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
    const hit=raycaster.intersectObjects([...meshes.values()],false)[0];
    if(hit){
      const id=hit.object.userData.bodyId;setSelected(id);
      applyImpulse(world,id,{x:direction.x*5,y:direction.y*5,z:direction.z*5});
    }
  });
}
renderer.xr.addEventListener('sessionstart',()=>{
  $('status').textContent='QUEST MODE · POINT AND TRIGGER TO SELECT/PUSH · ROOM SYNC OFF';
});
renderer.xr.addEventListener('sessionend',()=>{
  $('status').textContent='LOCAL DEMO · NO MULTIPLAYER SYNC OR INPUT BRIDGE';
});
let last=0,frame=0;
renderer.setAnimationLoop(time=>{
  const dt=last?Math.min((time-last)/1000,.1):0;
  last=time;
  stepWorld(world,dt);
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
