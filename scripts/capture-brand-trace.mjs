/**
 * Contact sheet of the header mark drawing itself.
 *
 *   BASE_URL=http://localhost:3091 node scripts/capture-brand-trace.mjs
 *   → captures/verify/brand-trace-sheet.png
 *
 * RE-HOVERED PER FRAME, not sampled from one pass. An element screenshot at
 * dsf 6 costs a few hundred ms, so a loop that hovers once and shoots
 * repeatedly samples a 700 ms draw four times and lands wherever it lands.
 * Leaving, waiting for the line to retreat, and hovering again puts the tween
 * back at a known zero, so frame k is genuinely the draw at t = k · STEP.
 */
import { chromium } from "playwright";
import { PNG } from "pngjs";
import fs from "node:fs";
import path from "node:path";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3091";
const OUT = "captures/verify";
const STEP = 100;
const FRAMES = 12;
const COLS = 6;
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 6,
  reducedMotion: "no-preference",
});
const page = await ctx.newPage();
await page.goto(`${BASE}/en?ftier=full`, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".brand-draw", { timeout: 40000 });
// past the arrival draw, so every frame below is the hover's own
await page.waitForTimeout(3500);

const mark = page.locator(".topbar-mark");
const shots = [];

// TILE 0 IS THE SETTLED MARK, shot before any hover fires. An element
// screenshot at dsf 6 costs a couple of hundred ms, so a "t=0" tile taken after
// hovering lands a quarter of a second into the wipe and the sheet reads as if
// the resting logo were clipped. It is not — `_probe-brand-trace.mjs` measures
// the settled mark against the painted one. For the same reason the labels
// below are nominal: every tile carries that same constant lateness.
await page.mouse.move(720, 600);
await page.waitForTimeout(1400);
shots.push(PNG.sync.read(await mark.screenshot()));

for (let i = 0; i < FRAMES - 1; i++) {
  await page.mouse.move(720, 600);
  // longer than the snake itself (0.4s wipe + 0.7s draw), or the take catches
  // the previous one still finishing
  await page.waitForTimeout(1400);
  await page.hover(".topbar-brand");
  await page.waitForTimeout(i * STEP);
  shots.push(PNG.sync.read(await mark.screenshot()));
  process.stdout.write(`  t=${String(i * STEP).padStart(4)}ms\r`);
}

const { width: w, height: h } = shots[0];
const pad = 10;
const rows = Math.ceil(FRAMES / COLS);
const sheet = new PNG({
  width: COLS * w + (COLS + 1) * pad,
  height: rows * h + (rows + 1) * pad,
});
for (let i = 0; i < sheet.data.length; i += 4) {
  sheet.data[i] = 4;
  sheet.data[i + 1] = 6;
  sheet.data[i + 2] = 8;
  sheet.data[i + 3] = 255;
}
shots.forEach((png, i) => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  PNG.bitblt(png, sheet, 0, 0, w, h, pad + col * (w + pad), pad + row * (h + pad));
});
const file = path.join(OUT, "brand-trace-sheet.png");
fs.writeFileSync(file, PNG.sync.write(sheet));
await browser.close();
console.log(`\ncaptured ${FRAMES} frames at ${STEP}ms → ${file}`);
