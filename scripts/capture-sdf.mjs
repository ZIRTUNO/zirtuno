// SDF-GLASS rest renderer proof (metaball-morph-spec v1.2 §6.1): render each FORM
// SVG as liquid glass by feeding its signed-distance field into the locked glass
// math (lib/webgl/sdf-glass-shader). Silhouette + holes are EXACT (from the SVG);
// the material matches the metaball glass (image-3 look). Renders every form SVG
// that exists — mark always; the 7 pillars from public/brand/forms/{key}.svg once
// they're vectorized (STEP A). Writes captures/sdf-glass-sheet.png + per-form PNGs.
//   node scripts/capture-sdf.mjs   (THICK=… RES=… to tune)

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SDF_GLASS_VERT, SDF_GLASS_FRAG, SDF_THICK } from "../lib/webgl/sdf-glass-shader.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "captures");
const BRAND = path.join(ROOT, "public", "brand");
const RES = Number(process.env.RES) || 512; // SDF + render resolution
const DRAW = Number(process.env.DRAW) || 0.9; // form fills this fraction of the frame
const THICK = Number(process.env.THICK) || SDF_THICK;
fs.mkdirSync(OUT, { recursive: true });

const KEYS = ["mark", "web", "software", "ai", "automation", "data", "branding", "marketing"];
const svgPathFor = (k) =>
  k === "mark"
    ? path.join(BRAND, "zirtuno-logo-mark.svg")
    : path.join(BRAND, "forms", `${k}.svg`);
const forms = KEYS.map((k) => ({ key: k, file: svgPathFor(k) })).filter((f) => fs.existsSync(f.file));

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const executablePath = chromeCandidates.find((c) => fs.existsSync(c));

const PAGE = `<!doctype html><html><body style="margin:0;background:#000">
<canvas id="c" width="${RES}" height="${RES}"></canvas>
<script type="module">
const VS=${JSON.stringify(SDF_GLASS_VERT)}, FS=${JSON.stringify(SDF_GLASS_FRAG)};
const cv=document.getElementById('c'); const gl=cv.getContext('webgl2',{antialias:false,alpha:false,premultipliedAlpha:false});
function sh(t,s){const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;}
const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);
if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(pr));gl.useProgram(pr);
const pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
const pl=gl.getAttribLocation(pr,'position');gl.enableVertexAttribArray(pl);gl.vertexAttribPointer(pl,2,gl.FLOAT,false,0,0);
gl.getExtension('OES_texture_float_linear');
const tex=gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D,tex);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
const U=(n)=>gl.getUniformLocation(pr,n);

// exact 1-D squared EDT (Felzenszwalb & Huttenlocher), then signed 2-D field.
function edt1d(f,n){
  const d=new Float64Array(n), v=new Int32Array(n), z=new Float64Array(n+1);
  let k=0; v[0]=0; z[0]=-1e20; z[1]=1e20;
  for(let q=1;q<n;q++){
    let s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);
    while(s<=z[k]){k--; s=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*q-2*v[k]);}
    k++; v[k]=q; z[k]=s; z[k+1]=1e20;
  }
  k=0;
  for(let q=0;q<n;q++){ while(z[k+1]<q)k++; const dx=q-v[k]; d[q]=dx*dx+f[v[k]]; }
  return d;
}
function edt2d(seed, W, H){ // seed[i]=1 → distance 0; returns squared distance to nearest seed
  const INF=1e20; const f=new Float64Array(W*H);
  for(let i=0;i<W*H;i++) f[i]=seed[i]?0:INF;
  const col=new Float64Array(H);
  for(let x=0;x<W;x++){ for(let y=0;y<H;y++) col[y]=f[y*W+x]; const r=edt1d(col,H); for(let y=0;y<H;y++) f[y*W+x]=r[y]; }
  const row=new Float64Array(W);
  for(let y=0;y<H;y++){ for(let x=0;x<W;x++) row[x]=f[y*W+x]; const r=edt1d(row,W); for(let x=0;x<W;x++) f[y*W+x]=r[x]; }
  return f;
}

window.__renderForm = async (svgText, RES, DRAW, thick) => {
  // 1. rasterise the SVG to an alpha mask, normalised to its CONTENT bbox so every
  //    form fills the frame consistently (uniform sizing + morph registration).
  const img=new Image();
  img.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svgText)));
  await img.decode();
  // probe pass: contain-fit, find the content bbox
  const probe=document.createElement('canvas'); probe.width=probe.height=RES; const pg=probe.getContext('2d');
  const ar=img.width/img.height; let pw=RES, ph=RES; if(ar>1) ph=RES/ar; else pw=RES*ar;
  const pox=(RES-pw)/2, poy=(RES-ph)/2;
  pg.drawImage(img,pox,poy,pw,ph);
  const pd=pg.getImageData(0,0,RES,RES).data;
  let minx=RES,miny=RES,maxx=0,maxy=0;
  for(let y=0;y<RES;y++) for(let x=0;x<RES;x++) if(pd[(y*RES+x)*4+3]>40){ if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y; }
  // final: redraw the WHOLE image (5-arg, robust to SVG intrinsic-size quirks),
  // scaled + offset so the content bbox fills DRAW*RES centred.
  const bw=maxx-minx+1, bh=maxy-miny+1;
  const S=(DRAW*RES)/Math.max(bw,bh);
  const fw=pw*S, fh=ph*S;
  const fx=RES/2-(minx-pox+bw/2)*S, fy=RES/2-(miny-poy+bh/2)*S;
  const mc=document.createElement('canvas'); mc.width=mc.height=RES; const g=mc.getContext('2d');
  g.clearRect(0,0,RES,RES);
  g.drawImage(img, fx,fy,fw,fh);
  const a=g.getImageData(0,0,RES,RES).data;
  const inside=new Uint8Array(RES*RES), outside=new Uint8Array(RES*RES);
  for(let i=0;i<RES*RES;i++){ const f=a[i*4+3]>40?1:0; inside[i]=f; outside[i]=f?0:1; }
  // 2. signed distance (pixels) = (inside? -dist-to-outside : +dist-to-inside)
  const dOut=edt2d(outside,RES,RES); // for inside pixels → dist to boundary
  const dIn=edt2d(inside,RES,RES);   // for outside pixels → dist to boundary
  let sdf=new Float32Array(RES*RES); const k=1.0/RES; // px → symbol units (frame=1)
  for(let i=0;i<RES*RES;i++){ sdf[i]=(inside[i] ? -Math.sqrt(dOut[i]) : Math.sqrt(dIn[i]))*k; }
  // light separable box blur of the SDF → removes the medial-axis crease so the
  // dome/normal read as smooth liquid (silhouette stays crisp: a blurred true SDF
  // keeps its zero-contour to sub-pixel). BLUR px radius, a couple passes.
  const BLUR=${Number(process.env.BLUR ?? 3)};
  function boxBlur(arr){
    const tmp=new Float32Array(RES*RES);
    for(let y=0;y<RES;y++) for(let x=0;x<RES;x++){ let s=0,c=0; for(let dx=-BLUR;dx<=BLUR;dx++){const xx=x+dx; if(xx>=0&&xx<RES){s+=arr[y*RES+xx];c++;}} tmp[y*RES+x]=s/c; }
    for(let y=0;y<RES;y++) for(let x=0;x<RES;x++){ let s=0,c=0; for(let dy=-BLUR;dy<=BLUR;dy++){const yy=y+dy; if(yy>=0&&yy<RES){s+=tmp[yy*RES+x];c++;}} arr[y*RES+x]=s/c; }
  }
  if(BLUR>0){ boxBlur(sdf); boxBlur(sdf); }
  // 3. flip Y (canvas y-down → texture y-up) and upload R32F
  const flip=new Float32Array(RES*RES);
  for(let y=0;y<RES;y++) for(let x=0;x<RES;x++) flip[(RES-1-y)*RES+x]=sdf[y*RES+x];
  gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.R32F,RES,RES,0,gl.RED,gl.FLOAT,flip);
  // 4. render glass
  gl.uniform1i(U('iSDF'),0); gl.uniform1f(U('iThick'),thick);
  gl.uniform2f(U('iRes'),RES,RES); gl.uniform2f(U('iTexel'),1/RES,1/RES);
  gl.viewport(0,0,RES,RES); gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES,0,3); gl.finish();
  return cv.toDataURL('image/png');
};
window.__ready=true;
</script></body></html>`;

