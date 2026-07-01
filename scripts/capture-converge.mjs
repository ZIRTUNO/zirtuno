// S4 converge checkpoints (the Problem → Ecosystem transformation): captures
// the LIVE EcosystemCore frozen at c = 0 / 0.25 / 0.5 / 0.75 / 1 via ?feco=c
// (0 = fully dispersed, 1 = the resolved organism). Proves the transition is
// continuous — staggered inward flow → fused blobby ghost → the exact mark
// grown through it — with no snap anywhere. Dev server must be running:
//   node scripts/capture-converge.mjs
// Writes captures/converge-sheet.png (+ per-checkpoint PNGs).

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "captures");
const BASE = process.env.BASE || "http://localhost:3000";
const LOCALE = process.env.LOCALE || "en";
const STOPS = [0, 0.25, 0.5, 0.75, 1];
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

const cells = [];
for (const c of STOPS) {
  await page.goto(`${BASE}/${LOCALE}?ftier=full&feco=${c}`, {
    waitUntil: "networkidle",
  });
  const stage = page.locator("[data-ecosystem-core]");
  await stage.scrollIntoViewIfNeeded();
  // the driver's damped progress settles in ~600 ms; give it room
  await page.waitForTimeout(2200);
  await stage.scrollIntoViewIfNeeded();
  const shot = await stage.screenshot();
  cells.push(shot.toString("base64"));
  fs.writeFileSync(path.join(OUT, `converge-${Math.round(c * 100)}.png`), shot);
  console.log(`converge checkpoint ${Math.round(c * 100)}%`);
}

const sheet = await ctx.newPage();
await sheet.setContent(
  `<!doctype html><html><body style="margin:0;background:#05070a;padding:12px;width:max-content;display:flex;gap:10px">
   ${cells
     .map(
       (b, i) => `<div style="text-align:center">
     <img src="data:image/png;base64,${b}" style="width:200px;height:200px;border:1px solid #13313a;border-radius:4px;object-fit:contain;background:#000"/>
     <div style="font:12px ui-monospace,monospace;color:#00e3fe;margin-top:5px">${Math.round(STOPS[i] * 100)}% · ${
       ["dispersed", "flowing home", "gathering", "fused ghost", "resolved"][i]
     }</div>
   </div>`,
     )
     .join("")}
   </body></html>`,
);
await sheet.waitForTimeout(250);
await sheet.locator("body").screenshot({ path: path.join(OUT, "converge-sheet.png") });
await browser.close();
console.log("→ captures/converge-sheet.png");
