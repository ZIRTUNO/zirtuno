// Structural form authoring (metaball-morph-spec §10 + Update v1.1): each pillar is
// hand-authored from explicit primitives (discs / strokes / tapers / arcs) — NOT
// blind distance-transform packing, which fills the intended gaps. Gaps are spaced
// WIDER than the literal reference so fine negative space survives in GLASS at iso
// 2.2 (§2.1: a deliberate gap needs opposite walls ≥ ~2.2·r apart). Rendered through
// the LOCKED field shader (lib/webgl/field-shader) in flat + glass; the SVG mark is
// shown for the full sheet but is the resting hero via §6.1 (not a metaball).
//   node scripts/author-forms.mjs
// Writes captures/forms-flat.png, forms-glass.png, lib/webgl/forms.generated.json.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MARK_RAW } from "../lib/webgl/symbols.data.mjs";
import {
  FIELD_VERT, FIELD_FRAG, FIELD_ISO, FIELD_N, FIELD_FRAME,
} from "../lib/webgl/field-shader.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "captures");
const SIZE = 360;
fs.mkdirSync(OUT, { recursive: true });

// ── explicit ball emitters (symbol space [-0.5,0.5], +y up) ───────────────────
const R = (v) => +v.toFixed(4);
const RAD = (d) => (d * Math.PI) / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const disc = (x, y, r) => [[R(x), R(y), R(r)]];
function stroke(x1, y1, x2, y2, r, sp = 1.15) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(1, Math.round(len / (sp * r)));
  const out = [];
  for (let i = 0; i <= n; i++) { const t = i / n; out.push([R(lerp(x1, x2, t)), R(lerp(y1, y2, t)), R(r)]); }
  return out;
}
function taper(x1, y1, x2, y2, r1, r2, sp = 1.15) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(1, Math.round(len / (sp * ((r1 + r2) / 2))));
  const out = [];
  for (let i = 0; i <= n; i++) { const t = i / n; out.push([R(lerp(x1, x2, t)), R(lerp(y1, y2, t)), R(lerp(r1, r2, t))]); }
  return out;
}
function arc(cx, cy, Rr, r, a0, a1, sp = 1.2) {
  const len = Math.abs(RAD(a1 - a0)) * Rr;
  const n = Math.max(1, Math.round(len / (sp * r)));
  const out = [];
  for (let i = 0; i <= n; i++) { const a = RAD(lerp(a0, a1, i / n)); out.push([R(cx + Math.cos(a) * Rr), R(cy + Math.sin(a) * Rr), R(r)]); }
  return out;
}
const onArc = (cx, cy, Rr, deg, r) => disc(cx + Math.cos(RAD(deg)) * Rr, cy + Math.sin(RAD(deg)) * Rr, r);

