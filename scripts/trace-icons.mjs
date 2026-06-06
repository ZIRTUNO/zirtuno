// MAX-FIDELITY symbol engine. For each symbol we DRAW the icon precisely as a
// vector shape on a 2D canvas (folds / window interiors are real negative space),
// then convert it to metaballs by medial-axis circle packing:
//   rasterise → distance transform → greedily place circles (r = dist to edge) →
//   render the circles through the 2D metaball field (iso 2.2).
// The packed union reproduces the drawn shape faithfully, then the field gives it
// the fluid bulbs-and-necks look. Outputs lib/webgl/symbols.generated.json + a
// contact sheet (captures/trace-sheet.png) and per-symbol draw/metaball PNGs.
//   node scripts/trace-icons.mjs

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "captures");
const DATA = path.join(__dirname, "..", "lib", "webgl", "symbols.generated.json");
const HEADLESS = process.env.HEADLESS !== "false";
const ISO = Number(process.env.THRESH) || 2.2;
const FRAME = 1.15;
const SIZE = 512;

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const executablePath = chromeCandidates.find((c) => fs.existsSync(c));

fs.mkdirSync(OUT, { recursive: true });

const KEYS = [
  "mark",
  "web",
  "software",
  "ai",
  "automation",
  "data",
  "branding",
  "marketing",
];

