// Author the MARK ball-cloud straight from the real logo SVG, so it reads
// unmistakably as the Zirtuno mark. Pipeline:
//   1. rasterise public/brand/zirtuno-logo-mark.svg → binary mask
//   2. distance-transform the filled region
//   3. greedily pack capped-radius balls (farthest-point + coverage removal):
//      the eye-counter + open bays get NO balls (stay open); the centre dot is
//      its own island → one ball; thin ribbons get tight small balls (smooth).
//   4. render the packed balls through the LOCKED field shader (flat + glass),
//      and overlay the SVG outline to judge fidelity.
// Tunables: N (budget ≤48), MAXR (cap radius, symbol units), K (field r = K·dist),
//   COVER (spacing = COVER·r), ERODE (px erosion to protect the counter).
//   node scripts/author-mark.mjs
// Writes captures/author-mark.png (flat|glass|overlay) and prints pasteable balls.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FIELD_VERT,
  FIELD_FRAG,
  FIELD_ISO,
  FIELD_N,
  FIELD_FRAME,
} from "../lib/webgl/field-shader.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "captures");
const SVG = fs.readFileSync(path.join(ROOT, "public/brand/zirtuno-logo-mark.svg"), "utf8");

const MASK = 240; // mask resolution
const TARGET = 0.86; // mark's larger dim spans this in symbol space (≈ ±0.43)
const BUDGET = Math.min(Number(process.env.N) || 46, FIELD_N);
const MAXR = Number(process.env.MAXR) || 0.13; // cap radius (symbol units)
const K = Number(process.env.K) || 0.95; // field radius = K · distance-to-edge
const COVER = Number(process.env.COVER) || 0.72; // farthest-point spacing = COVER · r
const ERODE = Number(process.env.ERODE) || 1; // erode mask N px (protect counter)
const MINPX = 2.0; // stop when deepest remaining point is this shallow
const SIZE = 600;

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const executablePath = chromeCandidates.find((c) => fs.existsSync(c));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: process.env.HEADLESS !== "false",
  chromiumSandbox: false,
  ...(executablePath ? { executablePath } : {}),
});
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("CONSOLE:", m.text()));

// ── 1. rasterise the SVG to a MASK×MASK binary mask (1 = filled) ──────────────
await page.setContent(`<!doctype html><body><canvas id="m" width="${MASK}" height="${MASK}"></canvas></body>`);
const mask = await page.evaluate(
  async ({ svg, MASK }) => {
    const cv = document.getElementById("m");
    const g = cv.getContext("2d");
    const img = new Image();
    const url = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
    img.src = url;
    await img.decode();
    // contain-fit the SVG into the square
    const ar = img.width / img.height;
    let w = MASK, h = MASK;
    if (ar > 1) h = MASK / ar; else w = MASK * ar;
    g.clearRect(0, 0, MASK, MASK);
    g.drawImage(img, (MASK - w) / 2, (MASK - h) / 2, w, h);
    const d = g.getImageData(0, 0, MASK, MASK).data;
    const out = new Array(MASK * MASK);
    for (let i = 0; i < MASK * MASK; i++) out[i] = d[i * 4 + 3] > 40 ? 1 : 0;
    return out;
  },
  { svg: SVG, MASK },
);

// ── 1b. keep only the largest connected component → drops the centre dot island
//        (an isolated blob inside the eye), so the counter is a fully-open hole.
const W = MASK, H = MASK;
let eyeFromDot = null; // centre-dot centroid (mask px) = exact counter location
{
  const label = new Int32Array(W * H).fill(-1);
  const comps = [], ccx = [], ccy = [];
  const stack = [];
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || label[s] >= 0) continue;
    const id = comps.length;
    let n = 0, sx = 0, sy = 0;
    stack.push(s);
    label[s] = id;
    while (stack.length) {
      const i = stack.pop();
      n++; sx += i % W; sy += (i / W) | 0;
      const x = i % W, y = (i / W) | 0;
      const nb = [];
      if (x > 0) nb.push(i - 1);
      if (x < W - 1) nb.push(i + 1);
      if (y > 0) nb.push(i - W);
      if (y < H - 1) nb.push(i + W);
      for (const j of nb) if (mask[j] && label[j] < 0) { label[j] = id; stack.push(j); }
    }
    comps.push(n); ccx.push(sx / n); ccy.push(sy / n);
  }
  let best = 0;
  for (let i = 1; i < comps.length; i++) if (comps[i] > comps[best]) best = i;
  // the largest NON-main component is the centre dot → exact eye location
  let dot = -1;
  for (let i = 0; i < comps.length; i++) if (i !== best && (dot < 0 || comps[i] > comps[dot])) dot = i;
  if (dot >= 0) { eyeFromDot = [ccx[dot], ccy[dot]]; }
  for (let i = 0; i < W * H; i++) if (mask[i] && label[i] !== best) mask[i] = 0;
}

