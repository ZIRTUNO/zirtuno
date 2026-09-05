// THE AURA PROBE — what the page's GROUND actually is, in real pixels.
//
// The aura is a background, so the only honest question about it is "how much
// has the ink moved, and what did that cost the copy?". Both are numbers, and
// neither is answerable by looking at a screenshot: a lifted ground is exactly
// the kind of change the eye adapts to within a second of looking at it, and
// `captures/` carries a ~1% churn noise floor besides.
//
//   node scripts/probe/aura.mjs <tag>          → captures/aura-<tag>-<route>.png
//   BASE=http://localhost:3100 node …          → against an isolated dev server
//
// Reports, per route:
//   ground   median RGB over AURA-LIT INK. Isolating that is easier here than
//            it sounds: the aura is pure cyan, so its red channel stays at 0,
//            while paper copy, grey UI and the site's greyscale imagery are all
//            R~=G~=B. Filtering to R<20 therefore drops the content and leaves
//            the ground, with no per-route masking.
//   peak     the 99th percentile of that same population — the top of the
//            bloom. THE number that decides whether this still reads as a
//            background rather than as a coloured page.
//   contrast paper (#F2F0EB) against `peak`: the worst case any body copy can
//            face, since peak is the brightest ground under any of it.
//
// KEY=<n> injects `--aura-key: <n>` before measuring, so the gain can be swept
// without editing CSS between runs. KEY=0 reproduces the bare-ink baseline.
//
// Routes are chosen for the two grounds this site actually has: the homepage,
// where the opaque liquid canvas owns the viewport, and everything else, where
// the ground is bare ink and the aura is the only thing on it.

import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LAUNCH } from "../support/launch.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "..", "captures");
const BASE = process.env.BASE || "http://localhost:3000";
const TAG = process.argv[2] || "base";
fs.mkdirSync(OUT, { recursive: true });

// [name, route, scrollY, settle ms]
//
// The first four rows walk the HERO GATE: the homepage opens on black and the
// atmosphere is scrubbed in across the hero's exit, so the interesting places
// are rest (must be bare ink), mid-hero (still nothing), the ribbon leaving
// (coming up) and clear of it (full). `gate` in the output is the measured
// `--aura-hero`, so the ground numbers can be read against what the gate was
// actually doing rather than against what it was supposed to be doing.
const SHOTS = [
  ["home-hero", "/en", 0, 3200],
  ["home-half", "/en", 450, 1200],
  ["home-exit", "/en", 820, 1200],
  ["home-mid", "/en", 2600, 2800],
  ["careers", "/en/careers", 0, 2400],
  ["contact", "/en/contact", 0, 2400],
  ["work", "/en/work", 0, 2600],
];

const PAPER = [242, 240, 235];

const srgb = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]) =>
  0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const contrast = (a, b) => {
  const [hi, lo] = lum(a) >= lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
  return (hi + 0.05) / (lo + 0.05);
};

/** Ground statistics from a raw RGB buffer. See the header for the metrics. */
function measure(data, w, h) {
  const n = w * h;
  // The aura is pure cyan; content on this site is paper, grey or greyscale
  // imagery. R<20 keeps the former and drops the latter.
  const rs = [];
  const gs = [];
  const bs = [];
  for (let i = 0; i < n; i++) {
    const r = data[i * 3];
    if (r >= 20) continue;
    rs.push(r);
    gs.push(data[i * 3 + 1]);
    bs.push(data[i * 3 + 2]);
  }
  if (!rs.length) return { ground: [0, 0, 0], peak: [0, 0, 0], share: 0 };
  const at = (arr, q) => {
    const s = arr.slice().sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(s.length * q))];
  };
  // Peak is taken per channel at the same quantile: the bloom is a single hue,
  // so the channels move together and this is the colour AT that quantile.
  return {
    ground: [at(rs, 0.5), at(gs, 0.5), at(bs, 0.5)],
    peak: [at(rs, 0.99), at(gs, 0.99), at(bs, 0.99)],
    share: rs.length / n,
  };
}

