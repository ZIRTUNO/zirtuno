// Capture a single pillar state fast (for tight iteration on one form).
//   node scripts/capture-one.mjs <state> [waitMs]
// Writes captures/state-<n>.png

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3001";
const OUT = "captures";
const SEL = "[data-hero-metaball]";
const n = process.argv[2] ?? "2";
const wait = Number(process.argv[3] ?? 20000);

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, chromiumSandbox: false });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
});
const page = await ctx.newPage();
await page.goto(`${BASE}/en?state=${n}#hero`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(wait);
const el = page.locator(SEL).first();
await el.scrollIntoViewIfNeeded();
await el.screenshot({ path: path.join(OUT, `state-${n}.png`) });
await browser.close();
console.log(`captured state ${n} → captures/state-${n}.png`);
