/**
 * COALESCENCE — two vector surfaces becoming one, and coming apart again.
 *
 * `membrane.mjs` gave a single closed contour a hand and a strike. It has no
 * notion of a SECOND body, so every membrane on the page is an island: a button
 * can be pushed, dented and struck, but nothing can ever arrive at it, touch
 * it, or leave. On a site whose whole argument is one continuous liquid, the
 * form was the last place where two pieces of that liquid could not meet.
 *
 * This kernel is that meeting: a drop that rides a field's edge, is absorbed
 * into it in a wetted foot, and — when the reader moves on — is pulled away on
 * a filament that stretches, thins at the waist, and lets go.
 *
 * ── Why not the goo filter ────────────────────────────────────────────────
 *
 * The usual way to do this on the web is `feGaussianBlur` + a steep
 * `feColorMatrix` alpha ramp: blur two shapes until they overlap, then throw
 * away the soft edge. It is cheap, it is convincing, and it is wrong here for
 * two reasons. It only reads on FILLED shapes — these fields are 1 px hairlines
 * and a blurred hairline is a glow, not an edge. And it is a raster operation
 * on a live surface, which on a page already running a WebGL fluid is exactly
 * the kind of second, unsynchronised visual engine AGENTS §4.15 forbids.
 * Everything here is GEOMETRY: one path, one stroke, no filter.
 *
 * ── Why not a smooth-minimum either ──────────────────────────────────────
 *
 * The first version of this kernel WAS a smooth-min — the vector half of what
 * `sdf-glass-shader.mjs` runs on the GPU — and it merged two bodies correctly.
 * It could not make a NECK. A smooth-min's bridge is always fat, and it does
 * not thin as the bodies separate: it stands at full width until the barrier
 * between them fails and then vanishes in a single frame. That is a property
 * of the blend function, not a tuning failure. Real necks come from surface
 * tension, so this one is AUTHORED — see `NECK`.
 *
 * The consequence is worth stating plainly, because it is what makes the
 * geometry here tractable at all: the bridge is traced as a graph over the
 * NECK AXIS, the line from the surface's anchor to the drop's centre. In that
 * frame the silhouette is single-valued from foot to tip no matter how far the
 * drop has travelled, so there is no topology to switch on and no limit on how
 * long the filament can get.
 *
 * ── The art direction ────────────────────────────────────────────────────
 *
 * SOFT TO SOFT. An earlier draft merged the drop against a square-cornered
 * rectangle on the argument that the liquid should give up its shape to the
 * structure and never the reverse. The owner asked for both sides soft, so the
 * field's ring is rounded too (`FIELD_R`) — which turns out to matter more than
 * the visible curve: a rounded ring has NO CUSPS, and a cusp is a hard stop for
 * the tension operator. Rounded, a wave launched on one edge carries the whole
 * way round instead of dying in the first corner it reaches.
 *
 * What survives from that draft is the corner rule, now about arcs rather than
 * cusps: the bridge grows out of the STRAIGHT run of an edge or not at all, and
 * never reaches a corner. `verify-coalesce.mjs §10` is the standing guard.
 *
 * DOM-free and deterministic on purpose — `scripts/verify-coalesce.mjs` runs it
 * in plain node, exactly like `membrane.mjs`.
 */

