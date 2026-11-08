/**
 * ΦSpace Dynamics R1: local, inspectable spatial indexing and illustrative physics.
 * No imported OMEGA source, scientific proof claims, networking or device authority.
 */
export const AXIS = 12;
export const HALF = 6;
export const CELL_COUNT = AXIS ** 4; // 12 data layers * 12^3 spatial cells
export const LAYERS = Object.freeze([
  'matter','force','motion','boundary','evidence','geometry',
  'traversal','causal','scale','history','annotation','experimental'
]);
const finite = n => typeof n === 'number' && Number.isFinite(n);
const bounded = (n, low, high) => Math.max(low, Math.min(high, n));

export function encodeAddress(x, y, z, layer = 'matter') {
  const l = typeof layer === 'string' ? LAYERS.indexOf(layer) : layer;
  if (![x,y,z,l].every(n => Number.isInteger(n) && n >= 0 && n < AXIS)) {
    throw new RangeError('Address coordinates and layer must be in [0,11]');
  }
  return 'SD-' + (((l * AXIS + x) * AXIS + y) * AXIS + z).toString().padStart(5,'0');
}
export function decodeAddress(id) {
  if (typeof id !== 'string' || !/^SD-\d{5}$/.test(id)) throw new RangeError('Invalid spatial address');
  let n = Number(id.slice(3));
  if (n >= CELL_COUNT) throw new RangeError('Address outside the 20,736-slot registry');
  const z = n % AXIS; n = Math.floor(n / AXIS);
  const y = n % AXIS; n = Math.floor(n / AXIS);
  const x = n % AXIS; n = Math.floor(n / AXIS);
  return { id, x, y, z, layer: n, layerName: LAYERS[n] };
}
export function addressAt(position, layer = 'matter') {
  if (!position || ![position.x,position.y,position.z].every(finite)) return null;
  if ([position.x,position.y,position.z].some(n => n < -HALF || n > HALF)) return null;
  const coord = n => bounded(Math.floor(n + HALF), 0, AXIS - 1);
  return encodeAddress(coord(position.x),coord(position.y),coord(position.z),layer);
}
export function createWorld() {
  return {
    schema: 'phi.space-dynamics.world.v1',
    gravity: -9.81, field: 'off', paused: false,
    elapsed: 0, accumulator: 0, nextId: 5,
    bodies: [
      {id:'orb-1',r:.38,m:1,p:{x:-2.8,y:4.4,z:-1},v:{x:1.4,y:0,z:.1}},
      {id:'orb-2',r:.52,m:2,p:{x:0,y:3.2,z:0},v:{x:-.6,y:0,z:-.3}},
      {id:'orb-3',r:.3,m:.7,p:{x:2.7,y:5,z:1.2},v:{x:-1.2,y:0,z:0}},
      {id:'orb-4',r:.45,m:1.5,p:{x:.5,y:6.2,z:-2.3},v:{x:0,y:0,z:.8}}
    ]
  };
}
export function addBody(world) {
  if (world.bodies.length >= 24) return null; // modest Quest-friendly demo cap
  const n = world.nextId++;
  const body = {id:'orb-'+n,r:.25+(n%3)*.08,m:1,
    p:{x:(n%5-2)*1.15,y:4.2,z:((n*3)%5-2)*.9},
    v:{x:(n%3-1)*.7,y:0,z:.15}};
  world.bodies.push(body);
  return body.id;
}
export function applyImpulse(world,id,vector) {
  const body = world.bodies.find(b => b.id === id);
  if (!body || !vector || ![vector.x,vector.y,vector.z].every(finite)) return false;
  const length = Math.hypot(vector.x,vector.y,vector.z);
  if (!length) return false;
  const scale = Math.min(length,8) / length / body.m;
  for (const k of ['x','y','z']) body.v[k] += vector[k] * scale;
  return true;
}
function integrate(world,dt) {
  const bodies = world.bodies;
  for (const b of bodies) {
    b.v.y += world.gravity * dt;
    if (world.field === 'center') {
      // Artistic horizontal attraction field, NOT a validated orbital solver.
      b.v.x += (-b.p.x * 2.6 / (1 + b.p.x*b.p.x + b.p.z*b.p.z)) * dt;
      b.v.z += (-b.p.z * 2.6 / (1 + b.p.x*b.p.x + b.p.z*b.p.z)) * dt;
    }
    for (const k of ['x','y','z']) b.p[k] += b.v[k] * dt;
    if (b.p.y < b.r) {
      b.p.y = b.r;
      if (b.v.y < 0) b.v.y *= -.72;
      b.v.x *= .992; b.v.z *= .992;
      if (Math.abs(b.v.y) < .09) b.v.y = 0;
    }
    for (const k of ['x','z']) {
      const wall = HALF - b.r;
      if (b.p[k] > wall) { b.p[k]=wall; if(b.v[k]>0) b.v[k]*=-.75; }
      if (b.p[k] < -wall) { b.p[k]=-wall; if(b.v[k]<0) b.v[k]*=-.75; }
    }
    if (b.p.y > 8 - b.r) { b.p.y=8 - b.r; if(b.v.y>0) b.v.y*=-.75; }
  }
  // Equal-and-opposite impulse along the collision normal.
  for (let i=0;i<bodies.length;i++) for (let j=i+1;j<bodies.length;j++) {
    const a=bodies[i],b=bodies[j];
    const dx=b.p.x-a.p.x,dy=b.p.y-a.p.y,dz=b.p.z-a.p.z;
    const minDist=a.r+b.r;
    const distance=Math.hypot(dx,dy,dz);
    if (distance >= minDist) continue;
    const nx=distance>1e-9?dx/distance:1;
    const ny=distance>1e-9?dy/distance:0;
    const nz=distance>1e-9?dz/distance:0;
    const invA=1/a.m, invB=1/b.m;
    const correction=(minDist-distance)/(invA+invB);
    a.p.x-=nx*correction*invA; a.p.y-=ny*correction*invA; a.p.z-=nz*correction*invA;
    b.p.x+=nx*correction*invB; b.p.y+=ny*correction*invB; b.p.z+=nz*correction*invB;
    const speed=(b.v.x-a.v.x)*nx+(b.v.y-a.v.y)*ny+(b.v.z-a.v.z)*nz;
    if (speed>=0) continue;
    const impulse=-(1+.82)*speed/(invA+invB);
    for (const [k,n] of [['x',nx],['y',ny],['z',nz]]) {
      a.v[k]-=impulse*invA*n; b.v[k]+=impulse*invB*n;
    }
  }
}
const FIXED_STEP=1/90;
export function stepWorld(world,seconds) {
  if (!finite(seconds) || seconds < 0) throw new RangeError('Invalid delta time');
  if (world.paused) return 0;
  world.accumulator = Math.min(.14,world.accumulator+Math.min(seconds,.14));
  let steps=0;
  while (world.accumulator + 1e-10 >= FIXED_STEP && steps < 13) {
    integrate(world,FIXED_STEP);
    world.accumulator -= FIXED_STEP;
    world.elapsed += FIXED_STEP;
    steps++;
  }
  return steps;
}
export function snapshot(world) {
  return {
    schema:world.schema,
    truth:'ILLUSTRATIVE_SIMULATION_NOT_MEASURED',
    addressScheme:{dimensions:3,axisCells:AXIS,layers:[...LAYERS],slots:CELL_COUNT},
    elapsedSeconds:Number(world.elapsed.toFixed(4)),
    gravity:world.gravity,field:world.field,
    bodies:world.bodies.map(b=>({id:b.id,r:b.r,m:b.m,
      position:{...b.p},velocity:{...b.v},address:addressAt(b.p)}))
  };
}
