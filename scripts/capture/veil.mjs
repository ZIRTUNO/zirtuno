// Review sheet AND live gate for THE VEIL — the route transition.
//
// The gate next door (`scripts/verify/veil.mjs`) proves the geometry in plain
// node. What it cannot see is the PAINT, and the paint is where this surface
// has already shipped one defect: the reference's cover path opens `M 0 0 V y₀`,
// which encloses no area but pins the path's BOUNDING BOX to the top of the
// viewport — and an `objectBoundingBox` gradient on that box is a gradient
// nailed to the screen instead of to the wave. The kernel was correct, every
// number was correct, and the first capture was three dark humps rising under
// a bright band that had nothing to do with them.
//
// So this file does two jobs. It shoots the crossing for a reviewer, and it
// reads the live SVG on every frame and asserts that the browser's own idea of
// each layer's box agrees with the kernel's idea of where the wave is. It exits
// non-zero when it does not.
//
// A REAL navigation, not a synthetic one: the transition's whole difficulty is
// that a route commits in the middle of it, and a harness that drove the
// curtain directly would be reviewing something the visitor never sees.
//
//   BASE_URL=http://localhost:PORT node scripts/capture/veil.mjs
//
// Writes captures/veil/{crossing,sheet.jpg,reduced.png}.

import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE_URL || process.env.BASE || "http://localhost:3000";
const LOCALE = process.env.LOCALE || "en";
/** Pins the column delays, so two runs of this script are comparable and a
 *  reviewer's "the third frame" is the same third frame tomorrow. Any `?f*`
 *  param also suppresses the entry intro, which is why the page below arrives
 *  ready rather than mid-wordmark. */
const SEED = process.env.SEED || "20260905";
const OUT = "captures/veil";
const FRAMES = Number(process.env.FRAMES || 46);

/**
 * A Playwright screenshot costs ~150 ms, so a plain burst only ever catches
 * the settled state of a 720 ms transition. Slow GSAP's own clock instead. It
 * reads `Date.now`, NOT `performance.now` (`_getTime = Date.now`,
 * gsap-core.js) — patching the wrong one changes nothing. Done in an init
 * script, before any page script runs, this stretches the timeline by K without
 * touching a line of shipped code: the curves are unchanged, only the wall
 * clock they are read against. The ROUTE still commits on real time, which is
 * the point — the swap lands wherever it lands inside the stretched cover.
 */
const SLOW = Number(process.env.SLOW || 8);

fs.mkdirSync(`${OUT}/crossing`, { recursive: true });
const browser = await chromium.launch(LAUNCH);

let failed = 0;
const check = (name, cond, why, extra) => {
  if (cond) console.log(`  ok   ${name}${extra ? ` — ${extra}` : ""}`);
  else {
    failed++;
    console.log(`  FAIL ${name} — ${why}`);
  }
};

/**
 * What the browser thinks each layer is, right now.
 *
 * `getBBox()` is the point of this: it is the box an `objectBoundingBox`
 * gradient actually resolves against, measured by the engine rather than
 * inferred from the path string. Both handles of every segment carry an
 * endpoint's own height, so the curve cannot overshoot its columns — which
 * means a correct cover reports `bbox.y === min(column)`, and a cover that has
 * quietly gone back to the reference's construction reports 0.
 */
const readVeil = (page) =>
  page.evaluate(() => {
    const svg = document.querySelector(".page-veil");
    if (!svg) return null;
    return {
      stage: svg.dataset.veil,
      layers: [...svg.querySelectorAll("path")].map((p) => {
        const d = p.getAttribute("d") || "";
        const b = p.getBBox();
        const out = {
          name: p.getAttribute("class").split(" ").pop(),
          fill: p.getAttribute("fill"),
          empty: d === "",
          y: Number(b.y.toFixed(3)),
          h: Number(b.height.toFixed(3)),
          crest: null,
          closeY: null,
        };
        if (out.empty) return out;
        // `M 0 y₀ C` then six numbers per segment, then `V edge H 0`.
        const t = d.split(" ");
        const ys = [Number(t[2])];
        let i = 4;
        while (t[i] !== "V") {
          ys.push(Number(t[i + 5]));
          i += 6;
        }
        out.crest = Math.min(...ys);
        out.closeY = Number(t[i + 1]);
        return out;
      }),
    };
  });

