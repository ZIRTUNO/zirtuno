// Render the resting MARK through the EXACT field shader the live hero uses
// (lib/webgl/field-shader.mjs → inverse-square field, iso 2.2) so the sign-off
// screenshot is what ships. Outputs captures/field-mark-flat.png (Phase 0),
// captures/field-mark-glass.png (Phase 1), and a side-by-side field-mark.png.
//   node scripts/capture/field.mjs   (GLOW=0 still renders both)

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MARK_RAW } from "../../lib/webgl/symbols.data.mjs";
import {
  FIELD_VERT,
  FIELD_FRAG,
  FIELD_ISO,
  FIELD_N,
  FIELD_FRAME,
} from "../../lib/webgl/field-shader.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "..", "captures");
const HEADLESS = process.env.HEADLESS !== "false";
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

const PAGE = `<!doctype html><html><body style="margin:0;background:#000">
<canvas id="c" width="${SIZE}" height="${SIZE}" style="width:${SIZE}px;height:${SIZE}px"></canvas>
<script type="module">
const VS = ${JSON.stringify(FIELD_VERT)};
const FS = ${JSON.stringify(FIELD_FRAG)};
const cv = document.getElementById('c');
const gl = cv.getContext('webgl2', { antialias:false, alpha:false, premultipliedAlpha:false });
function sh(t,src){const o=gl.createShader(t);gl.shaderSource(o,src);gl.compileShader(o);
  if(!gl.getShaderParameter(o,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o;}
const prog = gl.createProgram();
gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
gl.linkProgram(prog);
if(!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);
// fullscreen triangle: position (vec2) + uv (vec2), matching the shared vertex shader
const posBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
const pl = gl.getAttribLocation(prog,'position');
gl.enableVertexAttribArray(pl); gl.vertexAttribPointer(pl,2,gl.FLOAT,false,0,0);
const uvBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0, 2,0, 0,2]), gl.STATIC_DRAW);
const ul = gl.getAttribLocation(prog,'uv');
if(ul>=0){ gl.enableVertexAttribArray(ul); gl.vertexAttribPointer(ul,2,gl.FLOAT,false,0,0); }
gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
const U = (n)=>gl.getUniformLocation(prog,n);
gl.uniform2f(U('iRes'), cv.width, cv.height);
gl.uniform1f(U('iFrame'), ${FIELD_FRAME});
gl.uniform1f(U('iIso'), ${FIELD_ISO});
window.__render = (balls, glass) => {
  const flat = new Float32Array(${FIELD_N}*3);
  for (let i=0;i<balls.length && i<${FIELD_N};i++){ flat[i*3]=balls[i][0]; flat[i*3+1]=balls[i][1]; flat[i*3+2]=balls[i][2]; }
  gl.uniform3fv(U('iBalls'), flat);
  gl.uniform1i(U('iCount'), Math.min(balls.length, ${FIELD_N}));
  gl.uniform1f(U('iGlass'), glass ? 1 : 0);
  gl.viewport(0,0,cv.width,cv.height);
  gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES,0,3); gl.finish();
  return cv.toDataURL('image/png');
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
page.on("console", (m) => m.type() === "error" && console.error("CONSOLE:", m.text()));
await page.setContent(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__ready === true, { timeout: 15000 });

const shots = {};
for (const [name, glass] of [["flat", false], ["glass", true]]) {
  const data = await page.evaluate(
    ([balls, g]) => window.__render(balls, g),
    [MARK_RAW.balls, glass],
  );
  const b64 = data.split(",")[1];
  fs.writeFileSync(path.join(OUT, `field-mark-${name}.png`), Buffer.from(b64, "base64"));
  shots[name] = data;
  console.log(`captured field-mark-${name}.png  (${MARK_RAW.balls.length} balls, iso ${FIELD_ISO}, frame ${FIELD_FRAME})`);
}

// side-by-side sheet
const sheet = await ctx.newPage();
await sheet.setContent(
  `<!doctype html><html><body style="margin:0;background:#05070a;display:flex;gap:16px;padding:18px;width:max-content">
   ${[["flat", "Phase 0 · flat cyan"], ["glass", "Phase 1 · liquid glass"]]
     .map(([k, label]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:8px">
        <img src="${shots[k]}" style="width:360px;height:360px;border:1px solid #13313a;border-radius:6px"/>
        <div style="font:13px ui-monospace,monospace;color:#00e3fe">${label}</div></div>`)
     .join("")}
   </body></html>`,
);
await sheet.waitForTimeout(250);
await sheet.locator("body").screenshot({ path: path.join(OUT, "field-mark.png") });

await browser.close();
console.log("→ captures/field-mark.png");
