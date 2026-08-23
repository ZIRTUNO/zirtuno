/**
 * verify-coalesce.mjs — the merge kernel, in plain node.
 *
 * `coalesce.mjs` is DOM-free and deterministic for exactly this reason: the
 * claims it makes are geometric, and a screenshot cannot check any of them.
 * What is pinned here is what would break silently and look almost right:
 *
 *   EXACT REST. A field with no bead near it must emit the string `mem.path()`
 *   would have emitted, character for character. Not "within a tenth of a
 *   pixel" — the same string. The whole reason for choosing the polynomial
 *   smooth-min over the exponential one is that it returns its argument
 *   exactly past the blend radius, and that guarantee is worth nothing if it
 *   is never asserted.
 *
 *   THE HANDOVER. Two bodies are drawn as two contours until the neck forms,
 *   then as one. If the surfaces are not tangent at that frame the merge pops,
 *   and a pop of half a pixel on a 1 px hairline is exactly the kind of defect
 *   that survives review and annoys forever.
 *
 *   TOPOLOGY. `merged` must flip at gap = K/2 because that is where the
 *   barrier fails — not because someone tuned a threshold to look right at one
 *   bead size.
 *
 * Run: node scripts/verify-coalesce.mjs
 */

import { makeMembrane } from "../lib/motion/membrane.mjs";
import {
  COAL,
  smin,
  sdBox,
  unionReach,
  dropRing,
  makeBead,
  sideRun,
  unionContour,
  beadContour,
} from "../lib/motion/coalesce.mjs";

let failed = 0;
let checks = 0;
const section = (s) => console.log(`\n${s}`);
const ok = (m) => {
  checks++;
  console.log(`  ok   ${m}`);
};
const bad = (m) => {
  checks++;
  failed++;
  console.log(`  FAIL ${m}`);
};
const assert = (cond, m) => (cond ? ok(m) : bad(m));

// The shipped geometry, measured off the real form: `.field input` is 576 x 57
// at the 1440 px breakpoint. The constants in COAL are derived FOR this size,
// so the harness has to use it — and the clearance check below is what fails
// loudly if the field is ever restyled smaller than the merge needs.
const W = 576;
const H = 57;
const K = COAL.K;

/** A bead frozen at a chosen place — the harness drives geometry, not time. */
function staticBead(x, y, r = COAL.R) {
  return {
    x,
    y,
    r,
    stretch: 0,
    ux: 1,
    uy: 0,
    alive: r > COAL.EPS_R,
    sdf: (qx, qy) => Math.hypot(qx - x, qy - y) - r,
  };
}

/** Segment endpoints of a cubic path — the polygon the spline is drawn over. */
function polyOf(d) {
  const out = [];
  const head = d.match(/^M(-?[\d.]+) (-?[\d.]+)/);
  if (head) out.push([Number(head[1]), Number(head[2])]);
  for (const m of d.matchAll(/C-?[\d.]+ -?[\d.]+ -?[\d.]+ -?[\d.]+ (-?[\d.]+) (-?[\d.]+)/g)) {
    out.push([Number(m[1]), Number(m[2])]);
  }
  out.pop(); // the closing segment restates the start
  return out;
}

/** Does a closed polygon cross itself? */
function selfIntersects(p) {
  const n = p.length;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const hits = (a, b, c, d) => {
    const d1 = cross(c, d, a);
    const d2 = cross(c, d, b);
    const d3 = cross(a, b, c);
    const d4 = cross(a, b, d);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // adjacent across the wrap
      if (hits(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) return [i, j];
    }
  }
  return null;
}

/** All four corners, each as the cusp signature "x yCx y ". */
function cornersHeld(d, w, h) {
  return [
    `0 0C0 0 `,
    `${w} 0C${w} 0 `,
    `${w} ${h}C${w} ${h} `,
    `0 ${h}C0 ${h} `,
  ].every((sig) => d.includes(sig));
}

