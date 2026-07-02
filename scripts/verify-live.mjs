// Live-interaction verification against the PROD build (:3000). Drives real
// events (no idle-wait) and captures labelled evidence for each interaction.
//   node scripts/verify-live.mjs
// Outputs to captures/verify/ + a JSON report on stdout.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = "captures/verify";
fs.mkdirSync(OUT, { recursive: true });

const report = {};
const browser = await chromium.launch({ headless: true, chromiumSandbox: false });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
});
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));

await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });

// 1) hero canvas mounts?
const heroSel = "[data-hero-metaball]";
let mounted = false;
for (let i = 0; i < 40; i++) {
  mounted = await page.evaluate(
    (s) => !!document.querySelector(`${s} canvas`),
    heroSel,
  );
  if (mounted) break;
  await page.waitForTimeout(750);
}
report.heroCanvasMounted = mounted;
report.msToMount = mounted ? "â‰¤30s" : ">30s";
await page.waitForTimeout(3500); // let first frames paint
const hero = page.locator(heroSel).first();
await hero.screenshot({ path: path.join(OUT, "01-rest.png") });

// 2) autocycle â€” same element over time should show different forms
await page.waitForTimeout(7000); // ~10.5s elapsed â†’ Markâ†’Web melt
await hero.screenshot({ path: path.join(OUT, "02-cycle-10s.png") });
await page.waitForTimeout(6000); // ~16.5s â†’ Web settled
await hero.screenshot({ path: path.join(OUT, "03-cycle-16s.png") });

// 3) hover-lean â€” move pointer to right then left of the canvas
const box = await hero.boundingBox();
async function hoverAt(fx, name) {
  await page.mouse.move(box.x + box.width * fx, box.y + box.height * 0.5, {
    steps: 6,
  });
  await page.waitForTimeout(1400);
  await hero.screenshot({ path: path.join(OUT, name) });
}
await hoverAt(0.88, "04-hover-right.png");
await hoverAt(0.12, "05-hover-left.png");
await page.mouse.move(box.x - 50, box.y - 50); // leave
await page.waitForTimeout(1200);

// 4) keyboard nav â€” focus the stage, step pillars, read the live region
await hero.focus();
report.focusedTag = await page.evaluate(() => document.activeElement?.getAttribute("data-hero-metaball") != null ? "stage" : document.activeElement?.tagName);
await page.keyboard.press("ArrowRight");
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(2200); // let the melt settle
await hero.screenshot({ path: path.join(OUT, "06-keyboard.png") });
report.ariaLive = await page.evaluate(() => {
  const el = document.querySelector('#hero [aria-live="polite"]');
  return el ? el.textContent : "(none)";
});
report.activePillar = await page.evaluate(() => {
  const dots = [...document.querySelectorAll(".pillar-dot")];
  return dots.findIndex((d) => d.classList.contains("is-active"));
});
report.tabIndex = await page.evaluate(
  (s) => document.querySelector(s)?.getAttribute("tabindex"),
  heroSel,
);

// 5) scroll-converge â€” wheel down through the page, capture the eco core
const ecoSel = "[data-organism]";
const frames = [];
for (let i = 0; i < 16; i++) {
  await page.mouse.wheel(0, 650);
  await page.waitForTimeout(550);
  const vis = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cy = r.top + r.height / 2;
    return { centered: cy > 200 && cy < 760, top: Math.round(r.top) };
  }, ecoSel);
  if (vis && vis.centered && frames.length < 4) {
    const eco = page.locator(ecoSel).first();
    const fn = `07-converge-${frames.length}.png`;
    await eco.screenshot({ path: path.join(OUT, fn) });
    frames.push({ fn, top: vis.top });
  }
}
report.convergeFrames = frames;
report.pageErrors = errs;

console.log("VERIFY_REPORT " + JSON.stringify(report, null, 2));
await browser.close();
