// Generate the metaball MORPH-ENDPOINT ball-clouds FROM the form SVGs
// (metaball-morph-spec v1.3 Phase-3 prep). Each of the 8 forms is rasterised with
// the SAME content-bbox normalisation as the SDF-glass rest renderer (SDF_DRAW),
// distance-transformed (shared lib/webgl/sdf-core math), and greedily packed with
// capped-radius balls — so every metaball endpoint registers with its crisp rest
// form by construction (centre, mass, silhouette). Every form is padded to exactly
// N = 48 balls (spec §3.1: same fixed budget → morphs are pure lerps, no popping);
// surplus balls are parked "dormant" inside the thickest masses at r ≈ 0.02.
//
// These clouds are ~1 s liquid INBETWEENS, never the rest look (v1.2) — rough
// registration is the bar, not fidelity.
//
//   node scripts/generate-morph-endpoints.mjs            (K/COVER/MAXR/MINPX to tune)
//
// Writes lib/webgl/symbols.data.mjs (the runtime morph-endpoint data) and two QA
// sheets: captures/morph-endpoints-overlay.png (flat field + SVG outline → judge
// registration) and captures/morph-endpoints-glass.png (the melt look).

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FIELD_VERT, FIELD_FRAG, FIELD_ISO, FIELD_N, FIELD_FRAME,
} from "../lib/webgl/field-shader.mjs";
import { SDF_DRAW } from "../lib/webgl/sdf-glass-shader.mjs";
import { SDF_CORE_SOURCE } from "../lib/webgl/sdf-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "captures");
const BRAND = path.join(ROOT, "public", "brand");
const DATA_OUT = path.join(ROOT, "lib", "webgl", "symbols.data.mjs");

const MASK = 512; // packing-mask resolution (matches SDF_RES territory)
const SIZE = 360; // QA render size
const N = FIELD_N; // canonical budget — every form is EXACTLY this many balls
const K = Number(process.env.K) || 0.9; // field radius = K · distance-to-edge
const COVER = Number(process.env.COVER) || 0.72; // coverage removal = COVER · r
const MAXR = Number(process.env.MAXR) || 0.12; // radius cap (symbol units)
const MINPX = Number(process.env.MINPX) || 2.5; // stop when deepest point ≤ this (px)
const DORMANT_R = 0.02; // spec §3.2: parked surplus balls

const FORMS = [
  { key: "mark", label: "Mark", file: path.join(BRAND, "zirtuno-logo-mark.svg") },
  { key: "web", label: "Web", file: path.join(BRAND, "forms", "web.svg") },
  { key: "software", label: "Software", file: path.join(BRAND, "forms", "software.svg") },
  { key: "ai", label: "AI", file: path.join(BRAND, "forms", "ai.svg") },
  { key: "automation", label: "Automation", file: path.join(BRAND, "forms", "automation.svg") },
  { key: "data", label: "Data", file: path.join(BRAND, "forms", "data.svg") },
  { key: "branding", label: "Branding", file: path.join(BRAND, "forms", "branding.svg") },
  { key: "marketing", label: "Marketing", file: path.join(BRAND, "forms", "marketing.svg") },
];
for (const f of FORMS) {
  if (!fs.existsSync(f.file)) {
    console.error(`missing form SVG: ${f.file}`);
    process.exit(1);
  }
}

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const executablePath = chromeCandidates.find((c) => fs.existsSync(c));