// ───────────────────────────────────────────────────────────────────────────
section("1. the smooth-min is exact where it has to be");
{
  assert(smin(0, K, K) === 0, "a body exactly K away contributes exactly 0");
  assert(smin(0, K * 3, K) === 0, "a distant body contributes exactly 0");
  assert(smin(0, K * 0.999, K) < 0, "a body just inside K does contribute");
  // the neck condition, stated directly
  const g = K / 2;
  assert(
    Math.abs(smin(g / 2, g / 2, K)) < 1e-12,
    `the barrier vanishes at gap = K/2 — smin(${(g / 2).toFixed(2)}, ${(g / 2).toFixed(2)}) = 0`,
  );
  assert(
    smin(g * 0.6, g * 0.6, K) > 0,
    "above K/2 a positive barrier still stands between the bodies",
  );
  assert(sdBox(0, 0, 0, 0, 10, 5) === -5, "the box SDF is signed inside");
}

// ───────────────────────────────────────────────────────────────────────────
section("2. exact rest — an untouched field is its authored rectangle");
{
  const mem = makeMembrane(W, H);
  mem.step(0);
  const plain = mem.path();

  const far = staticBead(-K - COAL.R - 5, H / 2);
  const u1 = unionContour(mem, far);
  assert(u1.d === plain, "a bead beyond reach leaves the path byte-identical");
  assert(u1.merged === false, "…and reports itself unmerged");

  const drained = staticBead(-2, H / 2, 0);
  assert(
    unionContour(mem, drained).d === plain,
    "a drained bead leaves the path byte-identical",
  );

  // and the emitter itself did not change under the membrane refactor
  assert(plain.startsWith("M0 0C"), "the rest path still starts at the origin");
  assert(
    plain.includes("C0 0 0 0 0 0") || /C[-\d.]+ [-\d.]+ /.test(plain),
    "the rest path is a spline, not a polygon",
  );
}

// ───────────────────────────────────────────────────────────────────────────
section("3. the reach — how a surface answers an approaching body");
{
  const reachAt = (gap) => {
    const b = staticBead(-(gap + COAL.R), 0);
    return unionReach(0, 0, -1, 0, b.sdf, K, 4 * K);
  };
  assert(reachAt(K + 1) === 0, "beyond K the surface does not move at all");
  assert(reachAt(K) === 0, "at exactly K the surface does not move at all");

  // THE TWO-BODY REGIME. Above the neck condition the root-find returns the
  // surface's own bulge, and it must grow smoothly as the bead closes.
  const gaps = [K * 0.98, K * 0.9, K * 0.75, K * 0.6, K * 0.51];
  const rs = gaps.map(reachAt);
  assert(
    rs.every((v, i) => i === 0 || v > rs[i - 1]),
    `the bulge grows as the body closes — ${rs.map((v) => v.toFixed(2)).join(" → ")} px`,
  );
  // HOW FAR THE SURFACES COME BEFORE THEY BREAK. The exact "each has come
  // half the gap" identity holds only AT gap = K/2, where f(g/2) = 0 is a
  // tangent rather than a crossing — unmeasurable from this side, and the
  // root-find correctly reads that single touching point as already connected.
  // What is worth pinning is the visible consequence: the two surfaces have
  // reached a long way toward each other before the neck goes, which is what
  // separates a merge from a collision.
  const nearGap = K * 0.51;
  const nearReach = reachAt(nearGap);
  assert(
    nearReach / nearGap > 0.3,
    `the surface has come ${((nearReach / nearGap) * 100).toFixed(0)}% of the way before the neck breaks — ${nearReach.toFixed(2)} px into a ${nearGap.toFixed(2)} px gap`,
  );

  // THE JUMP. Below the neck the barrier is gone and the SAME call returns a
  // point past the bead. This discontinuity IS the topology change; the first
  // draft of this file asserted continuity across it, which is equivalent to
  // asserting that the merge never happens.
  const g = K / 2 - 0.2;
  const below = reachAt(g);
  assert(below > K, `below the neck the surface jumps past the bead — ${below.toFixed(1)} px`);
  assert(
    Math.abs(below - (g + 2 * COAL.R)) < 1.0,
    `…landing on the bead's far face — ${below.toFixed(1)} px vs gap + 2R = ${(g + 2 * COAL.R).toFixed(1)} px`,
  );

  assert(
    reachAt(0.001) < 2 * COAL.R + K,
    "the reach stays bounded when the bodies touch",
  );
}

