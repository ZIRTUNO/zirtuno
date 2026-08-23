/**
 * COALESCENCE — two vector surfaces becoming one, and coming apart again.
 *
 * `membrane.mjs` gave a single closed contour a hand and a strike. It has no
 * notion of a SECOND body, so every membrane on the page is an island: a
 * button can be pushed, dented and struck, but nothing can ever arrive at it,
 * touch it, or leave. On a site whose whole argument is one continuous liquid,
 * the form was the last place where two pieces of that liquid could not meet.
 *
 * This kernel is that meeting. It is the vector half of what
 * `sdf-glass-shader.mjs` already does on the GPU — a smooth-minimum of two
 * signed distance fields — evaluated on a contour instead of per pixel, so the
 * result is a crisp 1 px path rather than a blurred blob.
 *
 * ── Why not the goo filter ────────────────────────────────────────────────
 *
 * The usual way to do this on the web is `feGaussianBlur` + a steep
 * `feColorMatrix` alpha ramp: blur two shapes until they overlap, then throw
 * away the soft edge. It is cheap, it is convincing, and it is wrong here for
 * two reasons. It only reads on FILLED shapes — Zirtuno's fields are 1 px
 * hairlines, and a blurred hairline is a glow, not an edge. And it is a
 * raster operation on a live surface, which on a page already running a WebGL
 * fluid is exactly the kind of second, unsynchronised visual engine AGENTS §4.15
 * exists to forbid. Solving the iso-surface gives the same merge as GEOMETRY:
 * one path, one stroke, no filter, and the same smooth-min the field itself
 * runs.
 *
 * ── The art direction, stated as a rule ──────────────────────────────────
 *
 * When liquid meets structure here, THE LIQUID GIVES UP ITS SHAPE. A field's
 * rectangle never rounds, never bends and never softens its corners; the
 * droplet is what flattens, necks and is absorbed. That is the brand's own
 * sentence — structure given to what was dispersed — written as a physics
 * rule, and it is what keeps this from reading as a merge effect borrowed from
 * somewhere softer.
 *
 * ── The one number everything follows from ───────────────────────────────
 *
 * `K` is the blend radius of the smooth-min, and it decides three things at
 * once, all analytically rather than by taste:
 *
 *   Beyond a gap of K the two bodies do not interact AT ALL. The polynomial
 *   smin returns its left argument exactly — not approximately — when the
 *   other body is K or further away, so a distant droplet contributes a
 *   displacement of exactly zero and the field's rectangle emits its authored
 *   path character-for-character. Exact rest is a property of the arithmetic
 *   here, not an epsilon someone chose.
 *
 *   At a gap of exactly K/2 the neck forms. Halfway between the two surfaces
 *   both distances are gap/2, so smin there is gap/2 − K/4, which reaches zero
 *   precisely at gap = K/2. Above it there is a positive barrier between them
 *   and they are two bodies; below it there is none and they are one.
 *
 *   At that same instant each surface has bulged exactly gap/2 toward the
 *   other — they meet in the middle. Which is why the moment of topology
 *   change is invisible: the two-contour drawing and the one-contour drawing
 *   are tangent at the frame they swap.
 *
 * DOM-free and deterministic on purpose — `scripts/verify-coalesce.mjs` runs it
 * in plain node, exactly like `membrane.mjs`.
 */

