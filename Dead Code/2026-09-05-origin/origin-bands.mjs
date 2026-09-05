/**
 * S7 · THE ORIGIN — band geometry probe.
 *
 * The chapter's whole layout rests on one claim: every block of copy is
 * released by the horizon wipe WHILE its band is still pinned to the foot of
 * the viewport, and no block ever enters the mark's half of the screen. Both
 * halves of that are measurable, and guessing them is how the copy ends up
 * travelling up through the logo.
 *
 * Walks the runway in fine steps and reports, per beat:
 *   · the p range across which its `.origin-frame` is PINNED (band bottom
 *     within a few px of the scrollport foot);
 *   · the highest the band's copy ever reaches, in svh — stacked beats must
 *     stay BELOW the mark band, which the scene parks at 23-65svh;
 *   · the left edge of the wide purpose copy — Beat 4 deliberately shares the
 *     stage horizontally, so it must hold the right half rather than pass a
 *     vertical-clearance test that no longer describes its composition;
 *   · the p at which the wipe finishes releasing it (mask fully closed), so
 *     `--until + --exit` can be checked against the pin range.
 *
 *   node scripts/probe/origin-bands.mjs
 *   W=1280 H=800 node scripts/probe/origin-bands.mjs
 */
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);
const STEPS = Number(process.env.STEPS ?? 90);
const MARK_HI = 65; // svh — the foot of the mark band (23-65svh)

const browser = await chromium.launch({
  ...LAUNCH,
  args: [
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const page = await (
  await browser.newContext({ viewport: { width: W, height: H } })
).newPage();
await page.goto(`${BASE}/en?ftier=full`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.__scenes, { timeout: 30000 });
await page.waitForTimeout(1200);

const BEATS = ["ideas", "tension", "mark", "hold", "resolve"];
const rows = new Map(BEATS.map((b) => [b, []]));

const runway = await page.evaluate(() => {
  const wr = document.querySelector("#name .origin-journey");
  return {
    top: wr.getBoundingClientRect().top + window.scrollY,
    height: wr.offsetHeight,
    vh: window.innerHeight,
  };
});
console.log(
  `runway ${Math.round(runway.height / runway.vh * 100)}svh · p measured across ` +
    `${Math.round((runway.height - runway.vh) / runway.vh * 100)}svh · viewport ${W}x${H}\n`,
);

for (let s = 0; s <= STEPS; s++) {
  const f = s / STEPS;
  const y = Math.round(runway.top + (runway.height - runway.vh) * f);
  await page.evaluate((t) => window.scrollTo(0, t), y);
  await page.waitForTimeout(45);
  const snap = await page.evaluate((beats) => {
    const vh = window.innerHeight;
    const out = { p: window.__scenes?.origin?.p ?? -1, band: {} };
    for (const b of beats) {
      const frame = document.querySelector(
        `#name .origin-beat--${b} .origin-frame`,
      );
      const copy = document.querySelector(
        `#name .origin-beat--${b} .origin-copy`,
      );
      if (!frame || !copy) continue;
      const fr = frame.getBoundingClientRect();
      const cs = getComputedStyle(copy);
      out.band[b] = {
        // pinned == the band is sitting on the scrollport foot
        pinned: Math.abs(fr.bottom - vh) < 3,
        top: (copy.getBoundingClientRect().top / vh) * 100,
        left: (copy.getBoundingClientRect().left / window.innerWidth) * 100,
        // the wipe's own two numbers, so release can be read directly
        inN: parseFloat(cs.getPropertyValue("--wipe-in")),
        outN: parseFloat(cs.getPropertyValue("--wipe-out")),
        // --until past 1 means "hold to the end of the runway" (beat 5), not
        // "released late" — the probe has to read intent, not just numbers
        holds: parseFloat(cs.getPropertyValue("--until")) > 1,
      };
    }
    return out;
  }, BEATS);
  for (const b of BEATS) if (snap.band[b]) rows.get(b).push({ p: snap.p, ...snap.band[b] });
}

let bad = 0;
for (const b of BEATS) {
  const r = rows.get(b);
  const pin = r.filter((x) => x.pinned);
  // "visible" == the wipe has it at least half open
  const vis = r.filter((x) => x.inN > 0.5 && x.outN < 0.5);
  const release = r.find((x) => x.outN >= 1);
  const holds = r.length ? r[0].holds : false;
  const highest = vis.length ? Math.min(...vis.map((x) => x.top)) : Infinity;
  const leftmost = vis.length ? Math.min(...vis.map((x) => x.left)) : Infinity;
  // Beat 3 stacks under the held mark at every width. Beat 4 stacks on narrow
  // stages but becomes the authored left-mark/right-copy split above 900px.
  // At beat 1 the two masses are still travelling in at the sides, at beat 2
  // they are colliding, and by beat 5 the liquid has drained — the copy there
  // is measured for the record, not gated on a form that is not on stage.
  const verticalGate = b === "mark" || (b === "hold" && W <= 900);
  const splitGate = b === "hold" && W > 900;
  const crosses = verticalGate && highest < MARK_HI;
  const splitFails = splitGate && leftmost < 48;
  const pinLo = pin.length ? pin[0].p : NaN;
  const pinHi = pin.length ? pin[pin.length - 1].p : NaN;
  const relP = release ? release.p : NaN;
  const releaseInsidePin = holds || (release ? relP <= pinHi + 0.005 : false);
  if (crosses || splitFails || !releaseInsidePin) bad++;
  console.log(
    `${b.padEnd(8)} pinned p ${pinLo.toFixed(3)}→${pinHi.toFixed(3)}  ` +
      `released by p ${holds ? "hold " : Number.isFinite(relP) ? relP.toFixed(3) : "  —  "} ` +
      `${releaseInsidePin ? (holds ? "[by design]" : "[in pin]   ") : "[!! AFTER UNPIN]"}  ` +
      `band top ≥ ${Number.isFinite(highest) ? highest.toFixed(1) : "—"}svh ` +
      `${crosses ? `[!! CROSSES MARK (<${MARK_HI}svh)]` : verticalGate ? "[clear]" : "[ungated]"} ` +
      `${splitGate ? `purpose left ≥ ${leftmost.toFixed(1)}vw ${splitFails ? "[!! SPLIT]" : "[clear]"}` : ""}`,
  );
}
console.log(`\n${bad === 0 ? "PASS" : `FAIL — ${bad} beat(s)`}`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);