const browser = await chromium.launch(LAUNCH);

// ── PERF=1 — what the layer COSTS ─────────────────────────────────────────────
// The one real risk in adding this layer: a screen-blended full-viewport sheet
// makes the compositor keep a backdrop copy and re-blend it every frame, and
// FieldStage demotes the liquid through its rung ladder on SUSTAINED slow
// frames. So the question is not "is the aura fast", it is "did the aura push
// the liquid's frames far enough to cost the site its material".
//
// Measured on the homepage (liquid) and on careers (no liquid, so the aura's
// own compositing cost is isolated), aura on vs off, same session.
//
// A SMALL VIEWPORT IS LOAD-BEARING. Headless Chrome renders WebGL through
// SwiftShader — software rasterisation — and a full 1440x900 liquid starves
// there badly enough that the watchdog demotes the very code under test and the
// numbers describe the fallback instead. 800x600 keeps it on the top rung long
// enough to compare like with like.
if (process.env.PERF) {
  const pctx = await browser.newContext({
    viewport: { width: 800, height: 600 },
    deviceScaleFactor: 1,
  });
  const pp = await pctx.newPage();
  const sample = async (route, auraOn) => {
    await pp.goto(`${BASE}${route}?fcap=1`, { waitUntil: "load" });
    await pp.addStyleTag({
      content:
        "nextjs-portal,#__next-build-watcher{display:none!important}" +
        (auraOn ? "" : ".aura{display:none!important}"),
    });
    await pp.waitForTimeout(2500); // let the field build and settle
    return pp.evaluate(
      () =>
        new Promise((res) => {
          const d = [];
          let last = performance.now();
          let n = 0;
          const tick = (t) => {
            d.push(t - last);
            last = t;
            if (++n < 140) requestAnimationFrame(tick);
            else {
              d.sort((a, b) => a - b);
              res({
                median: +d[d.length >> 1].toFixed(2),
                p90: +d[Math.floor(d.length * 0.9)].toFixed(2),
              });
            }
          };
          requestAnimationFrame(tick);
        }),
    );
  };
  console.log("frame time (ms) — lower is better\n");
  console.log("route".padEnd(11), "aura off".padEnd(22), "aura on");
  for (const route of ["/en", "/en/careers"]) {
    const off = await sample(route, false);
    const on = await sample(route, true);
    console.log(
      route.padEnd(11),
      `med ${off.median} p90 ${off.p90}`.padEnd(22),
      `med ${on.median} p90 ${on.p90}`,
    );
  }
  await browser.close();
  process.exit(0);
}

// ── MOTION=1 — is the field ALIVE, or is it moving? ──────────────────────────
// The complaint that produced the shader was that the old vapour felt dead, and
// "dead" is measurable: a translated texture returns to itself, a live field
// does not. This samples the ground at t, t+4s and t+12s and reports the mean
// absolute change per channel between them.
//
// A TRANSLATED TEXTURE AND A LIVE FIELD BOTH SCORE ABOVE ZERO, so the number to
// read is not the 4s figure but whether the 12s figure keeps GROWING: a loop
// drifts back toward where it started, weather keeps leaving.
if (process.env.MOTION) {
  const mctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    // RM=1 asserts the OTHER half of the contract: under reduced motion the
    // field must render once and hold, so every figure below should be ~0.
    ...(process.env.RM ? { reducedMotion: "reduce" } : {}),
  });
  const mp = await mctx.newPage();
  await mp.goto(`${BASE}/en/careers?fcap=1`, { waitUntil: "load" });
  await mp.addStyleTag({
    content:
      "nextjs-portal{display:none!important}" +
      // Copy and chrome would swamp the measurement; the ground is the subject.
      ".journey-content,main,header,footer,.topbar,.custom-cursor{visibility:hidden!important}",
  });
  await mp.waitForTimeout(2000);
  const live = await mp.evaluate(() =>
    document.querySelector(".aura")?.hasAttribute("data-gl"),
  );
  const shot = async () =>
    await sharp(await mp.screenshot())
      .removeAlpha()
      .raw()
      .toBuffer();
  const t0 = await shot();
  await mp.waitForTimeout(4000);
  const t4 = await shot();
  await mp.waitForTimeout(8000);
  const t12 = await shot();
  const diff = (a, b) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
    return s / a.length;
  };
  console.log(`live field: ${live ? "yes" : "NO (static fallback)"}`);
  console.log(`mean abs change  t0 -> t4 : ${diff(t0, t4).toFixed(3)} / 255`);
  console.log(`mean abs change  t0 -> t12: ${diff(t0, t12).toFixed(3)} / 255`);
  console.log(`mean abs change  t4 -> t12: ${diff(t4, t12).toFixed(3)} / 255`);
  await browser.close();
  process.exit(0);
}

