// THE AURA, AMPLIFIED — the only honest way to judge a near-black layer.
//
// The atmosphere lives between rgb(0,0,0) and about rgb(20,20,20). At that
// amplitude a screenshot tells you almost nothing: the difference between "a
// lit volume with dust in it" and "a flat panel" is a handful of levels, and
// the eye adapts to it within a second of looking. So this shoots the ground
// with the content hidden and writes THREE images per route:
//
//   -raw    what is actually on screen
//   -x8     the same pixels multiplied by 8, which is where the STRUCTURE is
//           judged: gradient lobes, banding, wrap seams and mote density all
//           become plainly visible, and anything that reads as a SHAPE here is
//           a shape the reader will eventually notice too
//   -crop   a 320x200 region at 1:1, upscaled 3x with no smoothing, for
//           judging the motes themselves - size, streak and spacing
//
//   BASE=http://localhost:3081 node scripts/probe/aura-look.mjs <tag> [route]
//
// GAIN=<n> overrides the x8. HIDE=0 keeps the page content in frame.

import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LAUNCH } from "../support/launch.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "..", "captures");
const BASE = process.env.BASE || "http://localhost:3000";
const TAG = process.argv[2] || "look";
const ROUTE = process.argv[3] || "/en/careers";
const GAIN = Number(process.env.GAIN || 8);
const HIDE = process.env.HIDE !== "0";
fs.mkdirSync(OUT, { recursive: true });

const VW = 1440;
const VH = 900;
const CROP = { left: 820, top: 300, width: 320, height: 200 };

const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({
  viewport: { width: VW, height: VH },
  deviceScaleFactor: 1,
  reducedMotion: process.env.RM ? "reduce" : "no-preference",
});
const page = await ctx.newPage();
await page.goto(`${BASE}${ROUTE}${ROUTE.includes("?") ? "&" : "?"}fcap=1`, {
  waitUntil: "load",
});
// ONLY=mist isolates the vapour from the gradient AND from the film grain,
// which is the only way to judge the population itself: the grain peaks around
// nine levels and sits directly on top, so at anything like these amplitudes
// the two are read together. ONLY=ground does the reverse.
//
// NEITHER OF THEM TOUCHES THE LIQUID CANVAS, and that is deliberate. Hiding
// `.journey-canvas` looks like the obvious way to see the vapour on its own,
// and it silently invalidates the measurement: display:none collapses
// FieldStage's container, its ResizeObserver rebuilds the drawing buffer at
// 1x1, and the droplet positions it publishes are then computed at aspect 1 -
// so the occluders the vapour fades against land somewhere else entirely and
// the field appears to have a huge void punched in it. It does not.
const ONLY = process.env.ONLY || "";
const isolate =
  ONLY === "mist"
    ? ".aura-lights,.breath-layer{display:none!important}"
    : ONLY === "ground"
      ? ".aura-vapour{display:none!important}"
      : "";

// KEY / MIST sweep the two gains without editing CSS between runs, so a taste
// decision can be made from measurements of one build.
const KEY = process.env.KEY;
const MIST = process.env.MIST;
const gains =
  KEY === undefined && MIST === undefined
    ? ""
    : `.aura{${KEY === undefined ? "" : `--aura-key:${KEY}!important;`}${
        MIST === undefined ? "" : `--aura-mist:${MIST}!important;`
      }}`;

await page.addStyleTag({
  content:
    "nextjs-portal,#__next-build-watcher{display:none!important}" +
    isolate +
    gains +
    (HIDE
      ? // The subject is the GROUND. Copy and chrome are hidden rather than
        // masked out afterwards, so the amplified image has nothing in it that
        // is not atmosphere.
        "main,header,footer,.side-index,.custom-cursor,.journey-content{visibility:hidden!important}"
      : ""),
});
// Long enough for the tier probe, the field's warm-up and the first draws.
await page.waitForTimeout(4000);

const live = await page.evaluate(() => {
  const a = window.__aura;
  return {
    gl: document.querySelector(".aura")?.hasAttribute("data-gl") ?? false,
    stats: a
      ? { size: a.size, count: a.count, steps: a.steps, frames: a.frames, balls: a.balls, err: a.err, buf: a.buf }
      : null,
    // The readback: where the population actually is, how fast it is moving,
    // and what the frame it just drew actually put on the canvas.
    field: a?.probe ? a.probe() : null,
  };
});

const buf = await page.screenshot();
await sharp(buf).toFile(path.join(OUT, `look-${TAG}-raw.png`));
await sharp(buf)
  .linear(GAIN, 0)
  .toFile(path.join(OUT, `look-${TAG}-x${GAIN}.png`));
await sharp(buf)
  .extract(CROP)
  .resize(CROP.width * 3, CROP.height * 3, { kernel: "nearest" })
  .linear(GAIN, 0)
  .toFile(path.join(OUT, `look-${TAG}-crop.png`));

// What share of the ground is actually carrying light, and how bright the
// carriers are. A population of motes shows up here as a small share at a
// clearly raised level; a wash shows up as a large share at a low one.
const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({
  resolveWithObject: true,
});
let lit = 0;
let sum = 0;
let peak = 0;
const n = info.width * info.height;
for (let i = 0; i < n; i++) {
  const g = data[i * 3 + 1];
  const b = data[i * 3 + 2];
  const v = Math.max(g, b);
  sum += v;
  if (v > peak) peak = v;
  if (v >= 12) lit++;
}
console.log(`route ${ROUTE}`);
console.log(`live field: ${live.gl ? "yes" : "NO"}`, JSON.stringify(live.stats));
console.log("readback:", JSON.stringify(live.field));
console.log(`mean level ${(sum / n).toFixed(2)}   peak ${peak}   >=12: ${((lit / n) * 100).toFixed(2)}%`);
console.log(`wrote captures/look-${TAG}-{raw,x${GAIN},crop}.png`);

await browser.close();
