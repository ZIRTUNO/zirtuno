// Perf probe: canvases on load + rAF FPS at a few sections. Note: Playwright
// runs software GL, so absolute FPS is NOT representative of a real GPU. R5:
// the ONE page-wide conductor canvas renders everywhere, so there is no
// canvas-free baseline section anymore — the numbers are only useful
// relative to each other (a scene whose fps collapses vs the others flags a
// hot scene) and vs previous runs of this same script.
//   BASE_URL=http://localhost:PORT node scripts/verify/perf.mjs

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

const fpsWork = await fpsAt("work"); // liquid present but drained (idle scenes)
const fpsMethod = await fpsAt("method"); // the method rehearsal scene
const fpsHero = await fpsAt("hero"); // the hero machine (software GL)
const fpsName = await fpsAt("name"); // Origin beats + Beat 5 Canvas-2D

console.log(
  "PERF " + JSON.stringify({ onLoad, fpsWork, fpsMethod, fpsHero, fpsName }),
);
await browser.close();
