/** Strict transport-neutral spatial protocol. Validation is NOT authentication. */
export const SPACE_PROTOCOL='phi.space.sync.v1';
export const ROOM_RE=/^[A-Z0-9]{8}$/;
export const GRAVITIES=Object.freeze([-9.81,-1.62,0]);
export const FIELDS=Object.freeze(['off','center']);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const exact=(o,ks)=>o&&typeof o==='object'&&!Array.isArray(o)&&
  Object.keys(o).length===ks.length&&Object.keys(o).every(k=>ks.includes(k));
const bodyId=id=>typeof id==='string'&&/^orb-[1-9][0-9]{0,5}$/.test(id);
export function validateSpaceCommand(m){
  if(!m||m.type!=='space-command'||!Number.isSafeInteger(m.seq)||m.seq<1||m.seq>1e9)return null;
  if(['add','pause','reset'].includes(m.action))
    return exact(m,['type','seq','action'])?{action:m.action,seq:m.seq}:null;
  if(m.action==='gravity'&&exact(m,['type','seq','action','value'])&&GRAVITIES.includes(m.value))
    return {action:m.action,seq:m.seq,value:m.value};
  if(m.action==='field'&&exact(m,['type','seq','action','value'])&&FIELDS.includes(m.value))
    return {action:m.action,seq:m.seq,value:m.value};
  if(m.action==='push'&&exact(m,['type','seq','action','id','vector'])&&bodyId(m.id)&&
    exact(m.vector,['x','y','z'])&&['x','y','z'].every(k=>finite(m.vector[k])&&Math.abs(m.vector[k])<=8)&&
    Math.hypot(m.vector.x,m.vector.y,m.vector.z)>0)
    return {action:m.action,seq:m.seq,id:m.id,vector:{...m.vector}};
  return null;
}
export function validSpaceState(p){
  if(!p||p.type!=='space-state'||p.protocol!==SPACE_PROTOCOL||
    typeof p.epoch!=='string'||!/^[a-f0-9-]{36}$/.test(p.epoch)||
    !Number.isSafeInteger(p.revision)||p.revision<0)return false;
  const s=p.world;
  if(!s||s.schema!=='phi.space-dynamics.world.v1'||
    s.truth!=='ILLUSTRATIVE_SIMULATION_NOT_MEASURED'||
    !finite(s.elapsedSeconds)||s.elapsedSeconds<0||s.elapsedSeconds>1e8||
    !GRAVITIES.includes(s.gravity)||!FIELDS.includes(s.field)||
    typeof s.paused!=='boolean'||!Array.isArray(s.bodies)||s.bodies.length>24)return false;
  const seen=new Set();
  for(const b of s.bodies){
    if(!b||!bodyId(b.id)||seen.has(b.id)||
      !finite(b.r)||b.r<.1||b.r>1||!finite(b.m)||b.m<.2||b.m>10||
      !b.position||!b.velocity||!['x','y','z'].every(k=>
        finite(b.position[k])&&Math.abs(b.position[k])<=8.1&&
        finite(b.velocity[k])&&Math.abs(b.velocity[k])<=100))return false;
    seen.add(b.id);
  }
  return true;
}
export function hydrateSpaceWorld(packet){
  if(!validSpaceState(packet))throw new TypeError('Invalid space snapshot');
  const s=packet.world;
  return {schema:s.schema,gravity:s.gravity,field:s.field,paused:s.paused,
    elapsed:s.elapsedSeconds,accumulator:0,nextId:1,bodies:s.bodies.map(b=>({
      id:b.id,r:b.r,m:b.m,p:{...b.position},v:{...b.velocity}
    }))};
}
