// Capture the fractured metaball in The Problem (S3.2).
//   node scripts/capture-fractured.mjs [waitMs]
// Writes captures/fractured.png

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3001";
const OUT = "captures";
const SEL = "[data-fractured-metaball]";
const wait = Number(process.argv[2] ?? 30000);

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, chromiumSandbox: false });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 1000 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
});
const page = await ctx.newPage();
await page.goto(`${BASE}/en?glass=full#problem`, { waitUntil: "domcontentloaded" });
const el = page.locator(SEL).first();
await el.scrollIntoViewIfNeeded();
await page.waitForTimeout(wait); // two WebGL canvases on software GL are heavy
await el.scrollIntoViewIfNeeded();
await el.screenshot({ path: path.join(OUT, "fractured.png") });
await browser.close();
console.log("captured fractured → captures/fractured.png");