// ── 1c. clean enclosed counter. The real logo's eye is a near-OPEN pocket with a
//        floating dot (no true hole). To give the metaball a clean, fully-open
//        COUNTER without destroying the logo's open bays (a global close does),
//        do a TARGETED edit at the eye: carve a circular hole at the dot location,
//        then drop a small filled PLUG just below it to seal only the narrow
//        channel — turning the open pocket into a true enclosed loop. Bays untouched.
const EYER = Number(process.env.EYER ?? 17); // carved counter radius (px)
const PLUG = Number(process.env.PLUG ?? 15); // plug radius that seals the channel
const PLUGDY = Number(process.env.PLUGDY ?? 26); // plug offset below the eye (px)
const PLUGDX = Number(process.env.PLUGDX ?? 2);
const EYEDX = Number(process.env.EYEDX ?? 0); // manual eye nudge (px)
const EYEDY = Number(process.env.EYEDY ?? 0);
const PUPIL = process.env.PUPIL === "1"; // restore the logo's eye dot
const PUPILR = Number(process.env.PUPILR ?? 0.03); // pupil field radius (symbol units)
let eyePx = null; // eye centre in mask px (for the optional pupil)
{
  let ex = eyeFromDot ? eyeFromDot[0] : W / 2;
  let ey = eyeFromDot ? eyeFromDot[1] : H / 2;
  ex += EYEDX; ey += EYEDY;
  eyePx = [ex, ey];
  const disc = (cx, cy, r, val) => {
    const r2 = r * r;
    for (let y = Math.max(0, (cy - r) | 0); y <= Math.min(H - 1, (cy + r) | 0); y++)
      for (let x = Math.max(0, (cx - r) | 0); x <= Math.min(W - 1, (cx + r) | 0); x++)
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) mask[y * W + x] = val;
  };
  disc(ex + PLUGDX, ey + PLUGDY, PLUG, 1); // seal the channel below the counter
  disc(ex, ey, EYER, 0); // carve the clean counter hole
  console.log(`counter: eye @(${ex | 0},${ey | 0}) r${EYER}px · plug r${PLUG}@+${PLUGDY}`);
}

// ── 2. erode + distance transform (chamfer 3-4-5, two passes) ─────────────────
const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : mask[y * W + x]);
let m = mask.slice();
for (let e = 0; e < ERODE; e++) {
  const n = m.slice();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (m[y * W + x] && (!at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1)))
        n[y * W + x] = 0;
  m = n;
}
const INF = 1e9;
const dist = new Float64Array(W * H);
for (let i = 0; i < W * H; i++) dist[i] = m[i] ? INF : 0;
const relax = (x, y, nx, ny, c) => {
  if (nx < 0 || ny < 0 || nx >= W || ny >= H) return;
  const v = dist[ny * W + nx] + c;
  if (v < dist[y * W + x]) dist[y * W + x] = v;
};
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    relax(x, y, x - 1, y, 3); relax(x, y, x, y - 1, 3);
    relax(x, y, x - 1, y - 1, 4); relax(x, y, x + 1, y - 1, 4);
  }
for (let y = H - 1; y >= 0; y--)
  for (let x = W - 1; x >= 0; x--) {
    relax(x, y, x + 1, y, 3); relax(x, y, x, y + 1, 3);
    relax(x, y, x + 1, y + 1, 4); relax(x, y, x - 1, y + 1, 4);
  }
for (let i = 0; i < W * H; i++) dist[i] = m[i] ? dist[i] / 3 : 0; // back to ~px units

// bbox of the original (un-eroded) filled mask → symbol-space mapping
let minx = W, miny = H, maxx = 0, maxy = 0;
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++)
    if (mask[y * W + x]) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
const scale = TARGET / Math.max(maxx - minx, maxy - miny);
const maxrPx = MAXR / scale;

// ── 3. greedy farthest-point packing with coverage removal ────────────────────
const covered = new Uint8Array(W * H);
const balls = [];
while (balls.length < BUDGET) {
  let bi = -1, bd = MINPX;
  for (let i = 0; i < W * H; i++) if (m[i] && !covered[i] && dist[i] > bd) { bd = dist[i]; bi = i; }
  if (bi < 0) break;
  const px = bi % W, py = (bi / W) | 0;
  const rPx = Math.min(dist[bi], maxrPx);
  balls.push([px, py, rPx]);
  const rem = Math.max(1.5, COVER * rPx);
  const r2 = rem * rem;
  const x0 = Math.max(0, (px - rem) | 0), x1 = Math.min(W - 1, (px + rem) | 0);
  const y0 = Math.max(0, (py - rem) | 0), y1 = Math.min(H - 1, (py + rem) | 0);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if ((x - px) * (x - px) + (y - py) * (y - py) <= r2) covered[y * W + x] = 1;
}

// → symbol space (+y up); field radius = K · distance
const SY = balls
  .map(([px, py, rPx]) => [
    +((px - cx) * scale).toFixed(4),
    +(-(py - cy) * scale).toFixed(4),
    +(rPx * scale * K).toFixed(4),
  ])
  .sort((a, b) => b[1] - a[1] || a[0] - b[0]); // top-to-bottom for readable diffs