/** The first link on the page that is a real route change. */
async function firstRouteLink(page) {
  return page.evaluate(() => {
    for (const a of document.querySelectorAll("a[href]")) {
      if (a.dataset.noTransition !== undefined) continue;
      if (a.target && a.target !== "_self") continue;
      let url;
      try {
        url = new URL(a.href, location.href);
      } catch {
        continue;
      }
      if (url.origin !== location.origin) continue;
      if (url.pathname === location.pathname) continue;
      const r = a.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      return { href: url.pathname, x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  });
}

// ── the crossing ────────────────────────────────────────────────────────────
const shots = [];
const trace = [];
{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 860 },
  });
  await context.addInitScript((k) => {
    const raw = Date.now;
    const t0 = raw();
    Date.now = () => t0 + (raw() - t0) / k;
  }, SLOW);

  const page = await context.newPage();
  page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
  await page.goto(`${BASE}/${LOCALE}?fveil=${SEED}&ftier=full`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => !!document.querySelector("h1"), {
    timeout: 60000,
  });
  // Hydration, and the router's own prefetch of what we are about to click.
  await page.waitForTimeout(2500);

  const link = await firstRouteLink(page);
  if (!link) throw new Error("no internal route link found on the homepage");
  console.log(`crossing to ${link.href} (clock ÷${SLOW}, seed ${SEED})`);

  // The crossing is cover + reveal, both stretched, plus whatever the route
  // costs between them. Shooting back to back would empty the burst into the
  // first two seconds and miss the swap entirely, so the frames are spread
  // across the whole of it on a fixed grid. A screenshot costs ~45 ms and the
  // grid is ~250 ms, so the wait absorbs the jitter rather than accumulating.
  const SPAN = SLOW * 2 * 720 + Number(process.env.HOLD || 2600);
  const started = Date.now();
  await page.mouse.click(link.x, link.y);
  for (let i = 0; i < FRAMES; i++) {
    const due = started + (SPAN * i) / (FRAMES - 1);
    const wait = due - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
    const shot = await page.screenshot({ type: "jpeg", quality: 78 });
    // Read the SVG immediately after the frame, so the trace and the picture
    // describe the same moment to within a screenshot.
    const state = await readVeil(page);
    const ms = Date.now() - started;
    const name = `frame-${String(i).padStart(2, "0")}-${String(ms).padStart(5, "0")}ms.jpg`;
    fs.writeFileSync(`${OUT}/crossing/${name}`, shot);
    shots.push({ b64: shot.toString("base64"), ms, state });
    trace.push({ ms, ...state });
  }
  const landed = new URL(page.url()).pathname;
  console.log(
    `→ ${OUT}/crossing/ (${FRAMES} frames over ${shots[shots.length - 1].ms} ms, landed on ${landed})`,
  );
  if (landed !== link.href)
    console.error(
      `  WARNING: expected to land on ${link.href}. The route never committed inside the capture window, so these frames are a cover with no swap and no reveal.`,
    );
  await context.close();
}