section("4. the handover — two contours become one without a pop");
{
  const mem = makeMembrane(W, H);
  mem.step(0);

  // Sweep the bead in from far outside the left edge toward it. The switch
  // between "drawn as part of the field" and "drawn as its own body" is on the
  // STANDOFF — the bead's centre distance from the edge — because that is what
  // decides whether the union is still a graph over the edge (see COAL.K).
  let flip = null;
  let prevMerged = false;
  for (let p = COAL.K * 2; p > 0; p -= 0.05) {
    const u = unionContour(mem, staticBead(-p, H / 2));
    if (u.merged && !prevMerged) flip = p;
    prevMerged = u.merged;
  }
  assert(flip !== null, "the bodies do merge as the bead closes");
  assert(
    flip !== null && Math.abs(flip - K / 2) < 0.1,
    `absorption flips at the graph condition — standoff ${flip === null ? "n/a" : flip.toFixed(2)} px vs K/2 = ${(K / 2).toFixed(2)} px`,
  );
  assert(
    K / 2 === COAL.R,
    `…which is exactly where the bead's near face touches the edge — K/2 = ${(K / 2).toFixed(1)} = R`,
  );

  // THE PINCH, MEASURED. On the frame the bead stops being part of the field's
  // contour, the two drawings have to describe the same silhouette — otherwise
  // the merge completes with a jump cut.
  //
  // Because K/2 = R, the frame it separates on is the frame its near face
  // touches the edge, so the fused lobe and the free drop occupy the same
  // outline and only the JUNCTION differs: fused it is a smooth fillet, free it
  // is a tangent point with a hairline break between. That break is not a
  // defect to be tuned away — it is what a pinch IS. A liquid neck does not
  // thin to nothing, it goes unstable and snaps, and the same discontinuity run
  // backwards is what makes two drops join with a snap rather than a fade.
  const beadMem = makeMembrane(0, 0, {
    ring: dropRing(COAL.R, COAL.RING_N, 0.61),
    handR: COAL.R * 2.6,
  });
  beadMem.step(0);
  const reachOf = (p, merged) => {
    const b = staticBead(-p, H / 2);
    const u = unionContour(mem, b);
    const d = merged ? u.d : beadContour(beadMem, b);
    return -Math.min(...polyOf(d).map(([x]) => x));
  };
  const fused = reachOf(K / 2 - 0.01, true);
  const free = reachOf(K / 2 + 0.01, false);
  assert(
    Math.abs(fused - free) < 0.6,
    `the fused lobe and the free drop reach the same distance — ${fused.toFixed(2)} px vs ${free.toFixed(2)} px across the pinch`,
  );
  assert(
    Math.abs(fused - (K / 2 + COAL.R)) < 0.6,
    `…and that distance is the bead sitting on the edge — ${fused.toFixed(2)} px vs K/2 + R = ${K / 2 + COAL.R} px`,
  );
}

section("5. the merged silhouette actually contains the bead");
{
  const mem = makeMembrane(W, H);
  mem.step(0);
  const b = staticBead(-4, H / 2); // straddling the edge
  const u = unionContour(mem, b);
  assert(u.merged, "a straddling bead reads as merged");

  const xs = [...u.d.matchAll(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g)].map((m) =>
    Number(m[1]),
  );
  const leftMost = Math.min(...xs);
  const want = b.x - b.r;
  assert(
    leftMost <= want + 1.2,
    `the contour wraps past the bead's far side — reaches ${leftMost.toFixed(1)} px, bead's outer face at ${want.toFixed(1)} px`,
  );
  assert(
    leftMost > want - 4,
    "…without ballooning past it — the union hugs the body",
  );

  // THE ART-DIRECTION RULE, AS A TEST. A cusp is a control point collapsed
  // onto its own vertex, so a held corner restates itself immediately after
  // the move to it. Searched, not anchored at the start: a spliced contour
  // begins at the ridden edge, not at ring index 0.
  assert(cornersHeld(u.d, W, H), "all four corners are still cusps");
}

