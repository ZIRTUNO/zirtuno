import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";
import fs from "node:fs";
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const W = Number(process.env.W || 1440), H = Number(process.env.H || 900);
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: "reduce" });
const page = await ctx.newPage();
await page.goto("http://localhost:3000/en", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(3000);
const targets = ["#hero", "#problem", "#ecosystem", "#services", "#method", "#work", "#name", "#studio"];
for (const sel of targets) {
  const ok = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    el.scrollIntoView({ block: "start", behavior: "instant" });
    return true;
  }, sel);
  if (!ok) { console.log("missing", sel); continue; }
  await page.waitForTimeout(1400); // settle at rest before the shot
  await page.screenshot({ path: `${OUT}/${W}-${sel.slice(1)}.png` });
  console.log("shot", sel);
}
await browser.close();
