// capture/wet-edge — a filmstrip of the reading front crossing ONE block.
//
// probe/wet-edge.mjs reports the front as numbers; this is the other half.
// It walks a single block through the reading band in small steps and crops
// each frame to the block itself, so the SHAPE of the edge is visible — how
// wide the front is, how much cyan it carries, and whether the trailing copy
// actually lands on its authored colour.
//
// Frames are shot at REST: the wheel moves, then the page settles, then the
// shutter. A capture taken mid-inertia lands a step early and reads as a
// timing bug that is not there.
//
// Dev server must be running:
//   node scripts/capture/wet-edge.mjs
//   node scripts/capture/wet-edge.mjs "#method .font-poetic"
//   node scripts/capture/wet-edge.mjs "#services .type-lead-copy" --out=captures/x

import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE = flag("url", process.env.BASE_URL || "http://localhost:3000");
const OUT = flag("out", "captures/wet-edge-film");
const LOCALE = flag("locale", "pt");
const TARGET = args.find((a) => !a.startsWith("--")) ?? "#services .type-lead-copy";
const VIEW = { width: 1440, height: 900 };
const FRAMES = 12;
const STEP = 90; // px of wheel between frames — small enough to see the edge move

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: VIEW });
await page.goto(`${BASE}/${LOCALE}`, { waitUntil: "load" });
await page.waitForTimeout(2500); // the field mounts and the page stops growing

const state = () =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      top: Math.round(r.top),
      p: +(getComputedStyle(el).getPropertyValue("--wet-p").trim() || 1),
      driven: el.dataset.wet === "on",
      words: el.querySelectorAll(".wet-w").length,
    };
  }, TARGET);

let s = await state();
if (!s) {
  console.log(`no element matches ${TARGET}`);
  await browser.close();
  process.exit(1);
}

// Walk down until the block is just below the reading band, then film it.
// The step CLOSES on the target rather than being fixed: a flat 500px stride
// overshoots a block that starts 400px away and films a front that has
// already arrived.
const MARK = VIEW.height - 40;
let guard = 0;
while (s.top > MARK && guard++ < 240) {
  await page.mouse.wheel(0, Math.min(500, Math.max(60, (s.top - MARK) * 0.55)));
  await page.waitForTimeout(140);
  s = await state();
}
await page.waitForTimeout(600);

console.log(`${TARGET} — ${s.words} words, driven=${s.driven}`);
for (let i = 0; i < FRAMES; i++) {
  s = await state();
  const box = await (await page.$(TARGET)).boundingBox();
  if (box && box.y > -60 && box.y < VIEW.height - 20) {
    const x = Math.max(0, box.x - 20);
    const y = Math.max(0, box.y - 16);
    const path = `${OUT}/f${String(i).padStart(2, "0")}-p${s.p.toFixed(2)}.png`;
    await page.screenshot({
      path,
      clip: {
        x,
        y,
        width: Math.min(VIEW.width - x, box.width + 40),
        height: Math.min(VIEW.height - y, box.height + 32),
      },
    });
    console.log(`  ${path}  p=${s.p.toFixed(2)}  top=${s.top}`);
  }
  await page.mouse.wheel(0, STEP);
  await page.waitForTimeout(300);
}

await browser.close();
