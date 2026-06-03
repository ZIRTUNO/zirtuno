// Verify the S4 ecosystem "organism" behaviours (5.6) that a still can't show:
// traveling pulses are animating, the orbit ring rotates, and hovering a node
// lights its connector line.
//   BASE_URL=http://localhost:PORT node scripts/verify-eco-alive.mjs

import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:65135";
const browser = await chromium.launch({ headless: true, chromiumSandbox: false });
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 } })
).newPage();

await page.goto(`${BASE}/en#ecosystem`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!document.querySelector(".eco-radial"), {
  timeout: 30000,
});

const counts = await page.evaluate(() => {
  const pulse = document.querySelector(".eco-pulse");
  const orbit = document.querySelector(".eco-orbit");
  return {
    lines: document.querySelectorAll(".eco-line").length,
    pulses: document.querySelectorAll(".eco-pulse").length,
    pulseAnim: pulse ? getComputedStyle(pulse).animationName : "none",
    orbitAnim: orbit ? getComputedStyle(orbit).animationName : "none",
    nodes: document.querySelectorAll(".eco-node").length,
  };
});

// hover the first node → its connector line should gain .is-lit
await page.locator(".eco-node").first().hover();
await page.waitForTimeout(150);
const litAfterHover = await page.evaluate(
  () => document.querySelectorAll(".eco-line.is-lit").length,
);

console.log("ECO " + JSON.stringify({ ...counts, litAfterHover }));
await browser.close();
