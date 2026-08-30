/**
 * verify-coalesce.mjs — the merge kernel, in plain node.
 *
 * `coalesce.mjs` is DOM-free and deterministic for exactly this reason: the
 * claims it makes are geometric, and a screenshot cannot check any of them.
 * What is pinned here is what would break silently and still look almost right:
 *
 *   EXACT REST. A field with no drop near it must emit the string `mem.path()`
 *   would have emitted, character for character. Not "within a tenth of a
 *   pixel" — the same string. Everything this layer does is render-only for
 *   that reason, and the guarantee is worth nothing unasserted.
 *
 *   THE BRIDGE. Foot on the surface, throat in the middle, bulb at the end.
 *   Each has to be in the right place and thin in the right order, and none of
 *   it is visible to an area or a volume check: an earlier version had the
 *   throat 0.8 px from the wall out of an 8 px neck, and every other test in
 *   this file passed.
 *
 *   THE BREAK. Foot and throat must reach nothing together at full extension,
 *   or the connection disappears while it is still wide and the drop reads as
 *   having teleported off the surface.
 *
 *   THE CORNERS. The field's ring is rounded now, and the merge must still
 *   never reach an arc — the neck grows out of the straight run or not at all.
 *
 * Run: node scripts/verify-coalesce.mjs   (npm run liquid:form)
 */