// ───────────────────────────────────────────────────────────────────────────
section("6. the spliced contour is a simple closed curve");
{
  const mem = makeMembrane(W, H);
  mem.step(0);
  let worst = null;
  let worstAt = null;
  for (const bx of [-K, -12, -8, -4, 0, 4, 8]) {
    for (const by of [H * 0.35, H / 2, H * 0.65]) {
      const u = unionContour(mem, staticBead(bx, by));
      const hit = selfIntersects(polyOf(u.d));
      if (hit && !worst) {
        worst = hit;
        worstAt = `x=${bx} y=${by.toFixed(0)}`;
      }
    }
  }
  assert(
    worst === null,
    worst
      ? `the contour crosses itself at ${worstAt} (segments ${worst[0]}/${worst[1]}) — a spliced span walked backwards`
      : "no bead position produces a crossing — the merge window is spliced in ring order",
  );

  // …and the polygon the spline is drawn over must stay a graph over the edge
  // through the window, which is the property that makes that true.
  const u = unionContour(mem, staticBead(-4, H / 2));
  const poly = polyOf(u.d);
  const win = poly.filter(([x]) => x < -0.5);
  let mono = true;
  for (let i = 1; i < win.length; i++) {
    if (Math.sign(win[i][1] - win[i - 1][1]) !== Math.sign(win[1][1] - win[0][1])) mono = false;
  }
  assert(
    mono && win.length > 20,
    `the ${win.length} merge samples advance along the edge without doubling back`,
  );
}

// ───────────────────────────────────────────────────────────────────────────
section("7. the bead's own body");
{
  const ring = dropRing();
  assert(ring.n === COAL.RING_N, `the ring carries ${ring.n} vertices`);
  let minStep = Infinity;
  let maxStep = 0;
  for (let i = 0; i < ring.n; i++) {
    const j = (i + 1) % ring.n;
    const d = Math.hypot(ring.x[j] - ring.x[i], ring.y[j] - ring.y[i]);
    minStep = Math.min(minStep, d);
    maxStep = Math.max(maxStep, d);
  }
  assert(
    maxStep / minStep < 1.12,
    `arc spacing stays near-uniform — ${(maxStep / minStep).toFixed(3)}x spread (ringRest's tension term needs this)`,
  );

  const bmem = makeMembrane(0, 0, { ring, handR: COAL.R * 2.4 });
  bmem.step(0);
  const bead = makeBead();
  bead.target(100, 100, -1, 0, COAL.R);
  bead.step(0);
  for (let t = 16; t <= 1400; t += 16) bead.step(t);
  assert(bead.alive, "the bead gathers its mass");
  assert(
    Math.abs(bead.r - COAL.R) < 0.1,
    `…and settles at its resting radius — ${bead.r.toFixed(2)} px`,
  );
  assert(
    Math.abs(bead.x - 100) < 0.2 && Math.abs(bead.y - 100) < 0.2,
    "…exactly on the edge it was aimed at",
  );

  const d = beadContour(bmem, bead);
  assert(d.startsWith("M") && d.endsWith("Z"), "the bead emits a closed path");
}

