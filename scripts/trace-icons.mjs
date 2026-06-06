// MAX-FIDELITY symbol engine. Each symbol is DRAWN precisely as a vector shape
// (folds / window interiors are real negative space), then rendered from its TRUE
// signed distance field (SDF) — seamless, exact contours, crisp + buttery (a
// circle-pack metaball is either lumpy or melty; the SDF is neither). The SDF also
// gives fluid morphs later (lerp two fields). Outputs a glass contact sheet
// (captures/trace-sheet.png), per-symbol PNGs, and packed circles as a fallback
// (lib/webgl/symbols.generated.json).  node scripts/trace-icons.mjs

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "captures");
const DATA = path.join(__dirname, "..", "lib", "webgl", "symbols.generated.json");
const HEADLESS = process.env.HEADLESS !== "false";
const SIZE = 512;
const GLASS = process.env.FLAT ? 0 : 1;

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const executablePath = chromeCandidates.find((c) => fs.existsSync(c));

fs.mkdirSync(OUT, { recursive: true });

const KEYS = ["mark","web","software","ai","automation","data","branding","marketing"];

const PAGE = `<!doctype html><html><body style="margin:0;background:#000">
<canvas id="d" width="${SIZE}" height="${SIZE}"></canvas>
<canvas id="m" width="${SIZE}" height="${SIZE}"></canvas>
<script>
const S = ${SIZE};
const SC = S * 0.40;
const dc = document.getElementById('d');
const dx = dc.getContext('2d');

function begin(){ dx.setTransform(1,0,0,1,0,0); dx.clearRect(0,0,S,S); dx.fillStyle='#000'; dx.fillRect(0,0,S,S);
  dx.setTransform(SC,0,0,-SC,S/2,S/2); dx.fillStyle='#fff'; dx.strokeStyle='#fff';
  dx.lineCap='round'; dx.lineJoin='round'; }
function lw(w){ dx.lineWidth = w; }
function line(x1,y1,x2,y2){ dx.beginPath(); dx.moveTo(x1,y1); dx.lineTo(x2,y2); dx.stroke(); }
function poly(pts){ dx.beginPath(); pts.forEach((p,i)=> i?dx.lineTo(p[0],p[1]):dx.moveTo(p[0],p[1])); dx.stroke(); }
function dot(x,y,r){ dx.beginPath(); dx.arc(x,y,r,0,7); dx.fill(); }
function rrect(x,y,w,h,r,fill){ const k=Math.min(r,w/2,h/2); dx.beginPath();
  dx.moveTo(x+k,y); dx.arcTo(x+w,y,x+w,y+h,k); dx.arcTo(x+w,y+h,x,y+h,k);
  dx.arcTo(x,y+h,x,y,k); dx.arcTo(x,y,x+w,y,k); dx.closePath(); fill?dx.fill():dx.stroke(); }
function arcStroke(cx,cy,R,a0,a1){ dx.beginPath(); dx.arc(cx,cy,R,a0,a1); dx.stroke(); }
function curve(pts){ dx.beginPath(); dx.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length-1;i++){ const xc=(pts[i][0]+pts[i+1][0])/2, yc=(pts[i][1]+pts[i+1][1])/2;
    dx.quadraticCurveTo(pts[i][0],pts[i][1],xc,yc);} dx.stroke(); }
const D=(d)=> d*Math.PI/180;

function draw(key){
  begin();
  if(key==='mark'){
    lw(0.22);
    curve([[-0.62,-0.7],[-0.6,0.4],[-0.5,0.78]]);
    curve([[0.6,0.78],[0.62,-0.3],[0.56,-0.72]]);
    lw(0.16); curve([[-0.52,0.62],[0.0,0.0],[0.54,-0.6]]);
    dot(-0.06,0.16,0.12);
  } else if(key==='web'){
    lw(0.12); rrect(-0.72,-0.64,1.44,1.28,0.22,false);
    lw(0.07); line(-0.6,0.32,0.6,0.32);
    dot(-0.5,0.48,0.06); dot(-0.34,0.48,0.06); dot(-0.18,0.48,0.06);
    rrect(-0.56,-0.46,0.56,0.6,0.12,true);
    lw(0.085); line(0.16,0.06,0.56,0.06); line(0.16,-0.18,0.5,-0.18);
  } else if(key==='software'){
    dot(-0.56,0.42,0.2); dot(0.18,0.5,0.17);
    lw(0.13); line(-0.42,0.44,0.04,0.49);
    dot(-0.56,-0.18,0.18);
    lw(0.13); line(-0.56,0.24,-0.56,-0.02);
    lw(0.1); poly([[0.18,0.0],[-0.04,-0.26],[0.18,-0.52]]);
    poly([[0.46,0.0],[0.68,-0.26],[0.46,-0.52]]);
  } else if(key==='ai'){
    lw(0.17);
    arcStroke(0,0.06,0.6,D(15),D(165));
    curve([[-0.58,0.2],[-0.66,-0.1],[-0.5,-0.4],[-0.2,-0.46]]);
    curve([[0.58,0.24],[0.66,-0.06],[0.5,-0.38],[0.22,-0.44]]);
    lw(0.13);
    curve([[-0.12,0.5],[-0.16,0.2],[-0.06,-0.06],[-0.16,-0.34]]);
    curve([[0.12,0.5],[0.16,0.2],[0.06,-0.06],[0.16,-0.34]]);
    curve([[-0.42,0.34],[-0.28,0.12],[-0.4,-0.1]]);
    curve([[0.42,0.36],[0.3,0.14],[0.42,-0.08]]);
    lw(0.16); line(0.0,-0.44,0.02,-0.62);
    dot(-0.42,-0.5,0.07); dot(-0.28,-0.62,0.055); dot(-0.14,-0.56,0.045);
  } else if(key==='automation'){
    lw(0.16); arcStroke(0,0,0.6,D(118),D(404));
    dot(Math.cos(D(118))*0.6,Math.sin(D(118))*0.6,0.14);
    const a=D(44); dot(Math.cos(a)*0.6,Math.sin(a)*0.6,0.17);
  } else if(key==='data'){
    rrect(-0.74,-0.62,0.26,0.46,0.12,true);
    rrect(-0.34,-0.62,0.26,0.92,0.12,true);
    rrect(0.06,-0.62,0.26,0.66,0.12,true);
    rrect(0.46,-0.62,0.26,1.12,0.12,true);
  } else if(key==='branding'){
    dot(0,0,0.3);
    lw(0.1); arcStroke(0,0,0.66,D(24),D(156));
    arcStroke(0,0,0.66,D(204),D(336));
    dot(0,0.82,0.09); dot(-0.82,0.0,0.08); dot(0.82,0.1,0.075);
  } else if(key==='marketing'){
    dx.beginPath(); dx.moveTo(-0.68,0.0); dx.lineTo(-0.18,0.34); dx.lineTo(-0.18,-0.34); dx.closePath(); dx.fill();
    dot(-0.18,0.0,0.34); dot(-0.68,0.0,0.1);
    lw(0.11); arcStroke(-0.08,0.0,0.56,D(-50),D(50));
    arcStroke(-0.08,0.0,0.86,D(-46),D(46));
    dot(0.52,0.74,0.08); dot(0.64,-0.68,0.09);
  }
  return dx.getImageData(0,0,S,S);
}

// ---- distance transforms ----------------------------------------------------
function dt(inside){
  const N=S*S, dist=new Float32Array(N);
  for(let i=0;i<N;i++) dist[i]= inside[i]?1e9:0;
  const d1=1,d2=Math.SQRT2;
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){ const i=y*S+x; if(!inside[i])continue; let v=dist[i];
    if(x>0)v=Math.min(v,dist[i-1]+d1); if(y>0)v=Math.min(v,dist[i-S]+d1);
    if(x>0&&y>0)v=Math.min(v,dist[i-S-1]+d2); if(x<S-1&&y>0)v=Math.min(v,dist[i-S+1]+d2); dist[i]=v; }
  for(let y=S-1;y>=0;y--)for(let x=S-1;x>=0;x--){ const i=y*S+x; if(!inside[i])continue; let v=dist[i];
    if(x<S-1)v=Math.min(v,dist[i+1]+d1); if(y<S-1)v=Math.min(v,dist[i+S]+d1);
    if(x<S-1&&y<S-1)v=Math.min(v,dist[i+S+1]+d2); if(x>0&&y<S-1)v=Math.min(v,dist[i+S-1]+d2); dist[i]=v; }
  return dist;
}
function insideOf(img){ const N=S*S, ins=new Uint8Array(N); for(let i=0;i<N;i++) ins[i]=img.data[i*4]>100?1:0; return ins; }
function signed(ins, di){ const N=S*S, out=new Uint8Array(N); for(let i=0;i<N;i++) out[i]=1-ins[i];
  const dox=dt(out), sdf=new Float32Array(N); for(let i=0;i<N;i++) sdf[i]= ins[i]? di[i] : -dox[i]; return sdf; }

// ---- circle packing (fallback metaball data) --------------------------------
function pack(di, {maxC=240, minR=3, clear=0.72, maxR=22}={}){
  const work=di.slice(); const circles=[];
  for(let c=0;c<maxC;c++){ let bi=-1,bv=minR; for(let i=0;i<work.length;i++) if(work[i]>bv){bv=work[i];bi=i;}
    if(bi<0)break; const cx=bi%S, cy=(bi/S)|0, r=Math.min(bv,maxR); circles.push([cx,cy,r]);
    const cr=r*clear, rr=Math.ceil(cr); for(let y=Math.max(0,cy-rr);y<Math.min(S,cy+rr);y++)
      for(let x=Math.max(0,cx-rr);x<Math.min(S,cx+rr);x++){ if(Math.hypot(x-cx,y-cy)<cr) work[y*S+x]=0; } }
  return circles;
}
function norm(circles){ const O=S*0.86;
  return circles.map(([cx,cy,r])=>[ +((cx-S/2)/O).toFixed(4), +(-(cy-S/2)/O).toFixed(4), +((r/O)).toFixed(4) ]); }

// ---- SDF glass render -------------------------------------------------------
const mc=document.getElementById('m'); const gl=mc.getContext('webgl2',{antialias:false,alpha:false});
const VS='#version 300 es\\nprecision highp float;in vec2 p;out vec2 vUv;void main(){vUv=p*0.5+0.5;gl_Position=vec4(p,0.,1.);}';
const FS='#version 300 es\\nprecision highp float;uniform sampler2D iSdf;uniform float iRange;uniform float iGlass;in vec2 vUv;out vec4 o;void main(){float s=texture(iSdf,vec2(vUv.x,1.0-vUv.y)).r;float sdf=(s*2.0-1.0)*iRange;float aa=fwidth(sdf)+1e-4;float f=smoothstep(-aa,aa,sdf);if(iGlass<0.5){o=vec4(vec3(0.0,0.890,0.996)*f,1.0);return;}float rim=1.0-smoothstep(0.0,9.0,sdf);vec3 col=mix(vec3(0.0,0.89,0.996),vec3(0.62,0.98,1.0),rim*0.4);col+=vec3(0.0,0.05,0.035)*smoothstep(0.4,0.92,vUv.y);o=vec4(col*f,1.0);}';
function sh(t,src){const o=gl.createShader(t);gl.shaderSource(o,src);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;}
const prog=gl.createProgram(); gl.attachShader(prog,sh(gl.VERTEX_SHADER,VS)); gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FS)); gl.linkProgram(prog); gl.useProgram(prog);
const buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
const loc=gl.getAttribLocation(prog,'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
const U=(n)=>gl.getUniformLocation(prog,n);
gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
const tex=gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,tex);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
const RANGE=64;
function renderSDF(sdf){ const u8=new Uint8Array(S*S);
  for(let i=0;i<sdf.length;i++) u8[i]=Math.max(0,Math.min(255,Math.round((sdf[i]/RANGE*0.5+0.5)*255)));
  gl.bindTexture(gl.TEXTURE_2D,tex); gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,S,S,0,gl.RED,gl.UNSIGNED_BYTE,u8);
  gl.viewport(0,0,mc.width,mc.height); gl.clearColor(0.02,0.027,0.039,1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform1i(U('iSdf'),0); gl.uniform1f(U('iRange'),RANGE); gl.uniform1f(U('iGlass'),${GLASS});
  gl.drawArrays(gl.TRIANGLES,0,3); gl.finish(); }

window.__trace=(key)=>{
  const img=draw(key); const drawn=dc.toDataURL('image/png');
  const ins=insideOf(img); const di=dt(ins);
  renderSDF(signed(ins,di));
  return { balls: norm(pack(di)), drawn, mb: mc.toDataURL('image/png') };
};
window.__ready=true;
</script></body></html>`;

const browser = await chromium.launch({
  headless: HEADLESS,
  chromiumSandbox: false,
  ...(executablePath ? { executablePath } : {}),
});
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
await page.setContent(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__ready === true, { timeout: 15000 });

const out = {};
const cells = [];
for (const key of KEYS) {
  const res = await page.evaluate((k) => window.__trace(k), key);
  out[key] = res.balls;
  const b64 = (d) => Buffer.from(d.split(",")[1], "base64");
  fs.writeFileSync(path.join(OUT, `trace-mb-${key}.png`), b64(res.mb));
  fs.writeFileSync(path.join(OUT, `trace-draw-${key}.png`), b64(res.drawn));
  cells.push({ key, mb: res.mb });
  console.log(`${key.padEnd(11)} ${res.balls.length} balls`);
}

fs.writeFileSync(DATA, JSON.stringify(out));
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
