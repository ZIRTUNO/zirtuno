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
await page.goto(`${BASE}/${process.env.LOC ?? "en"}?ftier=full${process.env.Q ?? ""}`, { waitUntil: "load" });
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
  await page.waitForTimeout(Number(process.env.WAIT ?? 1400));

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
