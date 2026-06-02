// Confirms lazy-mounting: only the hero canvas exists on load; the rest mount
// as you scroll near them. Guards against the all-canvases-on-load GPU freeze.
//   BASE_URL=http://localhost:PORT node scripts/verify-canvas-count.mjs

import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true, chromiumSandbox: false });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
});
const page = await ctx.newPage();
await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 40000 });
await page.waitForTimeout(5000); // hydrate + hero mount

const count = () => page.evaluate(() => document.querySelectorAll("canvas").length);
const onLoad = await count();

// scroll the whole page slowly so each section's observer can fire
for (let i = 0; i < 26; i++) {
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(250);
}
await page.waitForTimeout(2500);
const afterScroll = await count();

console.log("CANVAS_COUNT " + JSON.stringify({ onLoad, afterScroll }));
await browser.close();