const PAGE = `<!doctype html><html><body style="margin:0;background:#000">
<canvas id="c" width="${SIZE}" height="${SIZE}"></canvas>
<script type="module">
// shared EDT math — injected from lib/webgl/sdf-core.mjs (single source)
${SDF_CORE_SOURCE}
const VS=${JSON.stringify(FIELD_VERT)}, FS=${JSON.stringify(FIELD_FRAG)};
const cv=document.getElementById('c'); const gl=cv.getContext('webgl2',{antialias:false,alpha:false,premultipliedAlpha:false});
function sh(t,s){const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;}
const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);
if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(pr));gl.useProgram(pr);
const pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
const pl=gl.getAttribLocation(pr,'position');gl.enableVertexAttribArray(pl);gl.vertexAttribPointer(pl,2,gl.FLOAT,false,0,0);
const U=(n)=>gl.getUniformLocation(pr,n);
gl.uniform2f(U('iRes'),cv.width,cv.height);gl.uniform1f(U('iFrame'),${FIELD_FRAME});gl.uniform1f(U('iIso'),${FIELD_ISO});

// rasterise the SVG to a mask with the SAME content-bbox fit as the rest renderer
async function maskFromSvg(svgText, RES, DRAW){
  const img=new Image();
  img.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svgText)));
  await img.decode();
  const probe=document.createElement('canvas'); probe.width=probe.height=RES; const pg=probe.getContext('2d');
  const ar=img.width/img.height; let pw=RES, ph=RES; if(ar>1) ph=RES/ar; else pw=RES*ar;
  const pox=(RES-pw)/2, poy=(RES-ph)/2;
  pg.drawImage(img,pox,poy,pw,ph);
  const pd=pg.getImageData(0,0,RES,RES).data;
  let minx=RES,miny=RES,maxx=0,maxy=0;
  for(let y=0;y<RES;y++) for(let x=0;x<RES;x++) if(pd[(y*RES+x)*4+3]>40){ if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y; }
  const bw=maxx-minx+1, bh=maxy-miny+1;
  const S=(DRAW*RES)/Math.max(bw,bh);
  const fw=pw*S, fh=ph*S;
  const fx=RES/2-(minx-pox+bw/2)*S, fy=RES/2-(miny-poy+bh/2)*S;
  const mc=document.createElement('canvas'); mc.width=mc.height=RES; const g=mc.getContext('2d');
  g.clearRect(0,0,RES,RES);
  g.drawImage(img, fx,fy,fw,fh);
  const a=g.getImageData(0,0,RES,RES).data;
  const inside=new Uint8Array(RES*RES);
  for(let i=0;i<RES*RES;i++) inside[i]=a[i*4+3]>40?1:0;
  return inside;
}

// greedy farthest-point packing with coverage removal (capped radius)
window.__pack = async (svgText, RES, DRAW, K, COVER, MAXR, MINPX, N) => {
  const inside = await maskFromSvg(svgText, RES, DRAW);
  const outside = new Uint8Array(RES*RES);
  for(let i=0;i<RES*RES;i++) outside[i]=inside[i]?0:1;
  const d2 = edt2d(outside, RES, RES); // squared dist to boundary, for inside px
  const dist = new Float64Array(RES*RES);
  for(let i=0;i<RES*RES;i++) dist[i]=inside[i]?Math.sqrt(d2[i]):0;
  const maxrPx = MAXR*RES;
  const covered = new Uint8Array(RES*RES);
  const balls = [];
  while(balls.length < N){
    let bi=-1, bd=MINPX;
    for(let i=0;i<RES*RES;i++) if(inside[i] && !covered[i] && dist[i]>bd){ bd=dist[i]; bi=i; }
    if(bi<0) break;
    const px=bi%RES, py=(bi/RES)|0;
    const rPx=Math.min(dist[bi], maxrPx);
    balls.push([px,py,rPx]);
    const rem=Math.max(2, COVER*rPx), r2=rem*rem;
    for(let y=Math.max(0,(py-rem)|0); y<=Math.min(RES-1,(py+rem)|0); y++)
      for(let x=Math.max(0,(px-rem)|0); x<=Math.min(RES-1,(px+rem)|0); x++)
        if((x-px)*(x-px)+(y-py)*(y-py)<=r2) covered[y*RES+x]=1;
  }
  // → symbol space (+y up), radius scaled by K
  return balls.map(([px,py,rPx])=>[
    +(((px - RES/2) / RES)).toFixed(4),
    +((-(py - RES/2) / RES)).toFixed(4),
    +((rPx / RES) * K).toFixed(4),
  ]);
};

window.__render=(balls,glass)=>{
  const flat=new Float32Array(${FIELD_N}*3);
  for(let i=0;i<balls.length&&i<${FIELD_N};i++){flat[i*3]=balls[i][0];flat[i*3+1]=balls[i][1];flat[i*3+2]=balls[i][2];}
  gl.uniform3fv(U('iBalls'),flat);gl.uniform1i(U('iCount'),Math.min(balls.length,${FIELD_N}));gl.uniform1f(U('iGlass'),glass?1:0);
  gl.viewport(0,0,cv.width,cv.height);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3);gl.finish();
  return cv.toDataURL('image/png');
};
window.__ready=true;
</script></body></html>`;