// MOBILE=1 shoots a 390px phone; RM=1 shoots with prefers-reduced-motion, where
// the global rule collapses every animation to 0.001ms — the aura's loops close
// on purpose so that lands on the authored composition, and this is what proves
// it rather than assuming it.
const ctx = await browser.newContext({
  viewport: process.env.MOBILE
    ? { width: 390, height: 844 }
    : { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  ...(process.env.RM ? { reducedMotion: "reduce" } : {}),
});
const page = await ctx.newPage();

// NOGL=1 renders the STATIC fallback instead of the live field, by refusing the
// aura canvas a context before any app code runs. That makes "static vs live" a
// reproducible A/B on one build rather than a comparison between two checkouts
// - which matters, because which of the two reads better is a taste call and
// the taste call needs the two shots to differ in nothing else.
if (process.env.NOGL) {
  await ctx.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (this.classList.contains("aura-vapour")) return null;
      return real.call(this, type, ...rest);
    };
  });
}

const KEY = process.env.KEY;
console.log(KEY === undefined ? "(authored gain)" : `--aura-key: ${KEY}`);
console.log(
  "route".padEnd(11),
  "gl".padEnd(4),
  "gate".padEnd(7),
  "ground".padEnd(16),
  "peak".padEnd(16),
  "paper:peak".padEnd(11),
  "ink %",
);
for (const [name, route, y, settle] of SHOTS) {
  // `?fcap` is the house QA flag: ANY `f*` param suppresses the entry veil
  // (see the gate in components/chrome/EntryVeil.tsx), which is what makes a
  // capture deterministic rather than a race against a 6s intro.
  const url = BASE + route + (route.includes("?") ? "&" : "?") + "fcap=1";
  await page.goto(url, { waitUntil: "load" });
  await page.addStyleTag({
    content:
      "nextjs-portal,#__next-build-watcher{display:none!important}" +
      (KEY === undefined ? "" : `.aura{--aura-key:${KEY} !important}`),
  });
  if (y) await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(settle);

  // What the hero gate resolved to here, and whether the LIVE field is the
  // thing being measured. `gl` false means a context was refused and these
  // pixels are the static CSS fallback — which is a valid render, but a
  // different one, and judging the shader by it would be a mistake.
  const { gate, gl } = await page.evaluate(() => {
    const a = document.querySelector(".aura");
    if (!a) return { gate: "none", gl: false };
    const v = getComputedStyle(a).getPropertyValue("--aura-hero").trim();
    return { gate: v === "" ? "?" : v, gl: a.hasAttribute("data-gl") };
  });

  const file = path.join(OUT, `aura-${TAG}-${name}.png`);
  const buf = await page.screenshot({ path: file });
  const { data, info } = await sharp(buf)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { ground, peak, share } = measure(data, info.width, info.height);

  console.log(
    name.padEnd(11),
    (gl ? "yes" : "NO").padEnd(4),
    String(gate).padEnd(7),
    `rgb(${ground.join(",")})`.padEnd(16),
    `rgb(${peak.join(",")})`.padEnd(16),
    (contrast(PAPER, peak).toFixed(1) + ":1").padEnd(11),
    (share * 100).toFixed(0) + "%",
  );
}

await browser.close();
console.log(`\nwrote captures/aura-${TAG}-*.png`);
