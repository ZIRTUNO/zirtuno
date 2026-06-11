// Rest-form fidelity sheet (morph-spec v1.6): the hero rests as the EXACT
// vector forms rendered as living liquid glass (warped SDF). This captures
// every resting form (?fstate=N, the frozen rest frame — zero warp, pixel-
// exact) next to its reference SVG to prove the match and catch regressions.
// Dev server must be running:
//   node scripts/capture-rest-forms.mjs
// Writes captures/rest-forms-sheet.png (+ per-form rest-<key>.png).

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "captures");
const BRAND = path.join(ROOT, "public", "brand");
const BASE = process.env.BASE || "http://localhost:3000";
const LOCALE = process.env.LOCALE || "en";
const KEYS = ["mark", "web", "software", "ai", "automation", "data", "branding", "marketing"];
fs.mkdirSync(OUT, { recursive: true });

const svgFor = (k) =>
  k === "mark"
    ? path.join(BRAND, "zirtuno-logo-mark.svg")
    : path.join(BRAND, "forms", `${k}.svg`);

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
await ctx.addInitScript(() => {
  try { sessionStorage.setItem("zr-gpu-tier-v5", "lite"); } catch { /* ignore */ }
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("CONSOLE:", m.text()));

const cells = [];
for (let i = 0; i < KEYS.length; i++) {
  await page.goto(`${BASE}/${LOCALE}?fstate=${i}&ftier=full`, {
    waitUntil: "networkidle",
  });
  const stage = page.locator("[data-hero-metaball]");
  await stage.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(700);
  const shot = await stage.screenshot();
  fs.writeFileSync(path.join(OUT, `rest-${KEYS[i]}.png`), shot);
  cells.push({
    key: KEYS[i],
    metaball: shot.toString("base64"),
    svg: fs.readFileSync(svgFor(KEYS[i]), "utf8"),
  });
  console.log(`rest form ${KEYS[i]}`);
}

const sheet = await ctx.newPage();
await sheet.setContent(
  `<!doctype html><html><body style="margin:0;background:#05070a;padding:14px;width:max-content">
   <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">
   ${cells
     .map(
       ({ key, metaball, svg }) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px">
     <div style="display:flex;gap:6px">
       <img src="data:image/png;base64,${metaball}" style="width:150px;height:150px;border:1px solid #13313a;border-radius:4px;object-fit:cover"/>
       <div style="width:150px;height:150px;border:1px dashed #13313a;border-radius:4px;display:flex;align-items:center;justify-content:center">
         <div style="width:118px">${svg}</div>
       </div>
     </div>
     <div style="font:12px ui-monospace,monospace;color:#00e3fe">${key} · rest vs reference</div>
   </div>`,
     )
     .join("")}
   </div></body></html>`,
);
await sheet.waitForTimeout(300);
await sheet.locator("body").screenshot({ path: path.join(OUT, "rest-forms-sheet.png") });
await browser.close();
console.log("→ captures/rest-forms-sheet.png");