import { splinePath } from "./membrane.mjs";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const COAL = {
  /**
   * Bead radius (px). Free to be a real drop now: the constraint that pinned it
   * to 8 was the graph-over-the-edge one, and the neck tracer does not have it.
   */
  R: 11,
  /**
   * FIELD CORNER RADIUS (px).
   *
   * The first version of this feature merged soft into HARD — a drop against a
   * square-cornered rectangle, on the argument that the liquid should give up
   * its shape to the structure and never the reverse. The owner asked for soft
   * to soft, so the rectangle softens too.
   *
   * What that buys is not only the visible curve. `buildRest` with a radius
   * emits a ring with NO CUSPS, and a cusp is a hard stop for the tension
   * Laplacian: a wave launched on one edge used to die in the corner it
   * reached. Rounded, the whole perimeter is one continuous surface and a
   * ripple travels all the way round. Most of what reads as softness here is
   * that continuity rather than the radius itself.
   *
   * 10 px leaves a 37 px straight run on a 57 px field, which is what the
   * neck's foot has to fit inside — see `NECK.BASE`.
   */
  FIELD_R: 10,
  /** Ring vertices around the bead. */
  RING_N: 44,
  /**
   * Lobe depth on the drop's rest contour, as a fraction of R.
   *
   * ZERO, and that is a correction rather than a shortcut. The idea was the
   * site's own — it draws no perfect circles anywhere, and `lobedCirclePath`
   * carries the same irregularity for the CTA flood — but at 3.5% on an 11 px
   * drop it comes to 0.77 px peak to peak, which lands exactly in the band
   * `cta-membrane-spec.md §5` already ruled on: "sub-pixel motion on a 1 px
   * hairline is a bug, not life… it renders as uneven antialiasing, a shaky
   * hand-drawn line." That finding turned off `BOW` and `BREATH_A` on the
   * buttons; this reintroduced it on the drop.
   *
   * Making it legible instead would need ≥ 9% on a body this small, which is a
   * blobby ball rather than a drop. So the outline is a true circle, and the
   * organic reading comes from the things that ARE above a pixel: the velocity
   * stretch, the hand, the strike, and the bridge it hangs from.
   *
   * `dropRing` still takes the parameter — a larger drop could afford one.
   */
  LOBE: 0,

  // ── travel ────────────────────────────────────────────────────────────────
  /**
   * Position spring — runs, then settles through one small overshoot.
   *
   * Slower than it was (16). At that stiffness the whole crossing was over in
   * about 350 ms, which is quick enough that the stretch and the break read as
   * one event rather than three. The drop has a bridge to draw out now; it can
   * afford the time to do it.
   */
  OMEGA: 8.2,
  ZETA: 0.92,
  /**
   * THE TARGET'S OWN LAG (ms) — and this is what "smooth" actually costs.
   *
   * A spring chasing a STEP target has its maximum acceleration at t = 0. On a
   * 120 px hop that was 0 → 300 px/s inside ONE frame, 18 750 px/s² from a
   * standing start, with the jerk simply undefined. The drop did not ease into
   * motion, it was kicked into it — and no amount of softening the spring can
   * fix that, because however low ω goes the acceleration still steps
   * discontinuously from zero to ω²Δ the moment the target moves.
   *
   * So the target is smoothed instead. A first-order lag in front of the
   * spring means the spring never sees a discontinuity: acceleration starts at
   * zero, rises, and falls. Two cascaded systems, and the second derivative is
   * continuous, which is the whole of what the eye reads as smoothness.
   */
  TARGET_TAU: 135,
  /** Radius spring. Critically damped: mass arriving does not bounce. */
  OMEGA_R: 9,
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
  LIFT_MAX: 54,
  /**
   * Speed (px/s) at which the lift is fully out. It tracks OMEGA: a gentler
   * spring reaches lower speeds, and at 320 a plain field-to-field hop peaked
   * at exactly BREAK — the drop slid along still attached instead of pinching
   * off, on the most common move there is.
   */
  LIFT_V: 225,
  /**
   * ASYMMETRIC, and this is the whole feel of the arrival.
   *
   * Liquid RUNS when it is let go and is drawn back slowly. The lift originally
   * used one constant, and the return was a decelerating rush: 44 px of lift
   * collapsed to 2 in 384 ms, so the bridge re-formed and contracted almost as
   * fast as the drop had left. The departure should be a flick; the arrival is
   * a settling.
   */
  LIFT_TAU_OUT: 70, // ms — thrown off the rail
  LIFT_TAU_IN: 240, // ms — drawn back onto it

  /**
   * VELOCITY STRETCH — the drawn-out teardrop of a drop in motion.
   *
   * Area-preserving: elongated by (1+e) along the direction of travel and
   * narrowed by 1/(1+e) across it, so a moving bead has exactly the mass of a
   * still one. `fluid-core`'s droplets already deform this way; this is the
   * same idea at the scale of one vector contour.
   */
  STRETCH_K: 0.55,
  STRETCH_V: 700, // px/s at which the stretch is fully out
  /** Same asymmetry, same reason: drawn out fast, relaxes slowly. */
  STRETCH_TAU_OUT: 55,
  STRETCH_TAU_IN: 300,

  /**
   * THE NECK — the filament between the surface and the drop.
   *
   * AUTHORED, not derived, and that is the whole reason it exists. A
   * smooth-minimum cannot make a long thin neck: its bridge between two bodies
   * is always fat, and it does not thin as they separate — it stands at full
   * width until the barrier fails at gap = K/2 and then vanishes in one frame.
   * That is a property of the blend function, not a tuning failure, and it is
   * why the first version of this feature had a hard pinch and no stretch.
   *
   * Real necks come from surface tension. This one is traced as a graph over
   * the NECK AXIS — the line from the surface's anchor to the drop's centre —
   * instead of over the edge. In that frame the silhouette is single-valued
   * from foot to tip no matter how far the drop has travelled, so the shape
   * can be anything a liquid bridge does: a wide wetted foot, a waist that
   * thins under extension, a bulb, and a tip. The ears problem that forced
   * K/2 = R does not exist here, because nothing is sampled over the edge.
   *
   * Extension `t = L / BREAK` drives all of it. Both the foot and the waist go
   * to zero at t = 1, so the connection does not snap out of existence — it
   * thins to nothing and the surface is already flat when it lets go. The
   * waist thins faster than the foot (1.9 vs 0.55), which is what leaves a
   * visible thread hanging on well after the bulge has flattened.
   */
  NECK: {
    /** Axis length (px) at which the filament fails. ~2 bead diameters. */
    BREAK: 42,
    /** Wetted foot on the surface, x R, at zero extension. */
    BASE: 1.45,
    BASE_TAPER: 0.55,
    /** Waist half-width, x R, at zero extension. */
    WAIST: 0.42,
    WAIST_TAPER: 1.9,
    /** Floor on the waist (px) so the thread stays drawable to the last. */
    WAIST_MIN: 0.75,
    /** How convex the run from foot to waist is. Higher = a tighter throat. */
    HORN_P: 2.1,
    /** The wetting fillet's reach at the wall, x R. */
    FILLET: 0.22,
    /** Where the fillet hands over to the taper, x the foot width. */
    SHOULDER: 0.72,
    /** Samples along the axis. */
    N: 52,
    /** Smoothing passes over the sampled profile — this IS the gooey fillet. */
    SMOOTH: 3,
  },

  /**
   * THE LEAN — what a field that is NOT holding the bead does about one going
   * past. A shallow bulge toward it, no neck and no bulb, so the whole board
   * answers a travelling drop instead of only the two fields it belongs to.
   * Applied through the membrane's render-only `push` channel, so it cannot
   * touch exact rest.
   */
  LEAN_A: 3.4, // px at closest approach
  LEAN_R: 150, // px — how far away a field starts to notice
  LEAN_W: 34, // px — how wide along the edge the bulge spreads


  /** Below this the bead has drained and nothing is drawn at all. */
  EPS_R: 0.35,

  /**
   * How long the free drop takes to cross-fade into the contour that absorbs
   * it, and back out again (ms). A DURATION, not a time constant.
   *
   * The drop and the bulb of the bridge occupy the SAME circle at the moment
   * the two representations swap — same centre, same radius — so overlapping
   * them costs nothing and hides nothing. What the fade dissolves is the
   * BRIGHTNESS step: the free drop is full cyan, and the contour it merges
   * into is `--color-paper-faint` unless the field happens to be focused.
   * Switched hard, that reads as a light going off, four times a lap.
   *
   * The first attempt at this was an exponential lag, and it did ramp — the
   * opacity attribute went 0.86 → 0.58 → 0.07 exactly as intended. It still
   * read as a cut, because an exponential spends most of its brightness in the
   * first frame or two (0.63 after 90 ms) and then crawls through a long tail
   * where nothing appears to happen. The eye reads that as "snap dim, then
   * gone". A fade has to spend its brightness EVENLY, which means a fixed
   * duration with an ease on it, not a decay.
   */

  /**
   * The lift below which the drop has reached the field it was aimed at (px).
   *
   * = R, and that is a geometric fact rather than a tuned number: at a lift of
   * R the drop's near face is exactly on the edge. It is touching. Below that
   * it is overlapping and merely settling deeper into its foot.
   *
   * Distinct from the rest-snap's 0.25 px, and the distinction buys real time.
   * `settled` is the sleep signal — everything spent, exact, nothing left to
   * integrate. But 656 ms of a 1392 ms stop is the last 26 px of the return
   * drawing itself in on LIFT_TAU_IN, and an autonomous tour that waits for
   * all of it stands still through most of its own cycle.
   *
   * So the tour moves on while the tail is still finishing underneath it. The
   * drop is unambiguously fused at each stop and the walk still flows, which
   * is the whole point: THE TOUR BRUSHES, FOCUS FUSES. Stop for a field and it
   * settles all the way into the wetted foot; pass by and it does not.
   *
   * Track R if R ever changes.
   */
  ARRIVE_LIFT: 11,

  /**
   * How hard letting go rings the drop.
   *
   * 1.6, not the 0.6 it started at, and for the same reason the lobe went to
   * zero: on an 11 px body a strike of 0.6 came out as 0.51 px of wobble —
   * under a pixel, so it read as antialiasing rather than as a body reacting.
   * A deformation on a hairline outline either clears a pixel or should not be
   * there at all.
   */
  PINCH_KICK: 1.6,
};

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
  // The smoothed target the spring actually chases. See TARGET_TAU.
  let stx = 0;
  let sty = 0;
  /** Outward direction of the edge being ridden (unit). */
  let ox = -1;
  let oy = 0;
  let lift = 0;
  let stretch = 0;
  let placed = false;
  let settled = false;
  let arrived = false;
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
      stx = x;
      sty = y;
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

    // The target eases toward where it was aimed; the spring chases THAT.
    const kt = 1 - Math.exp(-(dt * 1000) / COAL.TARGET_TAU);
    stx += (tx - stx) * kt;
    sty += (ty - sty) * kt;

    const w = COAL.OMEGA;
    const z = COAL.ZETA;
    vx += (-w * w * (x - stx) - 2 * z * w * vx) * dt;
    vy += (-w * w * (y - sty) - 2 * z * w * vy) * dt;
    x += vx * dt;
    y += vy * dt;

    const wr = COAL.OMEGA_R;
    const zr = COAL.ZETA_R;
    vr += (-wr * wr * (r - tr) - 2 * zr * wr * vr) * dt;
    r = Math.max(0, r + vr * dt);

    const sp = Math.hypot(vx, vy);
    const liftWant = COAL.LIFT_MAX * clamp(sp / COAL.LIFT_V, 0, 1);
    const liftTau =
      liftWant > lift ? COAL.LIFT_TAU_OUT : COAL.LIFT_TAU_IN;
    lift += (liftWant - lift) * (1 - Math.exp(-(dt * 1000) / liftTau));
    const stretchWant = COAL.STRETCH_K * clamp(sp / COAL.STRETCH_V, 0, 1);
    const stretchTau =
      stretchWant > stretch ? COAL.STRETCH_TAU_OUT : COAL.STRETCH_TAU_IN;
    stretch +=
      (stretchWant - stretch) * (1 - Math.exp(-(dt * 1000) / stretchTau));

    // WHAT IS DRAWN, not what the spring is chasing. The drop is rendered at
    // `x + ox * lift`, so a settled `x` with a lift still out is a drop still
    // visibly off the edge — and testing only `x` here meant the snap below
    // fired mid-return and zeroed the rest of the lift in one frame. Whatever
    // the reader can still see has to be counted as movement.
    const still =
      Math.abs(x - tx) < 0.05 &&
      Math.abs(y - ty) < 0.05 &&
      Math.abs(r - tr) < 0.02 &&
      sp < 0.6 &&
      lift < 0.25 &&
      stretch < 0.01;
    // VISIBLY arrived, as opposed to arithmetically finished. See ARRIVE_LIFT.
    arrived =
      Math.abs(x - tx) < 0.6 &&
      Math.abs(y - ty) < 0.6 &&
      Math.abs(r - tr) < 0.3 &&
      lift < COAL.ARRIVE_LIFT;
    settled = still;
    if (still) {
      x = tx;
      y = ty;
      stx = tx;
      sty = ty;
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
    /**
     * Arithmetically finished: position, mass, lift and stretch all spent, and
     * the next step will snap to exact rest. This is the SLEEP signal.
     */
    get settled() {
      return settled;
    },
    /**
     * Visually finished — the drop has stopped moving as far as the eye is
     * concerned, with the lift under ARRIVE_LIFT. This is what an autonomous
     * tour paces itself off: waiting for `settled` instead spends a third of a
     * second standing still watching sub-pixel motion.
     */
    get arrived() {
      return arrived;
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
 * THE NECK PROFILE — half-width of the filament at each point along its axis.
 *
 * Three pieces, maxed together and then smoothed:
 *
 *   the HORN, running from the wetted foot on the surface down to the waist.
 *   `HORN_P` decides how convex that run is: a high exponent drops to the
 *   waist quickly and leaves a tight throat, a low one leaves a shallow
 *   funnel. It is windowed to nothing past the drop so the tip can close.
 *
 *   the BULB, the drop itself as a circle about the axis at a = L.
 *
 *   the SMOOTHING, which is not a tidy-up. `max` of a horn and a circle has a
 *   corner where they cross, and a corner on a liquid silhouette reads as two
 *   shapes overlapping rather than as one body. Three passes of a 3-tap kernel
 *   over the sampled profile IS the gooey fillet, and it costs nothing.
 *
 * Both the foot and the waist are driven to zero at full extension, so a
 * breaking neck flattens out rather than vanishing mid-air.
 */
/**
 * Where sample i sits along the neck's axis.
 *
 * Cosine-spaced, dense at BOTH ends, and it has to be. The profile is a graph
 * over the axis, and a graph is at its steepest exactly where the surface
 * turns to face along it — which happens twice:
 *
 *   at the FOOT, because a wetting meniscus leaves the surface almost parallel
 *   to it, so the profile loses most of its width in the first fraction of a
 *   pixel. Sampled evenly, that collapse fell between sample 0 and sample 1
 *   and drew as a notch.
 *
 *   at the TIP, because the drop is a circle and a circle's pole has infinite
 *   slope in this parameterisation. Squaring the parameter fixed the foot and
 *   starved the tip, and the drop came out as a pointed leaf.
 *
 * One cosine puts samples at both, which is the whole reason Chebyshev spacing
 * exists. Both the profile and the banks read positions through here, or they
 * would be describing two different curves.
 */
export function neckA(i, n, aTip) {
  return aTip * 0.5 * (1 - Math.cos(Math.PI * (i / n)));
}

export function neckProfile(L, r, out, maxBase = Infinity) {
  const N = COAL.NECK.N;
  const nk = COAL.NECK;
  const t = clamp(L / nk.BREAK, 0, 1);
  // The foot is where the shape MEETS THE WALL, so it can never be narrower
  // than the drop's own cross-section there. Capped below that, the profile
  // stepped outward between sample 0 and sample 1 and the contour folded back
  // through itself — the cap has to yield to the geometry, not the other way
  // round. When the two genuinely fight, the drop is jammed into a corner,
  // which the travel never produces.
  const atWall = Math.sqrt(Math.max(r * r - L * L, 0));
  const base = Math.max(
    Math.min(r * nk.BASE * Math.pow(1 - t, nk.BASE_TAPER), maxBase),
    atWall,
  );
  // The waist holds a floor until the very end of the extension: a filament
  // thinner than the stroke that draws it is a filament nobody can see, and
  // the drop then reads as already detached while it is still attached.
  const raw = r * nk.WAIST * Math.pow(1 - t, nk.WAIST_TAPER);
  const waist = t < 0.985 ? Math.max(raw, nk.WAIST_MIN) : raw;
  const aTip = L + r;

  // THE WETTING FILLET. Right at the wall the surface must leave tangentially
  // or the junction draws as a notch, and tangential means dh/da -> -infinity,
  // which is what a sqrt gives. It governs only the first fraction of the run:
  // applied across the WHOLE horn it collapsed the profile inside a pixel and
  // jammed the throat against the wall — 0.8 px out of an 8 px neck.
  const filRun = Math.max(r * nk.FILLET, 0.6);
  const shoulder = base * nk.SHOULDER;
  const kFil = (base - shoulder) / Math.sqrt(filRun);

  // THE THROAT exists only once the drop is clear of the wall. Below that it
  // still overlaps the surface, there is no bridge to thin, and pulling the
  // profile down to a waist invents a pinch in what should be a wetted bulge.
  const clear = clamp((L - r) / r, 0, 1);
  const throat = shoulder + (waist - shoulder) * clear;
  const hornRun = Math.max(L, r * 0.9);

  for (let i = 0; i <= N; i++) {
    const a = neckA(i, N, aTip);
    let horn;
    if (a < filRun) {
      horn = base - kFil * Math.sqrt(a);
    } else {
      const u = clamp((a - filRun) / Math.max(hornRun - filRun, 1e-3), 0, 1);
      horn = throat + (shoulder - throat) * Math.pow(1 - u, nk.HORN_P);
    }
    if (a > L) horn *= Math.max(0, 1 - (a - L) / r);
    const dz = a - L;
    const bulb = Math.sqrt(Math.max(r * r - dz * dz, 0));
    out[i] = horn > bulb ? horn : bulb;
  }
  out[N] = 0; // the tip closes

  for (let pass = 0; pass < nk.SMOOTH; pass++) {
    let prev = out[0];
    for (let i = 1; i < N; i++) {
      const cur = out[i];
      out[i] = 0.25 * prev + 0.5 * cur + 0.25 * out[i + 1];
      prev = cur;
    }
  }
  return { base: out[0], waist, connected: t < 1 };
}

/**
 * ONE membrane and ONE drop, emitted as one path.
 *
 * `opts.own` decides which of two things a field is doing. The field the bead
 * belongs to draws the whole event — foot, neck, bulb — and reports `merged`,
 * so the caller knows not to draw the drop a second time. Every other field on
 * the form LEANS instead: a shallow bulge toward the drop going past, through
 * the membrane's render-only `push` channel. Exactly one field may own the
 * bead, or two of them would each draw the bulb.
 *
 * With no drop in reach, both paths return the string `mem.path()` would have
 * emitted, character for character.
 */
export function unionContour(mem, bead, opts = {}) {
  const rest = mem.rest;
  const pts = mem.points();
  const plain = () => splinePath(pts.px, pts.py, pts.sharp);
  const sideX = opts.sideX ?? -1;
  const own = opts.own !== false;

  if (!bead.alive) return { d: plain(), merged: false };

  const run = sideRun(rest, sideX);
  if (!run) return { d: plain(), merged: false };

  const n = rest.n;
  const nX = sideX;
  const edgeX = rest.bx[(run.start + 1) % n];

  // The anchor: the point on this edge nearest the drop, held inside the
  // straight run so it never climbs a corner arc. Clamping is what makes the
  // neck TRAIL — once the drop has descended past the foot of the edge the
  // anchor stays put and the axis tilts, exactly as a filament left behind.
  // The straight side's true extent, taken from the GEOMETRY and not from the
  // vertices sitting on it. A 57 px field carries only two or three ring
  // vertices on its short side, so their span understates the run by most of
  // its length — and clamping the anchor to that span left no room to clamp
  // into, which put the bridge's foot on a corner arc.
  let yLo;
  let yHi;
  if (rest.radius > 0) {
    yLo = rest.radius;
    yHi = rest.h - rest.radius;
  } else {
    yLo = Infinity;
    yHi = -Infinity;
    for (let j = 0; j < run.len; j++) {
      const y = rest.by[(run.start + j) % n];
      if (y < yLo) yLo = y;
      if (y > yHi) yHi = y;
    }
  }
  const ax = edgeX;
  const ay = clamp(bead.y, yLo, yHi);
  const dx = bead.x - ax;
  const dy = bead.y - ay;
  const L = Math.hypot(dx, dy);

  // ── the LEAN ──────────────────────────────────────────────────────────────
  if (!own) {
    if (L > COAL.LEAN_R) return { d: plain(), merged: false };
    const fall = 1 - L / COAL.LEAN_R;
    const amp = COAL.LEAN_A * fall * fall;
    if (amp < 0.02) return { d: plain(), merged: false };
    const push = new Float32Array(n);
    for (let j = 0; j < run.len; j++) {
      const i = (run.start + j) % n;
      const q = (rest.by[i] - ay) / COAL.LEAN_W;
      push[i] = amp * Math.exp(-q * q);
    }
    return { d: mem.path(0, push), merged: false };
  }

  // ── the NECK ──────────────────────────────────────────────────────────────
  const prof = new Float64Array(COAL.NECK.N + 1);
  // THE FOOT IS CAPPED, the anchor is not moved. The foot spans ±base either
  // side of the anchor and has to land inside the STRAIGHT run, but clamping
  // the ANCHOR to make room tilts the axis along the wall — and a bridge whose
  // axis runs parallel to the surface has its banks pointing INTO the field,
  // which folds the contour through itself. Capping the foot to the room
  // actually available keeps the axis pointing where it should and costs
  // nothing in the only case that matters: a drop at a field's centre has
  // 18.5 px of room either way and is never capped.
  const maxBase = Math.max(Math.min(ay - yLo, yHi - ay), 0.5);
  const info = neckProfile(L, bead.r, prof, maxBase);
  if (!info.connected) return { d: plain(), merged: false };

  // Axis frame. `u` runs from the surface out to the drop; the banks lie
  // either side of it.
  const ux = L > 1e-4 ? dx / L : nX;
  const uy = L > 1e-4 ? dy / L : 0;
  // The +y side, which is where the walk ENTERS the neck: the ring's left run
  // is traversed from high y to low y.
  let hiX = -uy;
  let hiY = ux;
  if (hiY < 0) {
    hiX = -hiX;
    hiY = -hiY;
  }
  // At the foot the offset must lie ALONG the edge, or the neck's base would
  // float off the contour it is supposed to grow out of. It swings into the
  // axis frame over the first part of the run.
  const blendOver = Math.max(L * 0.45, bead.r * 0.5);

  const N = COAL.NECK.N;
  const aTip = L + bead.r;
  const bankX = new Array(N + 1);
  const bankY = new Array(N + 1);
  const backX = new Array(N + 1);
  const backY = new Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const a = neckA(i, N, aTip);
    const w = clamp(a / blendOver, 0, 1);
    let ox = hiX * w;
    let oy = 1 + (hiY - 1) * w;
    const m = Math.hypot(ox, oy) || 1;
    ox /= m;
    oy /= m;
    const cxp = ax + ux * a;
    const cyp = ay + uy * a;
    const h = prof[i];
    bankX[i] = cxp + ox * h;
    bankY[i] = cyp + oy * h;
    backX[i] = cxp - ox * h;
    backY[i] = cyp - oy * h;
  }

  // ── splice ────────────────────────────────────────────────────────────────
  // The foot spans the edge between the two base points; every ring vertex
  // inside it is stood in for by the neck.
  const footHi = ay + info.base;
  const footLo = ay - info.base;
  let jLo = run.len;
  let jHi = -1;
  for (let j = 0; j < run.len; j++) {
    const y = rest.by[(run.start + j) % n];
    if (y <= footHi && y >= footLo) {
      if (j < jLo) jLo = j;
      if (j > jHi) jHi = j;
    }
  }
  if (jHi < jLo) {
    let best = 0;
    let bestD = Infinity;
    for (let j = 0; j < run.len; j++) {
      const d = Math.abs(rest.by[(run.start + j) % n] - ay);
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
  // Cosine spacing crowds samples hard at both ends of the axis, and several of
  // them land inside the 0.1 px the path is rounded to. Emitting all of them
  // costs path bytes for points that are the same point, and leaves ZERO-LENGTH
  // segments in the contour — which have no orientation, so anything reasoning
  // about the curve's geometry (a self-intersection check, a renderer's
  // join) is working with a degenerate edge.
  const put = (x, y, sh) => {
    const m = px.length - 1;
    if (m >= 0 && Math.abs(px[m] - x) < 0.05 && Math.abs(py[m] - y) < 0.05) return;
    px.push(x);
    py.push(y);
    sharp.push(sh);
  };
  for (let i = 0; i < n; i++) {
    const cyc = (run.start + i) % n;
    if (i < run.len && i >= jLo && i <= jHi) {
      if (i === jLo) {
        // out along the +y bank, around the tip, back down the -y bank
        for (let k = 0; k <= N; k++) put(bankX[k], bankY[k], 0);
        for (let k = N; k >= 0; k--) put(backX[k], backY[k], 0);
      }
      continue;
    }
    put(pts.px[cyc], pts.py[cyc], pts.sharp[cyc]);
  }

  return { d: splinePath(px, py, sharp), merged: true };
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
