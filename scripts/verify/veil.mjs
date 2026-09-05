// The VEIL gate — the route transition's geometry, in plain node.
//
// The kernel is DOM-free and seeded for exactly this reason: everything that
// can actually break this transition is a number, and a screenshot cannot see
// any of it. A curtain looks correct in a still at every phase it is wrong in.
//
//   THE SEAM      the route swap happens between a finished `cover` and a
//                 starting `reveal`. Those two are described by DIFFERENT path
//                 formulas closing onto opposite edges, and the only thing
//                 making the swap invisible is that both formulas describe the
//                 identical full-screen rectangle at that instant. One
//                 percentage point of daylight there is one frame of the
//                 outgoing route showing through the middle of its transition.
//   MONOTONE      coverage only ever grows on the way in and shrinks on the way
//                 out. A wave that backs up is not a wave.
//   THE STACK     crest leads on the way in and trails on the way out. Get the
//                 stagger sign wrong and the black arrives first, which is the
//                 same transition with all of the beauty removed.
//   OPAQUE INK    the sheet the swap hides behind must be opaque at every stop.
//                 That contract lives in CSS, so this reads the CSS.
//
// Plus the things that make it usable rather than merely correct: a wave that
// is actually wavy, a tempo inside the site's own duration ladder, a `d` small
// enough to write every frame, and clamped, idempotent seeking.
//
//   node scripts/verify/veil.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VEIL, VEIL_CEILING, makeVeil } from "../../lib/motion/veil.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

let failed = 0;
const pass = (name, extra = "") =>
  console.log(`  ok   ${name}${extra ? ` — ${extra}` : ""}`);
const fail = (name, why) => {
  failed++;
  console.log(`  FAIL ${name} — ${why}`);
};
const check = (name, cond, why, extra) =>
  cond ? pass(name, extra) : fail(name, why);

const STEP = 100 / (VEIL.N - 1);

/**
 * Parse an emitted `d` back into geometry.
 *
 * Deliberately strict and deliberately not a regex: this is the gate's only
 * window onto what the browser will actually be handed, so it re-derives every
 * column and every control point from the string rather than trusting the
 * kernel's own state.
 */
function parse(d) {
  const t = d.trim().split(/\s+/);
  let i = 0;
  const num = () => {
    const v = Number(t[i++]);
    if (!Number.isFinite(v)) throw new Error(`not a number at token ${i - 1}`);
    return v;
  };
  const word = (w) => {
    if (t[i++] !== w) throw new Error(`expected ${w} at token ${i - 1}`);
  };

  word("M");
  if (num() !== 0) throw new Error("the path must start on the left edge");
  const y0 = num();
  word("C");

  const cols = [y0];
  const ctrl = [];
  for (let j = 0; j < VEIL.N - 1; j++) {
    const c1x = num();
    const c1y = num();
    const c2x = num();
    const c2y = num();
    const x = num();
    const y = num();
    ctrl.push({ c1x, c1y, c2x, c2y, x, y, from: cols[cols.length - 1] });
    cols.push(y);
  }

  word("V");
  const closeY = num();
  word("H");
  if (num() !== 0) throw new Error("the path must close on the left edge");
  if (i !== t.length) throw new Error(`${t.length - i} trailing tokens`);

  // Both formulas open identically (`M 0 y₀ C …`) — see the deviation note in
  // veil.mjs — so the closing edge is what says which side the paint is on.
  if (closeY !== 100 && closeY !== 0)
    throw new Error(`the paint must close onto an edge, not onto y=${closeY}`);
  return { mode: closeY === 100 ? "cover" : "reveal", cols, ctrl, closeY };
}

/** ∫ y dx over the full width, ÷ 100 — the wave's mean height in viewBox
 *  units. The cubic's x is not linear in t (both handles sit on the segment's
 *  midpoint), so this integrates against dx/dt rather than sampling x evenly
 *  and hoping. */
