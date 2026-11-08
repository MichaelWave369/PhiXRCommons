import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,stepWorld,addBody} from '../src/spacedynamics/core.js';
import {makeDemoEvidence} from '../src/spacedynamics/evidence-layer.js';
import {createWorkspace,workspaceToText,parseWorkspaceText,restoreWorld,
  normalizeWorkspace,WORKSPACE_MAX_BYTES} from '../src/spacedynamics/workspace.js';
const make=()=>{
 const world=createWorld();stepWorld(world,.15);
 return createWorkspace(world,makeDemoEvidence(),{title:'Lab test',
   selectedOrb:'orb-2',inspectionLayer:'evidence',showEvidence:false});
};
const json=()=>JSON.parse(workspaceToText(make()));
test('portable round trip preserves physics, view, and evidence metadata',()=>{
 const w=make(),parsed=parseWorkspaceText(workspaceToText(w));
 assert.deepEqual(parsed,w);
 assert.equal(parsed.evidence.points.length,18);
 assert.equal(parsed.view.selectedOrb,'orb-2');
 assert.equal(parsed.view.showEvidence,false);
 assert.equal(parsed.evidence.provenance.kind,'synthetic');
 assert.equal(restoreWorld(parsed).bodies.length,4);
});
test('restored world maintains nextId and can safely create new objects',()=>{
 const world=createWorld();addBody(world);addBody(world);
 const w=createWorkspace(world,null,{selectedOrb:'orb-6'});
 const restored=restoreWorld(parseWorkspaceText(workspaceToText(w)));
 assert.equal(restored.nextId,7);
 assert.equal(addBody(restored),'orb-7');
 assert.equal(w.evidence,null);
});
test('paused state, gravity, force field and simulation time are retained',()=>{
 const world=createWorld();
 for(let i=0;i<15;i++)stepWorld(world,1/60);
 world.paused=true;world.gravity=0;world.field='center';
 const out=restoreWorld(parseWorkspaceText(workspaceToText(createWorkspace(world))));
 assert.equal(out.paused,true);assert.equal(out.gravity,0);
 assert.equal(out.field,'center');assert.ok(out.elapsed>.2);
});
test('refuse malformed JSON, huge files and unknown keys',()=>{
 assert.throws(()=>parseWorkspaceText('{invalid'),/Malformed/);
 assert.throws(()=>parseWorkspaceText(' '.repeat(WORKSPACE_MAX_BYTES+1)),/128 KB/);
 const w=json();w.injected=true;
 assert.throws(()=>normalizeWorkspace(w),/schema/);
 delete w.injected;w.world.extra='evil';
 assert.throws(()=>normalizeWorkspace(w),/configuration/);
});
test('reject invalid body positions, duplicate IDs, velocities and nextId collision',()=>{
 const w=json();w.world.bodies[0].position.x=1000;
 assert.throws(()=>normalizeWorkspace(w),/Invalid body/);
 w.world.bodies[0].position.x=0;
 w.world.bodies[1].id=w.world.bodies[0].id;
 assert.throws(()=>normalizeWorkspace(w),/duplicate/);
 w.world.bodies[1].id='orb-2';
 w.world.bodies[0].velocity.y=Infinity;
 assert.throws(()=>normalizeWorkspace(w),/Invalid body/);
 w.world.bodies[0].velocity.y=0;
 w.world.nextId=2;
 assert.throws(()=>normalizeWorkspace(w),/nextId/);
});
test('invalid layers, missing selected orb and unsupported truth markers fail',()=>{
 const w=json();w.view.inspectionLayer='unknown';
 assert.throws(()=>normalizeWorkspace(w),/view/);
 w.view.inspectionLayer='matter';w.view.selectedOrb='orb-999';
 assert.throws(()=>normalizeWorkspace(w),/view/);
 w.view.selectedOrb=null;w.truth='SCIENTIFICALLY_VERIFIED';
 assert.throws(()=>normalizeWorkspace(w),/truth/);
});
test('evidence cannot smuggle forged validation or source labels',()=>{
 const w=json();
 w.evidence.provenance.kind='proven';
 assert.throws(()=>normalizeWorkspace(w),/provenance/);
 w.evidence.provenance.kind='reported-measurement';
 assert.throws(()=>normalizeWorkspace(w),/HTTPS source/);
});
test('the round trip does not mutate source objects or reset simulation in place',()=>{
 const world=createWorld(),evidence=makeDemoEvidence();
 const original=JSON.stringify(world),originalEvidence=JSON.stringify(evidence);
 const saved=createWorkspace(world,evidence,{selectedOrb:'orb-1'});
 restoreWorld(saved);
 assert.equal(JSON.stringify(world),original);
 assert.equal(JSON.stringify(evidence),originalEvidence);
});
