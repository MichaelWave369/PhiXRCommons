/**
 * ΦSpace R5: consciously local, portable 1-file workspace contract.
 * No browser storage, network, code execution, or permission persistence.
 */
import {snapshot,LAYERS} from './core.js';
import {normalizeEvidence,evidenceAsJson} from './evidence-layer.js';
import {GRAVITIES,FIELDS} from './protocol.js';
export const WORKSPACE_SCHEMA='phi.space.workspace.v1';
export const WORKSPACE_MAX_BYTES=128000;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const exact=(o,k)=>o&&typeof o==='object'&&!Array.isArray(o)&&
  Object.keys(o).length===k.length&&Object.keys(o).every(p=>k.includes(p));
const bodyId=id=>typeof id==='string'&&/^orb-[1-9][0-9]{0,5}$/.test(id);
const vec=(v,limit)=>exact(v,['x','y','z'])&&['x','y','z'].every(k=>finite(v[k])&&Math.abs(v[k])<=limit);
function cleanTitle(s){
 if(typeof s!=='string'||!s.trim()||s.length>80||
   /[\u0000-\u001f\u007f]/.test(s))throw new TypeError('Invalid workspace title');
 return s.trim();
}
export function normalizeWorkspace(input){
 if(!exact(input,['schema','truth','title','world','evidence','view'])||
   input.schema!==WORKSPACE_SCHEMA||
   input.truth!=='LOCAL_PORTABLE_UNVERIFIED_SIMULATION')
   throw new TypeError('Invalid workspace schema/truth label');
 const title=cleanTitle(input.title);
 const w=input.world;
 if(!exact(w,['schema','elapsedSeconds','gravity','field','paused','nextId','bodies'])||
   w.schema!=='phi.space-dynamics.world.v1'||
   !finite(w.elapsedSeconds)||w.elapsedSeconds<0||w.elapsedSeconds>1e8||
   !GRAVITIES.includes(w.gravity)||!FIELDS.includes(w.field)||
   typeof w.paused!=='boolean'||
   !Number.isSafeInteger(w.nextId)||w.nextId<1||w.nextId>999999||
   !Array.isArray(w.bodies)||w.bodies.length>24)
   throw new TypeError('Invalid bounded world configuration');
 const ids=new Set();let highest=0;
 const bodies=w.bodies.map(b=>{
   if(!exact(b,['id','r','m','position','velocity'])||!bodyId(b.id)||ids.has(b.id)||
     !finite(b.r)||b.r<.1||b.r>1||
     !finite(b.m)||b.m<.2||b.m>10||
     !vec(b.position,8.1)||b.position.y<b.r-.1||
     !vec(b.velocity,100))
     throw new TypeError('Invalid body, physics values, or duplicate ID');
   ids.add(b.id);
   highest=Math.max(highest,Number(b.id.slice(4)));
   return {id:b.id,r:b.r,m:b.m,position:{...b.position},velocity:{...b.velocity}};
 });
 if(w.nextId<=highest)throw new TypeError('nextId must exceed all existing body IDs');
 const view=input.view;
 if(!exact(view,['selectedOrb','inspectionLayer','showEvidence'])||
   (view.selectedOrb!==null && !ids.has(view.selectedOrb))||
   !LAYERS.includes(view.inspectionLayer)||
   typeof view.showEvidence!=='boolean')
   throw new TypeError('Invalid local inspection view');
 let evidence=null;
 if(input.evidence!==null){
   evidence=normalizeEvidence(input.evidence);
 }
 return {
   schema:WORKSPACE_SCHEMA,truth:input.truth,title,
   world:{schema:w.schema,elapsedSeconds:w.elapsedSeconds,gravity:w.gravity,
     field:w.field,paused:w.paused,nextId:w.nextId,bodies},
   evidence,view:{...view}
 };
}
function fileEvidence(normalized){
 if(normalized===null)return null;
 return JSON.parse(evidenceAsJson(normalized));
}
export function createWorkspace(world,evidence=null,{title='Untitled spatial workspace',
  selectedOrb=null,inspectionLayer='matter',showEvidence=true}={}){
 const s=snapshot(world);
 return normalizeWorkspace({
   schema:WORKSPACE_SCHEMA,truth:'LOCAL_PORTABLE_UNVERIFIED_SIMULATION',
   title,world:{schema:s.schema,elapsedSeconds:s.elapsedSeconds,
     gravity:s.gravity,field:s.field,paused:world.paused,nextId:world.nextId,
     bodies:s.bodies.map(({id,r,m,position,velocity})=>
       ({id,r,m,position,velocity}))},
   evidence:fileEvidence(evidence),
   view:{selectedOrb,inspectionLayer,showEvidence}
 });
}
export function workspaceToText(workspace){
 const n=normalizeWorkspace({...workspace,evidence:fileEvidence(workspace.evidence)});
 const raw={...n,evidence:fileEvidence(n.evidence)};
 const text=JSON.stringify(raw,null,2);
 if(new TextEncoder().encode(text).length>WORKSPACE_MAX_BYTES)
   throw new RangeError('Workspace exceeds 128 KB');
 return text;
}
export function parseWorkspaceText(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>WORKSPACE_MAX_BYTES)
   throw new RangeError('Workspace exceeds 128 KB');
 let parsed;
 try{parsed=JSON.parse(text);}catch{throw new TypeError('Malformed workspace JSON');}
 return normalizeWorkspace(parsed);
}
export function restoreWorld(workspace){
 const n=normalizeWorkspace({...workspace,evidence:fileEvidence(workspace.evidence)});
 const w=n.world;
 return {schema:w.schema,gravity:w.gravity,field:w.field,paused:w.paused,
   elapsed:w.elapsedSeconds,accumulator:0,nextId:w.nextId,
   bodies:w.bodies.map(b=>({id:b.id,r:b.r,m:b.m,p:{...b.position},v:{...b.velocity}}))
 };
}