import { makeMembrane } from "../lib/motion/membrane.mjs";
import {
  COAL,
  neckA,
  neckProfile,
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
// at the 1440 px breakpoint. COAL's constants are derived FOR this size, so the
// harness uses it — and §10 is what fails loudly if the field is ever restyled
// smaller than the merge needs.
const W = 576;
const H = 57;
const R = COAL.R;
const NK = COAL.NECK;

/** A drop frozen at one place — the harness drives geometry, not time. */
const at = (x, y = H / 2, r = R) => ({
  x,
  y,
  r,
  stretch: 0,
  ux: 1,
  uy: 0,
  alive: r > COAL.EPS_R,
  sdf: (qx, qy) => Math.hypot(qx - x, qy - y) - r,
});

/** Segment endpoints of a cubic path — the polygon the spline is drawn over. */
function polyOf(d) {
  const out = [];
  const head = d.match(/^M(-?[\d.]+) (-?[\d.]+)/);
  if (head) out.push([Number(head[1]), Number(head[2])]);
  for (const m of d.matchAll(
    /C-?[\d.]+ -?[\d.]+ -?[\d.]+ -?[\d.]+ (-?[\d.]+) (-?[\d.]+)/g,
  )) {
    out.push([Number(m[1]), Number(m[2])]);
  }
  out.pop();
  return out;
}

/**
 * Does a closed polygon cross itself?
 *
 * Coincident points are dropped first. A zero-length segment has no
 * orientation, so the cross-product test reports a crossing for a pair of
 * points 0.003 px apart that the path's own 0.1 px rounding has already made
 * identical — a fold that exists in neither the geometry nor the output.
 */
function selfIntersects(raw) {
  const p = raw.filter(
    (q, i) =>
      i === 0 ||
      Math.abs(q[0] - raw[i - 1][0]) > 0.02 ||
      Math.abs(q[1] - raw[i - 1][1]) > 0.02,
  );
  const n = p.length;
  const cross = (o, a, b) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const hits = (a, b, c, d) => {
    const d1 = cross(c, d, a);
    const d2 = cross(c, d, b);
    const d3 = cross(a, b, c);
    const d4 = cross(a, b, d);
    return d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (hits(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) return [i, j];
    }
  }
  return null;
}

/** The bridge's shape, read the way a reviewer reads it. */
function bridge(L, r = R) {
  const prof = new Float64Array(NK.N + 1);
  const info = neckProfile(L, r, prof);
  let throat = Infinity;
  let throatAt = 0;
  for (let i = 1; i < NK.N; i++) {
    const a = neckA(i, NK.N, L + r);
    if (a < 0.5 || a > Math.max(L, 1)) continue; // between wall and drop only
    if (prof[i] < throat) {
      throat = prof[i];
      throatAt = a;
    }
  }
  return {
    foot: info.base,
    connected: info.connected,
    throat: throat === Infinity ? null : throat,
    throatAt,
    prof,
  };
}

const field = () => {
  const m = makeMembrane(W, H, { radius: COAL.FIELD_R });
  m.step(0);
  return m;
};

// ───────────────────────────────────────────────────────────────────────────
section("1. exact rest — an untouched field is its authored contour");
{
  const mem = field();
  const plain = mem.path();

  assert(
    unionContour(mem, at(-500)).d === plain,
    "a drop out of reach leaves the path byte-identical",
  );
  assert(
    unionContour(mem, at(-500), { own: false }).d === plain,
    "…and so does a field that is only leaning",
  );
  assert(
    unionContour(mem, at(-4, H / 2, 0)).d === plain,
    "a drained drop leaves the path byte-identical",
  );
  assert(
    unionContour(mem, at(-(NK.BREAK + 1))).d === plain,
    "a drop past the break leaves the path byte-identical",
  );
  assert(
    mem.rest.radius === COAL.FIELD_R,
    `the field's ring is rounded — ${mem.rest.radius} px`,
  );
  assert(
    [...mem.rest.sharp].every((v) => v === 0),
    "…with no cusps at all, so tension carries around the corners",
  );
}

// ───────────────────────────────────────────────────────────────────────────
section("2. the bridge has a foot, a throat and a bulb");
{
  const b = bridge(26);
  const wetted = bridge(0).foot;
  assert(
    wetted > R && wetted < R * 2,
    `at rest the foot wets wider than the drop — ${wetted.toFixed(1)} px vs R = ${R}`,
  );
  assert(
    b.throat !== null && b.throat < b.foot * 0.5,
    `the throat is much narrower than the foot — ${b.throat?.toFixed(2)} px`,
  );
  assert(
    b.throatAt > 26 * 0.25 && b.throatAt < 26 * 0.85,
    `and sits in the MIDDLE of the neck — ${((b.throatAt / 26) * 100).toFixed(0)}% along, not jammed against the wall`,
  );

  let widest = 0;
  for (let i = 0; i <= NK.N; i++) {
    const a = neckA(i, NK.N, 26 + R);
    if (a > 26 - R * 0.4) widest = Math.max(widest, b.prof[i]);
  }
  assert(
    Math.abs(widest - R) < 1.5,
    `the bulb is the drop's own radius — ${widest.toFixed(2)} px vs R = ${R}`,
  );
  assert(b.prof[NK.N] === 0, "the tip closes");
}

// ───────────────────────────────────────────────────────────────────────────
section("3. it thins under extension, and lets go cleanly");
{
  const Ls = [0, 8, 16, 24, 32, 40, 44];
  const feet = Ls.map((L) => bridge(L).foot);
  assert(
    feet.every((v, i) => i === 0 || v < feet[i - 1]),
    `the foot narrows all the way out — ${feet.map((v) => v.toFixed(1)).join(" → ")} px`,
  );

  const throats = [16, 24, 32, 40, 44].map((L) => bridge(L).throat);
  assert(
    throats.every((v, i) => i === 0 || v < throats[i - 1]),
    `the throat thins faster — ${throats.map((v) => v.toFixed(2)).join(" → ")} px`,
  );

  // THE BREAK. Both must arrive at nothing together, or the connection
  // vanishes while it is still wide and the drop appears to teleport.
  const last = bridge(NK.BREAK - 0.2);
  assert(last.connected, "just under the break it is still connected");
  assert(
    last.foot < R * 0.3,
    `…and the foot has all but gone — ${last.foot.toFixed(2)} px on a ${R} px drop`,
  );
  assert(!bridge(NK.BREAK + 0.1).connected, "past the break it is not connected");

  const mem = field();
  assert(
    unionContour(mem, at(-(NK.BREAK + 0.1))).d === mem.path(),
    "…and the surface it let go of is flat again, byte for byte",
  );
}

// ───────────────────────────────────────────────────────────────────────────
section("4. no pinch while the drop still overlaps the wall");
{
  // Below L = R the drop is half inside the surface. There is no bridge to
  // thin, and pulling the profile to a waist there invents a pinch in what
  // should read as a wetted bulge. This is where COAL's `clear` term earns its
  // place, and it is invisible to every other check here.
  for (const L of [0, 3, 6]) {
    const b = bridge(L);
    assert(
      b.throat === null || b.throat > R * 0.7,
      `L=${L}: narrowest point is ${b.throat === null ? "n/a" : b.throat.toFixed(1)} px — no throat while the drop overlaps`,
    );
  }
  const b8 = bridge(R + 4);
  assert(
    b8.throat !== null && b8.throat < R * 0.9,
    `and a throat does appear once the drop clears the wall — ${b8.throat?.toFixed(2)} px at L = ${R + 4}`,
  );
}

// ───────────────────────────────────────────────────────────────────────────
section("5. the drawn contour is a simple closed curve");
{
  const mem = field();
  let worst = null;
  let worstAt = "";
  for (let L = 0; L <= NK.BREAK; L += 1.5) {
    for (const y of [H * 0.35, H / 2, H * 0.7]) {
      const hit = selfIntersects(polyOf(unionContour(mem, at(-L, y)).d));
      if (hit && !worst) {
        worst = hit;
        worstAt = `L=${L} y=${y.toFixed(0)}`;
      }
    }
  }
  assert(
    worst === null,
    worst
      ? `the contour crosses itself at ${worstAt} (segments ${worst[0]}/${worst[1]})`
      : "no drop position anywhere in the travel produces a crossing",
  );
}

// ───────────────────────────────────────────────────────────────────────────
section("6. the silhouette grows smoothly across the whole travel");
{
  // The eye follows the outermost point of whatever is drawn. A representation
  // that starts dropping part of the body, or a handover that does not line up,
  // shows as a step in this curve and nowhere else.
  const mem = field();
  const beadMem = makeMembrane(0, 0, {
    ring: dropRing(R, COAL.RING_N, 0.61),
    handR: R * 2.6,
  });
  beadMem.step(0);

  let worstStep = 0;
  let worstAt = 0;
  let prev = null;
  const trace = [];
  for (let L = 0; L <= COAL.LIFT_MAX; L += 0.25) {
    const b = at(-L);
    const u = unionContour(mem, b);
    const d = u.merged ? u.d : beadContour(beadMem, b);
    const out = -Math.min(...polyOf(d).map(([x]) => x));
    if (prev !== null && Math.abs(out - prev) > worstStep) {
      worstStep = Math.abs(out - prev);
      worstAt = L;
    }
    prev = out;
    if (L % 8 < 0.13) trace.push(`${L.toFixed(0)}:${out.toFixed(0)}`);
  }
  assert(
    worstStep < 2.5,
    `worst step ${worstStep.toFixed(2)} px at L = ${worstAt.toFixed(2)}  [${trace.join(" ")}]`,
  );
}

// ───────────────────────────────────────────────────────────────────────────
section("7. the lean — the rest of the board answers too");
{
  const mem = field();
  const plain = mem.path();
  const leanAt = (L) =>
    -Math.min(
      ...polyOf(unionContour(mem, at(-L), { own: false }).d).map(([x]) => x),
    );

  assert(
    unionContour(mem, at(-(COAL.LEAN_R + 1)), { own: false }).d === plain,
    "beyond LEAN_R a field does not move at all",
  );
  const near = leanAt(20);
  const far = leanAt(110);
  assert(
    near > far,
    `it leans harder the closer the drop is — ${near.toFixed(2)} px at 20, ${far.toFixed(2)} px at 110`,
  );
  assert(
    near < COAL.LEAN_A + 0.3,
    `and never rivals the field actually holding it — ${near.toFixed(2)} px against an ${R} px bulge`,
  );
  assert(
    unionContour(mem, at(-20), { own: false }).merged === false,
    "a leaning field never claims the drop",
  );
}

// ───────────────────────────────────────────────────────────────────────────
section("8. the drop's own body");
{
  const ring = dropRing();
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
    `arc spacing stays near-uniform — ${(maxStep / minStep).toFixed(3)}x (ringRest's tension term needs this)`,
  );

  const bmem = makeMembrane(0, 0, { ring, handR: R * 2.6 });
  bmem.step(0);
  const area = (d) => {
    const p = polyOf(d);
    let a = 0;
    for (let i = 0; i < p.length; i++) {
      const j = (i + 1) % p.length;
      a += p[i][0] * p[j][1] - p[j][0] * p[i][1];
    }
    return Math.abs(a) / 2;
  };
  const still = { x: 0, y: 0, r: R, stretch: 0, ux: 1, uy: 0, alive: true };
  const moving = { ...still, stretch: COAL.STRETCH_K, ux: 0.6, uy: 0.8 };
  const a0 = area(beadContour(bmem, still));
  const a1 = area(beadContour(bmem, moving));
  assert(
    Math.abs(a1 - a0) / a0 < 0.02,
    `a stretched drop has the mass of a still one — ${((a1 / a0 - 1) * 100).toFixed(2)}% at full elongation`,
  );
}

