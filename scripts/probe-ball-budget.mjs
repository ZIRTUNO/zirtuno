// probe-ball-budget — WHAT A DROPLET ACTUALLY COSTS, and what the 48 is made of.
//
// The engine carries two numbers that have never been measured against a GPU:
// FIELD_N = 48 (the choreography budget — every form in symbols.data.mjs is
// packed to exactly this) and SDF_BALL_MAX = 80 (the shader's uniform-array
// ceiling). verify-frame-cost.mjs established that the frame tracks buffer AREA;
// it did so at a FIXED ball count, so it could not see that the ball loop IS
// most of that area cost. This probe varies the count.
//
//   node scripts/probe-ball-budget.mjs
//   CHROME_PATH=... node scripts/probe-ball-budget.mjs
//
// Four questions, four sections:
//
//   1 CAP    — does the compile-time loop bound cost anything on its own?
//   2 COUNT  — what does one more ACTIVE droplet cost, at real buffer sizes?
//   3 TILED  — the SHIPPED tiled renderer (SDF_GLASS_FRAG_TILED) driven by the
//              SHIPPED binner (lib/webgl/tile-bin.mjs): ball data in an RGBA32F
//              texture (no uniform ceiling) and a CPU prepass binning droplet
//              indices into screen tiles, so a fragment walks only the droplets
//              that can reach it. Measured LIVE — the droplets move and the tile
//              lists are rebuilt and re-uploaded every frame, which is the cost
//              the page actually pays. Both sides are real code, so the
//              alphaSum column is an equivalence proof and not a demo.
//   4 PAIRS  — fluid-core's O(N²) pair force in Node, against a uniform grid.
//
// alphaSum is the correctness column: with no tile overflow the tiled path is
// pixel-identical to the uniform-array path, so a matching alphaSum is the
// proof that the speed-up is not bought with dropped droplets.
//
// Runs the SYSTEM Chrome with a visible window, for the reason verify-frame-cost
// gives: bundled headless is SwiftShader and its numbers mean nothing.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  SDF_GLASS_VERT,
  SDF_GLASS_FRAG,
  SDF_GLASS_FRAG_TILED,
  SDF_BALL_MAX,
  SDF_THICK,
  SDF_BALL_REACH,
  SDF_GRAD_MARGIN,
} from "../lib/webgl/sdf-glass-shader.mjs";
// Only the constants the page SOURCE interpolates. makeTileBinner and TILE_PX
// arrive in the page through BINNER_SRC below, not through this import.
import { TILE_LIST_W } from "../lib/webgl/tile-bin.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "captures");

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].filter(Boolean);
const executablePath = chromeCandidates.find((c) => fs.existsSync(c));
if (!executablePath) {
  console.error("no system Chrome found — set CHROME_PATH.");
  process.exit(1);
}

// ── shader variants ──────────────────────────────────────────────────────────
// Every array size and loop bound in the emitted source comes from the same
// ${SDF_BALL_MAX} interpolation, so re-capping is an exact substitution rather
// than a guess — and the substitution is asserted, not assumed.
const atCap = (src, cap) => {
  const n = SDF_BALL_MAX;
  const out = src
    .replaceAll(`iBalls[${n}]`, `iBalls[${cap}]`)
    .replaceAll(`iBallZ[${n}]`, `iBallZ[${cap}]`)
    .replaceAll(`iBallDensity[${n}]`, `iBallDensity[${cap}]`)
    .replaceAll(`i < ${n};`, `i < ${cap};`);
  if (cap !== n && out === src) throw new Error(`cap rewrite missed at ${cap}`);
  return out;
};

const CAPS = [48, 80, 128, 192, 256, 384];
const UNIFORM = Object.fromEntries(CAPS.map((c) => [`u${c}`, atCap(SDF_GLASS_FRAG, c)]));

// THE SHIPPED tiled build, not a copy of it. The first version of this probe
// rebuilt the tiled shader here by string surgery, which made it a measurement
// of a prototype that could drift from the renderer without anyone noticing.
// Importing the real export means the alphaSum comparison below is a genuine
// equivalence proof about shipped code: same droplets, two data paths, one
// picture.
const TILE_CAP = 256; // the uniform baseline's own ceiling, for a fair A/B

// The binner, injected verbatim rather than reimplemented in the page. A second
// implementation here is exactly how a probe ends up certifying something the
// renderer does not do.
const BINNER_SRC = fs
  .readFileSync(path.join(__dirname, "..", "lib", "webgl", "tile-bin.mjs"), "utf8")
  .replace(/^export /gm, "");

