// Confirm the "lite" tier (backlog 5.0) mounts and DRAWS on a weak GPU. Under
// Playwright (SwiftShader = software), ?glass=force resolves to the lite tier
// (software honest→none, floored to lite by the mount override), so this captures
// the lighter raymarch and reports canvas count + responsiveness.
//   BASE_URL=http://localhost:PORT node scripts/capture-lite.mjs

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:65130";
fs.mkdirSync("captures/verify", { recursive: true });

const browser = await chromium.launch({ headless: true, chromiumSandbox: false });
const page = await (
  await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  })
).newPage();

await page.goto(`${BASE}/en?glass=force#hero`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 40000 });
await page.waitForTimeout(9000); // software GL is slow; let a few frames land

const info = await page.evaluate(() => {
  const c = document.querySelector("[data-hero-metaball] canvas");
  return {
    canvases: document.querySelectorAll("[data-hero-metaball] canvas").length,
    w: c ? c.width : 0,
    h: c ? c.height : 0,
  };
});
// responsiveness: can we still run script + measure rAF cadence (not frozen)?
const responsive = await page.evaluate(
  () =>
    new Promise((res) => {
      const t0 = performance.now();
      requestAnimationFrame(() => res(performance.now() - t0 < 2000));
    }),
);
const el = page.locator("[data-hero-metaball]").first();
await el.screenshot({ path: path.join("captures/verify", "lite-hero.png") });
console.log("LITE " + JSON.stringify({ ...info, responsive }));
await browser.close();
