// Perf probe: canvases on load + rAF FPS at a few sections. Note: Playwright runs
// software GL, so raymarch FPS is NOT representative of a real GPU — but the
// baseline (a section with no metaball rendering) IS, and canvas-count proves the
// load stays bounded (only in-view canvases render).
//   BASE_URL=http://localhost:PORT node scripts/verify-perf.mjs

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
await page.waitForTimeout(5000);
const onLoad = await page.evaluate(() => document.querySelectorAll("canvas").length);

const fpsAt = async (id) => {
  await page.evaluate((i) => document.getElementById(i)?.scrollIntoView(), id);
  await page.waitForTimeout(2500);
  return page.evaluate(
    () =>
      new Promise((res) => {
        let f = 0;
        const t0 = performance.now();
        const tick = () => {
          f++;
          if (performance.now() - t0 < 2500) requestAnimationFrame(tick);
          else res(Math.round((f / 2500) * 1000));
        };
        requestAnimationFrame(tick);
      }),
  );
};

const fpsMethod = await fpsAt("method"); // baseline — no metaball (representative)
const fpsHero = await fpsAt("hero"); // 1 raymarcher (software GL, not representative)
const fpsName = await fpsAt("name"); // Origin: Beat 2 raymarch + Beat 5 Canvas-2D

console.log("PERF " + JSON.stringify({ onLoad, fpsMethod, fpsHero, fpsName }));
await browser.close();