const pageJs = `
const VERT = ${JSON.stringify(SDF_GLASS_VERT)};
const FRAGS = ${JSON.stringify({ ...UNIFORM, tiled: SDF_GLASS_FRAG_TILED })};
const THICK = ${SDF_THICK}, REACH = ${SDF_BALL_REACH}, TILE_CAP = ${TILE_CAP};
const GRAD_UV = ${SDF_GRAD_MARGIN};
const LIST_W = ${TILE_LIST_W};
${BINNER_SRC}

const hash=(i,k)=>{const x=Math.sin(i*127.1+k*311.7)*43758.5453;return x-Math.floor(x);};

// Constant-MASS layouts: r is scaled by 1/sqrt(N) so the covered area is the
// same at every count, and the only variable is loop iterations per fragment.
function layout(kind, count, cap) {
  const b=new Float32Array(cap*4), z=new Float32Array(cap);
  const rBase=0.030*Math.sqrt(48/count);
  for(let i=0;i<count;i++){
    let cx,cy,sp;
    if(kind==='spread'){cx=0.5;cy=0.5;sp=0.60;}                       // worst case
    else{const m=i%3;cx=0.28+0.22*m;cy=0.42+0.14*(m%2);sp=0.16;}      // 3 masses
    b[i*4]=cx+(hash(i,1)-0.5)*sp; b[i*4+1]=cy+(hash(i,2)-0.5)*sp;
    b[i*4+2]=rBase*(0.7+0.8*hash(i,3)); b[i*4+3]=1;
    z[i]=hash(i,4);
  }
  const b3=new Float32Array(cap*3);
  for(let i=0;i<count;i++){b3[i*3]=b[i*4];b3[i*3+1]=b[i*4+1];b3[i*3+2]=b[i*4+2];}
  return {b,z,b3};
}

function run({w,h,variant,kind,count,frames,grid,live}){
  const tiled=!!grid;
  const canvas=document.createElement('canvas');
  canvas.width=w;canvas.height=h;document.body.appendChild(canvas);
  const gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:false,antialias:false,powerPreference:'high-performance'});
  if(!gl) return {error:'no webgl2'};
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);
    if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;};
  let prog;
  try{
    prog=gl.createProgram();
    gl.attachShader(prog,sh(gl.VERTEX_SHADER,VERT));
    gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FRAGS[variant]));
    gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS))
      return {error:'LINK: '+(gl.getProgramInfoLog(prog)||'(no log)')};
  }catch(e){return {error:'COMPILE: '+e.message};}
  gl.useProgram(prog);
  const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const pl=gl.getAttribLocation(prog,'position');gl.enableVertexAttribArray(pl);
  gl.vertexAttribPointer(pl,2,gl.FLOAT,false,0,0);
  const nearest=t=>{for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.NEAREST);
    for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);return t;};
  const mkSdf=()=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.R32F,1,1,0,gl.RED,gl.FLOAT,new Float32Array([10]));return nearest(t);};
  gl.activeTexture(gl.TEXTURE0);mkSdf();gl.activeTexture(gl.TEXTURE1);mkSdf();
  const U=n=>gl.getUniformLocation(prog,n);
  gl.uniform1i(U('iSDF'),0);gl.uniform1i(U('iSDF2'),1);

  const cap=tiled?count:TILE_CAP;
  const L=layout(kind,count,cap);
  let stats={cpuMs:0,overflow:0,maxPerTile:0,entries:0,tilesX:0,tilesY:0}, binner=null;
  let ballTex=null, headTex=null, listTex=null, rows=null;

  if(tiled){
    binner = makeTileBinner();
    // row 0 = (x, y, r, density) · row 1 = (depth, vx, vy, —) — the shipped layout
    rows=new Float32Array(cap*4*2); rows.set(L.b,0);
    for(let i=0;i<count;i++) rows[cap*4+i*4]=L.z[i];
    const t0=performance.now();
    binner.bin(L.b3, count, w, h, REACH, GRAD_UV);
    stats={...binner.stats, cpuMs:performance.now()-t0, overflow:binner.stats.over};
    gl.activeTexture(gl.TEXTURE2); ballTex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,ballTex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,cap,2,0,gl.RGBA,gl.FLOAT,rows); nearest(ballTex);
    gl.uniform1i(U('iBallTex'),2);
    gl.activeTexture(gl.TEXTURE3); headTex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,headTex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RG32UI,binner.stats.tilesX,binner.stats.tilesY,0,
      gl.RG_INTEGER,gl.UNSIGNED_INT,binner.head); nearest(headTex);
    gl.uniform1i(U('iTileHead'),3);
    gl.activeTexture(gl.TEXTURE4); listTex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,listTex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.R32UI,LIST_W,Math.max(1,Math.ceil(binner.list.length/LIST_W)),0,
      gl.RED_INTEGER,gl.UNSIGNED_INT,binner.list); nearest(listTex);
    gl.uniform1i(U('iTileList'),4);
    gl.uniform2i(U('iTiles'),binner.stats.tilesX,binner.stats.tilesY);
    gl.uniform1f(U('iTilePx'),TILE_PX);
  }else{
    const balls=new Float32Array(TILE_CAP*3),zb=new Float32Array(TILE_CAP),db=new Float32Array(TILE_CAP).fill(1);
    for(let i=0;i<count;i++){balls[i*3]=L.b[i*4];balls[i*3+1]=L.b[i*4+1];balls[i*3+2]=L.b[i*4+2];zb[i]=L.z[i];}
    gl.uniform3fv(U('iBalls'),balls); gl.uniform1fv(U('iBallZ'),zb); gl.uniform1fv(U('iBallDensity'),db);
  }

  gl.uniform2f(U('iRes'),w,h);gl.uniform2f(U('iTexel'),1/512,1/512);
  gl.uniform1f(U('iThick'),THICK);
  gl.uniform1f(U('iFormA'),0);gl.uniform1f(U('iFormB'),0);
  gl.uniform1f(U('iEroA'),0);gl.uniform1f(U('iEroB'),0);
  gl.uniform1f(U('iWarp'),0.0082);gl.uniform1f(U('iGlass'),1);
  gl.uniform1f(U('iGloss'),0);gl.uniform1f(U('iMute'),0);
  gl.uniform1f(U('iFormScale'),1);gl.uniform2f(U('iFormOff'),0,0);
  gl.uniform1f(U('iExpo'),0);gl.uniform1f(U('iKey'),0);
  gl.uniform1f(U('iAbsorb'),1.1);gl.uniform1f(U('iDepthFx'),0.55);gl.uniform1f(U('iShadow'),1.0);
  gl.uniform1i(U('iBallCount'),count);
  gl.viewport(0,0,w,h);

  const px=new Uint8Array(4), times=[]; let cpuTotal=0;
  for(let f=0;f<frames;f++){
    gl.uniform1f(U('iTime'),f*0.016);   // defeat redundant-draw elision
    const t=performance.now();
    if(tiled&&live){
      // the droplets move, and the tile lists are rebuilt and re-uploaded —
      // the per-frame cost the page actually pays, inside the timed window
      for(let i=0;i<count;i++){
        L.b[i*4]+=0.0006*Math.sin(f*0.11+i);
        L.b[i*4+1]+=0.0006*Math.cos(f*0.09+i*1.7);
        L.b3[i*3]=L.b[i*4]; L.b3[i*3+1]=L.b[i*4+1];
      }
      const c0=performance.now();
      binner.bin(L.b3,count,w,h,REACH,GRAD_UV);
      cpuTotal+=performance.now()-c0;
      rows.set(L.b,0);
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,ballTex);
      gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,cap,2,gl.RGBA,gl.FLOAT,rows);
      gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,headTex);
      gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,binner.stats.tilesX,binner.stats.tilesY,
        gl.RG_INTEGER,gl.UNSIGNED_INT,binner.head);
      gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,listTex);
      gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,LIST_W,
        Math.max(1,Math.ceil(binner.stats.entries/LIST_W)),
        gl.RED_INTEGER,gl.UNSIGNED_INT,binner.list);
      stats.overflow=binner.stats.over; stats.maxPerTile=binner.stats.maxPerTile;
    }
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES,0,3);
    gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);   // force GPU sync
    times.push(performance.now()-t);
  }
  const full=new Uint8Array(w*h*4);
  gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,full);
  let lit=0,sum=0;for(let p=3;p<full.length;p+=4){if(full[p]>2)lit++;sum+=full[p];}
  gl.getExtension('WEBGL_lose_context')?.loseContext();canvas.remove();
  times.sort((a,b)=>a-b);
  return {ms:times[times.length>>1],coverage:lit/(w*h),alphaSum:sum,...stats,
          cpuMs: live?cpuTotal/frames:stats.cpuMs};
}

window.__probe=(jobs)=>{
  const c=document.createElement('canvas').getContext('webgl2');
  const e=c.getExtension('WEBGL_debug_renderer_info');
  const limits={
    renderer: e?c.getParameter(e.UNMASKED_RENDERER_WEBGL):'unknown',
    maxFragUniformVectors:c.getParameter(c.MAX_FRAGMENT_UNIFORM_VECTORS),
    maxTexSize:c.getParameter(c.MAX_TEXTURE_SIZE),
  };
  // Warm the driver and let the GPU clock ramp: the first rows are otherwise
  // a compile-and-cold-clock measurement wearing a ball count's name.
  for(let i=0;i<4;i++) run({w:900,h:700,variant:'u80',kind:'spread',count:48,frames:20});
  return {limits, rows: jobs.map(j=>({...j,...run({...j,frames:40})}))};
};
`;