function meanHeight(cols) {
  const SUB = 400;
  let area = 0;
  for (let j = 0; j < cols.length - 1; j++) {
    const x0 = j * STEP;
    const x3 = (j + 1) * STEP;
    const cx = x3 - STEP / 2;
    const y0 = cols[j];
    const y3 = cols[j + 1];
    for (let k = 0; k < SUB; k++) {
      const t = (k + 0.5) / SUB;
      const mt = 1 - t;
      // y(t) with both handles at the endpoint heights — a smoothstep.
      const y = y0 * (mt * mt * mt + 3 * mt * mt * t) + y3 * (3 * mt * t * t + t * t * t);
      const dx = 3 * mt * mt * (cx - x0) + 3 * t * t * (x3 - cx);
      area += (y * dx) / SUB;
    }
  }
  return area / 100;
}

/** How much of the viewport this layer is painting over, 0..1.
 *  Quadrature, so it carries ~1.6e-6 of midpoint error on a flat wave — near
 *  enough for every ordering and monotonicity question below, and deliberately
 *  NOT what the seam is tested with. See `bandOf`. */
function coverage(d) {
  if (d === "") return 0;
  const { mode, cols } = parse(d);
  const mean = meanHeight(cols);
  return mode === "cover" ? (100 - mean) / 100 : mean / 100;
}

/** The exact painted band of a FLAT wave, [lo, hi] in viewBox units.
 *  The seam is an identity, not an approximation: at the swap both formulas
 *  are supposed to describe one rectangle, so it is tested by comparing the
 *  rectangles rather than two numerical integrals of them. */
function bandOf(d) {
  const { cols, closeY } = parse(d);
  return {
    flat: cols.every((y) => y === cols[0]),
    lo: Math.min(cols[0], closeY),
    hi: Math.max(cols[0], closeY),
  };
}

// ── 1. tempo ────────────────────────────────────────────────────────────────
console.log("\n1. tempo — the site's own duration ladder");
{
  check(
    "one column travels for --dur-short",
    Math.abs(VEIL.DUR - 0.4) < 1e-9,
    `DUR=${VEIL.DUR}s, --dur-short is 0.4s`,
    `${VEIL.DUR}s`,
  );
  check(
    "the whole wave lands inside --dur-medium",
    VEIL_CEILING <= 0.7 + 1e-9 + 0.02,
    `ceiling ${VEIL_CEILING.toFixed(3)}s is past 0.72s — a curtain this slow is a loading screen`,
    `${VEIL_CEILING.toFixed(3)}s worst case`,
  );

  const v = makeVeil();
  let min = Infinity;
  let max = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const total = v.arm("cover", seed);
    if (total < min) min = total;
    if (total > max) max = total;
  }
  check(
    "every run is inside the ceiling",
    max <= VEIL_CEILING + 1e-9,
    `a run reached ${max.toFixed(4)}s against a ${VEIL_CEILING.toFixed(4)}s ceiling`,
    `${min.toFixed(3)}–${max.toFixed(3)}s over 400 seeds`,
  );
}

