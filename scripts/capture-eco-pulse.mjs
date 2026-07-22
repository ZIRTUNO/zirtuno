// Capture THE CIRCULATION's system response: idle vs a hovered organ (05 ·
// Service) with the pulse propagated through the veins and the HUD filled.
// Dev server must be running:  node scripts/capture-eco-pulse.mjs

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LAUNCH } from "./_launch.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "captures");
const BASE = process.env.BASE_URL || process.env.BASE || "http://localhost:3000";
const LOCALE = process.env.LOCALE || "en";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
await page.goto(`${BASE}/${LOCALE}?ftier=full&feco=1`, { waitUntil: "networkidle" });
await page.evaluate(() =>
  document.querySelector("[data-organism]")?.scrollIntoView({ block: "center" }),
);
await page.waitForTimeout(2600);
await page.screenshot({ path: path.join(OUT, "eco-pulse-idle.png") });

await page.hover(".organism-node:nth-child(5) .organism-node-trigger");
await page.waitForTimeout(1400); // pulse fully propagated + dock swollen
await page.screenshot({ path: path.join(OUT, "eco-pulse-hover.png") });

await browser.close();
console.log("→ captures/eco-pulse-idle.png · eco-pulse-hover.png");
