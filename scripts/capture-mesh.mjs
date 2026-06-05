// Render the MESH metaball's 8 forms (?glass=mesh&state=N) + the mid-morph, and
// composite a labeled contact sheet (captures/mesh-sheet.png) so the new
// integrated/mobile glass can be judged against the raymarch reference.
//   BASE_URL=http://localhost:PORT node scripts/capture-mesh.mjs

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:65180";
const OUT = "captures";
const SEL = "[data-hero-metaball]";
const HEADLESS = process.env.HEADLESS !== "false";

const SHOTS = [
  ["state=0", "00 · Mark"],
  ["state=1", "01 · Web"],
  ["state=2", "02 · Software"],
  ["state=3", "03 · AI"],
  ["state=4", "04 · Automation"],
  ["state=5", "05 · Data"],
  ["state=6", "06 · Branding"],
  ["state=7", "07 · Marketing"],
  ["capture=morph", "morph · mark→AI"],
];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: HEADLESS, chromiumSandbox: false });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
  reducedMotion: "no-preference",
});
const page = await ctx.newPage();

const cells = [];
for (const [q, label] of SHOTS) {
  await page.goto(`${BASE}/en?glass=mesh&${q}#hero`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => !!document.querySelector("[data-hero-metaball] canvas"), {
    timeout: 30000,
  });
  await page.waitForTimeout(2500); // shrinkwrap geometry + matcap bake + paint
  const el = page.locator(SEL).first();
  await el.scrollIntoViewIfNeeded();
  const buf = await el.screenshot();
  fs.writeFileSync(path.join(OUT, `mesh-${q.replace(/[=&]/g, "-")}.png`), buf);
  cells.push({ label, b64: buf.toString("base64") });
  console.log(`captured ${q} — ${label}`);
}

// compose the labeled grid (3 × 3)
const sheet = await ctx.newPage();
const html = cells
  .map(
    ({ label, b64 }) => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:7px">
      <img src="data:image/png;base64,${b64}"
           style="width:230px;height:230px;background:#000;border:1px solid #13313a;border-radius:4px"/>
      <div style="font:12px ui-monospace,monospace;letter-spacing:.09em;color:#00e3fe">${label}</div>
    </div>`,
  )
  .join("");
await sheet.setContent(
  `<!doctype html><html><body style="margin:0;background:#050507;display:grid;
     grid-template-columns:repeat(3,1fr);gap:16px;padding:20px;width:max-content">${html}</body></html>`,
);
await sheet.waitForTimeout(400);
const grid = sheet.locator("body");
await grid.screenshot({ path: path.join(OUT, "mesh-sheet.png") });

await browser.close();
console.log("→ captures/mesh-sheet.png");