const browser = await chromium.launch({ headless: process.env.HEADLESS !== "false", chromiumSandbox: false, ...(executablePath ? { executablePath } : {}) });
const ctx = await browser.newContext({ deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("CONSOLE:", m.text()));
await page.setContent(PAGE, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__ready === true, { timeout: 15000 });

/** Pad a packed cloud to exactly N with dormant balls inside the thickest masses. */
function padToBudget(balls) {
  const padded = balls.slice();
  if (padded.length > N) padded.length = N; // packer already stops at N, but guard
  const anchors = balls
    .slice()
    .sort((a, b) => b[2] - a[2])
    .slice(0, Math.max(1, Math.min(4, balls.length)));
  let i = 0;
  while (padded.length < N) {
    const a = anchors[i % anchors.length];
    padded.push([a[0], a[1], DORMANT_R]);
    i++;
  }
  return padded;
}

const results = [];
for (const { key, label, file } of FORMS) {
  const svgText = fs.readFileSync(file, "utf8");
  const packed = await page.evaluate(
    ([svg, res, draw, k, cover, maxr, minpx, n]) =>
      window.__pack(svg, res, draw, k, cover, maxr, minpx, n),
    [svgText, MASK, SDF_DRAW, K, COVER, MAXR, MINPX, N],
  );
  const balls = padToBudget(packed);
  const flat = await page.evaluate((b) => window.__render(b, false), balls);
  const glass = await page.evaluate((b) => window.__render(b, true), balls);
  results.push({ key, label, file, svgText, balls, packed: packed.length, flat, glass });
  console.log(`${key.padEnd(11)} packed ${String(packed.length).padStart(2)} → ${balls.length} balls`);
}

// ── QA sheets ─────────────────────────────────────────────────────────────────
async function sheet(cells, file) {
  const p = await ctx.newPage();
  await p.setContent(
    `<!doctype html><html><body style="margin:0;background:#05070a;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:16px;width:max-content">${cells}</body></html>`,
  );
  await p.waitForTimeout(250);
  await p.locator("body").screenshot({ path: path.join(OUT, file) });
  await p.close();
}
// overlay: the flat metaball endpoint + the rest SVG (white, 45%) on top — both
// use the same bbox fit, so misregistration shows immediately.
await sheet(
  results
    .map(
      ({ key, packed, flat, svgText }) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px">
   <div style="position:relative;width:220px;height:220px;border:1px solid #13313a;border-radius:6px;overflow:hidden">
     <img src="${flat}" style="position:absolute;inset:0;width:220px;height:220px"/>
     <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.45;filter:brightness(0) invert(1)">
       <div style="width:${SDF_DRAW * 220}px">${svgText}</div></div>
   </div>
   <div style="font:12px ui-monospace,monospace;color:#00e3fe">${key} · ${packed}+pad</div></div>`,
    )
    .join(""),
  "morph-endpoints-overlay.png",
);
await sheet(
  results
    .map(
      ({ key, glass }) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px">
   <img src="${glass}" style="width:220px;height:220px;border:1px solid #13313a;border-radius:6px"/>
   <div style="font:12px ui-monospace,monospace;color:#00e3fe">${key} · melt</div></div>`,
    )
    .join(""),
  "morph-endpoints-glass.png",
);

// ── write lib/webgl/symbols.data.mjs ──────────────────────────────────────────
const fmtBalls = (balls) => {
  const rows = [];
  for (let i = 0; i < balls.length; i += 3) {
    rows.push(
      "    " +
        balls
          .slice(i, i + 3)
          .map(([x, y, r]) => `[${x}, ${y}, ${r}]`)
          .join(", ") +
        ",",
    );
  }
  return rows.join("\n");
};
const consts = results
  .map(
    ({ key, label, balls, packed }) => `// ── ${label} — packed ${packed}, padded to ${N} (${path.basename(FORMS.find((f) => f.key === key).file)})
const ${key.toUpperCase()} = {
  key: "${key}",
  label: "${label}",
  balls: [
${fmtBalls(balls)}
  ],
};`,
  )
  .join("\n\n");

const fileBody = `/**
 * Metaball MORPH-ENDPOINT clouds — GENERATED by scripts/generate-morph-endpoints.mjs.
 * DO NOT hand-edit; re-run the script (it packs each form's SVG with the same
 * content-bbox fit as the SDF-glass rest renderer, so endpoints register with the
 * crisp rest forms by construction).
 *
 * Engine: the 2D inverse-square field (lib/webgl/field-shader.mjs),
 *   total = Σ rᵢ²/|p−cᵢ|², iso ISO_LEVEL — shader MUST match.
 *
 * Every form is EXACTLY ${N} balls [x, y, r] in symbol space (frame = 1.0, +y up),
 * so morphs are pure position+radius lerps with no popping (spec §3.1); surplus
 * balls are parked dormant (r ≈ ${DORMANT_R}) inside the thickest masses. These clouds
 * are ~1 s liquid INBETWEENS during the morph — at REST every form renders as its
 * crisp SVG via SDF-glass (spec v1.2/v1.3). Packing: K=${K} COVER=${COVER} MAXR=${MAXR}.
 *
 * Order matches METABALL_STATES: mark · web · software · ai · automation · data ·
 * branding · marketing.
 */

export const ISO_LEVEL = ${FIELD_ISO};

${consts}

export const MARK_RAW = MARK;
export const PILLARS_RAW = [WEB, SOFTWARE, AI, AUTOMATION, DATA, BRANDING, MARKETING];
export const ALL_RAW = [MARK, ...PILLARS_RAW];
`;
fs.writeFileSync(DATA_OUT, fileBody, "utf8");

await browser.close();
console.log(`→ ${path.relative(ROOT, DATA_OUT)}`);
console.log("→ captures/morph-endpoints-overlay.png + morph-endpoints-glass.png");
console.log(`   (K ${K} · COVER ${COVER} · MAXR ${MAXR} · MINPX ${MINPX} · N ${N})`);
