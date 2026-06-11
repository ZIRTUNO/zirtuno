// Screenshot the LIVE field hero in the real Next app (dev server running):
//   node scripts/capture-field-live.mjs
// ?hero=field      → the SDF-GLASS resting mark (SdfGlassField, v1.2 §6.1)
// ?hero=fieldflat  → the flat metaball field (MetaballField, morph-layer debug)
// Writes captures/field-live-glass.png + field-live-flat.png (the
// [data-hero-metaball] stage only) + a rough requestAnimationFrame fps read.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "captures");
const BASE = process.env.BASE || "http://localhost:3000";
const LOCALE = process.env.LOCALE || "en";

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const executablePath = chromeCandidates.find((c) => fs.existsSync(c));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: process.env.HEADLESS !== "false",
  chromiumSandbox: false,
  ...(executablePath ? { executablePath } : {}),
});
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});
// pre-seed the legacy gpu-tier cache (the OTHER chapters still probe it until R1)
// so its readPixels stall can't pollute these captures; the hero's own tier is
// forced via ?ftier=full (headless Chrome rasterises WebGL in software).
await ctx.addInitScript(() => {
  try { sessionStorage.setItem("zr-gpu-tier-v5", "lite"); } catch { /* ignore */ }
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.error("CONSOLE:", m.text());
});

// the field hero is the DEFAULT path since R0 — no ?hero gate
for (const [params, label] of [["?ftier=full", "glass"], ["?fflat=1&ftier=full", "flat"]]) {
  await page.goto(`${BASE}/${LOCALE}${params}`, { waitUntil: "networkidle" });
  const stage = page.locator("[data-hero-metaball]");
  await stage.waitFor({ state: "visible", timeout: 15000 });
  // give the canvas a beat to mount + draw
  await page.waitForTimeout(900);
  await stage.screenshot({ path: path.join(OUT, `field-live-${label}.png`) });
  console.log(`captured field-live-${label}.png  (/${LOCALE}${params})`);
}

// rough fps probe on the default route (rest is a static draw; this mostly
// confirms the page isn't pinned/janky)
await page.goto(`${BASE}/${LOCALE}?ftier=full`, { waitUntil: "networkidle" });
const fps = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let frames = 0;
      const t0 = performance.now();
      const tick = () => {
        frames++;
        if (performance.now() - t0 < 1000) requestAnimationFrame(tick);
        else resolve(Math.round((frames * 1000) / (performance.now() - t0)));
      };
      requestAnimationFrame(tick);
    }),
);
console.log(`rAF throughput on hero page: ~${fps} fps`);

await browser.close();