// ───────────────────────────────────────────────────────────────────────────
section("9. travel — the pinch is emergent, not scheduled");
{
  // The settle windows are generous on purpose. The lift is drawn back on a
  // 240 ms lag now, so a move is not finished when the position spring is —
  // measuring restX before the gather had settled made the arrival look like
  // it landed 0.4 px off the edge when it lands exactly on it.
  const bead = makeBead();
  bead.target(100, 100, -1, 0, R);
  bead.step(0);
  for (let t = 16; t <= 2600; t += 16) bead.step(t);
  const restX = bead.x;
  assert(
    bead.alive && Math.abs(bead.r - R) < 0.1,
    `the drop gathers to ${bead.r.toFixed(1)} px`,
  );

  bead.target(100, 240, -1, 0, R);
  let maxLift = 0;
  let maxStretch = 0;
  for (let t = 2616; t <= 6200; t += 16) {
    bead.step(t);
    maxLift = Math.max(maxLift, Math.abs(bead.x - restX));
    maxStretch = Math.max(maxStretch, bead.stretch);
  }
  assert(
    maxLift > NK.BREAK,
    `travelling carries the drop past the break — ${maxLift.toFixed(0)} px lift against a ${NK.BREAK} px bridge`,
  );
  assert(
    maxLift < COAL.LIFT_MAX + 1,
    `…and no further than LIFT_MAX — ${maxLift.toFixed(0)} px`,
  );
  assert(
    maxStretch > 0.1,
    `the drop draws out along its travel — ${(maxStretch * 100).toFixed(0)}%`,
  );
  assert(
    Math.abs(bead.x - restX) < 0.05 && Math.abs(bead.y - 240) < 0.05,
    "it re-fuses exactly on the edge when it arrives",
  );
  assert(bead.stretch === 0, "…and gives up its stretch completely at rest");
}

