/**
 * S7 · THE ORIGIN — viewport stills through the scrubbed runway.
 *
 * capture/section.mjs cannot photograph this chapter: the runway is several
 * viewports tall and a full-element shot exceeds the surface limit. The story
 * is also not IN the DOM — the beats are scrubbed against the liquid stage, so
 * the only honest picture is a viewport still parked at a known scene p.
 *
 * Reports the scene's own p and which beat blocks are actually legible at each
 * stop, so "the copy sits under the mark" is a measurement rather than a hope.
 *
 *   node scripts/capture/origin.mjs
 *   STOPS=0,0.25,0.5,0.75,1 TAG=after node scripts/capture/origin.mjs
 *
 * R7: a NEGATIVE stop parks the viewport ABOVE the runway, inside the
 * chapter's opening — where the liquid boils off into the vapour before p
 * starts — so the entrance can be photographed too:
 *   STOPS=-0.2,-0.08,0.04,0.12,0.24,0.34,0.45,0.66,0.88,0.96 BASE=http://localhost:3001 node scripts/capture/origin.mjs
 *
 * Each stop settles WAIT ms of wall clock (default 1400) and then SIM ms of
 * the vapour's own clock (default 2500 — substeps, read from
 * window.__optics.mistSim), because the software renderer runs the
 * simulation slower than time and a wall-clock wait alone photographs the
 * letters still arriving.
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "captures/origin";
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);
const TAG = process.env.TAG ?? "origin";
const STOPS = (process.env.STOPS ?? "0.06,0.22,0.38,0.54,0.70,0.88")
  .split(",")
  .map(Number);
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  ...LAUNCH,
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
// fgov=0 and fwatch=0: the software renderer runs a few frames a second, and
// waiting out the vapour's clock at that cadence would otherwise wake the
// idle governor and demote the rung under review to one without a vapour
await page.goto(`${BASE}/${process.env.LOC ?? "en"}?ftier=full&fgov=0&fwatch=0${process.env.Q ?? ""}`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.__scenes, { timeout: 30000 });
await page.waitForTimeout(1500);

for (const f of STOPS) {
  const y = await page.evaluate((frac) => {
    const wr = document.querySelector("#name .origin-journey");
    const top = wr.getBoundingClientRect().top + window.scrollY;
    return Math.round(top + (wr.offsetHeight - window.innerHeight) * frac);
  }, f);
  await page.evaluate(async (t) => {
    for (let i = 0; i < 24; i++) {
      window.scrollTo(0, t);
      await new Promise((r) => setTimeout(r, 110));
      if (Math.abs(window.scrollY - t) < 3) break;
    }
  }, y);
  // settle on the wall clock, then on the vapour's own clock (SIM ms of
  // substeps — the software renderer runs the simulation slower than time)
  const simStart = await page.evaluate(() => window.__optics?.mistSim ?? 0);
  await page.waitForTimeout(Number(process.env.WAIT ?? 1400));
  const simNeed = simStart + Number(process.env.SIM ?? 2500) / 8;
  await page
    .waitForFunction((n) => (window.__optics?.mistSim ?? 0) >= n, simNeed, { timeout: 25000 })
    .catch(() => {});

  const info = await page.evaluate(() => {
    const vis = (el) => {
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const on =
        b.top < window.innerHeight * 0.92 &&
        b.bottom > window.innerHeight * 0.08 &&
        parseFloat(cs.opacity) > 0.35;
      return on ? (el.textContent ?? "").trim().slice(0, 46) : null;
    };
    const copy = [...document.querySelectorAll("#name .origin-beat p, #name .origin-beat h3")]
      .map(vis)
      .filter(Boolean);
    return {
      p: window.__scenes?.origin?.p?.toFixed(3) ?? "—",
      on: window.__scenes?.origin?.on?.toFixed(2) ?? "—",
      copy,
    };
  });

  const name = `${OUT}/${TAG}-${String(Math.round(f * 100)).padStart(2, "0")}.png`;
  await page.screenshot({ path: name });
  console.log(
    `  f=${f.toFixed(2)}  scene p=${info.p} on=${info.on}  legible: ` +
      (info.copy.length ? info.copy.map((c) => `"${c}"`).join(" · ") : "NOTHING"),
  );
}
console.log(`\n-> ${OUT}/${TAG}-*.png`);
await browser.close();