// ── 2. the path ─────────────────────────────────────────────────────────────
console.log("\n2. the path — the reference's construction, re-derived");
{
  const v = makeVeil();
  const total = v.arm("cover", 12345);
  v.seek(total * 0.42);

  let structural = null;
  let tangents = 0;
  let handles = 0;
  let ends = 0;
  let joins = 0;
  try {
    const { ctrl, cols } = parse(v.path(0));
    for (let j = 0; j < ctrl.length; j++) {
      const c = ctrl[j];
      const cx = (j + 1) * STEP - STEP / 2;
      if (Math.abs(c.c1x - cx) < 5e-4 && Math.abs(c.c2x - cx) < 5e-4) handles++;
      // Both handles carry an endpoint's own height, so the curve leaves and
      // arrives horizontal: a crest with no corners at any phase of the run.
      if (Math.abs(c.c1y - c.from) < 5e-4 && Math.abs(c.c2y - c.y) < 5e-4)
        tangents++;
      if (Math.abs(c.x - (j + 1) * STEP) < 5e-4) ends++;
      if (Math.abs(cols[j + 1] - c.y) < 5e-4) joins++;
    }
  } catch (e) {
    structural = e.message;
  }

  check("it parses as a well-formed veil path", structural === null, structural ?? "");
  check(
    "every segment spans one column",
    ends === VEIL.N - 1,
    `${VEIL.N - 1 - ends} of ${VEIL.N - 1} segments do not land on their column`,
    `${VEIL.N - 1} segments over ${VEIL.N} columns`,
  );
  check(
    "both handles sit on the segment's midpoint",
    handles === VEIL.N - 1,
    `${VEIL.N - 1 - handles} segments have handles off the midpoint`,
  );
  check(
    "the crest has horizontal tangents at every column",
    tangents === VEIL.N - 1,
    `${VEIL.N - 1 - tangents} segments would put a corner in the wave`,
  );
  check("the curve is continuous", joins === VEIL.N - 1, "a segment starts where the last one did not end");

  // THE PAINT DEPENDS ON THIS. `PageVeil.tsx` fills the cover in
  // `objectBoundingBox`, so the gradient spans whatever box the path reports —
  // which is the wave's own extent only while the path does not touch an edge
  // it has not reached. The reference's `M 0 0 V y₀` prefix encloses no area
  // and pinned that box to the top of the viewport for the whole run; the
  // first capture of this transition was three dark humps rising under a bright
  // band that had nothing to do with them. Both handles of every segment carry
  // an endpoint's own height (asserted above), so the curve cannot overshoot
  // its columns and the box top IS the crest.
  {
    let pinned = 0;
    let samples = 0;
    let earlyTop = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const t = v.arm("cover", seed);
      for (let k = 1; k <= 11; k++) {
        v.seek((t * k) / 12);
        const { cols, closeY } = parse(v.path(0));
        const top = Math.min(closeY, ...cols);
        if (top !== Math.min(...cols)) pinned++;
        samples++;
      }
      // A quarter of the way in, no column can have arrived yet (a column
      // needs DUR on its own, and DUR is over half the run), so the box top
      // has to still be a long way down the screen.
      v.seek(t * 0.25);
      earlyTop = Math.max(earlyTop, Math.min(...parse(v.path(0)).cols));
    }
    check(
      "the cover's box tracks the crest instead of the viewport",
      pinned === 0,
      `${pinned} of ${samples} sampled frames reported a box starting somewhere the wave is not — the gradient's lit stop would leave the crest`,
      `${samples} frames across 40 seeds`,
    );
    check(
      "so a quarter of the way in, the lit stop is still low on the screen",
      earlyTop > 55,
      `the highest crest at 25% was already at y=${earlyTop.toFixed(1)}`,
      `crest no higher than y=${earlyTop.toFixed(1)} at 25%`,
    );
  }

  const sizes = [];
  for (let seed = 1; seed <= 60; seed++) {
    const t = v.arm("cover", seed);
    for (let k = 0; k <= 8; k++) {
      v.seek((t * k) / 8);
      sizes.push(v.path(0).length);
    }
  }
  const worst = Math.max(...sizes);
  check(
    "`d` stays cheap enough to write every frame",
    worst <= 700,
    `${worst} bytes — the reference's un-rounded build is ~1.6 kB and this is written 3× per frame`,
    `${worst} bytes worst case, ${Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length)} typical`,
  );
}

