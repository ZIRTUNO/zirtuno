/**
 * MATERIAL PROBE — what the liquid is ACTUALLY made of, in numbers.
 *
 * Two ways a screenshot of this page lies, both of which produced wrong
 * conclusions before this existed:
 *
 *  1. SwiftShader is slow, the FPS watchdog demotes down the tier ladder, and
 *     below `glasshalf` the renderer drops to `lite` — the FLAT branch, which
 *     returns before any clean-material code. The capture shows a flat blob
 *     while the shader on disk is correct. `?fgov=0` pins the tier.
 *  2. The page is full of CYAN TEXT. A naive "count the cyan pixels" filter
 *     measures the headings and the chapter rail, reports a graded body, and is
 *     describing antialiased type. This masks to a liquid-only rect, requires a
 *     real pixel count, and ERODES the mask so edge falloff cannot be mistaken
 *     for interior shading.
 *
 * Reports:
 *   body    modal cyan of the mass — the "flat neon cyan"
 *   shadow  darkest INTERIOR tone and how far under body it sits
 *   spread  distinct luminance levels inside the body
 *           (< 8 = flat fill · 20+ = a genuinely shaded body)
 *
 *   node scripts/probe/material.mjs
 *   Q="&fgloss=1" TAG=glass node scripts/probe/material.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const Q = process.env.Q ?? "";
const TAG = process.env.TAG ?? "probe";
const AT = Number(process.env.AT ?? 0.5); // gather progress to park at
const OUT = "captures/probe";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  ...LAUNCH,
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const W = 1280, H = 800;
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
await page.goto(`${BASE}/en?ftier=full&fgov=0${Q}`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.__scenes, { timeout: 30000 });
await page.waitForTimeout(1200);

// The GATHERING at mid-progress: many droplets, fused lobes, and the middle of
// the stage carries no copy — the same content the reference frames show.
const y = await page.evaluate((frac) => {
  const rw = document.querySelector("[data-organism]");
  return Math.round(rw.getBoundingClientRect().top + scrollY + rw.offsetHeight * frac - innerHeight / 2);
}, AT);
await page.evaluate(async (t) => {
  for (let i = 0; i < 30; i++) {
    window.scrollTo(0, t);
    await new Promise((r) => setTimeout(r, 100));
    if (Math.abs(scrollY - t) < 3) break;
  }
}, y);
await page.waitForTimeout(2000);

const state = await page.evaluate(() => {
  const o = window.__optics;
  const s = window.__scenes?.site;
  return {
    optics: o ? { tier: o.tier, glass: o.glass, gloss: o.gloss, post: o.post, shadow: o.shadow } : "NOT EXPOSED",
    grow: document.querySelector(".journey-interactions")?.style.getPropertyValue("--eco-grow"),
    gather: s ? +s.gather.toFixed(3) : null,
  };
});

const buf = await page.screenshot();
const png = PNG.sync.read(buf);
// liquid-only window: right of the annotation column, left of the chapter rail,
// clear of the topbar and the outro copy
const X0 = Math.floor(W * 0.40), X1 = Math.floor(W * 0.88);
const Y0 = Math.floor(H * 0.14), Y1 = Math.floor(H * 0.86);
const isLiquid = (x, y) => {
  const i = (y * png.width + x) << 2;
  const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
  return b > 90 && g > 80 && b > r + 60 && g > r + 40; // saturated cyan only
};
const mask = new Uint8Array(png.width * png.height);
let raw = 0;
for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) if (isLiquid(x, y)) { mask[y * png.width + x] = 1; raw++; }
// ERODE by 3px — everything left is interior, so edge antialiasing and the
// bloom skirt cannot be counted as "shading".
const ER = 3;
const lum = [];
for (let y = Y0 + ER; y < Y1 - ER; y++)
  for (let x = X0 + ER; x < X1 - ER; x++) {
    if (!mask[y * png.width + x]) continue;
    let solid = true;
    for (let dy = -ER; dy <= ER && solid; dy++)
      for (let dx = -ER; dx <= ER; dx++)
        if (!mask[(y + dy) * png.width + (x + dx)]) { solid = false; break; }
    if (!solid) continue;
    const i = (y * png.width + x) << 2;
    lum.push(Math.round(0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2]));
  }
lum.sort((a, b) => a - b);
fs.writeFileSync(`${OUT}/${TAG}.png`, buf);

console.log(`  ran as     ${JSON.stringify(state.optics)}`);
console.log(`  gather     ${state.gather}  (--eco-grow ${state.grow})`);
if (lum.length < 2000) {
  console.log(`  ✗ ONLY ${lum.length} interior liquid px (raw ${raw}) — NOT ENOUGH TO MEASURE.`);
  console.log(`    The liquid is not in the sample window at this stop; the numbers would be noise.`);
} else {
  const at = (p) => lum[Math.min(lum.length - 1, Math.floor(lum.length * p))];
  const body = at(0.85), shadow = at(0.05), mid = at(0.5);
  const levels = new Set(lum.map((v) => v >> 1)).size;
  console.log(`  interior   ${lum.length} px (raw ${raw})`);
  console.log(`  body       L=${body}`);
  console.log(`  median     L=${mid}`);
  console.log(`  shadow     L=${shadow}   → ${Math.round((1 - shadow / body) * 100)}% under body`);
  console.log(`  spread     ${levels} levels   ${levels < 8 ? "<- FLAT FILL" : "<- shaded body"}`);
}
console.log(`  -> ${OUT}/${TAG}.png`);
await browser.close();