const browser = await chromium.launch({ headless: process.env.HEADLESS !== "false", chromiumSandbox: false, ...(executablePath ? { executablePath } : {}) });
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("CONSOLE:", m.text()));
await page.setContent(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__ready === true, { timeout: 15000 });

const cells = [];
for (const { key, file } of forms) {
  const svgText = fs.readFileSync(file, "utf8");
  const data = await page.evaluate(
    ([svg, res, draw, thick]) => window.__renderForm(svg, res, draw, thick),
    [svgText, RES, DRAW, THICK],
  );
  fs.writeFileSync(path.join(OUT, `sdf-glass-${key}.png`), Buffer.from(data.split(",")[1], "base64"));
  cells.push({ key, data });
  console.log(`rendered ${key.padEnd(11)} from ${path.relative(ROOT, file)}`);
}

const missing = KEYS.filter((k) => !forms.find((f) => f.key === k));
if (missing.length) console.log(`\n⚠ missing SVGs (STEP A): ${missing.join(", ")} → add public/brand/forms/<key>.svg`);

const sheet = await ctx.newPage();
await sheet.setContent(
  `<!doctype html><html><body style="margin:0;background:#05070a;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:16px;width:max-content">
   ${cells.map(({ key, data }) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px">
      <img src="${data}" style="width:230px;height:230px;border:1px solid #13313a;border-radius:6px"/>
      <div style="font:12px ui-monospace,monospace;color:#00e3fe">${key} · SDF-glass</div></div>`).join("")}
   </body></html>`,
);
await sheet.waitForTimeout(250);
await sheet.locator("body").screenshot({ path: path.join(OUT, "sdf-glass-sheet.png") });
await browser.close();
console.log("→ captures/sdf-glass-sheet.png");