// ── 3. the seam ─────────────────────────────────────────────────────────────
console.log("\n3. the seam — where the route is allowed to change");
{
  const v = makeVeil();
  const coverTotal = v.arm("cover", 4242);
  v.seek(coverTotal);
  const endCover = [0, 1, 2].map((i) => v.path(i));
  const endArea = endCover.map(coverage);

  // A DIFFERENT seed on purpose: the run that leaves is not the run that
  // arrived, and the seam has to hold across two unrelated waves — which it
  // does, because both of them are flat at the instant of the swap.
  v.arm("reveal", 4243);
  v.seek(0);
  const startReveal = [0, 1, 2].map((i) => v.path(i));
  const startArea = startReveal.map(coverage);

  const endBand = endCover.map(bandOf);
  const startBand = startReveal.map(bandOf);

  check(
    "cover finishes on a full screen",
    endArea.every((a) => a > 1 - 1e-5),
    `layer coverage ${endArea.map((a) => a.toFixed(6)).join(", ")}`,
    "every layer at 100%",
  );
  check(
    "reveal starts on a full screen",
    startArea.every((a) => a > 1 - 1e-5),
    `layer coverage ${startArea.map((a) => a.toFixed(6)).join(", ")}`,
    "every layer at 100%",
  );
  check(
    "both are a flat edge, not a wave that happens to average out",
    [...endBand, ...startBand].every((b) => b.flat),
    "a column is left short, so the two rectangles differ column by column",
  );
  check(
    "the two describe the same rectangle, exactly",
    endBand.every(
      (b, i) =>
        b.lo === 0 &&
        b.hi === 100 &&
        b.lo === startBand[i].lo &&
        b.hi === startBand[i].hi,
    ),
    `cover ends on ${endBand.map((b) => `[${b.lo},${b.hi}]`).join(" ")} and reveal starts on ${startBand.map((b) => `[${b.lo},${b.hi}]`).join(" ")} — the flip between the fill formulas would be visible`,
    "no daylight at the swap",
  );
  check(
    "and they close onto opposite edges",
    endCover.every((d) => d.endsWith("V 100 H 0")) &&
      startReveal.every((d) => d.endsWith("V 0 H 0")),
    "the paint is hanging off the wrong edge for its direction",
  );

  // The whole point of the seam: the kernel says so itself, and only for a
  // full stack. A finished `wash` half must not claim the page is hidden.
  const w = makeVeil();
  w.seek(w.arm("cover", 5, 1));
  check(
    "a finished wash never reports the page as covered",
    w.covered === false,
    "the crest alone would be treated as a blackout, and a route would swap in plain sight",
  );
  const full = makeVeil();
  full.seek(full.arm("cover", 5));
  check("a finished full cover does", full.covered === true, "the reveal would never be scheduled");
}

// ── 4. the current ──────────────────────────────────────────────────────────
console.log("\n4. the current — one direction, and it is wavy");
{
  const v = makeVeil();
  const FRAMES = 90;

  let regressions = 0;
  let worstRegression = 0;
  for (const mode of ["cover", "reveal"]) {
    for (let seed = 1; seed <= 40; seed++) {
      const total = v.arm(mode, seed);
      let prev = mode === "cover" ? -1 : 2;
      for (let k = 0; k <= FRAMES; k++) {
        v.seek((total * k) / FRAMES);
        const a = coverage(v.path(2));
        const delta = mode === "cover" ? a - prev : prev - a;
        if (delta < -1e-9) {
          regressions++;
          worstRegression = Math.min(worstRegression, delta);
        }
        prev = a;
      }
    }
  }
  check(
    "coverage is monotone in both directions",
    regressions === 0,
    `${regressions} frames run backwards, worst ${worstRegression.toFixed(6)}`,
    "80 runs × 91 frames",
  );

  // The wave IS the column jitter. With no spread this is a horizontal blind
  // with a gradient on it, which is the one outcome the port exists to avoid.
  let minSpread = Infinity;
  let maxSpread = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const total = v.arm("cover", seed);
    let spread = 0;
    for (let k = 1; k < FRAMES; k++) {
      v.seek((total * k) / FRAMES);
      let lo = Infinity;
      let hi = -Infinity;
      for (let j = 0; j < VEIL.N; j++) {
        const y = v.columnY(0, j);
        if (y < lo) lo = y;
        if (y > hi) hi = y;
      }
      spread = Math.max(spread, hi - lo);
    }
    minSpread = Math.min(minSpread, spread);
    maxSpread = Math.max(maxSpread, spread);
  }
  check(
    "the crest is never a straight edge",
    minSpread > 18,
    `the flattest seed only ever opened ${minSpread.toFixed(1)}% of the viewport between its highest and lowest column`,
    `${minSpread.toFixed(1)}–${maxSpread.toFixed(1)}% of viewport height across 200 seeds`,
  );
  check(
    "and never a curtain torn in half",
    maxSpread < 92,
    `${maxSpread.toFixed(1)}% — one column is most of a viewport ahead of another`,
  );
}

