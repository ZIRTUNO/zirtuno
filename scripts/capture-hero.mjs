// Capture the hero metaball at frozen breath phases on the REAL GPU (headful
// Chromium), and measure how closely the resting form matches the actual mark.
//
//   1. dev server must be running (default http://localhost:3001)
//   2. npm run capture:hero
//
// Outputs to captures/:
//   hero-rest.png     metaball frozen at neutral phase
//   hero-breath.png   metaball frozen at peak expansion
//   mark.png          the SVG mark rendered at the same size/fit, on black
//   hero-overlay.png  silhouette diff (cyan = match, red = metaball-only,
//                     blue = mark-only) + an IoU / diff% printed to stdout
//
// Headful (headless:false) is intentional: the preview's headless fallback uses
// SwiftShader and stalls on the rAF loop. Capture mode freezes a single frame.

import { chromium } from "playwright";
import { PNG } from "pngjs";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3001";
const OUT = "captures";
const SEL = "[data-hero-metaball]";
const FIT = 0.82; // must match the trace FIT in lib/webgl/trace-logo.ts
const N = 512; // comparison canvas (both masks resized to this)
const ON = 40; // luminance threshold for "part of the form"

fs.mkdirSync(OUT, { recursive: true });

// Headful (real GPU) is ideal, but some shells can't spawn the full chrome.exe.
// Still-capture mode freezes one frame (no rAF loop), so headless SwiftShader
// renders the metaball accurately without the idle-timeout. Override with
// HEADLESS=false on a machine that can launch headful Chromium.
const HEADLESS = process.env.HEADLESS !== "false";
const browser = await chromium.launch({
  headless: HEADLESS,
  chromiumSandbox: false,
});
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1, // headless SwiftShader: lighter frame so the SDF finishes in time
  reducedMotion: "no-preference",
});
const page = await ctx.newPage();

async function shoot(phase, file) {
  await page.goto(`${BASE}/en?capture=${phase}#hero`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(30000); // raymarched glass network is heavy on software GL (SwiftShader)
  const el = page.locator(SEL).first();
  await el.scrollIntoViewIfNeeded();
  await el.screenshot({ path: path.join(OUT, file) });
  return el.boundingBox();
}

const box = await shoot("rest", "hero-rest.png");
await shoot("morph", "hero-morph.png"); // mid-melt (uMorph 0.5) → logo → AI
await shoot("ai", "hero-ai.png"); // fully morphed AI state (uMorph 1)

// Render the SVG mark at the same box + FIT, on black, for a fair comparison.
const W = Math.max(1, Math.round(box?.width ?? 480));
const H = Math.max(1, Math.round(box?.height ?? 480));
const svgPage = await ctx.newPage();
await svgPage.setViewportSize({ width: W, height: H });
await svgPage.setContent(
  `<!doctype html><html><body style="margin:0;background:#000">
     <div style="position:absolute;inset:0;display:grid;place-items:center">
       <img src="${BASE}/brand/zirtuno-logo-mark.svg"
            style="width:${FIT * 100}%;height:${FIT * 100}%;object-fit:contain" />
     </div></body></html>`,
);
await svgPage.waitForTimeout(400);
await svgPage.screenshot({ path: path.join(OUT, "mark.png") });
await svgPage.close();
await browser.close();

// ---------- fidelity ----------
function readMask(file) {
  const png = PNG.sync.read(fs.readFileSync(path.join(OUT, file)));
  const m = new Uint8Array(png.width * png.height);
  for (let i = 0; i < m.length; i++) {
    const r = png.data[i * 4];
    const g = png.data[i * 4 + 1];
    const b = png.data[i * 4 + 2];
    m[i] = 0.2 * r + 0.6 * g + 0.2 * b > ON ? 1 : 0;
  }
  return { w: png.width, h: png.height, m };
}

function resize({ w, h, m }, W2, H2) {
  const out = new Uint8Array(W2 * H2);
  for (let y = 0; y < H2; y++) {
    for (let x = 0; x < W2; x++) {
      const sx = Math.min(w - 1, Math.floor((x * w) / W2));
      const sy = Math.min(h - 1, Math.floor((y * h) / H2));
      out[y * W2 + x] = m[sy * w + sx];
    }
  }
  return out;
}

function centroid(m, W2, H2) {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = 0; y < H2; y++) {
    for (let x = 0; x < W2; x++) {
      if (m[y * W2 + x]) {
        sx += x;
        sy += y;
        n++;
      }
    }
  }
  return n ? { x: sx / n, y: sy / n, n } : { x: W2 / 2, y: H2 / 2, n: 0 };
}

function shift(m, W2, H2, dx, dy) {
  const out = new Uint8Array(W2 * H2);
  const rx = Math.round(dx);
  const ry = Math.round(dy);
  for (let y = 0; y < H2; y++) {
    for (let x = 0; x < W2; x++) {
      const sx = x - rx;
      const sy = y - ry;
      if (sx >= 0 && sx < W2 && sy >= 0 && sy < H2) out[y * W2 + x] = m[sy * W2 + sx];
    }
  }
  return out;
}

const ball = resize(readMask("hero-rest.png"), N, N);
const mark = resize(readMask("mark.png"), N, N);

// Align by centroid (remove pure translation; keep scale + shape differences).
const cb = centroid(ball, N, N);
const cm = centroid(mark, N, N);
const ballA = shift(ball, N, N, cm.x - cb.x, cm.y - cb.y);

let inter = 0;
let uni = 0;
let ballOnly = 0;
let markOnly = 0;
const overlay = new PNG({ width: N, height: N });
for (let i = 0; i < N * N; i++) {
  const a = ballA[i];
  const b = mark[i];
  if (a || b) uni++;
  if (a && b) inter++;
  if (a && !b) ballOnly++;
  if (b && !a) markOnly++;
  let r = 0;
  let g = 0;
  let bl = 0;
  if (a && b) {
    r = 0; g = 227; bl = 254; // match → cyan
  } else if (a && !b) {
    r = 255; g = 40; bl = 40; // metaball spilling beyond the mark → red
  } else if (b && !a) {
    r = 40; g = 90; bl = 255; // mark areas the metaball misses → blue
  }
  overlay.data[i * 4] = r;
  overlay.data[i * 4 + 1] = g;
  overlay.data[i * 4 + 2] = bl;
  overlay.data[i * 4 + 3] = 255;
}
fs.writeFileSync(path.join(OUT, "hero-overlay.png"), PNG.sync.write(overlay));

const iou = uni ? inter / uni : 0;
console.log(
  `Fidelity vs mark — IoU ${(iou * 100).toFixed(1)}%  diff ${((1 - iou) * 100).toFixed(1)}%  ` +
    `(red/over ${((ballOnly / uni) * 100).toFixed(1)}%, blue/under ${((markOnly / uni) * 100).toFixed(1)}%)`,
);
