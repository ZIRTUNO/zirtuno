// Cursor-goo QA sheet (morph-spec v1.7): the react-bits hover — a cursor droplet
// that NECKS into and merges with the resting form. Captures deterministic
// frozen frames on /lab/forms (?fstate=N&fcursor=x,y) at increasing merge
// depth, next to the no-cursor reference, so the goo and the guardrail
// (bounded influence; the form never destroyed) are verifiable per pixel.
// Dev server must be running:
//   node scripts/capture/cursor-merge.mjs
// Writes captures/cursor-merge-sheet.png.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "..", "captures");
const BASE = process.env.BASE || "http://localhost:3000";
const LOCALE = process.env.LOCALE || "en";
const KEYS = ["mark", "web", "software", "ai", "automation", "data", "branding", "marketing"];
// forms to probe (mark = least deformable per CURSOR_INFLUENCE_MARK) and the
// cursor stops: beside the form → necking at the edge → merged into it.
const FORMS = [0, 1, 3];
const STOPS = [null, [0.95, 0.5], [0.84, 0.5], [0.7, 0.42]];
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

const rows = [];
for (const f of FORMS) {
  const cells = [];
  for (const stop of STOPS) {
    const cursor = stop ? `&fcursor=${stop[0]},${stop[1]}` : "";
    await page.goto(`${BASE}/${LOCALE}/lab/forms?fstate=${f}${cursor}`, {
      waitUntil: "networkidle",
    });
    const stage = page.locator("[data-hero-metaball]");
    await stage.waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(700);
    cells.push((await stage.screenshot()).toString("base64"));
  }
  rows.push({ f, cells });
  console.log(`cursor merge ${KEYS[f]}`);
}

const labels = ["no cursor", ...STOPS.slice(1).map((s) => `cursor ${s[0]},${s[1]}`)];
const sheet = await ctx.newPage();
await sheet.setContent(
  `<!doctype html><html><body style="margin:0;background:#05070a;padding:14px;width:max-content">
   <div style="display:grid;grid-template-columns:90px repeat(${STOPS.length},170px);gap:8px;align-items:center">
     <div></div>${labels.map((l) => `<div style="font:12px ui-monospace,monospace;color:#00e3fe;text-align:center">${l}</div>`).join("")}
     ${rows
       .map(
         ({ f, cells }) => `
       <div style="font:12px ui-monospace,monospace;color:#00e3fe">${KEYS[f]}</div>
       ${cells.map((c) => `<img src="data:image/png;base64,${c}" style="width:170px;height:170px;border:1px solid #13313a;border-radius:4px;object-fit:cover"/>`).join("")}`,
       )
       .join("")}
   </div></body></html>`,
);
await sheet.waitForTimeout(300);
await sheet.locator("body").screenshot({ path: path.join(OUT, "cursor-merge-sheet.png") });
await browser.close();
console.log("→ captures/cursor-merge-sheet.png");
