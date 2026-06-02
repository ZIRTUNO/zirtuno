// Renders each pillar state (?state=N) and composites a single labeled contact
// sheet (captures/contact-sheet.png) so all forms can be judged together.
//   1. dev server running (default http://localhost:3001)
//   2. npm run contact:sheet

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3001";
const OUT = "captures";
const SEL = "[data-hero-metaball]";
const HEADLESS = process.env.HEADLESS !== "false";

const STATES = [
  [0, "00 · Mark"],
  [1, "01 · Web Design"],
  [2, "02 · Software"],
  [3, "03 · AI"],
  [4, "04 · Automation"],
  [5, "05 · Data"],
  [6, "06 · Branding"],
  [7, "07 · Marketing"],
];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: HEADLESS, chromiumSandbox: false });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
});
const page = await ctx.newPage();

const cells = [];
for (const [n, label] of STATES) {
  await page.goto(`${BASE}/en?state=${n}#hero`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(22000); // raymarched glass is heavy on software GL
  const el = page.locator(SEL).first();
  await el.scrollIntoViewIfNeeded();
  const buf = await el.screenshot();
  fs.writeFileSync(path.join(OUT, `state-${n}.png`), buf);
  cells.push({ label, b64: buf.toString("base64") });
  console.log(`captured state ${n} — ${label}`);
}

// compose the labeled grid (2 rows × 4)
const sheet = await ctx.newPage();
await sheet.setViewportSize({ width: 1024, height: 580 });
const html = cells
  .map(
    ({ label, b64 }) => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:7px">
      <img src="data:image/png;base64,${b64}"
           style="width:224px;height:224px;background:#000;border:1px solid #13313a;border-radius:4px"/>
      <div style="font:12px ui-monospace,monospace;letter-spacing:.09em;color:#00e3fe">${label}</div>
    </div>`,
  )
  .join("");
await sheet.setContent(
  `<!doctype html><html><body style="margin:0;background:#050507;display:grid;
     grid-template-columns:repeat(4,1fr);gap:16px;padding:20px">${html}</body></html>`,
);
await sheet.waitForTimeout(400);
await sheet.screenshot({ path: path.join(OUT, "contact-sheet.png") });

await browser.close();
console.log("→ captures/contact-sheet.png");