// ── the live gate ───────────────────────────────────────────────────────────
// Everything below reads the trace the crossing collected, so it is asserting
// on what the ENGINE measured, not on what the kernel intended.
console.log("\nthe paint, as the browser resolved it");
{
  const covers = trace.filter((f) => f.stage === "cover" && !f.layers[0].empty);
  const reveals = trace.filter((f) => f.stage === "reveal" && !f.layers[0].empty);

  check(
    "the crossing was captured end to end",
    covers.length >= 3 && reveals.length >= 3 && trace.at(-1).stage === "idle",
    `${covers.length} cover frames, ${reveals.length} reveal frames, ending on "${trace.at(-1)?.stage}" — widen SPAN or lower SLOW`,
    `${covers.length} covering, ${reveals.length} revealing, settled to idle`,
  );

  // THE BOX IS THE WAVE. This is the one the first build got wrong.
  const offBox = trace.filter((f) =>
    f.layers.some(
      (l) => !l.empty && Math.abs(l.y - Math.min(l.crest, l.closeY)) > 0.02,
    ),
  );
  check(
    "every layer's box starts where its own paint does",
    offBox.length === 0,
    `${offBox.length} frames where getBBox() disagreed with the path — an objectBoundingBox gradient would be lit somewhere the wave is not`,
    `${trace.length} frames`,
  );

  // The same thing said the other way round, because the failure it guards
  // against is silent: with the reference's construction every one of these
  // frames reports y=0, so the run reads as a full-screen gradient with a hole
  // cut in it rather than as a wave carrying its own light.
  const midFlight = covers.filter((f) => f.layers[0].y > 8 && f.layers[0].y < 92);
  check(
    "and the crest's box was seen partway up the screen, not at the top of it",
    midFlight.length >= 3,
    `only ${midFlight.length} cover frames had the crest's box between y=8 and y=92 — either the gradient is pinned to the viewport, or the burst never sampled the wave in flight`,
    `${midFlight.length} frames, crest box from y=${Math.max(...midFlight.map((f) => f.layers[0].y)).toFixed(0)} to y=${Math.min(...midFlight.map((f) => f.layers[0].y)).toFixed(0)}`,
  );

  // Light first in, black first out — measured, not scheduled.
  const inOrder = covers.every(
    (f) => f.layers[0].y <= f.layers[1].y + 0.02 && f.layers[1].y <= f.layers[2].y + 0.02,
  );
  const outOrder = reveals.every(
    (f) => f.layers[2].h <= f.layers[1].h + 0.02 && f.layers[1].h <= f.layers[0].h + 0.02,
  );
  check("the crest leads the ink going in", inOrder, "a cover frame had the black arriving first");
  check("and the ink lifts first coming out", outOrder, "a reveal frame left the black on screen longest");

  // COVER fills in `objectBoundingBox` so the ramp rides the wave; REVEAL fills
  // in `userSpaceOnUse` so the body drains off a ramp pinned to the viewport
  // instead of re-lighting as it thins. The two agree exactly on a full-screen
  // rectangle, which is the only moment they are ever exchanged — so a path
  // still wearing the other stage's fill is a visible flip mid-transition.
  const running = trace.filter((f) => f.stage === "cover" || f.stage === "reveal");
  const mismatched = running.filter((f) =>
    f.layers.some((l, i) => l.fill !== `url(#zv-${f.stage}-${i})`),
  );
  check(
    "each stage wears its own gradient units",
    mismatched.length === 0,
    `${mismatched.length} of ${running.length} frames kept the other stage's fill (first at ${mismatched[0]?.ms} ms, stage ${mismatched[0]?.stage})`,
    `${running.length} frames`,
  );

  const seam = running.filter((f) => !f.layers[0].empty);

  const full = seam.filter((f) => f.layers.every((l) => l.y < 0.02 && l.h > 99.98));
  check(
    "the screen is fully covered at the swap",
    full.length > 0,
    "no captured frame had all three layers spanning the viewport — the route committed in plain sight, or the burst missed the hold",
    `${full.length} frames at full cover`,
  );

  const idle = trace.filter((f) => f.stage === "idle");
  check(
    "and nothing is left painted afterwards",
    idle.length > 0 && idle.every((f) => f.layers.every((l) => l.empty)),
    "the veil went idle still holding a path",
    `${idle.length} settled frames, all three layers cleared`,
  );
}

// ── the contact sheet ───────────────────────────────────────────────────────
{
  const page = await (await browser.newContext()).newPage();
  await page.setContent(
    `<!doctype html><body style="margin:0;background:#0b0d10;padding:10px;width:max-content">
     <div style="display:grid;grid-template-columns:repeat(6,300px);gap:8px">
     ${shots
       .map(
         (s) =>
           `<div><img src="data:image/jpeg;base64,${s.b64}" style="width:300px;display:block;border:1px solid #16323a"/><div style="font:11px ui-monospace,monospace;color:#00e3fe;padding:3px 0">${s.ms} ms &middot; ${s.state?.stage ?? "?"}${
             s.state && !s.state.layers[0].empty
               ? ` &middot; crest ${s.state.layers[0].y.toFixed(0)} body ${s.state.layers[1].y.toFixed(0)} ink ${s.state.layers[2].y.toFixed(0)}`
               : ""
           }</div></div>`,
       )
       .join("")}
     </div></body>`,
  );
  await page.waitForTimeout(250);
  await page
    .locator("body")
    .screenshot({ path: `${OUT}/sheet.jpg`, type: "jpeg", quality: 82 });
  console.log(`→ ${OUT}/sheet.jpg`);
  await page.context().close();
}