const htmlPath = path.join(OUT, "probe-ball-budget.html");
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(
  htmlPath,
  `<!doctype html><meta charset="utf-8"><title>ball budget</title>
<body style="margin:0;background:#05080a"><script>${pageJs}</` + `script></body>`,
);

const browser = await chromium.launch({
  headless: false,
  chromiumSandbox: false,
  executablePath,
  args: ["--window-position=0,0", "--window-size=1200,860"],
});
const page = await browser.newPage();
await page.goto("file:///" + htmlPath.replaceAll("\\", "/"));

const W = 1280,
  H = 880; // 1.13 Mpx — the middle rung verify-frame-cost records
const capFor = (n) => `u${CAPS.find((c) => c >= Math.max(n, 1))}`;

const jobs = [];
// 1 — the cap alone, at a fixed active count
for (const c of CAPS) jobs.push({ tag: "cap", w: W, h: H, variant: `u${c}`, kind: "spread", count: 48 });
// 2 — the active count, uniform-array path
for (const n of [0, 24, 48, 64, 80, 96, 128, 192, 256])
  jobs.push({ tag: "count", w: W, h: H, variant: capFor(n), kind: "spread", count: n });
// 3 — the shipped tiled path, live, against the uniform path at matched counts
for (const n of [48, 96, 192, 384, 768, 1536]) {
  if (n <= 256) jobs.push({ tag: "tile", w: W, h: H, variant: capFor(n), kind: "spread", count: n });
  for (const live of [false, true])
    jobs.push({ tag: "tile", w: W, h: H, variant: "tiled", kind: "spread", count: n, grid: true, live });
}

