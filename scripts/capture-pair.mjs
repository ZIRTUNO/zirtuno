// Renders each pillar→pillar transition frozen at its midpoint (?pair=a-b-0.5)
// and composites captures/morph-check.png, so the connected-liquid morph can be
// judged at the moment shattering would show. Needs the dev server running.
//   node scripts/capture-pair.mjs

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3001";
const OUT = "captures";
const SEL = "[data-hero-metaball]";
const HEADLESS = process.env.HEADLESS !== "false";

const PAIRS = [
  ["0-1-0.5", "Mark→Web"],
  ["1-2-0.5", "Web→Software"],
  ["2-3-0.5", "Software→AI"],
  ["3-4-0.5", "AI→Automation"],
  ["4-5-0.5", "Automation→Data"],
  ["5-6-0.5", "Data→Branding"],
  ["6-7-0.5", "Branding→Marketing"],
  ["7-0-0.5", "Marketing→Mark"],
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
for (const [pair, label] of PAIRS) {
  await page.goto(`${BASE}/en?pair=${pair}#hero`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(22000); // raymarched glass is heavy on software GL
  const el = page.locator(SEL).first();
  await el.scrollIntoViewIfNeeded();
  const buf = await el.screenshot();
  fs.writeFileSync(path.join(OUT, `pair-${pair}.png`), buf);
  cells.push({ label, b64: buf.toString("base64") });
  console.log(`captured ${pair} — ${label}`);
}

const sheet = await ctx.newPage();
await sheet.setViewportSize({ width: 1024, height: 580 });
const html = cells
  .map(
    ({ label, b64 }) => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:7px">
      <img src="data:image/png;base64,${b64}"
           style="width:224px;height:224px;background:#000;border:1px solid #13313a;border-radius:4px"/>
      <div style="font:12px ui-monospace,monospace;letter-spacing:.05em;color:#00e3fe">${label}</div>
    </div>`,
  )
  .join("");
await sheet.setContent(
  `<!doctype html><html><body style="margin:0;background:#050507;display:grid;
     grid-template-columns:repeat(4,1fr);gap:16px;padding:20px">${html}</body></html>`,
);
await sheet.waitForTimeout(400);
await sheet.screenshot({ path: path.join(OUT, "morph-check.png") });

await browser.close();
console.log("→ captures/morph-check.png");
