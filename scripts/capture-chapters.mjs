// R1 chapter-visual sheet (improvement-plan acceptance): every chapter liquid —
// S3 scatter · S4 converge · S5 scrub-morph · S8 origin converge · S10 contact —
// on the unified field, captured per tier (?ftier=full | lite | none; "none"
// must show the static SVG fallback, never a canvas). Dev server must be running:
//   node scripts/capture-chapters.mjs            (LOCALE=pt for the PT pass)
// Writes captures/chapters-sheet-<locale>.png (+ per-cell PNGs under captures/).

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "captures");
const BASE = process.env.BASE || "http://localhost:3000";
const LOCALE = process.env.LOCALE || "en";
const TIERS = ["full", "lite", "none"];
// [label, css selector, settle ms (converges need their timed run)]
const TARGETS = [
  ["S3 problem", "[data-fractured-metaball]", 2200],
  ["S4 ecosystem", "[data-ecosystem-core]", 3400],
  ["S5 services", ".services-metaball-stage", 2200],
  ["S8 origin", ".origin-mark-stage", 3400],
  ["S10 contact", ".contact-metaball-stage", 2200],
];
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
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("CONSOLE:", m.text()));

const rows = [];
for (const [label, sel] of TARGETS) rows.push({ label, sel, cells: [] });

for (const tier of TIERS) {
  await page.goto(`${BASE}/${LOCALE}?ftier=${tier}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 30000 });
  for (const row of rows) {
    const el = page.locator(row.sel).first();
    try {
      await el.scrollIntoViewIfNeeded();
      const [, , settle] = TARGETS.find(([l]) => l === row.label);
      await page.waitForTimeout(settle);
      await el.scrollIntoViewIfNeeded(); // pins/reveals can shift layout
      const shot = await el.screenshot();
      row.cells.push(shot.toString("base64"));
      const file = `chapter-${row.label.split(" ")[0].toLowerCase()}-${tier}.png`;
      fs.writeFileSync(path.join(OUT, file), shot);
      console.log(`${row.label} · ${tier}`);
    } catch (e) {
      row.cells.push(null);
      console.error(`${row.label} · ${tier} FAILED: ${e.message}`);
    }
  }
}

const sheet = await ctx.newPage();
await sheet.setContent(
  `<!doctype html><html><body style="margin:0;background:#05070a;padding:14px;width:max-content">
   <div style="display:grid;grid-template-columns:110px repeat(${TIERS.length},190px);gap:8px;align-items:center">
     <div></div>${TIERS.map((t) => `<div style="font:12px ui-monospace,monospace;color:#00e3fe;text-align:center">ftier=${t}</div>`).join("")}
     ${rows
       .map(
         ({ label, cells }) => `
       <div style="font:12px ui-monospace,monospace;color:#00e3fe">${label}</div>
       ${cells
         .map((c) =>
           c
             ? `<img src="data:image/png;base64,${c}" style="width:190px;height:190px;border:1px solid #13313a;border-radius:4px;object-fit:contain;background:#000"/>`
             : `<div style="width:190px;height:190px;border:1px dashed #7a2828;border-radius:4px;color:#ff6b5c;display:flex;align-items:center;justify-content:center;font:12px monospace">missed</div>`,
         )
         .join("")}`,
       )
       .join("")}
   </div></body></html>`,
);
await sheet.waitForTimeout(300);
await sheet
  .locator("body")
  .screenshot({ path: path.join(OUT, `chapters-sheet-${LOCALE}.png`) });
await browser.close();
console.log(`→ captures/chapters-sheet-${LOCALE}.png`);
