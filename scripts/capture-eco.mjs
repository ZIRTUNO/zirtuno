// Capture the ecosystem core after the converge (S4). The shards reassemble into
// the connected mark once the diagram scrolls into view.
//   node scripts/capture-eco.mjs [waitMs]
// Writes captures/eco-core.png

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3001";
const OUT = "captures";
const SEL = "[data-ecosystem-core]";
const wait = Number(process.argv[2] ?? 42000);

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, chromiumSandbox: false });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 1000 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
});
const page = await ctx.newPage();
await page.goto(`${BASE}/en?glass=force#ecosystem`, { waitUntil: "domcontentloaded" });
const el = page.locator(SEL).first();
await el.scrollIntoViewIfNeeded();
await page.waitForTimeout(wait); // converge advances ~0.05/frame; slow on software GL
await el.scrollIntoViewIfNeeded();
await el.screenshot({ path: path.join(OUT, "eco-core.png") });
await browser.close();
console.log("captured eco-core → captures/eco-core.png");
