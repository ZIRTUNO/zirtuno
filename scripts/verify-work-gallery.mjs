// Contact sheet + geometry trace for the work gallery (S7.5).
//
//   node scripts/verify-work-gallery.mjs
//
// Two kinds of evidence, because neither alone is enough:
//
//  · STILLS of the states a reviewer judges — grid at rest, a card under the
//    hand, the panel settled, and the same on a phone.
//  · A numeric TRACE of the morph. A screenshot costs a few hundred ms, so a
//    tile aimed mid-flight lands after a 450ms spring is over; sampling the
//    panel's rect from inside the page on rAF costs nothing and proves the
//    thing a still cannot — that the panel starts ON the card, grows without
//    overshoot, and lands on the centred box.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3210";
const OUT = process.env.OUT_DIR || "captures/work-gallery";
fs.mkdirSync(OUT, { recursive: true });

const shot = (page, name) =>
  page.screenshot({ path: path.join(OUT, `${name}.png`) });

const browser = await chromium.launch(LAUNCH);

async function settle(page) {
  await page.waitForSelector(".zw-card", { state: "visible" });
  // let the scroll reveal finish so nothing is mid-rise in the still
  await page.waitForTimeout(1400);
}

// ── desktop ────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(`${BASE}/pt/work`, { waitUntil: "networkidle" });
  await settle(page);
  await shot(page, "desktop-grid");

  await page.hover(".zw-card");
  await page.waitForTimeout(1500); // the 1.4s photo push
  await shot(page, "desktop-hover");

  // Trace the morph from inside the page, then shoot the settled panel.
  const trace = await page.evaluate(async () => {
    const card = document.querySelector(".zw-card");
    const before = card.getBoundingClientRect();
    card.click();
    const samples = [];
    await new Promise((resolve) => {
      const t0 = performance.now();
      const step = () => {
        const panel = document.querySelector(".zw-panel");
        if (panel) {
          const r = panel.getBoundingClientRect();
          samples.push({
            t: Math.round(performance.now() - t0),
            x: Math.round(r.x),
            y: Math.round(r.y),
            w: Math.round(r.width),
            h: Math.round(r.height),
          });
        }
        if (performance.now() - t0 > 900) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const panel = document.querySelector(".zw-panel");
    const media = document.querySelector(".zw-media");
    return {
      card: {
        x: Math.round(before.x),
        y: Math.round(before.y),
        w: Math.round(before.width),
        h: Math.round(before.height),
      },
      samples,
      final: panel && {
        x: Math.round(panel.getBoundingClientRect().x),
        w: Math.round(panel.getBoundingClientRect().width),
        h: Math.round(panel.getBoundingClientRect().height),
      },
      mediaSquare: media
        ? Math.abs(media.getBoundingClientRect().width -
            media.getBoundingClientRect().height) < 1
        : null,
      dialog: {
        role: panel?.getAttribute("role"),
        modal: panel?.getAttribute("aria-modal"),
        labelled: !!panel?.getAttribute("aria-labelledby"),
        focused: document.activeElement === panel,
      },
    };
  });
  await page.waitForTimeout(1600); // the copy stagger
  await shot(page, "desktop-panel");

  const first = trace.samples[0];
  const last = trace.samples[trace.samples.length - 1];
  const peakW = Math.max(...trace.samples.map((s) => s.w));
  console.log("\n── desktop morph ───────────────────────────────");
  console.log("card rect     ", trace.card);
  console.log("first frame   ", first);
  console.log("settled       ", last);
  console.log("final box     ", trace.final);
  console.log(
    "starts on card",
    Math.abs(first.x - trace.card.x) < 6 && Math.abs(first.w - trace.card.w) < 6,
  );
  console.log("overshoot px  ", Math.round(peakW - last.w));
  console.log("media square  ", trace.mediaSquare);
  console.log("dialog        ", trace.dialog);

  // Escape must close it and hand focus back to the card that opened it.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);
  const closed = await page.evaluate(() => {
    const photo = document.querySelector("[data-card-photo]");
    return {
      url: location.pathname,
      cards: document.querySelectorAll(".zw-card").length,
      gone: !document.querySelector(".zw-panel"),
      focusBack: document.activeElement?.classList.contains("zw-card"),
      // the card's photo must be handed back with no leftover inline transform
      cardPhotoClean: photo ? !photo.style.transform : "no photo",
    };
  });
  console.log("after Escape  ", closed);
  await shot(page, "desktop-closed");

  if (errors.length) console.log("PAGE ERRORS   ", errors.slice(0, 5));
  else console.log("page errors    none");
  await ctx.close();
}

// ── mobile ─────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/pt/work`, { waitUntil: "networkidle" });
  await settle(page);
  await shot(page, "mobile-grid");
  await page.evaluate(() => document.querySelector(".zw-card").click());
  await page.waitForTimeout(1800);
  await shot(page, "mobile-panel");
  await ctx.close();
}

// ── reduced motion ─────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/pt/work`, { waitUntil: "networkidle" });
  await page.waitForSelector(".zw-card", { state: "visible" });
  await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelector(".zw-card").click());
  await page.waitForTimeout(500);
  const rm = await page.evaluate(() => {
    const copy = document.querySelectorAll(".zw-copy > *");
    return {
      open: !!document.querySelector(".zw-panel"),
      allCopyVisible: [...copy].every(
        (el) => Number(getComputedStyle(el).opacity) > 0.99,
      ),
    };
  });
  console.log("reduced motion", rm);
  await shot(page, "reduced-panel");
  await ctx.close();
}

await browser.close();
console.log(`\nsheet → ${OUT}`);
