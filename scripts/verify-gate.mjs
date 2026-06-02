// Confirms the GPU gate: on a weak/software GPU (Playwright = SwiftShader) the
// glass is OFF (0 WebGL canvases → SVG everywhere, no freeze). With ?glass=force
// the glass mounts (lazy, hero first). Run against a prod server.
//   BASE_URL=http://localhost:PORT node scripts/verify-gate.mjs

import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({ headless: true, chromiumSandbox: false });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
});

const countOnLoad = async (url) => {
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 40000 });
  await page.waitForTimeout(4500);
  const n = await page.evaluate(() => document.querySelectorAll("canvas").length);
  await page.close();
  return n;
};

const gated = await countOnLoad(`${BASE}/en`); // SwiftShader, no force → expect 0 (SVG)
const forced = await countOnLoad(`${BASE}/en?glass=force`); // forced → expect 1 (hero, lazy)

console.log("GATE " + JSON.stringify({ gated_swiftshader: gated, forced }));
await browser.close();