const { limits, rows } = await page.evaluate((j) => window.__probe(j), jobs);
await browser.close();

console.log(`renderer  ${limits.renderer}`);
console.log(
  `limits    MAX_FRAGMENT_UNIFORM_VECTORS ${limits.maxFragUniformVectors} · MAX_TEXTURE_SIZE ${limits.maxTexSize}`,
);
const show = (tag, title, note) => {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 58 - title.length))}`);
  if (note) console.log(`   ${note}`);
  console.log("   variant        count   live      ms   cpuMs   ovf   alphaSum");
  for (const r of rows.filter((x) => x.tag === tag)) {
    if (r.error) {
      console.log(`   ${r.variant.padEnd(13)} ${String(r.count).padStart(5)}      —       —       —     —   ${r.error.slice(0, 60)}`);
      continue;
    }
    console.log(
      `   ${r.variant.padEnd(13)} ${String(r.count).padStart(5)}   ${(r.live ? "yes" : " - ").padStart(4)}  ${r.ms.toFixed(2).padStart(6)}  ${r.cpuMs.toFixed(2).padStart(5)}  ${String(r.overflow).padStart(4)}   ${r.alphaSum}`,
    );
  }
};
show("cap", "1 · the compile-time cap, at 48 active balls", "flat = `if (i >= iBallCount) break` is a real dynamic exit");
show("count", "2 · the active ball count (uniform array)", "the slope IS the droplet price");
show("tile", "3 · the SHIPPED tiled renderer + binner", "matching alphaSum at ovf 0 = pixel-identical to the uniform path");

// ── 4 · the CPU wall: fluid-core's O(N²) pair force vs a uniform grid ────────
// Faithful to the shipped v2 branch (fluid-core.mjs, the `if (!v3)` arm), at
// 2 substeps per 60 Hz frame (H_MS = 8).
const REP_RANGE = 1.15, REP_A = 2.6, REP_D_MIN = 0.004, H_S = 0.008;
const world = (N) => {
  const X = new Float32Array(N * 2), V = new Float32Array(N * 2), R = new Float32Array(N);
  const h = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < N; i++) {
    X[i * 2] = 0.5 + (h(i, 1) - 0.5) * 0.6;
    X[i * 2 + 1] = 0.5 + (h(i, 2) - 0.5) * 0.6;
    R[i] = 0.03 * Math.sqrt(48 / N) * (0.7 + 0.8 * h(i, 3));
  }
  return { X, V, R, N };
};
const force = (X, V, R, i, j, out) => {
  const dx = X[i * 2] - X[j * 2], dy = X[i * 2 + 1] - X[j * 2 + 1];
  const d2 = dx * dx + dy * dy;
  if (d2 < 1e-8) return;
  const reach = REP_RANGE * (R[i] + R[j]);
  if (d2 > reach * reach) return;
  const d = Math.max(Math.sqrt(d2), REP_D_MIN);
  const inv = (REP_A * (1 - d / reach)) / d;
  out[0] += dx * inv; out[1] += dy * inv;
  V[j * 2] -= dx * inv * H_S; V[j * 2 + 1] -= dy * inv * H_S;
};
const allPairs = ({ X, V, R, N }) => {
  const a = [0, 0];
  for (let i = 0; i < N; i++) {
    a[0] = 0; a[1] = 0;
    for (let j = i + 1; j < N; j++) force(X, V, R, i, j, a);
    V[i * 2] += a[0] * H_S; V[i * 2 + 1] += a[1] * H_S;
  }
};
const GX = 64, heads = new Int32Array(GX * GX);
const grid = ({ X, V, R, N }, next, cx, cy) => {
  let maxR = 0;
  for (let i = 0; i < N; i++) if (R[i] > maxR) maxR = R[i];
  const cell = Math.max(REP_RANGE * 2 * maxR, 1 / GX);
  heads.fill(-1);
  for (let i = 0; i < N; i++) {
    const gx = Math.min(GX - 1, Math.max(0, (X[i * 2] / cell) | 0));
    const gy = Math.min(GX - 1, Math.max(0, (X[i * 2 + 1] / cell) | 0));
    cx[i] = gx; cy[i] = gy;
    next[i] = heads[gy * GX + gx]; heads[gy * GX + gx] = i;
  }
  const a = [0, 0];
  for (let i = 0; i < N; i++) {
    a[0] = 0; a[1] = 0;
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        const gx = cx[i] + ox, gy = cy[i] + oy;
        if (gx < 0 || gy < 0 || gx >= GX || gy >= GX) continue;
        for (let j = heads[gy * GX + gx]; j >= 0; j = next[j])
          if (j > i) force(X, V, R, i, j, a);   // same i<j ordering as shipped
      }
    V[i * 2] += a[0] * H_S; V[i * 2 + 1] += a[1] * H_S;
  }
};
const timeIt = (fn, iters) => {
  for (let i = 0; i < 200; i++) fn();
  const t = process.hrtime.bigint();
  for (let i = 0; i < iters; i++) fn();
  return (2 * Number(process.hrtime.bigint() - t)) / 1e6 / iters; // 2 substeps/frame
};
console.log("\n── 4 · fluid-core pair forces, ms per 60 Hz frame ──────────");
console.log("   the only super-linear term in the CPU physics");
console.log("       N   all-pairs      grid   speedup");
for (const N of [48, 96, 192, 384, 768, 1536]) {
  const s = world(N);
  const next = new Int32Array(N), cx = new Int32Array(N), cy = new Int32Array(N);
  const iters = N > 500 ? 200 : 2000;
  const a = timeIt(() => allPairs(s), iters);
  const b = timeIt(() => grid(s, next, cx, cy), iters);
  console.log(
    `   ${String(N).padStart(5)}   ${a.toFixed(3).padStart(7)} ms  ${b.toFixed(3).padStart(6)} ms   ${(a / b).toFixed(1)}x`,
  );
}

fs.writeFileSync(
  path.join(OUT, "probe-ball-budget.json"),
  JSON.stringify({ limits, rows }, null, 2),
);
console.log(`\nwrote captures/probe-ball-budget.json`);
