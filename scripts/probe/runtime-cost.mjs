// Same-browser before/after probe. Absolute cadence is hardware-dependent;
// layout reads and delivered bytes expose avoidable work directly.
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const base = process.env.BASE_URL || "http://localhost:3000";
const out = process.env.OUT || "captures/runtime-cost";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.addInitScript(() => {
  const rect = Element.prototype.getBoundingClientRect;
  window.__layoutReads = { ribbon: 0, aura: 0, total: 0 };
  Element.prototype.getBoundingClientRect = function (...args) {
    const reads = window.__layoutReads;
    reads.total++;
    if (this.classList.contains("lab-ribbon")) reads.ribbon++;
    if (this.classList.contains("aura-vapour")) reads.aura++;
    return rect.apply(this, args);
  };
});
const results = [];
try {
  for (const route of ["/pt?ftier=lite", "/pt/contact?ftier=lite", "/en/legal/privacy?ftier=lite"]) {
    await page.goto(base + route, { waitUntil: "networkidle" });
    await page.waitForTimeout(2200);
    const sample = await page.evaluate(() => new Promise((resolve) => {
      const reads = { ...window.__layoutReads };
      const aura0 = window.__aura?.frames || 0;
      const intervals = [];
      let previous = 0;
      const start = performance.now();
      function frame(now) {
        if (previous) intervals.push(now - previous);
        previous = now;
        if (now - start < 2200) return requestAnimationFrame(frame);
        intervals.sort((a, b) => a - b);
        const nav = performance.getEntriesByType("navigation")[0];
        const resources = performance.getEntriesByType("resource");
        resolve({
          reads: Object.fromEntries(Object.keys(reads).map((key) => [key, window.__layoutReads[key] - reads[key]])),
          atmosphereFrames: (window.__aura?.frames || 0) - aura0,
          p50: intervals[Math.floor(intervals.length * 0.5)],
          p95: intervals[Math.floor(intervals.length * 0.95)],
          documentBytes: nav.decodedBodySize,
          jsBytes: resources.filter((r) => r.name.includes("/_next/") && /\.js(?:\?|$)/.test(r.name)).reduce((sum, r) => sum + r.decodedBodySize, 0),
          canvasCount: document.querySelectorAll("canvas").length,
        });
      }
      requestAnimationFrame(frame);
    }));
    results.push({ route, ...sample });
    console.log(JSON.stringify(results.at(-1)));
    await page.screenshot({ path: `${out}/${results.length}.png` });
  }
} finally {
  await browser.close();
  fs.writeFileSync(`${out}/report.json`, JSON.stringify({ results, errors }, null, 2));
}
if (errors.length) { console.error(errors); process.exitCode = 1; }
