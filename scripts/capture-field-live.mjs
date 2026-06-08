// Screenshot the LIVE hero metaball (the real OGL MetaballField in Next), to
// confirm the new field engine renders in the app. Usage (dev server running):
//   node scripts/capture-field-live.mjs
// Hits /en?hero=field (glass) and /en?hero=fieldflat (flat); writes
// captures/field-live-glass.png + field-live-flat.png (the [data-hero-metaball]
// stage only). Also samples requestAnimationFrame timing for a rough fps read.

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
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.error("CONSOLE:", m.text());
});

for (const [mode, label] of [["field", "glass"], ["fieldflat", "flat"]]) {
  await page.goto(`${BASE}/${LOCALE}?hero=${mode}`, { waitUntil: "networkidle" });
  const stage = page.locator("[data-hero-metaball]");
  await stage.waitFor({ state: "visible", timeout: 15000 });
  // give the canvas a beat to mount + draw
  await page.waitForTimeout(900);
  await stage.screenshot({ path: path.join(OUT, `field-live-${label}.png`) });
  console.log(`captured field-live-${label}.png  (/${LOCALE}?hero=${mode})`);
}

// rough fps probe on the glass route (the field re-renders only on resize this
// phase, so this mostly confirms the page isn't pinned/janky)
await page.goto(`${BASE}/${LOCALE}?hero=field`, { waitUntil: "networkidle" });
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