const PAGE = `<!doctype html><html><body style="margin:0;background:#000">
<canvas id="d" width="${SIZE}" height="${SIZE}"></canvas>
<canvas id="m" width="${SIZE}" height="${SIZE}"></canvas>
<script>
const S = ${SIZE};
const SC = S * 0.40;            // n-unit → px scale (icon spans ~±1.0)
const dc = document.getElementById('d');
const dx = dc.getContext('2d');

// ---- draw in normalised space (origin centre, +y up), white on black --------
function begin(){ dx.setTransform(1,0,0,1,0,0); dx.clearRect(0,0,S,S); dx.fillStyle='#000'; dx.fillRect(0,0,S,S);
  dx.setTransform(SC,0,0,-SC,S/2,S/2); dx.fillStyle='#fff'; dx.strokeStyle='#fff';
  dx.lineCap='round'; dx.lineJoin='round'; }
function lw(w){ dx.lineWidth = w; }
function line(x1,y1,x2,y2){ dx.beginPath(); dx.moveTo(x1,y1); dx.lineTo(x2,y2); dx.stroke(); }
function poly(pts,close){ dx.beginPath(); pts.forEach((p,i)=> i?dx.lineTo(p[0],p[1]):dx.moveTo(p[0],p[1])); if(close)dx.closePath(); dx.stroke(); }
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
    curve([[-0.62,-0.7],[-0.6,0.4],[-0.5,0.78]]);        // left upright runs up
    curve([[0.6,0.78],[0.62,-0.3],[0.56,-0.72]]);         // right upright
    lw(0.16); curve([[-0.52,0.62],[0.0,0.0],[0.54,-0.6]]); // diagonal
    dot(-0.06,0.16,0.12);                                  // free drop
  } else if(key==='web'){
    lw(0.12); rrect(-0.72,-0.64,1.44,1.28,0.22,false);     // window frame (thick → continuous)
    lw(0.07); line(-0.6,0.32,0.6,0.32);                    // title-bar divider
    dot(-0.5,0.48,0.06); dot(-0.34,0.48,0.06); dot(-0.18,0.48,0.06); // controls
    rrect(-0.56,-0.46,0.56,0.6,0.12,true);                 // content thumbnail
    lw(0.085); line(0.16,0.06,0.56,0.06); line(0.16,-0.18,0.5,-0.18); // text lines
  } else if(key==='software'){
    dot(-0.56,0.42,0.2); dot(0.18,0.5,0.17);               // two nodes
    lw(0.13); line(-0.42,0.44,0.04,0.49);                  // bridge
    dot(-0.56,-0.18,0.18);                                 // node BL
    lw(0.13); line(-0.56,0.24,-0.56,-0.02);                // neck
    lw(0.1); poly([[0.18,0.0],[-0.04,-0.26],[0.18,-0.52]]); // <
    poly([[0.46,0.0],[0.68,-0.26],[0.46,-0.52]]);          // >
  } else if(key==='ai'){
    // brain: fat winding gyri tubes (filled strokes) with sulci GAPS between them
    lw(0.17);
    arcStroke(0,0.06,0.6,D(15),D(165));                    // dome
    curve([[-0.58,0.2],[-0.66,-0.1],[-0.5,-0.4],[-0.2,-0.46]]); // left wall
    curve([[0.58,0.24],[0.66,-0.06],[0.5,-0.38],[0.22,-0.44]]); // right wall
    lw(0.13);
    curve([[-0.12,0.5],[-0.16,0.2],[-0.06,-0.06],[-0.16,-0.34]]); // left-of-fissure gyrus
    curve([[0.12,0.5],[0.16,0.2],[0.06,-0.06],[0.16,-0.34]]);     // right-of-fissure gyrus
    curve([[-0.42,0.34],[-0.28,0.12],[-0.4,-0.1]]);              // left fold
    curve([[0.42,0.36],[0.3,0.14],[0.42,-0.08]]);               // right fold
    lw(0.16); line(0.0,-0.44,0.02,-0.62);                  // stem
    dot(-0.42,-0.5,0.07); dot(-0.28,-0.62,0.055); dot(-0.14,-0.56,0.045); // neurons
  } else if(key==='automation'){
    lw(0.16); arcStroke(0,0,0.6,D(118),D(404));            // ~286° loop
    dot(Math.cos(D(118))*0.6,Math.sin(D(118))*0.6,0.14);   // tail bulb
    const a=D(44); dot(Math.cos(a)*0.6,Math.sin(a)*0.6,0.17); // arrow head
  } else if(key==='data'){
    rrect(-0.74,-0.62,0.26,0.46,0.12,true);                // columns, growing
    rrect(-0.34,-0.62,0.26,0.92,0.12,true);
    rrect(0.06,-0.62,0.26,0.66,0.12,true);
    rrect(0.46,-0.62,0.26,1.12,0.12,true);
  } else if(key==='branding'){
    dot(0,0,0.3);                                          // essence core
    lw(0.1); arcStroke(0,0,0.66,D(24),D(156));             // orbit top (thicker → continuous)
    arcStroke(0,0,0.66,D(204),D(336));                     // orbit bottom
    dot(0,0.82,0.09); dot(-0.82,0.0,0.08); dot(0.82,0.1,0.075); // satellites
  } else if(key==='marketing'){
    dx.beginPath(); dx.moveTo(-0.68,0.0); dx.lineTo(-0.18,0.34);
    dx.lineTo(-0.18,-0.34); dx.closePath(); dx.fill();     // horn (triangle)
    dot(-0.18,0.0,0.34); dot(-0.68,0.0,0.1);               // bell + mouthpiece
    lw(0.11); arcStroke(-0.08,0.0,0.56,D(-50),D(50));      // wave 1 (thicker → continuous)
    arcStroke(-0.08,0.0,0.86,D(-46),D(46));                // wave 2
    dot(0.52,0.74,0.08); dot(0.64,-0.68,0.09);             // stray drops
  }
  return dx.getImageData(0,0,S,S);
}

// ---- distance transform (chamfer 1, √2) -------------------------------------
function distance(img){
  const N=S*S, inside=new Uint8Array(N), dist=new Float32Array(N);
  for(let i=0;i<N;i++){ inside[i]= img.data[i*4]>100 ? 1:0; dist[i]= inside[i]?1e9:0; }
  const d1=1, d2=Math.SQRT2;
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){ const i=y*S+x; if(!inside[i])continue; let v=dist[i];
    if(x>0)v=Math.min(v,dist[i-1]+d1); if(y>0)v=Math.min(v,dist[i-S]+d1);
    if(x>0&&y>0)v=Math.min(v,dist[i-S-1]+d2); if(x<S-1&&y>0)v=Math.min(v,dist[i-S+1]+d2); dist[i]=v; }
  for(let y=S-1;y>=0;y--)for(let x=S-1;x>=0;x--){ const i=y*S+x; if(!inside[i])continue; let v=dist[i];
    if(x<S-1)v=Math.min(v,dist[i+1]+d1); if(y<S-1)v=Math.min(v,dist[i+S]+d1);
    if(x<S-1&&y<S-1)v=Math.min(v,dist[i+S+1]+d2); if(x>0&&y<S-1)v=Math.min(v,dist[i+S-1]+d2); dist[i]=v; }
  return dist;
}

// ---- circle packing: cap the radius so thin features get traced as evenly as
//      thick ones (otherwise one big circle eats a filled region + the budget) ---
function pack(dist, {maxC=240, minR=3, clear=0.72, maxR=22}={}){
  const work=dist.slice(); const circles=[];
  for(let c=0;c<maxC;c++){
    let bi=-1,bv=minR; for(let i=0;i<work.length;i++) if(work[i]>bv){bv=work[i];bi=i;}
    if(bi<0)break; const cx=bi%S, cy=(bi/S)|0, r=Math.min(bv,maxR);
    circles.push([cx,cy,r]);
    const cr=r*clear, rr=Math.ceil(cr);
    for(let y=Math.max(0,cy-rr);y<Math.min(S,cy+rr);y++)
      for(let x=Math.max(0,cx-rr);x<Math.min(S,cx+rr);x++){
        if(Math.hypot(x-cx,y-cy) < cr) work[y*S+x]=0; }
  }
  return circles;
}

// px circle → normalised [x,y,r] (+y up). OUTSC maps the drawn icon (~±0.9·SC px)
// into the field's ~[-0.42,0.42] space; rscale compensates the iso shrink.
function norm(circles, rscale){
  const O = S*0.86;
  return circles.map(([cx,cy,r])=>[ +((cx-S/2)/O).toFixed(4), +(-(cy-S/2)/O).toFixed(4), +((r/O)*rscale).toFixed(4) ]);
}

// ---- metaball render (field sum, iso) ---------------------------------------
const mc=document.getElementById('m'); const gl=mc.getContext('webgl2',{antialias:false,alpha:false});
const VS='#version 300 es\\nprecision highp float;in vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
// smooth-MIN union of circle SDFs (the hero's makeSymbolSdfGlsl math): the packed
// medial-axis circles UNION to the drawn shape, joins rounded by k → crisp + fluid.
const FS='#version 300 es\\nprecision highp float;uniform vec2 iRes;uniform int iCount;uniform float iFrame;uniform float iK;uniform vec3 iColor;uniform vec3 iBalls[256];out vec4 o;float smin(float a,float b,float k){float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0);return mix(b,a,h)-k*h*(1.0-h);}void main(){vec2 fc=gl_FragCoord.xy;float s=iFrame/iRes.y;vec2 q=(fc-iRes*0.5)*s;float d=1e9;for(int i=0;i<256;i++){if(i>=iCount)break;vec3 b=iBalls[i];float cd=length(q-b.xy)-b.z;d=smin(d,cd,iK);}float aa=fwidth(d);float f=smoothstep(aa,-aa,d);o=vec4(iColor*f,1.0);}';
function sh(t,src){const o=gl.createShader(t);gl.shaderSource(o,src);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;}
const prog=gl.createProgram(); gl.attachShader(prog,sh(gl.VERTEX_SHADER,VS)); gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FS)); gl.linkProgram(prog); gl.useProgram(prog);
const buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
const loc=gl.getAttribLocation(prog,'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
const U=(n)=>gl.getUniformLocation(prog,n);
gl.uniform2f(U('iRes'),mc.width,mc.height); gl.uniform1f(U('iFrame'),${FRAME}); gl.uniform1f(U('iK'),${Number(process.env.K) || 0.035}); gl.uniform3f(U('iColor'),0.0,0.890,0.996);
function renderMB(balls){ const flat=new Float32Array(256*3); for(let i=0;i<balls.length&&i<256;i++){flat[i*3]=balls[i][0];flat[i*3+1]=balls[i][1];flat[i*3+2]=balls[i][2];}
  gl.uniform3fv(U('iBalls'),flat); gl.uniform1i(U('iCount'),Math.min(balls.length,256));
  gl.viewport(0,0,mc.width,mc.height); gl.clearColor(0.02,0.027,0.039,1); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES,0,3); gl.finish(); }

window.__trace=(key, rscale)=>{
  const img=draw(key);
  const drawn = dc.toDataURL('image/png');
  const balls=norm(pack(distance(img)), rscale);
  renderMB(balls);
  return { balls, drawn, mb: mc.toDataURL('image/png') };
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

const RSCALE = Number(process.env.RSCALE) || 1.0;
const out = {};
const cells = [];
for (const key of KEYS) {
  const res = await page.evaluate(([k, rs]) => window.__trace(k, rs), [key, RSCALE]);
  out[key] = res.balls;
  const b64 = (d) => Buffer.from(d.split(",")[1], "base64");
  fs.writeFileSync(path.join(OUT, `trace-mb-${key}.png`), b64(res.mb));
  fs.writeFileSync(path.join(OUT, `trace-draw-${key}.png`), b64(res.drawn));
  cells.push({ key, n: res.balls.length, mb: res.mb });
  console.log(`${key.padEnd(11)} ${res.balls.length} balls`);
}

fs.writeFileSync(DATA, JSON.stringify(out));
console.log(`→ ${path.relative(process.cwd(), DATA)}`);

// contact sheet of the metaball renders
const sheet = await ctx.newPage();
const html = cells
  .map(
    ({ key, n, mb }) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px">
    <img src="${mb}" style="width:230px;height:230px;border:1px solid #13313a;border-radius:4px"/>
    <div style="font:12px ui-monospace,monospace;color:#00e3fe">${key} · ${n}</div></div>`,
  )
  .join("");
await sheet.setContent(
  `<!doctype html><html><body style="margin:0;background:#05070a;display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:18px;width:max-content">${html}</body></html>`,
);
await sheet.waitForTimeout(300);
await sheet.locator("body").screenshot({ path: path.join(OUT, "trace-sheet.png") });

await browser.close();
console.log("→ captures/trace-sheet.png");