// ── 5. the stack ────────────────────────────────────────────────────────────
console.log("\n5. the stack — light first in, black first out");
{
  const v = makeVeil();
  const FRAMES = 60;

  let inOrder = 0;
  let outOrder = 0;
  let frames = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const cover = v.arm("cover", seed);
    for (let k = 1; k < FRAMES; k++) {
      v.seek((cover * k) / FRAMES);
      const [a, b, c] = [0, 1, 2].map((i) => coverage(v.path(i)));
      if (a >= b - 1e-9 && b >= c - 1e-9) inOrder++;
      frames++;
    }
    const reveal = v.arm("reveal", seed);
    for (let k = 1; k < FRAMES; k++) {
      v.seek((reveal * k) / FRAMES);
      const [a, b, c] = [0, 1, 2].map((i) => coverage(v.path(i)));
      if (a >= b - 1e-9 && b >= c - 1e-9) outOrder++;
    }
  }
  check(
    "the crest leads the body and the body leads the ink, going in",
    inOrder === frames,
    `${frames - inOrder} of ${frames} frames had the black arriving early`,
    `${frames} frames`,
  );
  check(
    "and the ink lifts first, coming out",
    outOrder === frames,
    `${frames - outOrder} of ${frames} frames left the black on screen longest`,
    `${frames} frames`,
  );

  // The stagger has to be worth having: at some point in the run the sheets
  // must be visibly apart, or three layers are one layer painted three times.
  const cover = v.arm("cover", 77);
  let widest = 0;
  for (let k = 1; k < FRAMES; k++) {
    v.seek((cover * k) / FRAMES);
    widest = Math.max(widest, coverage(v.path(0)) - coverage(v.path(2)));
  }
  check(
    "the sheets are legibly apart mid-crossing",
    widest > 0.12,
    `the crest never got more than ${(widest * 100).toFixed(1)}% of the viewport ahead of the ink`,
    `crest leads ink by up to ${(widest * 100).toFixed(1)}% of the viewport`,
  );
}

// ── 6. the wash ─────────────────────────────────────────────────────────────
console.log("\n6. the wash — the arrival nobody covered for");
{
  const v = makeVeil();
  const total = v.arm("cover", 31, 1);
  v.seek(total * 0.5);
  check(
    "only the crest is armed",
    v.path(0) !== "" && v.path(1) === "" && v.path(2) === "",
    "a back/forward would black out a page the visitor is already looking at",
    "layers 1 and 2 hold an empty `d`",
  );
  check(
    "and it is quicker than a full crossing",
    total < VEIL_CEILING,
    `${total.toFixed(3)}s against a ${VEIL_CEILING.toFixed(3)}s full stack`,
    `${total.toFixed(3)}s per half`,
  );
}

// ── 7. seeking ──────────────────────────────────────────────────────────────
console.log("\n7. seeking — clamped, idempotent, exact at the ends");
{
  const v = makeVeil();
  const total = v.arm("cover", 909);

  v.seek(-5);
  const before = v.path(0);
  v.seek(0);
  check("time before zero is time zero", v.path(0) === before, "the run starts somewhere else when seeked negative");

  v.seek(total + 5);
  const past = v.path(0);
  v.seek(total);
  check("time past the end is the end", v.path(0) === past, "the run keeps moving after it is over");

  check(
    "the end is exact",
    [0, 1, 2].every((i) =>
      Array.from({ length: VEIL.N }, (_, j) => v.columnY(i, j)).every((y) => y === 0),
    ),
    "a column is left short of the top, so the curtain never quite closes",
  );

  v.seek(total * 0.3);
  check("re-seeking the same time is a no-op", v.seek(total * 0.3) === false, "the DOM would be rewritten on a repeated frame");
  check("moving is not", v.seek(total * 0.31) === true, "a real move reported nothing to redraw");
}

