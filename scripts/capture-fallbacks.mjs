// Capture the GATED fallbacks (no ?glass=force) — i.e. exactly what a weak/
// integrated GPU sees: the static brand mark instead of the raymarched glass.
// Verifies the LogoMark unified + fractured fallbacks look premium.
//   BASE_URL=http://localhost:PORT node scripts/capture-fallbacks.mjs

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:65120";
const OUT = "captures/fallbacks";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, chromiumSandbox: false });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
});
const page = await ctx.newPage();

async function shoot(url, sel, out) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 40000 });
  const el = page.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await el.screenshot({ path: path.join(OUT, `${out}.png`) });
  console.log("  ✓", out);
}

// Homepage gated fallbacks (no force → gate serves the static mark)
await shoot(`${BASE}/en`, "[data-fractured-metaball]", "problem-fractured");
await shoot(`${BASE}/en`, "[data-ecosystem-core]", "ecosystem-unified");
await shoot(`${BASE}/en`, ".services-metaball-stage", "services-unified");
await shoot(`${BASE}/en`, ".contact-metaball-stage", "contact-unified");
// 404 fractured mark
await shoot(`${BASE}/en/this-page-does-not-exist`, ".logo-mark-fractured", "notfound-fractured");

await browser.close();
console.log("done → captures/fallbacks/");
