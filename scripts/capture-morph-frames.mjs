// Morph QA (metaball-morph-spec §12 checkpoint): capture deterministic
// MID-FRAMES of every autocycle transition (?fpair=a-b-m — all liquid, no
// pops), measure fps DURING a live melt (?fcycle=1 short dwell), and smoke-test
// the keyboard stepping (focus + ArrowRight → aria-live announces, melt starts).
// Dev server must be running:  node scripts/capture-morph-frames.mjs
// Writes captures/morph-frames-sheet.png (rows = transitions, cols = m).

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "captures");
const BASE = process.env.BASE || "http://localhost:3000";
const LOCALE = process.env.LOCALE || "en";
const KEYS = ["mark", "web", "software", "ai", "automation", "data", "branding", "marketing"];
const TRANSITIONS = KEYS.map((_, i) => [i, (i + 1) % KEYS.length]);
// 0.12 / 0.88 sit inside the BRIDGE handoff windows (form ⇄ droplets — where the
// retired crossfade double-exposed); 0.3 / 0.5 / 0.7 cover the droplet travel.
const MIDS = [0.12, 0.3, 0.5, 0.7, 0.88];
fs.mkdirSync(OUT, { recursive: true });

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const executablePath = chromeCandidates.find((c) => fs.existsSync(c));

const browser = await chromium.launch({
  headless: process.env.HEADLESS !== "false",
  chromiumSandbox: false,
  ...(executablePath ? { executablePath } : {}),
});
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("CONSOLE:", m.text()));

// ── 1. deterministic mid-frames for every transition ──────────────────────────
const rows = [];
for (const [a, b] of TRANSITIONS) {
  const cells = [];
  for (const m of MIDS) {
    await page.goto(`${BASE}/${LOCALE}?fpair=${a}-${b}-${m}&ftier=full`, {
      waitUntil: "networkidle",
    });
    const stage = page.locator("[data-hero-metaball]");
    await stage.waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(700);
    cells.push((await stage.screenshot()).toString("base64"));
  }
  rows.push({ a, b, cells });
  console.log(`mid-frames ${KEYS[a]} → ${KEYS[b]}`);
}

const sheet = await ctx.newPage();
await sheet.setContent(
  `<!doctype html><html><body style="margin:0;background:#05070a;padding:14px;width:max-content">
   <div style="display:grid;grid-template-columns:140px repeat(${MIDS.length},150px);gap:8px;align-items:center">
     <div></div>${MIDS.map((m) => `<div style="font:12px ui-monospace,monospace;color:#00e3fe;text-align:center">m=${m}</div>`).join("")}
     ${rows
       .map(
         ({ a, b, cells }) => `
       <div style="font:12px ui-monospace,monospace;color:#00e3fe">${KEYS[a]}→${KEYS[b]}</div>
       ${cells.map((c) => `<img src="data:image/png;base64,${c}" style="width:150px;height:150px;border:1px solid #13313a;border-radius:4px;object-fit:cover"/>`).join("")}`,
       )
       .join("")}
   </div></body></html>`,
);
await sheet.waitForTimeout(300);
await sheet.locator("body").screenshot({ path: path.join(OUT, "morph-frames-sheet.png") });
await sheet.close();

// ── 2. fps of the LIVE liquid (rest renders per-frame too since v1.5 — the
// rest jitter and the melt cost the same draw, so sample once the loop runs).
// NOTE: headless Chrome rasterises WebGL in software here — run HEADLESS=false on
// the target machine for a real-GPU number.
await page.goto(`${BASE}/${LOCALE}?fcycle=1&ftier=full`, { waitUntil: "networkidle" });
await page.waitForSelector(".journey-canvas canvas", { timeout: 20000 });
await page.waitForTimeout(1200); // let the machine start its loop
const fps = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let frames = 0;
      const t0 = performance.now();
      const tick = () => {
        frames++;
        if (performance.now() - t0 < 1200) requestAnimationFrame(tick);
        else resolve(Math.round((frames * 1000) / (performance.now() - t0)));
      };
      requestAnimationFrame(tick);
    }),
);
console.log(`fps of the live liquid: ~${fps}`);

// ── 3. keyboard smoke test: focus → ArrowRight announces the next pillar ──────
await page.goto(`${BASE}/${LOCALE}?ftier=full`, { waitUntil: "networkidle" });
await page.waitForSelector(".journey-canvas canvas", { timeout: 20000 });
await page.waitForTimeout(800);
await page.focus("[data-hero-metaball]");
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(500);
const kb = await page.evaluate(() => {
  const live = document.querySelector("span.sr-only[aria-live]");
  return { announced: live?.textContent ?? "" };
});
console.log(`keyboard: announced "${kb.announced}" (expect the first pillar name)`);

await browser.close();
console.log("→ captures/morph-frames-sheet.png");