import { splinePath } from "./membrane.mjs";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const COAL = {
  /**
   * Resting radius (px). Read against a 57 px field: present, never dominant.
   * Pinned to K by the graph constraint below — these two are one decision.
   */
  R: 8,
  /**
   * Smooth-union blend radius (px) — the reach, the neck (K/2) and the
   * handover, all at once. See the header.
   *
   * NOT a taste number. Two constraints fix it, and together they leave
   * exactly one answer on a 57 px field.
   *
   * FIRST — the corners. The deformation footprint is exact: a surface point
   * at lateral offset u is untouched once hypot(u, p) ≥ R + K, where p is the
   * bead's standoff. At p = 0 that is ±(R + K) = ±24 px, which fits inside the
   * 28.5 px half-edge with 2.5 px to spare. The rectangle keeps its corners
   * because the arithmetic says so, not because anything is clamped.
   *
   * SECOND — and this one was only found by looking at it: THE UNION MUST
   * STAY A GRAPH OVER THE EDGE. The contour is solved by casting a ray outward
   * from each point of the edge and taking the crossing, which can only
   * describe a boundary with ONE crossing per ray. A bead held off the edge
   * breaks that. A ray at lateral offset u reaches the bead only for |u| < R,
   * but it is MERGED along that ray only where the local gap is under K/2 —
   * and where those disagree the bead's top and bottom (its "ears") are
   * dropped and the outline squares off into a rectangular tab. At a 17 px
   * standoff only ±6.3 px of an ±11 px body survived, and it drew as a tab.
   *
   * The ears exist unless the whole bead is inside K/2 of the edge:
   *
   *     p ≤ K/2        — below this it is drawn as part of the field's contour
   *
   * and past that it must be drawn as its OWN body. For that handover to be
   * seamless the switch has to land exactly where the bead's near face touches
   * the edge, or a separately drawn bead would appear already crossing through
   * the field's outline. That is:
   *
   *     K/2 = R
   *
   * K = 16, R = 8 satisfies both. `verify-coalesce.mjs` §11 and §12 are the
   * standing guards, so a later change to either number fails loudly rather
   * than quietly squaring off the merge again.
   */
  K: 16,
  /** Ring vertices around the bead. */
  RING_N: 44,
  /**
   * Lobe depth on the bead's rest contour, as a fraction of R. The site does
   * not draw perfect circles anywhere — `lobedCirclePath` carries the same
   * idea for the CTA flood — and a mathematically exact disc beside a liquid
   * that is visibly irregular reads as a UI dot rather than as a drop.
   *
   * Kept small for a second reason: `ringRest` needs uniform ARC spacing to
   * make its tension term a real Laplacian, and uniform ANGLE only gives that
   * on a true circle. At 3.5% the arc-length error between neighbouring
   * vertices stays under 1%, which the operator does not notice.
   */
  LOBE: 0.035,

  // ── travel ────────────────────────────────────────────────────────────────
  /** Position spring — runs, then settles through one small overshoot. */
  OMEGA: 16,
  ZETA: 0.72,
  /** Radius spring. Critically damped: mass arriving does not bounce. */
  OMEGA_R: 12,
  ZETA_R: 1,

  /**
   * THE LIFT — how far a moving bead is thrown off the edge it is riding.
   *
   * Without it the bead slides down the rail while permanently fused, and the
   * merge never comes apart: the reader sees a bulge translating along a line,
   * which is an animation, not liquid. A drop running along a wall cannot wet
   * it while it is moving, so speed pushes the bead outward — past K/2, where
   * the neck necessarily fails and it becomes its own body again. Then it
   * slows, falls back, and re-fuses.
   *
   * The separation is therefore EMERGENT. Nothing schedules a pinch-off; it is
   * what the smooth-min does when the standoff crosses K/2, and it happens on
   * the way out and on the way in for the same reason.
   *
   * LIFT_MAX carries the bead clear of R + K (24 px), where the two bodies are
   * out of each other's reach entirely and it is unambiguously its own. Below
   * that and above K/2 it is separate but still reaching back — which is the
   * drawn-out neck, and the reason the number is comfortably past 24 rather
   * than exactly at it. LIFT_V sits under a typical field-to-field travel
   * speed, so an ordinary focus move detaches fully rather than smearing.
   */
  LIFT_MAX: 26,
  LIFT_V: 420, // px/s at which the lift is fully out
  LIFT_TAU: 90, // ms — the lift follows speed, but not instantly

  /**
   * VELOCITY STRETCH — the drawn-out teardrop of a drop in motion.
   *
   * Area-preserving: elongated by (1+e) along the direction of travel and
   * narrowed by 1/(1+e) across it, so a moving bead has exactly the mass of a
   * still one. `fluid-core`'s droplets already deform this way; this is the
   * same idea at the scale of one vector contour.
   */
  STRETCH_K: 0.42,
  STRETCH_V: 700, // px/s at which the stretch is fully out
  STRETCH_TAU: 70, // ms

  // ── the union window ──────────────────────────────────────────────────────
  /**
   * Samples across the merge window. The ring underneath is coarse by
   * necessity — `MEM.N_MAX` caps a 576 px input at ~16 px between vertices, so
   * a bead spans barely one and a half of them — and a merge drawn at that
   * resolution is a polygon. The window is therefore re-sampled densely and
   * spliced in: ~2 px between samples where the merge is, the ring's own
   * vertices everywhere else. Fine detail is paid for only where it exists.
   */
  WIN_N: 44,
  /**
   * How far the dense window stays clear of the two cusps bounding the edge
   * (px). At this distance the last sample is already outside the bead's exact
   * footprint, so it lands on the rest line and the spline runs dead straight
   * into the corner — the rectangle keeps its corners not by clamping the
   * result but by never sampling near them.
   */
  CORNER_KEEP: 2,
  /** Root-find effort. Deterministic counts, not a tolerance loop. */
  SCAN: 48,
  BISECT: 14,

  /** Below this the bead has drained and nothing is drawn at all. */
  EPS_R: 0.35,
};

