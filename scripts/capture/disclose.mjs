// Visual review sheet for the R6 disclosure and its line split. Burst-captures
// the panel through its open and its close so the two curves can be compared
// by eye, shoots the summary row at 3x so the plus/minus mark is legible, and
// lays every burst out as one contact sheet.
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
const sheets = [];

/** Park on the first pillar with the disclosure hydrated and live. */
async function park(page) {
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
}

// ── the mark, at 3x ────────────────────────────────────────────────────────
{
  const page = await (
    await browser.newContext({
      viewport: { width: 1280, height: 860 },
      deviceScaleFactor: 3,
    })
  ).newPage();
  await park(page);
  await page.waitForTimeout(800);

  const summary = page.locator(`${SEL} summary`).first();
  await summary.screenshot({ path: `${OUT}/mark-plus.png` });
  await page.evaluate(
    (sel) => document.querySelector(sel).querySelector("summary").click(),
    SEL,
  );
  await page.waitForTimeout(900);
  await summary.screenshot({ path: `${OUT}/mark-minus.png` });
  await page.context().close();
}

// ── the burst ──────────────────────────────────────────────────────────────
// A Playwright screenshot costs ~150ms and this page renders at a handful of
// frames a second under a live field, so a burst that races the wall clock
// only ever catches the settled state of a 620ms animation — every frame of
// the first attempt at this came back fully open, including frame zero.
//
// So the clock is DRIVEN rather than slowed. GSAP reads `Date.now` (`_getTime
// = Date.now`, gsap-core.js:1269 — NOT performance.now, patching that one
// changes nothing), so an init script hands it a clock that follows real time
// until the page has parked and is then FROZEN and advanced by hand. Each
// frame below is therefore taken at an exact position on the component's own
// timeline — 0ms, 56ms, 112ms … — rather than wherever the renderer happened
// to be, which makes the sheet reproducible and evenly spaced in the only
// units that matter here. Steps stay well under GSAP's 500ms lag threshold,
// past which the ticker would compress them and the spacing would be a lie.
const OPEN_MS = 620;
const CLOSE_MS = Math.round(620 / 1.5); // timeScale(1.5) — leaving is quicker
{
  // Tall enough that the panel at FULL height and the summary above it are in
  // one frame. A burst cropped to the top of the panel cannot show the pour:
  // the sheet grows downward, so the top rows are settled while most of the
  // animation is still happening below the crop.
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await context.addInitScript(() => {
    const raw = Date.now;
    window.__frozenAt = null;
    window.__off = 0;
    Date.now = () => (window.__frozenAt === null ? raw() : window.__frozenAt + window.__off);
  });
  const page = await context.newPage();
  await park(page);

  // Put the summary near the top of the viewport so the panel has room to grow
  // into frame, and let the scroll actually stop — a burst started mid-scroll
  // reads as the headline flying around, which is exactly the thing these
  // frames are supposed to be evidence about.
  await page.evaluate((sel) => {
    document.querySelector(sel).scrollIntoView({ block: "start" });
  }, SEL);
  await page.waitForTimeout(2500);
  await page.waitForFunction(
    () =>
      new Promise((r) => {
        const a = window.scrollY;
        requestAnimationFrame(() => requestAnimationFrame(() => r(window.scrollY === a)));
      }),
    null,
    { timeout: 30000 },
  );

  const box = await page.evaluate((sel) => {
    const d = document.querySelector(sel);
    const shut = d.getBoundingClientRect();
    d.open = true;
    const full = d.getBoundingClientRect().height;
    d.open = false;
    return { x: shut.x, y: shut.y, w: shut.width, full };
  }, SEL);
  const x = Math.max(0, box.x - 14);
  const y = Math.max(0, box.y - 22);
  const clip = {
    x,
    y,
    width: Math.min(box.w + 28, 1280 - x),
    height: Math.min(box.full + 52, 1000 - y),
  };
  console.log(
    `burst clip: ${Math.round(clip.width)}×${Math.round(clip.height)} at ${Math.round(clip.x)},${Math.round(clip.y)} (panel opens to ${Math.round(box.full)}px)`,
  );

  // take the clock
  await page.evaluate(() => {
    window.__frozenAt = Date.now();
    window.__off = 0;
  });
  /** Advance the frozen clock by `ms` and let GSAP's ticker render it. */
  const advance = (ms) =>
    page.evaluate(
      (ms) =>
        new Promise((r) => {
          window.__off += ms;
          requestAnimationFrame(() => requestAnimationFrame(r));
        }),
      ms,
    );

  const burst = async (tag, span, frames) => {
    const step = Math.round(span / (frames - 1));
    const shots = [];
    await page.evaluate(() => {
      window.__off = 0;
    });
    await page.evaluate(
      (sel) => document.querySelector(sel).querySelector("summary").click(),
      SEL,
    );
    for (let i = 0; i < frames; i++) {
      const state = await page.evaluate(
        (sel) => {
          const d = document.querySelector(sel);
          return {
            t: window.__off,
            h: Math.round(
              d.open ? d.querySelector(".disclose-pane").getBoundingClientRect().height : 0,
            ),
            n: d.querySelectorAll(".disclose-line").length,
          };
        },
        SEL,
      );
      const file = `${OUT}/${tag}-${String(i).padStart(2, "0")}.png`;
      await page.screenshot({ path: file, clip });
      shots.push({ file, label: `${state.t}ms · ${state.h}px · ${state.n} lines` });
      if (i < frames - 1) await advance(step);
    }
    // hand the clock back so the rest of the sequence settles in real time
    await advance(2000);
    sheets.push({ title: tag, shots });
  };

  await burst("open", OPEN_MS, 12);
  await burst("close", CLOSE_MS, 10);
  await page.context().close();
}