// ── the wash ────────────────────────────────────────────────────────────────
// A back/forward arrives with the page already changed. There is nothing left
// to cover for, and covering would hide exactly what the visitor came back to
// see — so this path gets the crest alone. Two things have to hold, and
// neither is visible in a still: the other two sheets must stay unarmed, and
// the page underneath must stay live (a translucent overlay that eats clicks
// for a second is worse than no transition at all).
{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 860 },
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/${LOCALE}?fveil=${SEED}&ftier=none`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => !!document.querySelector("h1"), {
    timeout: 60000,
  });
  await page.waitForTimeout(2000);

  const link = await firstRouteLink(page);
  await page.mouse.click(link.x, link.y);
  await page.waitForFunction(
    (href) =>
      location.pathname === href &&
      document.querySelector(".page-veil")?.dataset.veil === "idle",
    link.href,
    { timeout: 30000 },
  );

  console.log("\nthe wash — a back/forward nobody covered for");
  await page.goBack();
  const seen = [];
  for (let i = 0; i < 60; i++) {
    const s = await readVeil(page);
    if (s) seen.push({ ...s, pe: await page.evaluate(() => getComputedStyle(document.querySelector(".page-veil")).pointerEvents) });
    await page.waitForTimeout(110);
  }

  const washing = seen.filter((s) => s.stage === "wash" && !s.layers[0].empty);
  check(
    "a back/forward gets the wash, not a cover",
    washing.length > 0 && !seen.some((s) => s.stage === "cover" || s.stage === "reveal"),
    `stages seen: ${[...new Set(seen.map((s) => s.stage))].join(", ")} — a blackout here hides the page the visitor navigated back to`,
    `${washing.length} washing frames`,
  );
  check(
    "and only the crest is armed",
    washing.every((s) => s.layers[1].empty && s.layers[2].empty),
    "the body or the ink painted during a wash",
  );
  check(
    "so the page under it stays live",
    seen.every((s) => s.pe === "none"),
    "the wash took the pointer, which blocks a page it is not hiding",
    "pointer-events stayed none throughout",
  );
  check(
    "and it settles",
    seen.at(-1)?.stage === "idle" && seen.at(-1).layers.every((l) => l.empty),
    `left on "${seen.at(-1)?.stage}" still holding a path`,
  );
  await context.close();
}

// ── the fallback ────────────────────────────────────────────────────────────
// Reduced motion gets no curtain at all: the component does not render, the
// provider does not intercept, and `<Link>` routes exactly as it always has.
// The still proves the arrival is a finished page and not a stalled veil.
{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 860 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/${LOCALE}?fveil=${SEED}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => !!document.querySelector("h1"), {
    timeout: 60000,
  });
  await page.waitForTimeout(1500);
  const link = await firstRouteLink(page);
  if (link) {
    await page.mouse.click(link.x, link.y);
    await page.waitForTimeout(2500);
  }
  const present = await page.evaluate(
    () => document.querySelectorAll(".page-veil").length,
  );
  const landed = new URL(page.url()).pathname;
  await page.screenshot({ path: `${OUT}/reduced.png` });
  console.log(`\n→ ${OUT}/reduced.png`);
  check(
    "reduced motion renders no curtain at all",
    present === 0,
    `${present} .page-veil elements are in the document`,
    "nothing to animate, nothing to stall",
  );
  check(
    "and still routes",
    !link || landed === link.href,
    `clicking ${link?.href} left the visitor on ${landed} — the provider swallowed the click without a transition to play`,
    `landed on ${landed}`,
  );
  await context.close();
}

await browser.close();
console.log(
  failed === 0
    ? "\nVEIL PAINT OK — the box rides the wave, the stack is ordered, the swap is hidden.\n"
    : `\n${failed} FAILED\n`,
);
process.exit(failed === 0 ? 0 : 1);
