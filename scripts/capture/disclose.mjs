// Visual review sheet for the R6 disclosure. Burst-captures the panel through
// its open and its close so the two curves can be compared by eye, and shoots
// the summary row at 3x so the plus/minus mark is legible.
//   BASE_URL=http://localhost:PORT node scripts/capture/disclose.mjs

import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const LOCALE = process.env.LOCALE || "en";
const URL = `${BASE}/${LOCALE}?ftier=full`;
const OUT = "captures/disclose";
const SEL = "#services details.disclose";

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(LAUNCH);

// ── the mark, at 3x ────────────────────────────────────────────────────────
{
  const page = await (
    await browser.newContext({
      viewport: { width: 1280, height: 860 },
      deviceScaleFactor: 3,
    })
  ).newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.dataset.disclose === "live",
    SEL,
    { timeout: 30000 },
  );
  await page.evaluate(
    (sel) =>
      document.querySelector(sel).closest(".pillar").scrollIntoView({ block: "center" }),
    SEL,
  );
  await page.waitForTimeout(800);

  const summary = page.locator(`${SEL} summary`).first();
  await summary.screenshot({ path: `${OUT}/mark-plus.png` });
  await page.evaluate((sel) => document.querySelector(sel).querySelector("summary").click(), SEL);
  await page.waitForTimeout(900);
  await summary.screenshot({ path: `${OUT}/mark-minus.png` });
  await page.context().close();
}

// ── the burst ──────────────────────────────────────────────────────────────
// A Playwright screenshot costs ~150ms, so a plain burst only ever catches the
// settled state of a 620ms animation. Slow GSAP's own clock instead. Note it
// reads `Date.now`, NOT `performance.now` (`_getTime = Date.now`,
// gsap-core.js:1269) — patching the wrong one changes nothing. Done in an init
// script, before any page script runs, this stretches the whole timeline by K
// without touching a line of shipped code: the curves are unchanged, only the
// wall clock they are read against.
const SLOW = 6;
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript((k) => {
    const raw = Date.now;
    const t0 = raw();
    Date.now = () => t0 + (raw() - t0) / k;
  }, SLOW);
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.dataset.disclose === "live",
    SEL,
    { timeout: 30000 },
  );
  await page.evaluate(
    (sel) =>
      document.querySelector(sel).closest(".pillar").scrollIntoView({ block: "center" }),
    SEL,
  );
  // Lenis runs on the same slowed clock, so the scroll into view takes SLOW×
  // longer than it looks. Wait it out and then confirm the scroll has actually
  // stopped — a burst started mid-scroll reads as the headline flying around,
  // which is exactly the thing these frames are supposed to be evidence about.
  await page.waitForTimeout(1200 * SLOW);
  await page.waitForFunction(
    () =>
      new Promise((r) => {
        const a = window.scrollY;
        requestAnimationFrame(() => requestAnimationFrame(() => r(window.scrollY === a)));
      }),
    null,
    { timeout: 30000 },
  );

  // clip a fixed window around the copy column so every frame is comparable
  const box = await page.locator(`${SEL}`).first().boundingBox();
  const H = 560;
  const x = Math.max(0, box.x - 10);
  const clip = {
    x,
    y: Math.min(Math.max(0, box.y - 24), 900 - H),
    width: Math.min(620, 1280 - x),
    height: H,
  };

  const burst = async (tag, frames, gap) => {
    await page.evaluate(
      (sel) => document.querySelector(sel).querySelector("summary").click(),
      SEL,
    );
    for (let i = 0; i < frames; i++) {
      await page.screenshot({ path: `${OUT}/${tag}-${i}.png`, clip });
      await page.waitForTimeout(gap);
    }
    await page.waitForTimeout(1500 * SLOW);
  };

  // open ≈ 620ms × 6 = 3.7s of wall clock; close ≈ 410ms × 6 = 2.5s
  await burst("open", 9, 260);
  await burst("close", 7, 190);
  await page.context().close();
}

// ── the narrow stage ───────────────────────────────────────────────────────
// 390px is where .pillar-block drops to one column, so the slab's padding has
// to survive the tightest measure the panel ever gets.
{
  const page = await (
    await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  ).newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.dataset.disclose === "live",
    SEL,
    { timeout: 30000 },
  );
  await page.evaluate(
    (sel) => document.querySelector(sel).closest(".pillar").scrollIntoView({ block: "center" }),
    SEL,
  );
  await page.waitForTimeout(1500);

  // the pin measures real layout rather than a formula, so it has to hold on
  // the single-column stage too — where the liquid's band sits ABOVE the copy
  // and the centring maths is a different shape entirely
  const drift = await page.evaluate(async (sel) => {
    const d = document.querySelector(sel);
    const name = d.closest(".pillar").querySelector(".pillar-name");
    const tops = [];
    await new Promise((resolve) => {
      const t0 = performance.now();
      const tick = () => {
        tops.push(name.getBoundingClientRect().top);
        if (performance.now() - t0 < 1200) requestAnimationFrame(tick);
        else resolve();
      };
      d.querySelector("summary").click();
      requestAnimationFrame(tick);
    });
    return Math.max(...tops.map((t) => Math.abs(t - tops[0])));
  }, SEL);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  console.log(`390px horizontal overflow: ${overflow}px`);
  console.log(`390px headline excursion: ${drift.toFixed(2)}px`);
  await page.locator(SEL).first().screenshot({ path: `${OUT}/mobile-open.png` });
  await page.context().close();
}

await browser.close();
console.log(`captures → ${OUT}/`);
