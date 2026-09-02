// Contact sheet for the mobile nav (S12) — rest, mid-flight pose, settled.
//
//   node scripts/capture/nav-sheet.mjs
//
// The mid-flight tile is captured by SLOWING THE TRANSITIONS, not by racing
// them. A screenshot costs a few hundred ms, so a tile aimed at 200ms into a
// 700ms move lands after it is over — the reason this repo's filmstrips have
// lied before. Stretching the same transitions to 8s and shooting at a fixed
// fraction gives the identical pose, held still: the cards' 34px drop and
// their ∓4deg fan, which is the part of the reference that a settled still
// cannot show.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = process.env.OUT_DIR || "captures/nav-sheet";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "networkidle" });

// The entry veil owns the screen for its own score and will happily photobomb
// the rest tile. Escape fast-forwards it (EntryVeil's own skip path), and the
// wait after is for the veil's exit, not for the veil.
await page.waitForTimeout(1800);
await page.keyboard.press("Escape");
await page.waitForFunction(() => !document.querySelector(".entry-veil"), null, { timeout: 15000 })
  .catch(() => console.warn("  ! entry veil never left; the rest tile may show it"));
await page.waitForTimeout(1600);

const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });

await shot("00-rest");

// Stretch every transition the sheet owns by the same factor, so the RELATIVE
// ladder (80/180/280 against 700) is preserved and only the clock changes.
const SLOW = 8000 / 700;
await page.addStyleTag({
  content: `
    .nav-sheet { transition-duration: ${0.4 * SLOW}s !important; }
    .nav-card { transition-duration: ${0.5 * SLOW}s, ${0.7 * SLOW}s !important; }
    html[data-nav-open] .nav-card-links { transition-delay: ${0.08 * SLOW}s !important; }
    html[data-nav-open] .nav-card-contact { transition-delay: ${0.18 * SLOW}s !important; }
    .nav-sheet-cta {
      transition-duration: ${0.5 * SLOW}s, ${0.7 * SLOW}s, 0.2s !important;
    }
    html[data-nav-open] .nav-sheet-cta { transition-delay: ${0.28 * SLOW}s !important; }
    .burger-icon, .burger-curl, .burger-bar { transition-duration: ${0.5 * SLOW}s !important; }
  `,
});

await page.evaluate(() => document.querySelector(".burger").click());
// ~28% through the stretched arrival — the links card has settled, the contact
// card is still falling, the CTA has only just been released. The reference's
// fan is at its most legible here.
await page.waitForTimeout(2600);
await shot("01-open-midflight");

await page.waitForTimeout(9000);
await shot("02-open-settled");

await ctx.close();
await browser.close();
console.log(`wrote ${OUT}/00-rest.png, 01-open-midflight.png, 02-open-settled.png`);
