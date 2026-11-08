import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDemoEvidence,parseEvidenceText,normalizeEvidence,evidenceAsJson,EVIDENCE_MAX_POINTS,EVIDENCE_KIND} from '../src/spacedynamics/evidence-layer.js';
const example=()=>JSON.parse(evidenceAsJson(makeDemoEvidence()));
test('synthetic example is explicitly labeled and reversible',()=>{
  const data=makeDemoEvidence();
  assert.equal(data.provenance.kind,'synthetic');
  assert.match(EVIDENCE_KIND.synthetic,/NOT MEASURED/);
  assert.equal(data.points.length,18);
  assert.ok(data.points.every(p=>p.address.startsWith('SD-')));
  assert.deepEqual(parseEvidenceText(evidenceAsJson(data)),data);
});
test('measured claims require an HTTPS reference and remain unverified',()=>{
  const d=example();d.provenance.kind='reported-measurement';
  assert.throws(()=>normalizeEvidence(d),/HTTPS source/);
  d.provenance.sourceUrl='https://example.org/study';
  assert.equal(normalizeEvidence(d).provenance.kind,'reported-measurement');
  assert.match(EVIDENCE_KIND['reported-measurement'],/UNVERIFIED/);
  for(const url of ['http://example.org','https://u:p@example.org','javascript:alert(1)',
    'https://example.org/#frag']){d.provenance.sourceUrl=url;
    assert.throws(()=>normalizeEvidence(d),/source URL|HTTPS/);}
});
test('rejects invalid coordinate, uncertainty, NaN and duplicate sample id',()=>{
  const d=example();d.points[0].position.x=8;
  assert.throws(()=>normalizeEvidence(d),/position/);
  d.points[0].position.x=0;
  d.points[0].uncertainty=-1;
  assert.throws(()=>normalizeEvidence(d),/uncertainty/);
  d.points[0].uncertainty=0;d.points[0].value=Infinity;
  assert.throws(()=>normalizeEvidence(d),/point value/);
  d.points[0].value=1;d.points[1].id=d.points[0].id;
  assert.throws(()=>normalizeEvidence(d),/duplicate/);
});
test('rejects excessively many points and oversized JSON payloads',()=>{
  const d=example();
  d.points=Array.from({length:EVIDENCE_MAX_POINTS+1},(_,i)=>({
    ...d.points[0],id:'p-'+i
  }));
  assert.throws(()=>normalizeEvidence(d),/1–96/);
  assert.throws(()=>parseEvidenceText(' '.repeat(73000)),/72 KB/);
});
test('strict provenance and schema disallow unexpected or dangerous keys',()=>{
  const d=example();d.randomFlag=true;
  assert.throws(()=>normalizeEvidence(d),/schema/);
  delete d.randomFlag;d.provenance.extra='pretend_verified';
  assert.throws(()=>normalizeEvidence(d),/provenance/);
  delete d.provenance.extra;d.points[0].extra={};
  assert.throws(()=>normalizeEvidence(d),/point ID/);
});
test('bad source, invalid strings, units and malformed JSON rejected',()=>{
  assert.throws(()=>parseEvidenceText('{broken'),/Malformed/);
  const d=example();d.title='line\nbreak';
  assert.throws(()=>normalizeEvidence(d),/title/);
  d.title='Data';d.unit='<script>';
  assert.throws(()=>normalizeEvidence(d),/unit/);
  d.unit='Pa';d.points[0].label='\u0001';
  assert.throws(()=>normalizeEvidence(d),/point label/);
});
test('user-supplied model outputs cannot be relabeled as independently validated',()=>{
  const d=example();d.provenance.kind='model-output';
  d.provenance.source='Claimed simulation';
  assert.match(EVIDENCE_KIND['model-output'],/UNVERIFIED/);
  assert.equal(normalizeEvidence(d).provenance.kind,'model-output');
  d.provenance.kind='validated';
  assert.throws(()=>normalizeEvidence(d),/provenance/);
});
