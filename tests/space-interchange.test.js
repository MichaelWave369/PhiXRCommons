import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld} from '../src/spacedynamics/core.js';
import {makeDemoEvidence} from '../src/spacedynamics/evidence-layer.js';
import {createWorkspace} from '../src/spacedynamics/workspace.js';
import {sceneFromWorkspace,sceneToText,parseSceneText,normalizeScene,SCENE_TRUTH,
  SCENE_MAX_BYTES,SCENE_MAX_NODES,COORDINATE_FRAME} from '../src/spacedynamics/scene-interchange.js';
const sample=()=>sceneFromWorkspace(createWorkspace(createWorld(),makeDemoEvidence(),
  {title:'Spatial bridge test',selectedOrb:'orb-1'}));
const raw=()=>JSON.parse(sceneToText(sample()));
test('visual export contains 4 orbs and 18 evidence records but no simulation controls',()=>{
  const s=sample();
  assert.equal(s.nodes.length,22);
  assert.equal(s.nodes.filter(n=>n.kind==='sphere').length,4);
  assert.equal(s.nodes.filter(n=>n.kind==='evidence-marker').length,18);
  assert.equal(s.truth,SCENE_TRUTH);
  assert.deepEqual(s.coordinateFrame,COORDINATE_FRAME);
  assert.equal('gravity' in s,false);
  assert.equal('room' in s,false);
  assert.equal('velocity' in s.nodes[0],false);
});
test('roundtrip yields equivalent strict cross-app scene',()=>{
  const s=sample();
  assert.deepEqual(parseSceneText(sceneToText(s)),s);
  const foreign=raw();foreign.creator='canopy';
  assert.equal(parseSceneText(JSON.stringify(foreign)).creator,'canopy');
});
test('source claims and uncertainties survive but remain unverified',()=>{
  const s=sample(),data=s.nodes.find(n=>n.kind==='evidence-marker');
  assert.equal(data.metadata.kind,'synthetic');
  assert.equal(data.metadata.uncertainty,null);
  assert.match(SCENE_TRUTH,/UNVERIFIED/);
  assert.equal(data.metadata.sourceUrl,null);
});
test('injection properties, script keys and arbitrary metadata are refused',()=>{
  const s=raw();s.execute='shell.exec';
  assert.throws(()=>normalizeScene(s),/schema/);
  delete s.execute;
  s.nodes[0].metadata={script:'alert(1)'};
  assert.throws(()=>normalizeScene(s),/metadata/);
  s.nodes[0].metadata=null;s.nodes[1].script='evil';
  assert.throws(()=>normalizeScene(s),/visual node/);
});
test('invalid coordinates, nonfinite numbers and duplicate IDs fail closed',()=>{
  const s=raw();s.nodes[0].position.y=900;
  assert.throws(()=>normalizeScene(s),/position/);
  s.nodes[0].position.y=1;s.nodes[1].id=s.nodes[0].id;
  assert.throws(()=>normalizeScene(s),/duplicate/);
  s.nodes[1].id='body-orb-2';s.nodes[0].radius=Infinity;
  assert.throws(()=>normalizeScene(s),/visual node/);
});
test('changing coordinate basis, truth label or node kind is forbidden',()=>{
  const s=raw();s.coordinateFrame.upAxis='Z';
  assert.throws(()=>normalizeScene(s),/coordinate frame/);
  s.coordinateFrame.upAxis='Y';s.truth='CERTIFIED';
  assert.throws(()=>normalizeScene(s),/schema/);
  s.truth=SCENE_TRUTH;s.nodes[0].kind='code';
  assert.throws(()=>normalizeScene(s),/visual node/);
});
test('evidence metadata cannot pretend to contain a validated category',()=>{
  const s=raw(),mark=s.nodes.find(n=>n.kind==='evidence-marker');
  mark.metadata.kind='peer-reviewed-proof';
  assert.throws(()=>normalizeScene(s),/evidence metadata/);
  mark.metadata.kind='reported-measurement';
  assert.throws(()=>normalizeScene(s),/source URL/);
  mark.metadata.sourceUrl='https://example.org/report';
  assert.equal(normalizeScene(s).nodes.length,22);
});
test('oversized scenes and excessive nodes are rejected',()=>{
  assert.throws(()=>parseSceneText(' '.repeat(SCENE_MAX_BYTES+1)),/96 KB/);
  const s=raw(),body=s.nodes[0];
  s.nodes=Array.from({length:SCENE_MAX_NODES+1},(_,i)=>({...body,id:'copy-'+i}));
  assert.throws(()=>normalizeScene(s),/schema/);
  assert.throws(()=>parseSceneText('oops'),/Malformed/);
});
test('converter never mutates the live physics world or evidence source',()=>{
  const w=createWorld(),e=makeDemoEvidence();
  const worldBefore=JSON.stringify(w),evidenceBefore=JSON.stringify(e);
  const scene=sceneFromWorkspace(createWorkspace(w,e));
  assert.equal(JSON.stringify(w),worldBefore);
  assert.equal(JSON.stringify(e),evidenceBefore);
  assert.equal(scene.nodes.length,22);
});