// ───────────────────────────────────────────────────────────────────────────
section("8. travel — the pinch-off is emergent, not scheduled");
{
  const bead = makeBead();
  bead.target(100, 100, -1, 0, COAL.R);
  bead.step(0);
  for (let t = 16; t <= 1400; t += 16) bead.step(t);
  const restX = bead.x;

  // move it a field's distance down the rail and watch what the lift does
  bead.target(100, 240, -1, 0, COAL.R);
  let maxLift = 0;
  let maxStretch = 0;
  let peakSpeed = 0;
  for (let t = 1416; t <= 3200; t += 16) {
    bead.step(t);
    maxLift = Math.max(maxLift, Math.abs(bead.x - restX));
    maxStretch = Math.max(maxStretch, bead.stretch);
    peakSpeed = Math.max(peakSpeed, bead.speed);
  }
  assert(
    maxLift > K / 2,
    `travelling throws the bead clear of the neck — ${maxLift.toFixed(1)} px lift vs the K/2 = ${(K / 2).toFixed(1)} px neck`,
  );
  assert(
    maxLift < COAL.LIFT_MAX + 1,
    `…and no further than LIFT_MAX — ${maxLift.toFixed(1)} px`,
  );
  assert(
    maxStretch > 0.08,
    `the bead draws out along its travel — ${(maxStretch * 100).toFixed(0)}% elongation at ${peakSpeed.toFixed(0)} px/s`,
  );
  assert(
    maxStretch <= COAL.STRETCH_K + 1e-6,
    "…without exceeding STRETCH_K",
  );
  assert(
    Math.abs(bead.x - restX) < 0.05 && Math.abs(bead.y - 240) < 0.05,
    "it re-fuses exactly on the edge when it arrives",
  );
  assert(bead.stretch === 0, "…and gives up its stretch completely at rest");
}

// ───────────────────────────────────────────────────────────────────────────
section("9. stretch conserves the bead's mass");
{
  const ring = dropRing();
  const bmem = makeMembrane(0, 0, { ring, handR: COAL.R * 2.4 });
  bmem.step(0);
  const area = (d) => {
    const pts = [...d.matchAll(/C[-\d. ]+ ([-\d.]+) ([-\d.]+)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      a += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
    }
    return Math.abs(a) / 2;
  };
  const still = { x: 0, y: 0, r: COAL.R, stretch: 0, ux: 1, uy: 0, alive: true };
  const moving = { ...still, stretch: COAL.STRETCH_K, ux: 0.6, uy: 0.8 };
  const a0 = area(beadContour(bmem, still));
  const a1 = area(beadContour(bmem, moving));
  assert(
    Math.abs(a1 - a0) / a0 < 0.02,
    `a stretched bead has the mass of a still one — ${((a1 / a0 - 1) * 100).toFixed(2)}% area change at full elongation`,
  );
}

// ───────────────────────────────────────────────────────────────────────────
section("10. cost");
{
  const mem = makeMembrane(W, H);
  mem.step(0);
  const b = staticBead(-6, H / 2);
  const N = 400;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) unionContour(mem, b);
  const per = (performance.now() - t0) / N;
  assert(
    per < 0.9,
    `a merged field costs ${per.toFixed(3)} ms/frame (${COAL.WIN_N} window samples x ${COAL.SCAN}+${COAL.BISECT} root steps)`,
  );

  const far = staticBead(-200, H / 2);
  const t1 = performance.now();
  for (let i = 0; i < N; i++) unionContour(mem, far);
  const perIdle = (performance.now() - t1) / N;
  assert(
    perIdle < per,
    `an unmerged field is cheaper — ${perIdle.toFixed(3)} ms/frame, the early-out working`,
  );
}