// optional pupil (the logo's eye dot) at the counter centre — small, so the ring
// keeps ≥2.2·r clearance and stays black in glass (the same rule as the counter).
if (PUPIL && eyePx) {
  const pupil = [
    +((eyePx[0] - cx) * scale).toFixed(4),
    +(-(eyePx[1] - cy) * scale).toFixed(4),
    +PUPILR.toFixed(4),
  ];
  SY.push(pupil);
  console.log(`pupil @ [${pupil}] (r ${PUPILR})`);
}

console.log(`packed ${SY.length} balls  (N=${BUDGET} MAXR=${MAXR} K=${K} COVER=${COVER} ERODE=${ERODE})`);
fs.writeFileSync(path.join(OUT, "mark-balls.json"), JSON.stringify(SY));
console.log("balls:\n" + SY.map((b) => `    [${b[0]}, ${b[1]}, ${b[2]}],`).join("\n"));

// ── 4. render through the LOCKED field shader + overlay the SVG outline ────────
const RPAGE = `<!doctype html><html><body style="margin:0;background:#000">
<canvas id="c" width="${SIZE}" height="${SIZE}"></canvas>
<script type="module">
const VS=${JSON.stringify(FIELD_VERT)}, FS=${JSON.stringify(FIELD_FRAG)};
const cv=document.getElementById('c'); const gl=cv.getContext('webgl2',{antialias:false,alpha:false,premultipliedAlpha:false});
function sh(t,s){const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;}
const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);
if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(pr));gl.useProgram(pr);
const pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
const pl=gl.getAttribLocation(pr,'position');gl.enableVertexAttribArray(pl);gl.vertexAttribPointer(pl,2,gl.FLOAT,false,0,0);
const U=(n)=>gl.getUniformLocation(pr,n);
gl.uniform2f(U('iRes'),cv.width,cv.height);gl.uniform1f(U('iFrame'),${FIELD_FRAME});gl.uniform1f(U('iIso'),${FIELD_ISO});
window.__render=(balls,glass)=>{
  const flat=new Float32Array(${FIELD_N}*3);
  for(let i=0;i<balls.length&&i<${FIELD_N};i++){flat[i*3]=balls[i][0];flat[i*3+1]=balls[i][1];flat[i*3+2]=balls[i][2];}
  gl.uniform3fv(U('iBalls'),flat);gl.uniform1i(U('iCount'),Math.min(balls.length,${FIELD_N}));gl.uniform1f(U('iGlass'),glass?1:0);
  gl.viewport(0,0,cv.width,cv.height);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3);gl.finish();
  return cv.toDataURL('image/png');
};
window.__ready=true;
</script></body></html>`;
await page.setContent(RPAGE, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__ready === true, { timeout: 15000 });
const flat = await page.evaluate((b) => window.__render(b, false), SY);
const glass = await page.evaluate((b) => window.__render(b, true), SY);

// overlay: flat metaball with the real logo outline on top (same fit/scale)
const FRAME = FIELD_FRAME;
const overlayHtml = `<!doctype html><html><body style="margin:0;background:#05070a">
<div style="position:relative;width:${SIZE}px;height:${SIZE}px">
  <img src="${flat}" style="position:absolute;inset:0;width:${SIZE}px;height:${SIZE}px"/>
  <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0.45;
       filter:brightness(0) invert(1)">
    <div style="width:${(TARGET / FRAME) * SIZE}px">${SVG}</div>
  </div>
</div></body></html>`;

const sheet = await ctx.newPage();
await sheet.setContent(
  `<!doctype html><html><body style="margin:0;background:#05070a;display:flex;gap:14px;padding:16px;width:max-content">
   ${[["flat", flat], ["glass", glass]].map(([k, src]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:8px">
       <img src="${src}" style="width:300px;height:300px;border:1px solid #13313a;border-radius:6px"/>
       <div style="font:12px ui-monospace,monospace;color:#00e3fe">${k} · ${SY.length} balls</div></div>`).join("")}
   <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
     <div style="position:relative;width:300px;height:300px;border:1px solid #13313a;border-radius:6px;overflow:hidden">
       <img src="${flat}" style="position:absolute;inset:0;width:300px;height:300px"/>
       <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0.5;filter:brightness(0) invert(1)">
         <div style="width:${(TARGET / FRAME) * 300}px">${SVG}</div></div>
     </div>
     <div style="font:12px ui-monospace,monospace;color:#00e3fe">overlay vs logo</div></div>
   </body></html>`,
);
await sheet.waitForTimeout(250);
await sheet.locator("body").screenshot({ path: path.join(OUT, "author-mark.png") });

fs.writeFileSync(path.join(OUT, "mark-flat.png"), Buffer.from(flat.split(",")[1], "base64"));
fs.writeFileSync(path.join(OUT, "mark-glass.png"), Buffer.from(glass.split(",")[1], "base64"));
await browser.close();
console.log("→ captures/author-mark.png");
