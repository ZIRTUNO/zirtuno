// Screenshot a whole chapter section by id (full element, even if taller than
// the viewport). For eyeballing layout while building body chapters.
//   BASE_URL=http://localhost:PORT node scripts/capture/section.mjs <id> [waitMs]

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const id = process.argv[2] || "method";
const wait = Number(process.argv[3] ?? 6000);
const OUT = "captures/verify";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, chromiumSandbox: false });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1600 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
});
const page = await ctx.newPage();
await page.goto(`${BASE}/en?ftier=full#${id}`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 30000 });
await page.waitForTimeout(wait);
await page.evaluate((i) => document.getElementById(i)?.scrollIntoView(), id);
await page.waitForTimeout(2500);
const el = page.locator(`#${id}`).first();
await el.screenshot({ path: path.join(OUT, `section-${id}.png`) });
await browser.close();
console.log(`captured #${id} → captures/verify/section-${id}.png`);
