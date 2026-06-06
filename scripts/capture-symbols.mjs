// Render every morph SYMBOL through the EXACT 2D metaball field of the react-bits
// reference (total = Σ r²/|p−c|², thresholded at 1.3 with fwidth AA) and composite
// a labeled contact sheet (captures/symbols-sheet.png). Flat cyan on near-black so
// the SILHOUETTE is what's judged. Reads the shared source (symbols.data.mjs).
//   node scripts/capture-symbols.mjs

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_RAW } from "../lib/webgl/symbols.data.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "captures");
const HEADLESS = process.env.HEADLESS !== "false";
const FRAME = 1.15; // visible vertical extent in symbol units (zoom)
const SIZE = 480;

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const executablePath = chromeCandidates.find((c) => fs.existsSync(c));

fs.mkdirSync(OUT, { recursive: true });

const PAGE = `<!doctype html><html><body style="margin:0;background:#05070a">
<canvas id="c" width="${SIZE}" height="${SIZE}" style="width:${SIZE}px;height:${SIZE}px"></canvas>
<script>
const cv = document.getElementById('c');
const gl = cv.getContext('webgl2', { antialias:false, alpha:false });
const VS = \`#version 300 es
precision highp float;
in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }\`;
const FS = \`#version 300 es
precision highp float;
uniform vec2 iRes; uniform vec3 iColor; uniform int iCount; uniform float iFrame;
uniform vec3 iBalls[160];
out vec4 o;
void main(){
  vec2 fc = gl_FragCoord.xy;
  float scale = iFrame / iRes.y;
  vec2 q = (fc - iRes*0.5) * scale;
  float total = 0.0;
  for(int i=0;i<160;i++){ if(i>=iCount) break; vec3 b=iBalls[i]; vec2 d=q-b.xy; total += (b.z*b.z)/max(dot(d,d),1e-6); }
  float f = smoothstep(-1.0, 1.0, (total - 1.3)/min(1.0, fwidth(total)));
  o = vec4(iColor*f, 1.0);
}\`;
function sh(t,s){const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);
  if(!gl.getShaderParameter(o,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o;}
const prog = gl.createProgram();
gl.attachShader(prog, sh(gl.VERTEX_SHADER,VS));
gl.attachShader(prog, sh(gl.FRAGMENT_SHADER,FS));
gl.linkProgram(prog); gl.useProgram(prog);
const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog,'p');
gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
const U = (n)=>gl.getUniformLocation(prog,n);
gl.uniform2f(U('iRes'), cv.width, cv.height);
gl.uniform3f(U('iColor'), 0.0, 0.890, 0.996);
gl.uniform1f(U('iFrame'), ${FRAME});
window.__render = (balls) => {
  const flat = new Float32Array(160*3);
  for (let i=0;i<balls.length && i<160;i++){ flat[i*3]=balls[i][0]; flat[i*3+1]=balls[i][1]; flat[i*3+2]=balls[i][2]; }
  gl.uniform3fv(U('iBalls'), flat);
  gl.uniform1i(U('iCount'), Math.min(balls.length,160));
  gl.viewport(0,0,cv.width,cv.height);
  gl.clearColor(0.02,0.027,0.039,1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES,0,3);
  gl.finish();
};
window.__ready = true;
</script></body></html>`;

const browser = await chromium.launch({
  headless: HEADLESS,
  chromiumSandbox: false,
  ...(executablePath ? { executablePath } : {}),
});
const ctx = await browser.newContext({ deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
await page.setContent(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__ready === true, { timeout: 15000 });

const cells = [];
for (const sym of ALL_RAW) {
  await page.evaluate((balls) => window.__render(balls), sym.balls);
  await page.waitForTimeout(80);
  const buf = await page.locator("#c").screenshot();
  fs.writeFileSync(path.join(OUT, `symbol-${sym.key}.png`), buf);
  cells.push({ label: `${sym.key} · ${sym.balls.length} balls`, b64: buf.toString("base64") });
  console.log(`captured ${sym.key} (${sym.balls.length} balls)`);
}

// labeled grid (4 × 2)
const sheet = await ctx.newPage();
const html = cells
  .map(
    ({ label, b64 }) => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
      <img src="data:image/png;base64,${b64}" style="width:230px;height:230px;border:1px solid #13313a;border-radius:4px"/>
      <div style="font:12px ui-monospace,monospace;letter-spacing:.06em;color:#00e3fe">${label}</div>
    </div>`,
  )
  .join("");
await sheet.setContent(
  `<!doctype html><html><body style="margin:0;background:#05070a;display:grid;
     grid-template-columns:repeat(4,1fr);gap:14px;padding:18px;width:max-content">${html}</body></html>`,
);
await sheet.waitForTimeout(300);
await sheet.locator("body").screenshot({ path: path.join(OUT, "symbols-sheet.png") });

await browser.close();
console.log("→ captures/symbols-sheet.png");