// ── the 7 pillars, authored to images 2/3 with wide gaps ──────────────────────
const FORMS = {
  // web — gooey browser window: rounded frame (open interior) + 3 controls + a
  // content bar. Frame from 4 fluid edges; interior empty (walls far apart).
  web: [
    ...stroke(-0.30, 0.32, 0.30, 0.32, 0.052, 1.3), // top
    ...stroke(-0.30, -0.32, 0.30, -0.32, 0.052, 1.3), // bottom
    ...stroke(-0.36, -0.26, -0.36, 0.26, 0.052, 1.3), // left
    ...stroke(0.36, -0.26, 0.36, 0.26, 0.052, 1.3), // right
    ...disc(-0.24, 0.19, 0.03), ...disc(-0.15, 0.19, 0.03), ...disc(-0.06, 0.19, 0.03), // controls
    ...stroke(-0.12, -0.04, 0.12, -0.04, 0.05), // content bar
  ],
  // software — a network: a dumbbell (two nodes + bridge) + a third node, and two
  // clearly SEPARATE chevrons (< and >) in the open lower-right (gap ≫ 2.2·r).
  software: [
    ...disc(-0.29, 0.21, 0.105), ...disc(0.02, 0.25, 0.095), // dumbbell nodes
    ...stroke(-0.19, 0.225, -0.06, 0.245, 0.03), // thin bridge
    ...disc(-0.30, -0.10, 0.095), ...stroke(-0.295, 0.11, -0.30, -0.01, 0.03), // third node + thin neck
    ...stroke(0.06, 0.10, -0.10, -0.05, 0.042), ...stroke(-0.10, -0.05, 0.06, -0.20, 0.042), // <
    ...stroke(0.22, 0.10, 0.38, -0.05, 0.042), ...stroke(0.38, -0.05, 0.22, -0.20, 0.042), // >
  ],
  // ai — brain: two DISTINCT hemispheres split by a DEEP open central fissure,
  // closed only by a bottom bridge (U-shape), + stem + 2 firing neuron droplets.
  ai: [
    // left hemisphere (inner edge ≈ -0.11)
    ...disc(-0.25, 0.17, 0.10), ...disc(-0.30, 0.05, 0.10), ...disc(-0.24, -0.05, 0.10), ...disc(-0.17, 0.07, 0.09),
    // right hemisphere (mirror)
    ...disc(0.25, 0.17, 0.10), ...disc(0.30, 0.05, 0.10), ...disc(0.24, -0.05, 0.10), ...disc(0.17, 0.07, 0.09),
    // bottom bridge — closes the U; the central fissure stays open ABOVE it (~0.22 wide)
    ...stroke(-0.22, -0.15, 0.22, -0.15, 0.075),
    ...disc(0.0, -0.27, 0.055), // stem
    ...disc(-0.36, -0.24, 0.026), ...disc(0.37, -0.21, 0.026), // firing neurons
  ],
  // automation — single fluid cycle loop (~290°) with an open gap + arrowhead bulb.
  automation: [
    ...arc(0, 0, 0.32, 0.058, 122, 410, 1.1), // ~288° loop (gap lower-right)
    ...onArc(0, 0, 0.32, 122, 0.085), // tail bulb
    ...onArc(0, 0, 0.32, 410, 0.11), // arrowhead bulb
  ],
  // data — four necked columns of growing height, well separated (gaps ≫ 2.2·r).
  data: [
    ...stroke(-0.36, -0.30, -0.36, -0.06, 0.05),
    ...stroke(-0.12, -0.30, -0.12, 0.10, 0.05),
    ...stroke(0.12, -0.30, 0.12, -0.02, 0.05),
    ...stroke(0.36, -0.30, 0.36, 0.30, 0.05),
  ],
  // branding — organic core + a necked orbit ring (one clean gap) + 2 satellites.
  branding: [
    ...disc(0, 0, 0.13), ...disc(-0.05, 0.05, 0.09), ...disc(0.05, -0.05, 0.09), // core
    ...arc(0, 0, 0.37, 0.048, 55, 305, 1.25), // orbit (open on the right)
    ...disc(0.34, 0.28, 0.05), ...disc(0.36, -0.28, 0.045), // satellites floating in the opening
  ],
  // marketing — megaphone: tapered horn (back→bell) + 2 necked signal waves + a drop.
  marketing: [
    ...taper(-0.36, 0.0, -0.12, 0.01, 0.05, 0.15), // horn
    ...arc(-0.06, 0.01, 0.25, 0.05, -52, 52, 1.25), // wave 1
    ...arc(-0.06, 0.01, 0.40, 0.052, -44, 44, 1.25), // wave 2
    ...disc(0.40, -0.30, 0.05), // stray drop
  ],
};

const ORDER = ["mark", "web", "software", "ai", "automation", "data", "branding", "marketing"];
const cells = {};
const generated = {};
for (const key of ORDER) {
  const balls = key === "mark" ? MARK_RAW.balls.map((b) => [b[0], b[1], b[2]]) : FORMS[key];
  if (key !== "mark") generated[key] = balls;
  cells[key] = { balls };
  const over = balls.length > FIELD_N ? "  ⚠ OVER BUDGET" : "";
  console.log(`${key.padEnd(11)} ${balls.length} balls${over}`);
}
fs.writeFileSync(path.join(__dirname, "..", "lib", "webgl", "forms.generated.json"), JSON.stringify(generated, null, 0));

// ── render through the LOCKED field shader ────────────────────────────────────
const PAGE = `<!doctype html><html><body style="margin:0;background:#000">
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

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const executablePath = chromeCandidates.find((c) => fs.existsSync(c));

const browser = await chromium.launch({ headless: process.env.HEADLESS !== "false", chromiumSandbox: false, ...(executablePath ? { executablePath } : {}) });
const ctx = await browser.newContext({ deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("CONSOLE:", m.text()));
await page.setContent(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__ready === true, { timeout: 15000 });

for (const key of ORDER) {
  cells[key].flat = await page.evaluate((b) => window.__render(b, false), cells[key].balls);
  cells[key].glass = await page.evaluate((b) => window.__render(b, true), cells[key].balls);
}

async function sheet(kind, file) {
  const html = `<!doctype html><html><body style="margin:0;background:#05070a;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:16px;width:max-content">
   ${ORDER.map((k) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px">
       <img src="${cells[k][kind]}" style="width:220px;height:220px;border:1px solid #13313a;border-radius:6px"/>
       <div style="font:12px ui-monospace,monospace;color:#00e3fe">${k} · ${cells[k].balls.length}</div></div>`).join("")}
   </body></html>`;
  const p = await ctx.newPage();
  await p.setContent(html);
  await p.waitForTimeout(250);
  await p.locator("body").screenshot({ path: path.join(OUT, file) });
  await p.close();
}
await sheet("flat", "forms-flat.png");
await sheet("glass", "forms-glass.png");
await browser.close();
console.log("→ captures/forms-flat.png + forms-glass.png");