/**
 * The polynomial smooth-minimum (Inigo Quilez). The exactness at the ends is
 * the whole reason this variant and not the exponential one: with `b >= k`
 * this returns `a` EXACTLY, so a distant body contributes nothing at all
 * rather than a vanishing something. Exact rest depends on that.
 */
export function smin(a, b, k) {
  if (!(k > 0)) return a < b ? a : b;
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}

/** Signed distance to an axis-aligned box centred at (cx, cy), half-extents hw/hh. */
export function sdBox(qx, qy, cx, cy, hw, hh) {
  const dx = Math.abs(qx - cx) - hw;
  const dy = Math.abs(qy - cy) - hh;
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(dx, dy), 0);
}

/**
 * How far the union surface sits beyond a point that lies ON one of the two
 * surfaces, measured along that surface's outward normal.
 *
 * The own-body term is simply `s` — the distance travelled — because the ray
 * starts on the surface and leaves it. So the root of
 * `smin(s, other(p + n·s), k)` is the union boundary, and:
 *
 *   • `other(p) >= k` returns 0 EXACTLY (see `smin`), which is what makes an
 *     untouched surface emit its authored path rather than a perturbed one;
 *   • when a barrier still stands between the bodies the first crossing is the
 *     surface's own bulge, which is correct — they are two bodies and are
 *     drawn as two contours;
 *   • when the barrier is gone the first crossing is past the other body, so
 *     the same call also draws the merged silhouette. One function covers both
 *     regimes, and the handover needs no blend.
 *
 * Scan-then-bisect rather than Newton: the field is only piecewise smooth and
 * a fixed iteration count keeps this deterministic for the node harness.
 */
export function unionReach(px, py, nx, ny, other, k, limit) {
  const d0 = other(px, py);
  if (d0 >= k) return 0;
  const lim = limit > 0 ? limit : k * 4;
  const step = lim / COAL.SCAN;
  let lo = 0;
  let hi = -1;
  for (let g = 1; g <= COAL.SCAN; g++) {
    const s = g * step;
    const qx = px + nx * s;
    const qy = py + ny * s;
    if (smin(s, other(qx, qy), k) > 0) {
      lo = (g - 1) * step;
      hi = s;
      break;
    }
  }
  if (hi < 0) return lim;
  for (let b = 0; b < COAL.BISECT; b++) {
    const m = 0.5 * (lo + hi);
    if (smin(m, other(px + nx * m, py + ny * m), k) > 0) hi = m;
    else lo = m;
  }
  return 0.5 * (lo + hi);
}

/**
 * A lobed near-circular ring with true outward normals, in the shape
 * `makeMembrane({ ring })` wants. Centred on the origin so the caller can
 * translate it freely — a travelling body cannot own fixed geometry.
 */