// ── 8. determinism ──────────────────────────────────────────────────────────
console.log("\n8. determinism — the same seed is the same wave");
{
  const a = makeVeil();
  const b = makeVeil();
  const ta = a.arm("cover", 20260905);
  const tb = b.arm("cover", 20260905);
  let same = true;
  for (let k = 0; k <= 30; k++) {
    a.seek((ta * k) / 30);
    b.seek((tb * k) / 30);
    for (let i = 0; i < VEIL.LAYERS; i++) same = same && a.path(i) === b.path(i);
  }
  check("two veils on one seed agree byte for byte", ta === tb && same, "`?fveil` would not reproduce a capture");

  const c = makeVeil();
  c.arm("cover", 20260906);
  c.seek(0.2);
  a.seek(0.2);
  check(
    "a different seed is a different wave",
    c.path(0) !== a.path(0),
    "every navigation in a session would draw the identical crest",
  );
}

// ── 9. the paint ────────────────────────────────────────────────────────────
console.log("\n9. the paint — only the ink is load-bearing");
{
  const css = fs.readFileSync(path.join(ROOT, "app", "globals.css"), "utf8");
  const stopsOf = (layer) => {
    const found = [];
    const re = new RegExp(
      `\\.page-veil \\.zv-${layer} \\.zv-s(\\d)\\s*\\{([^}]*)\\}`,
      "g",
    );
    let m;
    while ((m = re.exec(css)) !== null) {
      const opacity = /stop-opacity:\s*([\d.]+)/.exec(m[2]);
      found.push({
        index: Number(m[1]),
        opacity: opacity ? Number(opacity[1]) : 1,
        color: /stop-color:\s*([^;]+);/.exec(m[2])?.[1]?.trim() ?? null,
      });
    }
    return found;
  };

  const crest = stopsOf("crest");
  const body = stopsOf("body");
  const ink = stopsOf("ink");

  check(
    "every sheet declares a full ramp",
    [crest, body, ink].every((s) => s.length === 4),
    `crest ${crest.length}, body ${body.length}, ink ${ink.length} stops — the component renders 4 each`,
    "4 stops each",
  );
  check(
    "the ink is opaque at every stop",
    ink.length === 4 && ink.every((s) => s.opacity === 1),
    `stop-opacity ${ink.map((s) => s.opacity).join(", ")} — anything under 1 puts the outgoing route on screen during the swap`,
  );
  check(
    "the crest hides nothing",
    crest.length === 4 && crest.every((s) => s.opacity < 1),
    `stop-opacity ${crest.map((s) => s.opacity).join(", ")} — an opaque crest turns a back/forward wash into a blackout`,
    `peaks at ${Math.max(...crest.map((s) => s.opacity))}`,
  );
  check(
    "the ramp is lit at its leading edge and deepens away from it",
    crest[0]?.opacity > crest[3]?.opacity && body[0]?.opacity < body[3]?.opacity,
    "the light is not on the crest, which is the whole optical story",
  );
  check(
    "and it is cyan on black, like everything else",
    [...crest, ...body, ...ink].every(
      (s) => s.color !== null && /--color-(cyan|ink|surface)/.test(s.color),
    ),
    "a stop is painted with something that is not in the palette",
    "every stop resolves through a palette token",
  );
}

console.log(
  failed === 0
    ? "\nVEIL OK — seam tight, current one-way, stack ordered, ink opaque.\n"
    : `\n${failed} FAILED\n`,
);
process.exit(failed === 0 ? 0 : 1);
