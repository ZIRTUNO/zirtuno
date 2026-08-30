// S5 → S6 contact sheet: real composited frames across the boundary.
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const VW = Number(process.env.VW ?? 1440);
const VH = Number(process.env.VH ?? 900);
const OUT = process.env.OUT ?? "captures/s5s6";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  ...LAUNCH,
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
const page = await ctx.newPage();
await page.goto(`${BASE}/pt?ftier=full`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.__scenes, { timeout: 60000 });
await page.waitForTimeout(2500);

const g = await page.evaluate(() => {
  const y = window.scrollY;
  const j = document.querySelector("#method .method-journey").getBoundingClientRect();
  return { jTop: Math.round(j.top + y), vh: window.innerHeight };
});
// jTop/vh from 1.70 down to 0.30 — the whole handoff
const stops = [];
for (let f = 1.70; f >= 0.28; f -= 0.10) stops.push(+f.toFixed(2));

for (const f of stops) {
  const y = Math.round(g.jTop - f * g.vh);
  await page.evaluate(async (t) => {
    for (let i = 0; i < 40; i++) {
      window.scrollTo(0, t);
      await new Promise((r) => setTimeout(r, 60));
      if (Math.abs(window.scrollY - t) < 3) break;
    }
  }, y);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/j${f.toFixed(2).replace(".", "_")}.png` });
  console.log(`shot jTop=${f.toFixed(2)}vh  y=${y}`);
}
await browser.close();
