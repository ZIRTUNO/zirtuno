// Behavioural gates for S7. Real scene + conductor + fixed-step core, no DOM.
import assert from 'node:assert/strict';
import { makeOriginScene } from '../../lib/webgl/scenes/origin.ts';
import { makeConductor } from '../../lib/webgl/conductor.mjs';
import { originAcceleration } from '../../lib/webgl/origin-field.mjs';
import { makeFluidCore } from '../../lib/webgl/fluid-core.mjs';

const POP = 384;
function rig(aspect = 1.6) {
  const c = makeConductor([makeOriginScene()], {pop: POP, ballMax:512, physicsV3:true, temper:1});
  const buf = new Float32Array(512*3), ids = new Int16Array(512);
  let t = 0, frame;
  c.raw.origin.on = 1;
  return { c, buf, ids,
    step(p, seconds) {
      c.raw.origin.p = p;
      for(let j=0;j<Math.ceil(seconds*60);j++) {
        t += 1000/60;
        frame = c.driver.frame(t,buf,aspect,undefined,ids);
        assert.ok([...buf].every(Number.isFinite), 'finite positions through holds and reversals');
      }
      return frame;
    },
  };
}
function extent(r) {
  // Authored identity slots always precede motes; visible host radii > 0.
  const x = [], y=[];
  for(let i=0;i<48;i++){x.push(r.buf[i*3]);y.push(r.buf[i*3+1]);}
  return [Math.max(...x)-Math.min(...x), Math.max(...y)-Math.min(...y)];
}
const r=rig();
r.step(.08,5);
const broad=extent(r);
const before=r.buf.slice();
r.step(.08,3);
let travel=0;
for(let i=0;i<48;i++) travel+=Math.hypot(r.buf[i*3]-before[i*3],r.buf[i*3+1]-before[i*3+1])/48;
assert.ok(travel>.007, 'the field moves during a fixed-scroll hold');
assert.ok(broad[0]>.8 && broad[1]>.3, 'the opening inhabits a field, not two clouds');
r.step(.44,6);
const gathered=extent(r);
assert.ok(gathered[0]<broad[0]*.75, 'capture contracts the field visibly');
const rest=r.step(.68,5);
assert.equal(rest.fa,1,'exact mark reaches full field presence');
assert.equal(rest.ea,0,'exact mark has no erosion at rest');
assert.ok(rest.count>20,'the outer field remains alive beside the resting mark');
const hold=r.buf.slice();
r.step(.68,2);
assert.notDeepEqual(r.buf,hold,'identity hold retains living liquid');
const released=r.step(.96,4);
assert.ok(released.count>rest.count*2, 'ending releases the population from the exact mark');
let releaseX=0;
for(let i=0;i<48;i++) releaseX+=r.buf[i*3]/48;
assert.ok(releaseX<.5, 'desktop release occupies the margin beside the closing statement');
for(const p of [.1,.9,.2,1,0,.65]) r.step(p,.6);
assert.equal(r.c.stats.violations,0,'reverse scrubbing preserves form ownership');

// The force law has no singularity or large near-centre kick.
for(const x of [.5,.5000001,.52,100]){
  const out=new Float32Array(2);
  originAcceleration(x,.62,0,{cx:.5,cy:.62,gain:1,capture:1},out);
  assert.ok(out.every(Number.isFinite) && Math.hypot(...out)<1,'bounded attraction');
}
// Exact bind is still byte-identical with and without the basin active.
const n=48, A=new Float32Array(n*2).fill(.5), B=A.slice();
const T=A.slice(), bind=new Float32Array(n).fill(1), cl=new Int16Array(n).fill(-1), rad=new Float32Array(n).fill(.02);
const ca=makeFluidCore(),cb=makeFluidCore();
const env={px:0,py:0,pvx:0,pvy:0,pon:false,vel:1};
for(let i=0;i<180;i++){
  ca.step(A,T,bind,cl,rad,16.67,i*16.67,env);
  cb.step(B,T,bind,cl,rad,16.67,i*16.67,{...env,basin:{cx:.1,cy:.9,gain:1,capture:1}});
}
assert.deepEqual(A,B,'bind=1 remains byte-exact under full attractor force');
for(const aspect of [.462, .76, 2.2]){
  const mobile=rig(aspect);
  for(const p of [0,.3,.55,.68,.9,1]) mobile.step(p,.5);
  assert.equal(mobile.c.stats.violations,0);
}
console.log('ORIGIN_CHECK',JSON.stringify({broad,gathered,heldTravel:travel,population:POP,failures:0}));
