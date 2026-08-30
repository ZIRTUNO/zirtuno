// MEASURED contrast for the glass bar — real pixels, not computed styles.
//
// verify-a11y derives an "effective background" from CSS and therefore cannot
// see the liquid: the topbar's background is a 14% film over a `backdrop-filter`,
// and what actually sits behind the labels is whatever the canvas is painting.
// This walks the page, screenshots the bar at many scroll positions, and reads
// the worst real contrast between glyph pixels and plate pixels.
import fs from "node:fs";
import { PNG } from "pngjs";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3091";
const LOCALE = process.env.LOCALE || "en";
const STEPS = Number(process.env.STEPS || 30);
const STEP_PX = Number(process.env.STEP_PX || 950);

const srgb = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (r, g, b) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const ratio = (a, b) => { const [hi, lo] = a > b ? [a, b] : [b, a]; return (hi + 0.05) / (lo + 0.05); };

const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(`${BASE}/${LOCALE}?fshot=1`, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".topbar");
await page.waitForTimeout(4000);
const docH = await page.evaluate(() => document.documentElement.scrollHeight);

// the label boxes we care about, in viewport coords
const boxes = await page.evaluate(() => {
  const pick = (sel) => [...document.querySelectorAll(sel)].map((e) => {
    const r = e.getBoundingClientRect();
    return { label: e.textContent.trim().slice(0, 18),
             x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
  // .lang-opt included deliberately: the pixel sweep found the locale toggle
  // was the weakest label in the bar, and an earlier version of this probe
  // missed it entirely and so reported a worst case that was not the worst.
  return [...pick(".topbar-link"), ...pick(".topbar .cta-label"), ...pick(".wordmark"),
          ...pick(".topbar .lang-opt")]
    .filter((b) => b.w > 4 && b.h > 4);
});

let worst = { ratio: Infinity };
let brightestPlate = { plate: -1 };
const seen = [];

for (let i = 0; i <= STEPS; i++) {
  if (i) { await page.mouse.move(720, 500); await page.mouse.wheel(0, STEP_PX); await page.waitForTimeout(1100); }
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 130 } });
  const png = PNG.sync.read(buf);
  const at = (x, y) => { const o = (png.width * y + x) << 2; return [png.data[o], png.data[o + 1], png.data[o + 2]]; };

  for (const b of boxes) {
    // tighten to the type's own band; the 44px tap box is mostly empty
    const y0 = Math.max(0, b.y + Math.round(b.h / 2) - 7);
    const y1 = Math.min(png.height - 1, b.y + Math.round(b.h / 2) + 7);
    const L = [];
    for (let y = y0; y <= y1; y++) for (let x = b.x; x < b.x + b.w; x++) L.push(lum(...at(x, y)));
    if (L.length < 30) continue;
    L.sort((p, q) => p - q);
    // glyphs are the bright tail, plate is the dark bulk
    const plate = L[Math.floor(L.length * 0.15)];
    const glyph = L[Math.floor(L.length * 0.97)];
    const r = ratio(glyph, plate);
    seen.push({ label: b.label, r, scroll: i, plate });
    if (plate > brightestPlate.plate) brightestPlate = { plate, label: b.label, step: i, r };
    if (r < worst.ratio) worst = { ratio: r, label: b.label, step: i, plate, glyph };
  }
}
await browser.close();

const byLabel = new Map();
for (const s of seen) if (!byLabel.has(s.label) || s.r < byLabel.get(s.label).r) byLabel.set(s.label, s);
console.log(`measured over ${STEPS + 1} scroll positions · worst per label\n`);
for (const [label, s] of [...byLabel].sort((a, b) => a[1].r - b[1].r))
  console.log(`  ${s.r >= 4.5 ? "ok  " : "FAIL"} ${s.r.toFixed(2)}:1  ${label}`);
console.log(`\nworst overall: ${worst.ratio.toFixed(2)}:1 on "${worst.label}"`);
console.log(worst.ratio >= 4.5 ? "PASS — every label clears AA small-text (4.5:1) on real pixels"
                               : "FAIL — a label drops below 4.5:1 against the live liquid");
process.exit(worst.ratio >= 4.5 ? 0 : 1);
