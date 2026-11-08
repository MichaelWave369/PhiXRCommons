/**
 * Evidence Lens v0.1 · local bounded display data.
 * Research labels are source assertions, not independent verification.
 * No network, execution, persistence, physical authority, or source fetching.
 */
import {addressAt} from './core.js';
export const EVIDENCE_SCHEMA='phi.space.evidence.v1';
export const EVIDENCE_MAX_BYTES=72000;
export const EVIDENCE_MAX_POINTS=96;
export const EVIDENCE_KIND=Object.freeze({
  synthetic:'SYNTHETIC EXAMPLE · NOT MEASURED',
  'reported-measurement':'REPORTED MEASUREMENT · UNVERIFIED',
  'model-output':'MODEL OUTPUT · UNVERIFIED',
  hypothesis:'HYPOTHESIS · NOT MEASURED'
});
const own=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&
  Object.keys(o).length===keys.length&&Object.keys(o).every(k=>keys.includes(k));
const finite=n=>typeof n==='number'&&Number.isFinite(n);
function label(s,max,field){
  if(typeof s!=='string'||s.length<1||s.length>max||!s.trim()||
    /[\u0000-\u001f\u007f]/.test(s))throw new TypeError('Invalid '+field);
  return s.trim();
}
function sourceUrl(raw,kind){
  if(raw===null){
    if(kind==='reported-measurement')throw new TypeError('Reported measurement requires an HTTPS source URL');
    return null;
  }
  if(typeof raw!=='string'||raw.length>500)throw new TypeError('Invalid source URL');
  let url;try{url=new URL(raw);}catch{throw new TypeError('Invalid source URL');}
  if(url.protocol!=='https:'||!url.hostname||url.username||url.password||
     url.hash||url.href!==raw)throw new TypeError('Source URL must be exact HTTPS, without credentials or fragment');
  return raw;
}
export function normalizeEvidence(raw){
  if(!own(raw,['schema','title','mapping','unit','provenance','points'])||
    raw.schema!==EVIDENCE_SCHEMA||
    raw.mapping!=='illustrative-lab-meters-v1')throw new TypeError('Invalid Evidence Lens schema');
  const title=label(raw.title,100,'dataset title');
  const unit=label(raw.unit,24,'measurement unit');
  if(!/^[a-zA-Z0-9 °%/^._-]+$/.test(unit))throw new TypeError('Invalid measurement unit');
  const p=raw.provenance;
  if(!own(p,['kind','source','sourceUrl','method'])||
    !Object.hasOwn(EVIDENCE_KIND,p.kind))throw new TypeError('Invalid provenance');
  const provenance={
    kind:p.kind,
    source:label(p.source,180,'provenance source'),
    sourceUrl:sourceUrl(p.sourceUrl,p.kind),
    method:label(p.method,240,'provenance method')
  };
  if(!Array.isArray(raw.points)||raw.points.length<1||
    raw.points.length>EVIDENCE_MAX_POINTS)throw new RangeError('Evidence must contain 1–96 points');
  const ids=new Set();
  const points=raw.points.map(entry=>{
    if(!entry||typeof entry!=='object'||Array.isArray(entry)||
      !['id','label','position','value','uncertainty'].every(k=>k in entry)||
      !own(entry,['id','label','position','value','uncertainty'])||
      typeof entry.id!=='string'|| !/^[a-z][a-z0-9-]{0,31}$/.test(entry.id)||
      ids.has(entry.id))throw new TypeError('Invalid or duplicate point ID/fields');
    ids.add(entry.id);
    const name=label(entry.label,90,'point label');
    const pos=entry.position;
    if(!own(pos,['x','y','z'])||!['x','y','z'].every(k=>finite(pos[k]))||
      Math.abs(pos.x)>5.7||Math.abs(pos.z)>5.7||pos.y<.25||pos.y>5.7)
      throw new RangeError('Point position outside safe indexed lab volume');
    if(!finite(entry.value)||Math.abs(entry.value)>1e9)
      throw new RangeError('Invalid bounded point value');
    if(entry.uncertainty!==null && (!finite(entry.uncertainty)||
      entry.uncertainty<0||entry.uncertainty>1e9))
      throw new RangeError('Invalid nonnegative absolute uncertainty');
    return {id:entry.id,label:name,position:{...pos},value:entry.value,
      uncertainty:entry.uncertainty,address:addressAt(pos,'evidence')};
  });
  return {schema:EVIDENCE_SCHEMA,title,mapping:raw.mapping,unit,provenance,points};
}
export function parseEvidenceText(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>EVIDENCE_MAX_BYTES)
    throw new RangeError('Evidence JSON exceeds 72 KB');
  let raw;try{raw=JSON.parse(text);}catch{throw new TypeError('Malformed evidence JSON');}
  return normalizeEvidence(raw);
}
export function makeDemoEvidence(){
  return normalizeEvidence({
    schema:EVIDENCE_SCHEMA,
    title:'Synthetic field-wave example (invented values)',
    mapping:'illustrative-lab-meters-v1',
    unit:'arbitrary',
    provenance:{
      kind:'synthetic',
      source:'ΦSpace Dynamics built-in demonstration',
      sourceUrl:null,
      method:'Invented sinusoidal values shown only to demonstrate rendering; no observations or scientific measurements'
    },
    points:Array.from({length:18},(_,i)=>{
      const angle=i*2*Math.PI/18,r=2.3+(i%3)*.45;
      return {id:'sample-'+(i+1),label:'Invented sample '+(i+1),
        position:{x:Number((Math.cos(angle)*r).toFixed(3)),
          y:Number((2.5+Math.sin(angle*3)*.8).toFixed(3)),
          z:Number((Math.sin(angle)*r).toFixed(3))},
        value:Number((15+10*Math.sin(angle*2)).toFixed(3)),uncertainty:null};
    })
  });
}
export function evidenceAsJson(data){
  const valid=normalizeEvidence({
    ...data,points:data.points.map(({address,...p})=>p)
  });
  return JSON.stringify({...valid,points:valid.points.map(({address,...p})=>p)},null,2);
}