// ───────────────────────────────────────────────────────────────────────────
section("10. it never reaches a corner arc");
{
  const mem = field();
  const run = sideRun(mem.rest, -1);
  assert(run !== null, `the straight left run offers ${run?.len} vertices`);

  // Only the STRAIGHT run may be replaced. On a rounded ring the arcs carry
  // turning normals, so selecting by normal is what keeps the merge off them.
  let straight = true;
  for (let j = 0; j < (run?.len ?? 0); j++) {
    const i = (run.start + j) % mem.rest.n;
    if (Math.abs(mem.rest.nx[i] + 1) > 1e-3 || Math.abs(mem.rest.ny[i]) > 1e-3) {
      straight = false;
    }
  }
  assert(straight, "every ridable vertex is on the straight side, none on an arc");

  // THE STANDING GUARD on the constants. The widest the merge ever gets is its
  // foot at zero extension, and that has to fit inside the straight run.
  const straightRun = H - 2 * COAL.FIELD_R;
  const foot = bridge(0).foot;
  assert(
    foot * 2 <= straightRun,
    `the widest foot fits the straight run — ${(foot * 2).toFixed(1)} px across a ${straightRun} px run`,
  );

  // …and empirically, at every position the drop can reach. Counting the points
  // that are neither on the left nor the right side catches an arc being eaten
  // or reshaped, which a bounding box would not.
  const arcPoints = (d) => polyOf(d).filter(([x]) => x > 1 && x < W - 1).length;
  const restArcs = arcPoints(mem.path());
  let held = true;
  let firstBad = "";
  for (let L = 0; L <= NK.BREAK; L += 1) {
    for (const y of [R, H / 2, H - R]) {
      if (arcPoints(unionContour(mem, at(-L, y)).d) !== restArcs) {
        if (held) firstBad = `L=${L} y=${y.toFixed(0)}`;
        held = false;
      }
    }
  }
  assert(
    held,
    held
      ? `every reachable drop position leaves both corner arcs intact (${restArcs} arc points)`
      : `a drop at ${firstBad} reached an arc`,
  );
}

