// Screenshot one element by CSS selector after scrolling it into view.
//   BASE_URL=http://localhost:PORT node scripts/capture-el.mjs <selector> <outName> [waitMs]

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const sel = process.argv[2];
const out = process.argv[3] || "el";
const wait = Number(process.argv[4] ?? 8000);
fs.mkdirSync("captures/verify", { recursive: true });

const browser = await chromium.launch({ headless: true, chromiumSandbox: false });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
});
const page = await ctx.newPage();
await page.goto(`${BASE}/en?glass=force`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 40000 });
const el = page.locator(sel).first();
await el.scrollIntoViewIfNeeded();
await page.waitForTimeout(wait);
await el.scrollIntoViewIfNeeded();
await el.screenshot({ path: path.join("captures/verify", `${out}.png`) });
await browser.close();
console.log("captured " + sel + " → captures/verify/" + out + ".png");
