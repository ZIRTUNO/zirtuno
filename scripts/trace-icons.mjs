// FLUID symbol engine. Each symbol is composed of fat BULBS (circles) + thin
// NECKS (capsules) and fused with SMOOTH-MIN — which fillets the joins into the
// liquid mercury look of the brand reference (droplets running + connecting),
// while staying seamless: few large analytic primitives → no scallops, no lumps,
// gaps preserved. The hero renders the same smin-union and morphs by lerping the
// primitives. Outputs lib/webgl/symbols.generated.json + captures/trace-sheet.png.
//   node scripts/trace-icons.mjs   (FLAT=1 for flat cyan, K=… to tune fillet)

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "captures");
const DATA = path.join(__dirname, "..", "lib", "webgl", "symbols.generated.json");
const HEADLESS = process.env.HEADLESS !== "false";
const GLASS = process.env.GLOW ? 1 : 0; // flat silhouettes by default; GLOW=1 for glass
const K = Number(process.env.K) || 0.05;
const FRAME = 1.9; // visible vertical extent (symbols live in ~±0.85)
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

// ── primitive helpers (every primitive is a capsule [x1,y1,x2,y2,r]; a circle is
//    a zero-length capsule) ────────────────────────────────────────────────────
const circ = (x, y, r) => [x, y, x, y, r];
const cap = (x1, y1, x2, y2, r) => [x1, y1, x2, y2, r];
/** bulbs at each point [x,y,r] + thin necks between consecutive points */
function chain(pts, neckR) {
  const out = pts.map((p) => circ(p[0], p[1], p[2]));
  for (let i = 0; i < pts.length - 1; i++)
    out.push(cap(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], neckR));
  return out;
}
const RAD = (d) => (d * Math.PI) / 180;
/** bulbs along an arc + necks (a fluid arc) */
function arcChain(cx, cy, R, a0, a1, n, r, neckR) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = RAD(a0 + ((a1 - a0) * i) / (n - 1));
    pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R, r]);
  }
  return chain(pts, neckR);
}
const onArc = (cx, cy, R, deg, r) => circ(cx + Math.cos(RAD(deg)) * R, cy + Math.sin(RAD(deg)) * R, r);
/** a closed ring of node-bulbs joined by necks (network / orbit) */
function ringNodes(cx, cy, R, count, nodeR, neckR, phase = 0) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = RAD(phase) + (i / count) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
  }
  const out = pts.map((p) => circ(p[0], p[1], nodeR));
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    out.push(cap(pts[i][0], pts[i][1], pts[j][0], pts[j][1], neckR));
  }
  return out;
}