export function dropRing(r = COAL.R, n = COAL.RING_N, seed = 0) {
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const nx = new Float32Array(n);
  const ny = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const lobe =
      1 +
      COAL.LOBE *
        (0.62 * Math.sin(3 * a + seed) + 0.38 * Math.sin(5 * a - seed * 1.7));
    x[i] = Math.cos(a) * r * lobe;
    y[i] = Math.sin(a) * r * lobe;
    // Outward normal of a near-circle is the radial direction to within the
    // lobe's own slope, which at 3.5% is under 1.5 degrees.
    nx[i] = Math.cos(a);
    ny[i] = Math.sin(a);
  }
  return { n, x, y, nx, ny };
}

/**
 * THE BEAD — one travelling body, its motion and its own signed distance.
 *
 * Position, radius, lift and stretch are all springs or first-order lags, so
 * every change of target is answered by a trajectory rather than by a
 * keyframe. Nothing here has a duration: the reader can move focus twice in
 * 80 ms and the bead simply carries its velocity into the second move, which
 * is the behaviour a scripted tween cannot give.
 */
export function makeBead(seed = 0.61) {
  let x = 0;
  let y = 0;
  let vx = 0;
  let vy = 0;
  let r = 0;
  let vr = 0;
  let tx = 0;
  let ty = 0;
  let tr = 0;
  /** Outward direction of the edge being ridden (unit). */
  let ox = -1;
  let oy = 0;
  let lift = 0;
  let stretch = 0;
  let placed = false;
  let last = 0;

  /** Where the contour actually sits: the target point pushed off the edge. */
  const cx = () => x + ox * lift;
  const cy = () => y + oy * lift;

  /**
   * The bead's signed distance, built ONCE and closed over the mutable state
   * above — a fresh closure per frame would be exactly the per-frame
   * allocation the field's own conventions forbid.
   *
   * The stretch is applied by pulling the query point back into the bead's
   * un-stretched frame and scaling the result by the minor axis. That is the
   * standard ellipse approximation: not the true distance to an ellipse (which
   * has no closed form), but smooth, monotone and correct on the axes, which
   * is everything the root finder and the eye need.
   */
  const sdf = (qx, qy) => {
    const dx = qx - cx();
    const dy = qy - cy();
    if (stretch <= 1e-4) return Math.hypot(dx, dy) - r;
    const sp = Math.hypot(vx, vy) || 1;
    const ux = vx / sp;
    const uy = vy / sp;
    const along = dx * ux + dy * uy;
    const across = -dx * uy + dy * ux;
    const sa = 1 + stretch;
    const sb = 1 / sa;
    const q = Math.hypot(along / sa, across / sb);
    return (q - r) * sb;
  };

  /** Aim the bead at a point on an edge whose outward normal is (nxE, nyE). */
  const target = (nx_, ny_, nxE, nyE, radius) => {
    tx = nx_;
    ty = ny_;
    ox = nxE;
    oy = nyE;
    tr = radius;
    if (!placed) {
      // The FIRST gather does not spring from nowhere. It starts on the same
      // edge, above the form — the direction the contact mark sits in — so the
      // liquid arrives from the page rather than being switched on.
      placed = true;
      x = tx;
      y = ty - 140;
      r = 0;
    }
  };

  /** Drain: the bead loses its mass in place and stops being drawn. */
  const drain = () => {
    tr = 0;
  };

  const step = (tMs) => {
    if (!last) last = tMs;
    let dt = (tMs - last) / 1000;
    last = tMs;
    if (!(dt > 0)) return false;
    if (dt > 0.05) dt = 0.05; // a backgrounded tab must not launch the bead

    const w = COAL.OMEGA;
    const z = COAL.ZETA;
    vx += (-w * w * (x - tx) - 2 * z * w * vx) * dt;
    vy += (-w * w * (y - ty) - 2 * z * w * vy) * dt;
    x += vx * dt;
    y += vy * dt;

    const wr = COAL.OMEGA_R;
    const zr = COAL.ZETA_R;
    vr += (-wr * wr * (r - tr) - 2 * zr * wr * vr) * dt;
    r = Math.max(0, r + vr * dt);

    const sp = Math.hypot(vx, vy);
    const liftWant = COAL.LIFT_MAX * clamp(sp / COAL.LIFT_V, 0, 1);
    lift += (liftWant - lift) * (1 - Math.exp(-(dt * 1000) / COAL.LIFT_TAU));
    const stretchWant = COAL.STRETCH_K * clamp(sp / COAL.STRETCH_V, 0, 1);
    stretch +=
      (stretchWant - stretch) *
      (1 - Math.exp(-(dt * 1000) / COAL.STRETCH_TAU));

    const still =
      Math.abs(x - tx) < 0.05 &&
      Math.abs(y - ty) < 0.05 &&
      Math.abs(r - tr) < 0.02 &&
      sp < 0.6;
    if (still) {
      x = tx;
      y = ty;
      r = tr;
      vx = 0;
      vy = 0;
      vr = 0;
      lift = 0;
      stretch = 0;
    }
    return !still || r > COAL.EPS_R;
  };

  return {
    target,
    drain,
    step,
    sdf,
    get x() {
      return cx();
    },
    get y() {
      return cy();
    },
    get r() {
      return r;
    },
    get seed() {
      return seed;
    },
    get stretch() {
      return stretch;
    },
    get speed() {
      return Math.hypot(vx, vy);
    },
    /** True once the bead carries enough mass to be worth drawing. */
    get alive() {
      return r > COAL.EPS_R;
    },
    /** Unit velocity — the stretch axis. */
    get ux() {
      const s = Math.hypot(vx, vy) || 1;
      return vx / s;
    },
    get uy() {
      const s = Math.hypot(vx, vy) || 1;
      return vy / s;
    },
  };
}

