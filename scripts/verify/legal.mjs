// The LEGAL PORT gate — the legal pages against upsunday.co/terms.html.
//
// The owner's brief for these pages was "match it perfectly", so the match is
// a contract rather than an impression, and this is where it is kept. Every
// length the reference renders is asserted here at the five widths that matter.
//
// WHAT IS ASSERTED  the geometry: column, page padding, the head block's rule
//                   and spacing, both display tiers, both reading tiers, the
//                   section rhythm, and the three gaps that set the document's
//                   texture (rule to first section, section to section,
//                   heading to body).
//
// WHAT IS NOT       colour, type face and weight. The reference is near-black
//                   on a white-to-peach wash in a rounded face with a sage
//                   eyebrow; Zirtuno is paper on ink, Bricolage over Geist,
//                   cyan accent. Those are identity and are meant to differ.
//                   They are printed as INFO so a change is still visible here.
//
// The reference's own numbers are BAKED IN, measured 2026-09-05, so the gate
// does not depend on a third-party site being up. Re-measure with --live: it
// re-reads upsunday.co and reports any drift in the baseline itself.
//
//   node scripts/verify/legal.mjs            (against the baked baseline)
//   node scripts/verify/legal.mjs --live     (also re-measure the reference)
//
// Needs the dev server on :3000.

import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const LIVE = process.argv.includes("--live");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const LOCAL = `${BASE}/en/legal/terms?f=1`;
const REFERENCE = "https://www.upsunday.co/terms.html";

let failed = 0;
const pass = (name, extra = "") =>
  console.log(`  ok   ${name}${extra ? ` — ${extra}` : ""}`);
const fail = (name, why) => {
  failed++;
  console.log(`  FAIL ${name} — ${why}`);
};
const info = (name, extra) => console.log(`  info ${name} — ${extra}`);

/** The reference, measured 2026-09-05. Every number is a computed style. */
const BASELINE = {
  1280: {
    column: 1070, padTop: 120, padBottom: 80.9,
    headPb: 28, headMb: 33.66,
    title: 76.8, titleLh: 78.34, titleLs: -2.3,
    lede: 19.2, ledeLh: 30.72, ledeMt: 24,
    h2: 18.5, h2Lh: 22.2, h2Ls: -0.37, h2Mb: 12,
    body: 16.5, bodyLh: 28.05, sectionMb: 28,
  },
  1440: {
    column: 1070, padTop: 121.25, padBottom: 91.01,
    headPb: 30.38, headMb: 37.87,
    title: 86.4, titleLh: 88.13, titleLs: -2.59,
    lede: 21.6, ledeLh: 34.56, ledeMt: 24,
    h2: 18.5, h2Lh: 22.2, h2Ls: -0.37, h2Mb: 12,
    body: 16.5, bodyLh: 28.05, sectionMb: 30.38,
  },
  1920: {
    column: 1070, padTop: 161.66, padBottom: 121.34,
    headPb: 40.51, headMb: 50.5,
    title: 115.2, titleLh: 117.5, titleLs: -3.46,
    lede: 28.8, ledeLh: 46.08, ledeMt: 24,
    h2: 18.5, h2Lh: 22.2, h2Ls: -0.37, h2Mb: 12,
    body: 16.5, bodyLh: 28.05, sectionMb: 40.51,
  },
  768: {
    column: 721.98, padTop: 193.54, padBottom: 19.97,
    headPb: 60.67, headMb: 75.03,
    title: 71.44, titleLh: 72.87, titleLs: -2.14,
    lede: 30.36, ledeLh: 48.57, ledeMt: 42.86,
    h2: 33.04, h2Lh: 39.65, h2Ls: -0.66, h2Mb: 21.43,
    body: 29.47, bodyLh: 50.1, sectionMb: 60.67,
  },
  390: {
    column: 366.63, padTop: 98.28, padBottom: 10.14,
    headPb: 30.81, headMb: 38.1,
    title: 36.28, titleLh: 37, titleLs: -1.09,
    lede: 15.42, ledeLh: 24.67, ledeMt: 21.77,
    h2: 16.78, h2Lh: 20.13, h2Ls: -0.34, h2Mb: 10.88,
    body: 14.96, bodyLh: 25.44, sectionMb: 30.81,
  },
};

const WIDTHS = [1280, 1440, 1920, 768, 390];

// `padTop` is the one geometric figure that is allowed to differ, and only
// upward: Zirtuno's top bar is taller than the reference's nav, so the page
// takes whichever is larger — the reference's own padding, or the bar plus the
// ~28px of air the reference leaves under its nav.
const PAD_TOP_IS_FLOOR = true;
const TOL = 1.0; // px. Sub-pixel layout and font metrics move the last decimal.

// Colour, face and weight are identity and are MEANT to differ. They are read
// so a change is visible here, never asserted — `--live` re-measures the whole
// reference, so without this they would be compared like everything else.
const IDENTITY = new Set(["face", "weight", "ink"]);
// Derived from other keys, checked separately as the document's texture.
const DERIVED = new Set([
  "ruleToFirst",
  "sectionGap",
  "headingToBody",
  "charsPerLine",
  "headBorder",
]);

