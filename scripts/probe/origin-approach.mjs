/**
 * S7 · THE APPROACH — the S6→S7 handoff, measured.
 *
 * The convergence is supposed to GROW out of the Work chapter, and whether it
 * does is a question about four numbers across the scroll that precedes the
 * runway: work's presence as it drains, origin's as it rises, the approach
 * (`lead`) that boils the vapour off, and the runway's own p. Reading them
 * from the source is not enough — `.origin-journey` sits a full viewport below
 * `#name`'s top, so the windows in origin.ts's `read` land somewhere the
 * stylesheet decides, not somewhere the scene does.
 *
 *   node scripts/probe/origin-approach.mjs
 *   BASE=http://localhost:3001 node scripts/probe/origin-approach.mjs
 *
 * `above` is the journey's top in viewports below the fold: 2.6 is deep in
 * Work, 1.0 is the S7 headline centred, 0 is the runway starting.
 */
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);

const browser = await chromium.launch({
  ...LAUNCH,
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
await page.goto(`${BASE}/en?ftier=full&fgov=0&fwatch=0`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.__scenes, { timeout: 30000 });
await page.waitForTimeout(1200);

const geo = await page.evaluate(() => {
  const j = document.querySelector("#name .origin-journey");
  const sec = document.querySelector("#name");
  const work = document.querySelector("#work");
  return {
    vh: innerHeight,
    journeyTop: j.getBoundingClientRect().top + scrollY,
    journeyH: j.offsetHeight,
    sectionTop: sec.getBoundingClientRect().top + scrollY,
    workTop: work ? work.getBoundingClientRect().top + scrollY : null,
    workH: work ? work.offsetHeight : null,
  };
});
const vhs = (n) => (n / geo.vh).toFixed(2);
console.log(
  `runway ${vhs(geo.journeyH)}vh · opening ${vhs(geo.journeyTop - geo.sectionTop)}vh · ` +
    `work ${geo.workH ? vhs(geo.workH) : "n/a"}vh · ` +
    `work foot → runway top ${geo.workTop != null ? vhs(geo.journeyTop - (geo.workTop + geo.workH)) : "n/a"}vh`,
);

const rows = [];
for (let k = 2.6; k >= -0.9; k -= 0.2) {
  const y = Math.round(geo.journeyTop - k * geo.vh);
  await page.evaluate(async (t) => {
    for (let i = 0; i < 20; i++) {
      scrollTo(0, t);
      await new Promise((r) => setTimeout(r, 90));
      if (Math.abs(scrollY - t) < 3) break;
    }
  }, y);
  await page.waitForTimeout(240);
  rows.push({
    k,
    ...(await page.evaluate(() => {
      const r = window.__scenes;
      return {
        wrTop: document.querySelector("#name .origin-journey").getBoundingClientRect().top / innerHeight,
        work: r.work?.on ?? -1,
        origin: r.origin?.on ?? -1,
        lead: r.origin?.lead ?? -1,
        p: r.origin?.p ?? -1,
      };
    })),
  });
}
console.log("\n  above    wrTop   work.on  origin.on     lead       p");
for (const r of rows)
  console.log(
    r.k.toFixed(1).padStart(7),
    r.wrTop.toFixed(2).padStart(8),
    r.work.toFixed(3).padStart(9),
    r.origin.toFixed(3).padStart(10),
    r.lead.toFixed(3).padStart(9),
    r.p.toFixed(3).padStart(8),
  );
await browser.close();