/**
 * The contiguous run of ring vertices lying on one vertical side.
 *
 * Selected by NORMAL rather than by index arithmetic: `buildRest` happens to
 * emit the sides in a known order, but a contour that depends on the internals
 * of another module's loop is a contour that breaks the next time someone
 * changes the vertex budget. Corners are excluded — they carry a bisector
 * normal and a cusp flag, and a merge must never eat one. That is the same
 * rule as the art direction: the rectangle keeps its corners.
 *
 * Returns null when there is no usable run, which is a legitimate answer for a
 * control too small to ride.
 */
export function sideRun(rest, sideX = -1) {
  const n = rest.n;
  let start = -1;
  let len = 0;
  const on = (i) =>
    !rest.sharp[i] &&
    Math.abs(rest.nx[i] - sideX) < 1e-3 &&
    Math.abs(rest.ny[i]) < 1e-3;
  for (let i = 0; i < n; i++) {
    if (!on(i)) continue;
    if (on((i - 1 + n) % n)) continue;
    start = i;
    while (len < n && on((start + len) % n)) len++;
    break;
  }
  // ONE interior vertex is enough. A 54 px field side gets two of them at the
  // ring's ~16 px spacing, and an earlier `len < 3` guard here silently
  // disabled the whole merge on every input on the page while every other
  // check still passed. The dense window is what draws the merge; the run only
  // has to say which vertices it may replace.
  if (start < 0 || len < 1) return null;
  return {
    start,
    len,
    // The cusps bounding the run. They are interpolation ANCHORS — the surface
    // height at the ends of the edge — and are never themselves replaced.
    pre: (start - 1 + n) % n,
    post: (start + len) % n,
  };
}

/**
 * THE UNION CONTOUR — one field membrane and one bead, emitted as one path.
 *
 * Everything outside the merge window is the membrane's own vertices,
 * untouched, so a control with no bead near it round-trips to the exact string
 * `mem.path()` would have produced. Inside the window the surface is re-solved
 * at `WIN_N` samples against the smooth-union, which is where the neck, the
 * engulfed bead and the drawn-out pinch all come from.
 *
 * Returns `merged` as well as the path. The test is not a tuned threshold: the
 * union surface at the bead's own lateral position is either at or beyond the
 * bead's centre — in which case the ring has wrapped it and it must not also
 * be drawn as its own body — or it is short of it, in which case they are two
 * bodies. That flips exactly when the barrier fails, at gap = K/2, where the
 * two drawings are tangent.
 */