// ───────────────────────────────────────────────────────────────────────────
section("11. cost");
{
  const mem = field();
  const b = at(-20);
  const N = 400;
  let t0 = performance.now();
  for (let i = 0; i < N; i++) unionContour(mem, b);
  const per = (performance.now() - t0) / N;
  assert(per < 1.0, `a field carrying the bridge costs ${per.toFixed(3)} ms/frame`);

  t0 = performance.now();
  for (let i = 0; i < N; i++) unionContour(mem, b, { own: false });
  const perLean = (performance.now() - t0) / N;
  assert(perLean < per, `a leaning field is cheaper — ${perLean.toFixed(3)} ms/frame`);

  t0 = performance.now();
  for (let i = 0; i < N; i++) unionContour(mem, at(-500));
  const perIdle = (performance.now() - t0) / N;
  // Idle and leaning both early-out to the plain path once the drop is out of
  // range, so they cost the same; what matters is that neither pays for a
  // bridge nobody can see.
  assert(
    perIdle < per * 0.6,
    `an untouched field pays nothing for the bridge — ${perIdle.toFixed(3)} ms/frame`,
  );
}

// ───────────────────────────────────────────────────────────────────────────
section("12. nothing on the outline is sub-pixel");
{
  // `cta-membrane-spec.md §5`, applied to the drop: "sub-pixel motion on a 1 px
  // hairline is a bug, not life… it renders as uneven antialiasing, a shaky
  // hand-drawn line." That finding turned off BOW and BREATH_A on the buttons.
  // The drop reintroduced it twice — a 3.5% rest lobe worth 0.77 px, and a
  // pinch kick worth 0.51 px — and both read as a wobbly circle rather than as
  // a body reacting. A deformation on a hairline either clears a pixel or is
  // not there at all.
  const bmem = makeMembrane(0, 0, {
    ring: dropRing(R, COAL.RING_N, 0.61),
    handR: R * 2.6,
    maxN: R * 0.7,
  });
  bmem.step(0);
  const spread = (m) => {
    const p = m.points();
    let mn = Infinity;
    let mx = 0;
    for (let i = 0; i < p.px.length; i++) {
      const d = Math.hypot(p.px[i], p.py[i]);
      if (d < mn) mn = d;
      if (d > mx) mx = d;
    }
    return mx - mn;
  };

  assert(
    spread(bmem) < 0.02,
    `the resting drop is a true circle — ${spread(bmem).toFixed(3)} px of radial spread`,
  );

  bmem.strike(0, 0, 0, COAL.PINCH_KICK, true);
  let peak = 0;
  for (let t = 16; t <= 900; t += 16) {
    bmem.step(t);
    peak = Math.max(peak, spread(bmem));
  }
  assert(
    peak > 1,
    `letting go rings it by more than a pixel — ${peak.toFixed(2)} px, so it reads as a body rather than as antialiasing`,
  );
  assert(
    peak < R * 0.5,
    `…and not so hard it stops being a drop — ${((peak / R) * 100).toFixed(0)}% of R`,
  );
}

// ───────────────────────────────────────────────────────────────────────────
section("13. the tour paces off what can be SEEN");
{
  // `arrived` exists so an autonomous tour does not stand still waiting for
  // motion under a pixel. It has to fire meaningfully earlier than `settled`,
  // or it is not worth having; and it must not fire while the drop is still
  // visibly travelling.
  const b = makeBead();
  b.target(0, 80, -1, 0, R);
  b.step(0);
  for (let t = 16; t <= 4000; t += 16) b.step(t);
  b.target(0, 320, -1, 0, R);
  let tArrived = 0;
  let tSettled = 0;
  for (let t = 4016; t <= 12000; t += 16) {
    b.step(t);
    if (!tArrived && b.arrived) tArrived = t - 4016;
    if (!tSettled && b.settled) tSettled = t - 4016;
  }
  assert(
    tArrived > 0 && tSettled > 0,
    `both signals fire — arrived at ${tArrived} ms, settled at ${tSettled} ms`,
  );
  assert(
    tSettled - tArrived > 200,
    `and arrived comes ${tSettled - tArrived} ms earlier — that gap is the dead time it exists to remove`,
  );
  assert(
    tArrived > 600,
    `…without firing while the drop is still visibly travelling — ${tArrived} ms in`,
  );
}

console.log(
  `\n${failed ? "COALESCE FAILED" : "COALESCE OK"} — ${checks - failed}/${checks} checks passed.`,
);
process.exit(failed ? 1 : 0);
