/**
 * ΦSpatial Scene Interchange R6.
 * A strict, passive visual manifest for cross-app import/export.
 * No executable commands, physics authority, URLs to fetch, or XR permissions.
 */
import {workspaceToText} from './workspace.js';
import {EVIDENCE_KIND} from './evidence-layer.js';

export const SCENE_SCHEMA='phi.spatial.scene.v1';
export const SCENE_MAX_BYTES=96000;
export const SCENE_MAX_NODES=120;
export const SCENE_TRUTH='UNVERIFIED_VISUALIZATION_ONLY';
export const COORDINATE_FRAME=Object.freeze({
  handedness:'right',upAxis:'Y',unit:'meter',origin:'illustrative-local'
});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
  Object.keys(v).length===keys.length && Object.keys(v).every(k=>keys.includes(k));
const cleanString=(v,max,label)=>{
  if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u001f\u007f]/.test(v))
    throw new TypeError('Invalid '+label);
  return v.trim();
};
const url=(value,kind)=>{
  if(value===null){
    if(kind==='reported-measurement')throw new TypeError('Reported measurements require a source URL');
    return null;
  }
  if(typeof value!=='string'||value.length>500)throw new TypeError('Invalid source URL');
  let u;try{u=new URL(value);}catch{throw new TypeError('Invalid source URL');}
  if(u.href!==value||u.protocol!=='https:'||!u.hostname||u.username||u.password||u.hash)
    throw new TypeError('Source URL must be canonical HTTPS with no credentials or fragment');
  return value;
};
const point=p=>{
  if(!exact(p,['x','y','z'])||!['x','y','z'].every(k=>finite(p[k]))||
    Math.abs(p.x)>6.1||Math.abs(p.z)>6.1||p.y<-.1||p.y>8.1)
    throw new RangeError('Invalid visual node position');
  return {...p};
};
const valueMetadata=meta=>{
  if(!exact(meta,['kind','unit','value','uncertainty','source','sourceUrl','method'])||
    !Object.hasOwn(EVIDENCE_KIND,meta.kind)||!finite(meta.value)||
    Math.abs(meta.value)>1e9||
    meta.uncertainty!==null&&(!finite(meta.uncertainty)||meta.uncertainty<0||meta.uncertainty>1e9))
    throw new TypeError('Invalid evidence metadata');
  const unit=cleanString(meta.unit,24,'evidence unit');
  if(!/^[a-zA-Z0-9 °%/^._-]+$/.test(unit))throw new TypeError('Invalid evidence unit');
  return {kind:meta.kind,unit,value:meta.value,uncertainty:meta.uncertainty,
    source:cleanString(meta.source,180,'evidence source'),
    sourceUrl:url(meta.sourceUrl,meta.kind),
    method:cleanString(meta.method,240,'evidence method')};
};
export function normalizeScene(input){
  if(!exact(input,['schema','truth','creator','title','coordinateFrame','nodes'])||
    input.schema!==SCENE_SCHEMA||input.truth!==SCENE_TRUTH||
    typeof input.creator!=='string'||!/^[a-z][a-z0-9-]{1,47}$/.test(input.creator)||
    !exact(input.coordinateFrame,['handedness','upAxis','unit','origin'])||
    Object.keys(COORDINATE_FRAME).some(k=>input.coordinateFrame[k]!==COORDINATE_FRAME[k])||
    !Array.isArray(input.nodes)||input.nodes.length>SCENE_MAX_NODES)
    throw new TypeError('Invalid passive scene manifest schema or coordinate frame');
  const title=cleanString(input.title,80,'scene title');
  const ids=new Set();
  const nodes=input.nodes.map(n=>{
    if(!exact(n,['id','kind','label','position','radius','metadata'])||
      typeof n.id!=='string'||!/^[a-z][a-z0-9_-]{0,47}$/.test(n.id)||
      ids.has(n.id)||!['sphere','evidence-marker'].includes(n.kind)||
      !finite(n.radius)||n.radius<.05||n.radius>1)
      throw new TypeError('Invalid or duplicate visual node');
    ids.add(n.id);
    const position=point(n.position);
    const label=cleanString(n.label,90,'node label');
    if(n.kind==='sphere' && n.metadata!==null)
      throw new TypeError('Sphere nodes cannot provide executable or arbitrary metadata');
    if(n.kind==='evidence-marker' && n.metadata===null)
      throw new TypeError('Evidence marker requires provenance metadata');
    return {id:n.id,kind:n.kind,label,position,radius:n.radius,
      metadata:n.metadata===null?null:valueMetadata(n.metadata)};
  });
  return {schema:SCENE_SCHEMA,truth:SCENE_TRUTH,creator:input.creator,
    title,coordinateFrame:{...COORDINATE_FRAME},nodes};
}
export function sceneFromWorkspace(workspace){
  // Reuse R5's canonical serializer. It strips derived address fields and
  // validates the entire R5 scene before any passive conversion.
  const w=JSON.parse(workspaceToText(workspace));
  const nodes=w.world.bodies.map(body=>({
    id:'body-'+body.id,kind:'sphere',label:'Simulated '+body.id,
    position:{...body.position},radius:body.r,metadata:null
  }));
  if(w.evidence){
    const {provenance,unit}=w.evidence;
    for(const item of w.evidence.points)nodes.push({
      id:'evidence-'+item.id,kind:'evidence-marker',label:item.label,
      position:{...item.position},radius:.12,
      metadata:{kind:provenance.kind,unit,value:item.value,uncertainty:item.uncertainty,
        source:provenance.source,sourceUrl:provenance.sourceUrl,method:provenance.method}
    });
  }
  return normalizeScene({
    schema:SCENE_SCHEMA,truth:SCENE_TRUTH,creator:'phi-space-dynamics',title:w.title,
    coordinateFrame:{...COORDINATE_FRAME},nodes
  });
}
export function sceneToText(scene){
  const data=normalizeScene(scene);
  const text=JSON.stringify(data,null,2);
  if(new TextEncoder().encode(text).length>SCENE_MAX_BYTES)
    throw new RangeError('Scene file exceeds 96 KB');
  return text;
}
export function parseSceneText(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>SCENE_MAX_BYTES)
    throw new RangeError('Scene file exceeds 96 KB');
  let decoded;try{decoded=JSON.parse(text);}catch{throw new TypeError('Malformed scene JSON');}
  return normalizeScene(decoded);
}