export function unionContour(mem, bead, opts = {}) {
  const rest = mem.rest;
  const pts = mem.points();
  const plain = () => splinePath(pts.px, pts.py, pts.sharp);
  const sideX = opts.sideX ?? -1;
  const k = opts.k ?? COAL.K;

  if (!bead.alive) return { d: plain(), merged: false };
  const run = sideRun(rest, sideX);
  if (!run) return { d: plain(), merged: false };

  const n = rest.n;
  const nX = sideX;

  // ── the edge, as an ordered list of anchors ───────────────────────────────
  // pre-cusp · the run's interior vertices · post-cusp. The cusps are in here
  // so the surface height can be interpolated across the WHOLE edge (a 54 px
  // side offers only two interior vertices, which on their own do not span
  // it), and out of the replaceable range so a merge can never eat a corner.
  const anchors = [run.pre];
  for (let j = 0; j < run.len; j++) anchors.push((run.start + j) % n);
  anchors.push(run.post);
  const A = anchors.length;
  const tAt = (a) => rest.by[anchors[a]];
  const hAt = (a) => (pts.px[anchors[a]] - rest.bx[anchors[a]]) * nX;

  const tFirst = tAt(0);
  const tLast = tAt(A - 1);
  const tSign = tLast > tFirst ? 1 : -1;
  const tLo = Math.min(tFirst, tLast);
  const tHi = Math.max(tFirst, tLast);

  /**
   * The membrane's OWN surface height at an arbitrary point along the edge,
   * linearly interpolated between anchors. The dense samples are solved from
   * here rather than from the rest line, so a field being pushed by the
   * pointer at the same time merges from where its surface actually is.
   */
  const surfAt = (tRaw) => {
    const t = clamp(tRaw, tLo, tHi);
    for (let a = 0; a < A - 1; a++) {
      const p = tAt(a);
      const q = tAt(a + 1);
      if ((t - p) * (t - q) <= 0) {
        const u = q === p ? 0 : (t - p) / (q - p);
        return hAt(a) + (hAt(a + 1) - hAt(a)) * u;
      }
    }
    return hAt(0);
  };

  // ── the window ────────────────────────────────────────────────────────────
  // Exactly ±(r + k) from the bead: past that the smooth-min returns the
  // surface unchanged, not approximately but identically. CORNER_KEEP holds
  // the samples clear of the cusps so the last one always lands on the rest
  // line and the spline runs dead straight into the corner.
  const edgeX = rest.bx[anchors[1]];

  // ── ABSORBED, or its own body? ────────────────────────────────────────────
  // The bead's STANDOFF decides it, and nothing else — see COAL.K. Inside K/2
  // every ray that reaches the bead is merged along it too, so this contour can
  // describe the whole silhouette and the bead must not be drawn again. Outside
  // K/2 it is its own body and this contour is the authored rectangle, exactly.
  //
  // Nothing reaches across that gap, on either side, and that is a DRAWING
  // decision rather than a physical one. The smooth-min is perfectly happy to
  // have both surfaces lean toward each other, but the meniscus between two
  // touching bodies is ONE surface: let both contours describe it and both draw
  // it, and the contact plane comes out as a doubled straight line through the
  // middle of the drop. Letting only the field describe it traded that for a
  // cup drawn around the drop instead. Neither is worth having — the merge
  // story is carried by the FUSION, which is a real event at a real threshold,
  // not by two outlines leaning.
  const standoff = (bead.x - edgeX) * nX;
  if (standoff > k / 2) return { d: plain(), merged: false };

  const reach = bead.r + k;
  const lateral = Math.abs(bead.x - edgeX);
  if (lateral > reach) return { d: plain(), merged: false };

  const wLo = Math.max(tLo + COAL.CORNER_KEEP, bead.y - reach);
  const wHi = Math.min(tHi - COAL.CORNER_KEEP, bead.y + reach);
  if (wHi - wLo < 1) return { d: plain(), merged: false };

  const limit = 2 * bead.r + k + COAL.LIFT_MAX;
  const outX = new Array(COAL.WIN_N + 1);
  const outY = new Array(COAL.WIN_N + 1);

  // Emitted in RING INDEX order — a span walked backwards produces a
  // self-crossing contour, which reads as a shape with a hole in it.
  const from = tSign > 0 ? wLo : wHi;
  const to = tSign > 0 ? wHi : wLo;
  for (let s = 0; s <= COAL.WIN_N; s++) {
    const t = from + ((to - from) * s) / COAL.WIN_N;
    const sx = edgeX + nX * surfAt(t);
    outX[s] = sx + nX * unionReach(sx, t, nX, 0, bead.sdf, k, limit);
    outY[s] = t;
  }
  const merged = true;

  // ── splice ────────────────────────────────────────────────────────────────
  // Which of the run's own vertices fall inside the window: those are the ones
  // the dense samples stand in for.
  let jLo = run.len;
  let jHi = -1;
  for (let j = 0; j < run.len; j++) {
    const t = rest.by[(run.start + j) % n];
    if (t >= wLo && t <= wHi) {
      if (j < jLo) jLo = j;
      if (j > jHi) jHi = j;
    }
  }
  if (jHi < jLo) {
    // A window narrower than the gap between two ring vertices still has to be
    // drawn — it just stands in for the single nearest one.
    let best = 0;
    let bestD = Infinity;
    for (let j = 0; j < run.len; j++) {
      const d = Math.abs(rest.by[(run.start + j) % n] - bead.y);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    jLo = best;
    jHi = best;
  }

  const px = [];
  const py = [];
  const sharp = [];
  for (let i = 0; i < n; i++) {
    const cyc = (run.start + i) % n;
    if (i < run.len && i >= jLo && i <= jHi) {
      if (i === jLo) {
        for (let s = 0; s <= COAL.WIN_N; s++) {
          px.push(outX[s]);
          py.push(outY[s]);
          sharp.push(0);
        }
      }
      continue;
    }
    px.push(pts.px[cyc]);
    py.push(pts.py[cyc]);
    sharp.push(pts.sharp[cyc]);
  }

  return { d: splinePath(px, py, sharp), merged };
}

/**
 * The bead drawn as its OWN body — valid only while `unionContour` reports it
 * unmerged, i.e. standing more than K/2 off the edge.
 *
 * It does NOT reach toward the surface it is approaching, and that is a
 * deliberate subtraction rather than a missing feature. Two bodies about to
 * touch share ONE meniscus; if both contours describe it, both draw it, and the
 * contact plane appears as a doubled straight line across the middle of the
 * drop. Letting only the field describe it drew a cup around the drop instead.
 * The merge is carried by the fusion event at K/2, which is a real threshold
 * with a real silhouette on both sides of it — not by two outlines leaning at
 * each other across a gap they cannot both own.
 *
 * The stretch is applied to the POINTS rather than through the membrane's
 * normal channel, because elongation is not a displacement along a normal:
 * pushing every vertex out along its own normal inflates a shape, it does not
 * draw it out.
 */
export function beadContour(mem, bead) {
  const pts = mem.points();
  const n = pts.px.length;
  const scale = bead.r / COAL.R;
  const sa = 1 + bead.stretch;
  const sb = 1 / sa;
  const ux = bead.ux;
  const uy = bead.uy;
  const ox = new Array(n);
  const oy = new Array(n);

  for (let i = 0; i < n; i++) {
    // scale first: the ring is authored at COAL.R and the bead's mass is a
    // spring, so the reach must be measured from where the surface IS.
    let dx = pts.px[i] * scale;
    let dy = pts.py[i] * scale;
    if (bead.stretch > 1e-4) {
      const along = dx * ux + dy * uy;
      const across = -dx * uy + dy * ux;
      const a2 = along * sa;
      const c2 = across * sb;
      dx = a2 * ux - c2 * uy;
      dy = a2 * uy + c2 * ux;
    }
    ox[i] = bead.x + dx;
    oy[i] = bead.y + dy;
  }
  return splinePath(ox, oy, null);
}
