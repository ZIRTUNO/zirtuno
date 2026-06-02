// Baseline rAF FPS on a page with NO metaball (/work) — rules out a global
// runaway (Lenis/ScrollTrigger/reveal) and isolates the raymarch as the only
// software-GL cost. Should be ~60 even under SwiftShader.
//   BASE_URL=http://localhost:PORT node scripts/verify-baseline.mjs

import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true, chromiumSandbox: false });
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 } })
).newPage();
await page.goto(`${BASE}/en/work`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);
const measure = () =>
  page.evaluate(
    () =>
      new Promise((r) => {
        let f = 0;
        const t = performance.now();
        const k = () => {
          f++;
          if (performance.now() - t < 2000) requestAnimationFrame(k);
          else r(Math.round((f / 2000) * 1000));
        };
        requestAnimationFrame(k);
      }),
  );
const idle = await measure();
// scroll a bit (exercise Lenis + filters) and re-measure
await page.mouse.wheel(0, 1200);
await page.waitForTimeout(500);
const scrolling = await measure();
console.log("WORK_FPS " + JSON.stringify({ idle, scrolling }));
await browser.close();