/** One page's geometry, read from computed style — never from CSS text. */
const GEOMETRY = (sel) => {
  const px = (v) => Math.round(parseFloat(v) * 100) / 100;
  const q = (s) => document.querySelector(s);
  const cs = (s) => getComputedStyle(q(s));
  const rect = (s) => q(s).getBoundingClientRect();

  const doc = cs(sel.doc);
  const page = cs(sel.page);
  const head = cs(sel.head);
  const title = cs(sel.title);
  const lede = cs(sel.lede);
  const h2 = cs(`${sel.section} h2`);
  const body = cs(`${sel.section} p`);
  const section = cs(sel.section);
  const secs = [...document.querySelectorAll(sel.section)];

  return {
    column: px(doc.width),
    padTop: px(page.paddingTop),
    padBottom: px(page.paddingBottom),
    headPb: px(head.paddingBottom),
    headMb: px(head.marginBottom),
    headBorder: px(head.borderBottomWidth),
    title: px(title.fontSize), titleLh: px(title.lineHeight), titleLs: px(title.letterSpacing),
    lede: px(lede.fontSize), ledeLh: px(lede.lineHeight), ledeMt: px(lede.marginTop),
    h2: px(h2.fontSize), h2Lh: px(h2.lineHeight), h2Ls: px(h2.letterSpacing), h2Mb: px(h2.marginBottom),
    body: px(body.fontSize), bodyLh: px(body.lineHeight),
    sectionMb: px(section.marginBottom),
    ruleToFirst: Math.round(rect(sel.section).top - rect(sel.head).bottom),
    sectionGap: Math.round(
      secs[1].getBoundingClientRect().top - secs[0].getBoundingClientRect().bottom,
    ),
    headingToBody: Math.round(
      secs[0].querySelector("p").getBoundingClientRect().top -
        secs[0].querySelector("h2").getBoundingClientRect().bottom,
    ),
    charsPerLine: Math.round(parseFloat(doc.width) / (parseFloat(body.fontSize) * 0.5)),
    // Identity, reported not asserted.
    face: title.fontFamily.split(",")[0].replace(/["']/g, ""),
    weight: title.fontWeight,
    ink: body.color,
  };
};

const LOCAL_SEL = {
  doc: ".legal-doc", page: ".legal-page", head: ".legal-head",
  title: ".legal-title", lede: ".legal-lede", section: ".legal-section",
};
const REF_SEL = {
  doc: ".legal", page: ".legal", head: ".legal__head",
  title: ".legal__title", lede: ".legal__lede", section: ".legal__section",
};

async function measure(browser, url, sel, widths) {
  const out = {};
  for (const w of widths) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: w < 500 ? 844 : 900 },
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(1400);
    // Land every reveal before measuring. Both pages hold their sections 30px
    // low until the trigger fires, so a section that has never been scrolled
    // past reports every gap around it 30px too large — walking the page is
    // what settles it. Do NOT substitute a flag on the element: the motion is
    // GSAP's, and only GSAP clearing its own inline transform ends it.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += Math.round((w < 500 ? 844 : 900) * 0.7)) {
      await page.evaluate((to) => window.scrollTo(0, to), y);
      await page.waitForTimeout(260);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1200);
    out[w] = await page.evaluate(GEOMETRY, sel);
    await ctx.close();
  }
  return out;
}

const browser = await chromium.launch(LAUNCH);

let baseline = BASELINE;
if (LIVE) {
  console.log(`\nre-measuring the reference at ${REFERENCE}\n`);
  const live = await measure(browser, REFERENCE, REF_SEL, WIDTHS);
  for (const w of WIDTHS) {
    const drift = Object.keys(BASELINE[w]).filter(
      (k) => Math.abs(live[w][k] - BASELINE[w][k]) > TOL,
    );
    if (drift.length) {
      fail(
        `baseline still describes the reference at ${w}`,
        `drifted: ${drift.map((k) => `${k} ${BASELINE[w][k]}→${live[w][k]}`).join(", ")}`,
      );
    } else pass(`baseline still describes the reference at ${w}`);
  }
  baseline = live;
}

const local = await measure(browser, LOCAL, LOCAL_SEL, WIDTHS);
await browser.close();

for (const w of WIDTHS) {
  console.log(`\n${w}px`);
  const got = local[w];
  const want = baseline[w];

  for (const key of Object.keys(want)) {
    if (IDENTITY.has(key) || DERIVED.has(key)) continue;
    const delta = got[key] - want[key];
    if (key === "padTop" && PAD_TOP_IS_FLOOR) {
      // Allowed to exceed (taller bar), never to fall short.
      if (delta >= -TOL) {
        info(
          "padTop clears the taller bar",
          `${got[key]} vs reference ${want[key]} (+${delta.toFixed(2)})`,
        );
      } else {
        fail("padTop", `${got[key]} is BELOW the reference's ${want[key]}`);
      }
      continue;
    }
    if (Math.abs(delta) <= TOL) pass(key, `${got[key]}`);
    else fail(key, `got ${got[key]}, reference ${want[key]} (${delta > 0 ? "+" : ""}${delta.toFixed(2)})`);
  }

  // The document's texture: three gaps that no single declaration owns.
  const rhythm = { ruleToFirst: Math.round(want.headMb), sectionGap: Math.round(want.sectionMb), headingToBody: Math.round(want.h2Mb) };
  for (const [key, expected] of Object.entries(rhythm)) {
    if (Math.abs(got[key] - expected) <= 1) pass(key, `${got[key]}px`);
    else fail(key, `got ${got[key]}px, reference ${expected}px`);
  }

  info("measure", `${got.charsPerLine} characters per line`);
  info("identity (not asserted)", `${got.face} ${got.weight}, body ${got.ink}`);
}

console.log(
  failed
    ? `\n${failed} check(s) FAILED — the legal pages have drifted from the reference\n`
    : "\nall legal checks passed — the port still matches upsunday.co/terms.html\n",
);
process.exit(failed ? 1 : 0);
