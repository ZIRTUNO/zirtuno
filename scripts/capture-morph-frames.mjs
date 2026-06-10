// Phase-3 morph QA (metaball-morph-spec §12 checkpoint): capture deterministic
// MID-FRAMES of every autocycle transition (?hero=field&fpair=a-b-m — all liquid,
// no pops), measure fps DURING a live melt (?fcycle=1 short dwell), and smoke-test
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
const MIDS = [0.25, 0.5, 0.75];
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
// pre-seed the gpu-tier cache: the perf probe (heavy quad + readPixels) would
// otherwise run on every fresh session and pollute the fps measurements
await ctx.addInitScript(() => {
  try { sessionStorage.setItem("zr-gpu-tier-v5", "lite"); } catch { /* ignore */ }
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("CONSOLE:", m.text()));

// ── 1. deterministic mid-frames for every transition ──────────────────────────
const rows = [];
for (const [a, b] of TRANSITIONS) {
  const cells = [];
  for (const m of MIDS) {
    await page.goto(`${BASE}/${LOCALE}?hero=field&fpair=${a}-${b}-${m}`, {
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

// ── 2. fps during a LIVE melt (?fcycle=1 → dwell 2 s, melt 1.4 s) ─────────────
// Wait until the FIELD layer is actually visible (a melt is running), then sample.
// NOTE: headless Chrome rasterises WebGL in software here — run HEADLESS=false on
// the target machine for a real-GPU number.
await page.goto(`${BASE}/${LOCALE}?hero=field&fcycle=1`, { waitUntil: "networkidle" });
let fps = null;
const tEnd = Date.now() + 15000;
while (Date.now() < tEnd && fps == null) {
  const melting = await page.evaluate(() => {
    const cs = [...document.querySelectorAll("[data-hero-metaball] canvas")];
    return cs.length === 2 && cs[0].style.opacity === "1";
  });
  if (melting) {
    fps = await page.evaluate(
      () =>
        new Promise((resolve) => {
          let frames = 0;
          const t0 = performance.now();
          const tick = () => {
            frames++;
            if (performance.now() - t0 < 800) requestAnimationFrame(tick);
            else resolve(Math.round((frames * 1000) / (performance.now() - t0)));
          };
          requestAnimationFrame(tick);
        }),
    );
  } else await page.waitForTimeout(120);
}
console.log(`fps during live melt: ${fps == null ? "no melt observed!" : `~${fps}`}`);

// ── 3. keyboard smoke test: focus → ArrowRight announces + starts a melt ──────
await page.goto(`${BASE}/${LOCALE}?hero=field`, { waitUntil: "networkidle" });
await page.waitForFunction(
  () => {
    const cs = [...document.querySelectorAll("[data-hero-metaball] canvas")];
    return cs.length === 2 && cs[1].style.opacity === "1"; // resting SDF visible
  },
  { timeout: 20000 },
);
await page.focus("[data-hero-metaball]");
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(500);
const kb = await page.evaluate(() => {
  const live = document.querySelector("span.sr-only[aria-live]");
  const canvases = document.querySelectorAll("[data-hero-metaball] canvas");
  const opacities = [...canvases].map((c) => c.style.opacity);
  return { announced: live?.textContent ?? "", canvasOpacities: opacities };
});
console.log(
  `keyboard: announced "${kb.announced}" · [field,sdf] opacities [${kb.canvasOpacities}] (expect 1,0 = melting)`,
);

await browser.close();
console.log("→ captures/morph-frames-sheet.png");
