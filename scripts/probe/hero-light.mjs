// Where does the Hero's stream actually put light on the screen?
//
// probe-hero-place measures BOXES, and for the ribbon a box is a lie: the
// element starts ~200px above anything you can see, because the canvas draws
// black over its own top half and the mask fades what is left. The sentence
// has to clear the LIGHT, so the light is what gets measured — per row, in
// pixels, down two side bands where no copy can ever be.
//
//   node scripts/probe/hero-light.mjs
//   URL=http://localhost:3100/en?fprobe=1 node scripts/probe/hero-light.mjs
//
// Writes a PNG per viewport next to the numbers, so the rows can be checked
// against the thing they claim to describe.

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { LAUNCH } from "../support/launch.mjs";

const URL = process.env.URL || "http://localhost:3100/en?fprobe=1";
const OUT = process.env.OUT || path.join("captures", "hero-light");
const SIZES = (process.env.SIZES || "1920x1080,1440x900,1280x800,1024x768,390x844")
  .split(",")
  .map((s) => s.split("x").map(Number));

/** the side bands: everything outside the middle 60%, where the copy lives */
const SIDE = 0.2;

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(LAUNCH);
const report = [];

for (const [w, h] of SIZES) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(3000);

  const file = path.join(OUT, `${w}x${h}.png`);
  await page.screenshot({ path: file });

  const boxes = await page.evaluate(() => {
    const r1 = (n) => Math.round(n);
    const b = (s) => {
      const e = document.querySelector(s);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { t: r1(r.top), b: r1(r.bottom), l: r1(r.left), r: r1(r.right) };
    };
    return { headline: b(".lab-headline"), sub: b(".lab-sub"), hero: b(".lab-hero") };
  });

  const png = PNG.sync.read(fs.readFileSync(file));
  const rows = new Array(png.height).fill(0);
  const x0 = Math.round(png.width * SIDE);
  const x1 = png.width - x0;
  for (let y = 0; y < png.height; y++) {
    let sum = 0;
    let n = 0;
    for (let x = 0; x < png.width; x++) {
      if (x >= x0 && x < x1) continue; // skip the copy column entirely
      const i = (png.width * y + x) << 2;
      // relative luminance is enough; the stream is cyan on near-black ink
      sum += 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
      n++;
    }
    rows[y] = sum / n;
  }

  const peak = Math.max(...rows);
  const floor = Math.min(...rows.slice(0, Math.round(png.height * 0.25)));
  const at = (frac) => {
    const target = floor + (peak - floor) * frac;
    for (let y = Math.round(png.height * 0.2); y < png.height; y++) {
      if (rows[y] >= target) return y;
    }
    return null;
  };

  report.push({
    w,
    h,
    file,
    floor: Math.round(floor * 10) / 10,
    peak: Math.round(peak * 10) / 10,
    // the perceptual edges of the stream, as fractions of its own contrast
    lit5: at(0.05),
    lit15: at(0.15),
    lit35: at(0.35),
    boxes,
  });
  await ctx.close();
}
await browser.close();

const p = (n, k = 8) => String(n ?? "—").padStart(k);
console.log(
  "\nvw×vh        floor   peak   lit@5%   lit@15%  lit@35%   copy bot   gap to 5%  gap to 15%",
);
for (const r of report) {
  const bot = r.boxes.sub?.b ?? r.boxes.headline?.b;
  console.log(
    `${String(r.w + "×" + r.h).padEnd(12)} ${p(r.floor, 6)} ${p(r.peak, 6)} ${p(r.lit5)} ${p(r.lit15)} ${p(r.lit35)} ${p(bot, 10)} ${p(r.lit5 != null && bot != null ? r.lit5 - bot : null, 11)} ${p(r.lit15 != null && bot != null ? r.lit15 - bot : null, 11)}`,
  );
}
console.log(
  "\nas a fraction of the viewport:\nvw×vh          lit@5%   lit@15%  copy top  copy mid  copy bot",
);
for (const r of report) {
  const f = (y) => (y == null ? "—" : `${(Math.round((y / r.h) * 1000) / 10).toFixed(1)}%`);
  const top = r.boxes.headline?.t;
  const bot = r.boxes.sub?.b ?? r.boxes.headline?.b;
  console.log(
    `${String(r.w + "×" + r.h).padEnd(14)} ${p(f(r.lit5))} ${p(f(r.lit15))} ${p(f(top))} ${p(f(top != null && bot != null ? (top + bot) / 2 : null))} ${p(f(bot))}`,
  );
}
console.log(`\nstills → ${OUT}`);
