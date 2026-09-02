// R5: the homepage renders exactly ONE liquid canvas (PageStage's conductor
// stage) from load to end — the four per-runway canvases are gone. 2D helper
// canvases (EntryVeil / OriginWordmark particle assemblies) are counted
// separately and are allowed to come and go.
//   BASE_URL=http://localhost:PORT node scripts/verify/canvas-count.mjs

import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
});
const page = await ctx.newPage();
await page.goto(`${BASE}/en?ftier=full`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 40000 });
await page.waitForTimeout(5000); // hydrate + stage mount

const count = () =>
  page.evaluate(() => ({
    liquid: document.querySelectorAll(".journey-canvas canvas").length,
    total: document.querySelectorAll("canvas").length,
  }));
const onLoad = await count();

// scroll the whole page slowly (observers, wordmark assembly, exhale zone)
for (let i = 0; i < 26; i++) {
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(250);
}
await page.waitForTimeout(2500);
const afterScroll = await count();

console.log("CANVAS_COUNT " + JSON.stringify({ onLoad, afterScroll }));
const ok = onLoad.liquid === 1 && afterScroll.liquid === 1;
if (!ok) {
  console.error(
    `FAIL expected exactly 1 liquid canvas load→end, got ${onLoad.liquid} → ${afterScroll.liquid}`,
  );
  process.exit(1);
}
console.log("one liquid canvas, load to end");
await browser.close();
