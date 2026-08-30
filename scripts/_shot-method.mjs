// MÉTODO runway contact shots: real composited frames at fractional positions
// along the phase-center clock `u` (0 = Diagnosis centred … 4 = Evolution).
// OUT=captures/method-before node scripts/_shot-method.mjs
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE ?? "http://localhost:3081";
const VW = Number(process.env.VW ?? 1440);
const VH = Number(process.env.VH ?? 900);
const OUT = process.env.OUT ?? "captures/method";
const STOPS = (process.env.STOPS ?? "0,1,2,2.5,2.7,3,3.3,3.5,3.7,4")
  .split(",")
  .map(Number);
// Settling is measured in FRAMES, not milliseconds: under SwiftShader a big
// viewport renders a fraction of the frames a small one does, so the physics
// integrates that much less in the same wall-clock wait. Raise DWELL for large
// stages or the shot catches droplets still in transit.
const DWELL = Number(process.env.DWELL ?? 1400);
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  ...LAUNCH,
  args: [
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
const page = await ctx.newPage();
await page.goto(`${BASE}/pt?ftier=full${process.env.Q ?? ""}`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.__scenes, { timeout: 90000 });
await page.waitForTimeout(2500);

// absolute document Y of every phase centre
const centers = await page.evaluate(() => {
  const y = window.scrollY;
  return [...document.querySelectorAll("#method .method-phase")].map(
    (el) => el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2 + y,
  );
});

const log = [];
for (const u of STOPS) {
  const k = Math.min(Math.floor(u), centers.length - 2);
  const f = u - k;
  const cy = centers[k] + (centers[k + 1] - centers[k]) * f;
  const y = Math.round(cy - VH / 2);
  await page.evaluate(async (t) => {
    for (let i = 0; i < 50; i++) {
      window.scrollTo(0, t);
      await new Promise((r) => setTimeout(r, 60));
      if (Math.abs(window.scrollY - t) < 3) break;
    }
  }, y);
  await page.waitForTimeout(DWELL);
  const ch = await page.evaluate(() => ({ ...window.__scenes.method }));
  const name = `u${u.toFixed(2).replace(".", "_")}`;
  await page.screenshot({ path: `${OUT}/${name}.png` });
  log.push({ u, y, ch });
  console.log(
    `${name}  y=${y}  u=${ch.u?.toFixed(3)} on=${ch.on?.toFixed(2)} rIn=${ch.rIn?.toFixed(2)} ex=${ch.ex?.toFixed(2)}`,
  );
}
fs.writeFileSync(`${OUT}/stops.json`, JSON.stringify(log, null, 2));
await browser.close();