// ── the narrow stage ───────────────────────────────────────────────────────
// Here the clock is merely DIVIDED rather than driven: this pass is measuring
// the pin and the line count over a real run, not composing a filmstrip, so it
// wants the animation to play itself — just slowly enough that a rAF sampler
// on a page rendering at a few frames a second still lands inside it.
const SLOW = 8;
// 390px is where .pillar-block drops to one column, so the slab's padding has
// to survive the tightest measure the panel ever gets — and the split has to
// survive the widest line count.
{
  // On the same slowed clock as the burst. At real speed this page renders at
  // a few frames a second under a live field, and a rAF loop sampling a 620ms
  // animation can miss the split entirely — the count came back 0 for a pour
  // that measurably had thirteen lines in it.
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  await context.addInitScript((k) => {
    const raw = Date.now;
    const t0 = raw();
    Date.now = () => t0 + (raw() - t0) / k;
  }, SLOW);
  const page = await context.newPage();
  await park(page);
  await page.waitForTimeout(1500 * SLOW);

  // the pin measures real layout rather than a formula, so it has to hold on
  // the single-column stage too — where the liquid's band sits ABOVE the copy
  // and the centring maths is a different shape entirely
  const run = await page.evaluate(async (sel) => {
    const d = document.querySelector(sel);
    const name = d.closest(".pillar").querySelector(".pillar-name");
    const tops = [];
    let lines = 0;
    await new Promise((resolve) => {
      const t0 = Date.now();
      const tick = () => {
        tops.push(name.getBoundingClientRect().top);
        lines = Math.max(lines, d.querySelectorAll(".disclose-line").length);
        if (Date.now() - t0 < 900) requestAnimationFrame(tick);
        else resolve();
      };
      d.querySelector("summary").click();
      requestAnimationFrame(tick);
    });
    return { drift: Math.max(...tops.map((t) => Math.abs(t - tops[0]))), lines };
  }, SEL);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  console.log(`390px horizontal overflow: ${overflow}px`);
  console.log(`390px headline excursion: ${run.drift.toFixed(2)}px`);
  console.log(`390px lines in the pour:  ${run.lines}`);
  await page.waitForTimeout(1600 * SLOW);
  await page.locator(SEL).first().screenshot({ path: `${OUT}/mobile-open.png` });
  await page.context().close();
}

// ── the contact sheet ──────────────────────────────────────────────────────
// One page per burst, frames in reading order, so the pour can be read as a
// sequence instead of as a directory listing.
{
  const page = await (
    await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
  ).newPage();
  for (const { title, shots } of sheets) {
    // Inlined, not linked: setContent leaves the page on about:blank, which is
    // not allowed to load file:// subresources — a linked sheet comes out as a
    // grid of broken images.
    const cells = shots
      .map(
        ({ file, label }) =>
          `<figure><img src="data:image/png;base64,${fs.readFileSync(file).toString("base64")}"><figcaption>${title} · ${label}</figcaption></figure>`,
      )
      .join("");
    await page.setContent(
      `<style>
        body{margin:0;background:#0b0b0c;color:#8a8a8a;font:11px/1.4 ui-monospace,monospace}
        .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:14px}
        figure{margin:0}
        img{width:100%;display:block;border:1px solid #1e1e20}
        figcaption{padding-top:4px;letter-spacing:.08em;text-transform:uppercase}
       </style><div class="grid">${cells}</div>`,
    );
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/sheet-${title}.png`, fullPage: true });
  }
  await page.context().close();
}

await browser.close();
console.log(`captures → ${OUT}/`);