const SYMBOLS = {
  // mark — a flowing organic glyph: a loop (with counter dot) opening into a lobe
  mark: [
    ...arcChain(-0.16, -0.04, 0.32, 55, 330, 6, 0.12, 0.085), // the loop (open right)
    circ(-0.16, -0.04, 0.08), // counter dot inside
    cap(-0.02, 0.22, 0.16, 0.36, 0.1), // neck → upper lobe
    ...chain([[0.16, 0.36, 0.15], [0.42, 0.56, 0.19], [0.54, 0.3, 0.15]], 0.1), // upper lobe
    cap(0.12, -0.18, 0.36, -0.05, 0.1), // neck → tail
    ...chain([[0.36, -0.05, 0.14], [0.52, -0.38, 0.14], [0.34, -0.58, 0.11]], 0.09), // tail
  ],
  // web — a browser window: thin fluid frame + 3 control bulbs + thumbnail + lines
  web: [
    cap(-0.6, 0.58, 0.6, 0.58, 0.055), // top
    cap(0.64, 0.52, 0.64, -0.52, 0.055), // right
    cap(0.6, -0.58, -0.6, -0.58, 0.055), // bottom
    cap(-0.64, -0.52, -0.64, 0.52, 0.055), // left
    cap(-0.5, 0.3, 0.5, 0.3, 0.04), // title divider
    circ(-0.46, 0.45, 0.05), circ(-0.3, 0.45, 0.05), circ(-0.14, 0.45, 0.05), // controls
    cap(-0.46, -0.12, -0.16, -0.12, 0.18), // content thumbnail (fat capsule)
    cap(0.1, 0.06, 0.5, 0.06, 0.04), cap(0.1, -0.16, 0.44, -0.16, 0.04), // text lines
  ],
  // software — a node NETWORK ring around a centered </> glyph
  software: [
    ...ringNodes(0, 0.03, 0.55, 6, 0.12, 0.055, 0),
    cap(-0.02, 0.2, -0.22, -0.04, 0.05), cap(-0.22, -0.04, -0.02, -0.28, 0.05), // <
    cap(0.14, 0.2, 0.34, -0.04, 0.05), cap(0.34, -0.04, 0.14, -0.28, 0.05), // >
  ],
  // ai — a brain: bilobed crown + rounded base outline, 3 internal fold tubes
  ai: [
    ...arcChain(-0.2, 0.12, 0.33, 32, 168, 4, 0.1, 0.082), // left hemisphere crown
    ...arcChain(0.2, 0.12, 0.33, 12, 148, 4, 0.1, 0.082), // right hemisphere crown
    ...chain([[-0.5, 0.06, 0.1], [-0.46, -0.3, 0.092], [-0.16, -0.47, 0.088],
      [0.16, -0.47, 0.088], [0.46, -0.3, 0.092], [0.5, 0.08, 0.1]], 0.072), // base sweep
    ...chain([[0.0, 0.34, 0.06], [0.0, -0.26, 0.058]], 0.045), // central fissure
    ...chain([[-0.22, 0.22, 0.06], [-0.24, -0.2, 0.055]], 0.045), // left fold
    ...chain([[0.22, 0.22, 0.06], [0.24, -0.2, 0.055]], 0.045), // right fold
    circ(0.0, -0.52, 0.07), // brain-stem
    circ(-0.4, -0.54, 0.05), circ(-0.28, -0.62, 0.04), // neurons
  ],
  // automation — a fluid cycle loop (necked ring) with arrow + tail bulbs
  automation: [
    ...arcChain(0, 0, 0.6, 120, 402, 11, 0.075, 0.065),
    onArc(0, 0, 0.6, 120, 0.13), // tail bulb
    onArc(0, 0, 0.6, 46, 0.16), // arrow head bulb
  ],
  // data — strings of pearls: four columns of bulb-neck-bulb, growing
  data: [
    ...chain([[-0.6, -0.5, 0.1], [-0.6, -0.18, 0.11], [-0.6, 0.12, 0.1]], 0.06),
    ...chain([[-0.2, -0.5, 0.1], [-0.2, -0.16, 0.11], [-0.2, 0.18, 0.12], [-0.2, 0.5, 0.11]], 0.06),
    ...chain([[0.2, -0.5, 0.1], [0.2, -0.2, 0.11], [0.2, 0.12, 0.1]], 0.06),
    ...chain([[0.6, -0.5, 0.1], [0.6, -0.12, 0.11], [0.6, 0.28, 0.12]], 0.06),
  ],
  // branding — a bulbous core + a necked node orbit (ring) + outer satellites
  branding: [
    circ(0, 0, 0.26),
    ...ringNodes(0, 0, 0.56, 7, 0.07, 0.05, 12),
    circ(0, 0.85, 0.1), circ(-0.86, 0.06, 0.085), circ(0.86, 0.08, 0.078),
  ],
  // marketing — a fluid megaphone (growing horn) + necked signal waves + drops
  marketing: [
    ...chain([[-0.6, 0.0, 0.1], [-0.36, 0.02, 0.18], [-0.12, 0.03, 0.28]], 0.13),
    ...arcChain(-0.04, 0.0, 0.56, -50, 50, 6, 0.055, 0.05),
    ...arcChain(-0.04, 0.0, 0.84, -46, 46, 7, 0.06, 0.05),
    circ(0.52, 0.74, 0.08), circ(0.64, -0.68, 0.09),
  ],
};
const KEYS = Object.keys(SYMBOLS);