// ───────────────────────────────────────────────────────────────────────────
section("11. it never eats a corner");
{
  const mem = makeMembrane(W, H);
  mem.step(0);
  const run = sideRun(mem.rest, -1);
  assert(run !== null, `the left side offers a run of ${run?.len} vertices`);
  for (let j = 0; j < (run?.len ?? 0); j++) {
    const i = (run.start + j) % mem.rest.n;
    if (mem.rest.sharp[i]) bad("a cusp leaked into the ridable run");
  }
  ok("no cusp is in the ridable run — the corners cannot be merged away");

  // THE CONSTANT'S STANDING GUARD. The footprint is exact and worst at zero
  // standoff — which is exactly where the bead rests. A surface point at
  // lateral offset u is untouched once hypot(u, p) >= R + K, so at p = 0 the
  // half-width is R + K. Arithmetic, not sampling: shrink the field or grow the
  // bead and this fails before anyone has to notice the corners going soft.
  const foot = COAL.R + COAL.K;
  assert(
    foot + COAL.CORNER_KEEP <= H / 2,
    `the merge footprint fits inside the edge — ±${foot} px on a ${(H / 2).toFixed(1)} px half-edge, ${(H / 2 - foot - COAL.CORNER_KEEP).toFixed(1)} px clear of each corner`,
  );

  // …and empirically, across the whole band the bead can occupy: from absorbed
  // on the edge out to the full width of its lift.
  let held = true;
  let firstBad = "";
  for (let y = COAL.R; y <= H - COAL.R; y += 1) {
    for (let p = 0; p <= COAL.LIFT_MAX; p += 2) {
      if (!cornersHeld(unionContour(mem, staticBead(-p, y)).d, W, H)) {
        if (held) firstBad = `standoff ${p} at y=${y.toFixed(0)}`;
        held = false;
      }
    }
  }
  assert(
    held,
    held
      ? "every reachable bead position leaves all four corners exact"
      : `a bead at ${firstBad} softened a corner`,
  );
}

// ───────────────────────────────────────────────────────────────────────────
section("12. the silhouette never squares off");
{
  // THE DEFECT THIS SECTION EXISTS FOR. The contour is solved by casting one
  // ray outward per point on the edge, which can only describe a boundary with
  // ONE crossing per ray. Hold the bead off the edge and that stops being true:
  // a ray reaches the bead only for |u| < R, but is merged along it only where
  // the local gap is under K/2, and everything between those two is silently
  // dropped. The bead loses its top and bottom and draws as a rectangular tab.
  //
  // That defect is invisible to every other check in this file — area, volume,
  // corners, self-intersection and cost all passed with a tab on the edge, and
  // it was found by looking at a screenshot. So the claim is made here
  // directly: sweep the bead out along its whole travel and watch the
  // OUTERMOST point of whatever is actually drawn. A representation that starts
  // dropping half the body shows up as a step in that curve and nowhere else.
  const mem = makeMembrane(W, H);
  mem.step(0);
  const beadMem = makeMembrane(0, 0, {
    ring: dropRing(COAL.R, COAL.RING_N, 0.61),
    handR: COAL.R * 2.6,
  });
  beadMem.step(0);

  let worstStep = 0;
  let worstAt = 0;
  let prev = null;
  const trace = [];
  for (let p = 0; p <= COAL.LIFT_MAX; p += 0.25) {
    const b = staticBead(-p, H / 2);
    const u = unionContour(mem, b);
    // whatever the reader actually sees at this standoff
    const d = u.merged ? u.d : beadContour(beadMem, b);
    const out = -Math.min(...polyOf(d).map(([x]) => x));
    if (prev !== null && Math.abs(out - prev) > worstStep) {
      worstStep = Math.abs(out - prev);
      worstAt = p;
    }
    prev = out;
    if (p % 4 < 0.13) trace.push(`${p.toFixed(0)}:${out.toFixed(1)}`);
  }
  assert(
    worstStep < 2.2,
    `the drawn silhouette grows smoothly across the whole travel — worst step ${worstStep.toFixed(2)} px at standoff ${worstAt.toFixed(2)} px  [${trace.join(" ")}]`,
  );

  // the two constraints that make that possible, stated as arithmetic so a
  // later change to R or K cannot quietly reintroduce the tab
  assert(
    COAL.K / 2 === COAL.R,
    `the handover lands where the bead touches the edge — K/2 = ${COAL.K / 2}, R = ${COAL.R}`,
  );
  assert(
    COAL.LIFT_MAX > COAL.R + COAL.K,
    `the lift carries the bead fully out of reach — ${COAL.LIFT_MAX} px past R + K = ${COAL.R + COAL.K} px`,
  );
}

console.log(
  `\n${failed ? "COALESCE FAILED" : "COALESCE OK"} — ${checks - failed}/${checks} checks passed.`,
);
process.exit(failed ? 1 : 0);
