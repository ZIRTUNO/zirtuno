// Confirm the hero autocycle auto-advances (wall-time holds). Captures the hero
// at several timestamps; forms should change over time without any interaction.
//   node scripts/verify-autocycle.mjs

import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = "captures/verify";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
});
const page = await ctx.newPage();
await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
const heroSel = "[data-hero-metaball]";
for (let i = 0; i < 40; i++) {
  if (await page.evaluate((s) => !!document.querySelector(`${s} canvas`), heroSel))
    break;
  await page.waitForTimeout(750);
}
const hero = page.locator(heroSel).first();
const stamps = [5, 12, 15, 18, 24];
let prev = 0;
for (const s of stamps) {
  await page.waitForTimeout((s - prev) * 1000);
  prev = s;
  await hero.screenshot({ path: path.join(OUT, `auto-${s}s.png`) });
  console.log("captured auto-" + s + "s");
}
await browser.close();