const PAGE = `<!doctype html><html><body style="margin:0;background:#000">
<canvas id="m" width="${SIZE}" height="${SIZE}"></canvas>
<script>
const mc=document.getElementById('m'); const gl=mc.getContext('webgl2',{antialias:false,alpha:false});
const VS='#version 300 es\\nprecision highp float;in vec2 p;out vec2 vUv;void main(){vUv=p*0.5+0.5;gl_Position=vec4(p,0.,1.);}';
const FS=\`#version 300 es
precision highp float;
uniform vec2 iRes; uniform int iCount; uniform float iFrame; uniform float iK; uniform float iGlass;
uniform vec4 iSeg[96]; uniform float iRad[96];
in vec2 vUv; out vec4 o;
float smin(float a,float b,float k){float h=clamp(0.5+0.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float sdCap(vec2 p,vec2 a,vec2 b,float r){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.,1.);return length(pa-ba*h)-r;}
float field(vec2 q){ float d=1e9; for(int i=0;i<96;i++){ if(i>=iCount)break; vec4 s=iSeg[i]; d=smin(d,sdCap(q,s.xy,s.zw,iRad[i]),iK);} return d; }
void main(){
  vec2 q=(gl_FragCoord.xy - iRes*0.5)*(iFrame/iRes.y);
  float px=iFrame/iRes.y;            // world units per pixel
  float d=field(q);
  float aa=fwidth(d)+1e-4; float fill=smoothstep(aa,-aa,d);
  if(iGlass<0.5){o=vec4(vec3(0.0,0.890,0.996)*fill,1.0);return;}
  // outer glow halo (bloom around the liquid)
  float glow=exp(-max(d,0.0)*7.0);
  vec3 col=vec3(0.0,0.66,0.92)*glow*0.7;
  if(fill>0.001){
    float inside=max(-d,0.0);
    // rounded DOME profile across the whole cross-section → voluminous glass tube
    float THICK=0.135;
    float t=clamp(inside/THICK,0.0,1.0);
    float curv=sqrt(max(1.0-(1.0-t)*(1.0-t),0.0));      // 0 at edge → 1 at top
    float slope=(1.0-t)/max(curv,0.05);                  // dH/dt: steep rim, flat top
    vec2 e=vec2(px*1.5,0.0);
    vec2 g=vec2(field(q+e.xy)-field(q-e.xy), field(q+e.yx)-field(q-e.yx));
    vec2 gdir=length(g)>1e-7?normalize(g):vec2(0.0,1.0);
    vec3 n=normalize(vec3(gdir*slope, 1.0));             // true rounded normal
    vec3 V=vec3(0.0,0.0,1.0);
    vec3 L1=normalize(vec3(-0.42,0.72,0.55));
    float diff=clamp(dot(n,L1)*0.5+0.5,0.0,1.0);         // wrapped diffuse
    vec3 Rfl=reflect(-L1,n); float sp=max(dot(Rfl,V),0.0);
    float spec=pow(sp,26.0);                             // tight glossy highlight
    float sheen=pow(sp,4.0)*0.22;                        // broad wet sheen
    float fres=pow(1.0-max(n.z,0.0),2.6);                // rim light
    vec3 base=mix(vec3(0.0,0.72,0.92), vec3(0.45,0.97,1.0), diff); // bright cyan body
    base+=vec3(1.0)*spec + vec3(0.6,0.92,1.0)*sheen;
    base+=vec3(0.5,0.95,1.0)*fres*0.5;
    col=mix(col,base,fill);
  }
  o=vec4(col,1.0);
}\`;
function sh(t,src){const o=gl.createShader(t);gl.shaderSource(o,src);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;}
const prog=gl.createProgram(); gl.attachShader(prog,sh(gl.VERTEX_SHADER,VS)); gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FS)); gl.linkProgram(prog);
if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);
const buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
const loc=gl.getAttribLocation(prog,'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
const U=(n)=>gl.getUniformLocation(prog,n);
gl.uniform2f(U('iRes'),mc.width,mc.height); gl.uniform1f(U('iFrame'),${FRAME}); gl.uniform1f(U('iK'),${K}); gl.uniform1f(U('iGlass'),${GLASS});
const RS=${Number(process.env.RS) || 1.18};
window.__render=(caps)=>{
  const seg=new Float32Array(96*4), rad=new Float32Array(96);
  for(let i=0;i<caps.length&&i<96;i++){ seg[i*4]=caps[i][0]; seg[i*4+1]=caps[i][1]; seg[i*4+2]=caps[i][2]; seg[i*4+3]=caps[i][3]; rad[i]=caps[i][4]*RS; }
  gl.uniform4fv(U('iSeg'),seg); gl.uniform1fv(U('iRad'),rad); gl.uniform1i(U('iCount'),Math.min(caps.length,96));
  gl.viewport(0,0,mc.width,mc.height); gl.clearColor(0.02,0.027,0.039,1); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES,0,3); gl.finish();
  return mc.toDataURL('image/png');
};
window.__ready=true;
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
for (const key of KEYS) {
  const mb = await page.evaluate((caps) => window.__render(caps), SYMBOLS[key]);
  fs.writeFileSync(path.join(OUT, `trace-mb-${key}.png`), Buffer.from(mb.split(",")[1], "base64"));
  cells.push({ key, mb });
  console.log(`${key.padEnd(11)} ${SYMBOLS[key].length} primitives`);
}

fs.writeFileSync(DATA, JSON.stringify(SYMBOLS));
console.log(`→ ${path.relative(process.cwd(), DATA)}`);

const sheet = await ctx.newPage();
const html = cells
  .map(({ key, mb }) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px">
    <img src="${mb}" style="width:230px;height:230px;border:1px solid #13313a;border-radius:4px"/>
    <div style="font:12px ui-monospace,monospace;color:#00e3fe">${key}</div></div>`)
  .join("");
await sheet.setContent(`<!doctype html><html><body style="margin:0;background:#05070a;display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:18px;width:max-content">${html}</body></html>`);
await sheet.waitForTimeout(300);
await sheet.locator("body").screenshot({ path: path.join(OUT, "trace-sheet.png") });

await browser.close();
console.log("→ captures/trace-sheet.png");
