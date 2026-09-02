// S5 QA (R5): the services liquid melts pillar → pillar on the ONE page
// canvas. Asserts the conductor's melt-pair channel tracks each pillar as it
// crosses the viewport centre (pairA === pillar form index 1..7 at each
// pillar's rest plateau) — a behavioral check, sharper than screenshots.
// (Replaces the pre-remake `.services-metaball-stage` screenshot walk — that
// per-section canvas no longer exists.)
//   BASE_URL=http://localhost:PORT node scripts/verify/services.mjs

import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch(LAUNCH);
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 } })
).newPage();

await page.goto(`${BASE}/en?ftier=full`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 40000 });
await page.waitForFunction(() => !!window.__scenes, { timeout: 20000 });
await page.waitForTimeout(1200);

const pillarCount = await page.evaluate(
  () => document.querySelectorAll("#services .pillar").length,
);

const track = [];
for (let k = 0; k < pillarCount; k++) {
  // scroll to the pillar's centre and INSIST on arriving — Lenis's rAF
  // smoothing can fight a single programmatic scrollTo and land short
  await page.evaluate(async (i) => {
    const el = document.querySelectorAll("#services .pillar")[i];
    const target = Math.round(
      el.getBoundingClientRect().top +
        window.scrollY +
        el.offsetHeight / 2 -
        window.innerHeight / 2,
    );
    for (let tries = 0; tries < 10; tries++) {
      window.scrollTo(0, target);
      await new Promise((r) => setTimeout(r, 150));
      if (Math.abs(window.scrollY - target) < 2) break;
    }
  }, k);
  await page.waitForTimeout(900); // damped channels settle
  const s = await page.evaluate(() => ({
    a: window.__scenes.site.pairA,
    b: window.__scenes.site.pairB,
    m: Math.round(window.__scenes.site.pairM * 100) / 100,
  }));
  // the rendered form: at a segment boundary {a:k, b:k+1, m:1} and
  // {a:k+1, m:0} are the SAME visual state — normalise to the shown form
  const shown = s.m >= 0.85 ? s.b : s.m <= 0.15 ? s.a : -1;
  track.push({ ...s, shown });
}

console.log("SERVICES " + JSON.stringify({ pillarCount, track }));
const failures = [];
if (pillarCount !== 7) failures.push(`pillarCount ${pillarCount} !== 7`);
track.forEach((s, k) => {
  if (s.shown !== k + 1)
    failures.push(
      `pillar ${k + 1}: shown form ${s.shown} (a=${s.a} b=${s.b} m=${s.m}), want ${k + 1}`,
    );
});
if (failures.length) {
  for (const f of failures) console.error("FAIL " + f);
  process.exit(1);
}
console.log("melt pair tracks all 7 pillars at rest");
await browser.close();
