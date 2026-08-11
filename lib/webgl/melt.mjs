/**
 * The §3.3 MELT KERNEL — one form becoming another, node-runnable.
 *
 * Split out of field-drivers.ts under the same rule phys.mjs already follows:
 * the pure, shared vocabulary lives in .mjs so the node harnesses can import it
 * without a TS toolchain, and field-drivers.ts re-exports it so every
 * browser-side import stays unchanged. What made that necessary here is
 * scripts/_melt-sim.mjs — an offline port of the fragment shader's field that
 * profiles every melt in seconds instead of minutes. A simulator holding its own
 * copy of these curves would drift from the shipped melt and start lying; this
 * way it cannot, because it runs THIS file.
 *
 * The hero autocycle (FieldMorphHero) and the Services scrub (scenes/site.ts)
 * share this vocabulary but are NOT the same melt: they agree on geometry,
 * timing and solidity (meltDroplet) and differ in exactly one thing — the hero
 * additionally shrinks radius to zero at both ends, Services carries the whole
 * handoff on density. See packBridge for why each is right where it is.
 */
import { SDF_MELT_ERODE } from "./sdf-glass-shader.mjs";
import { EASE_POINTS } from "../animation/easings.mjs";
import { CLOUDS, N, clamp01, smooth01 } from "./phys.mjs";

// ── §3.3 melt constants (single source — hero + services scrub) ───────────────
export const STAGGER = 0.25; // fraction of the timeline sweeping left → right
export const RADIUS_LEAD = 1.18; // radius finishes ~18% ahead of position
// p-window where a form hands off to / from droplets.
//
// Form A's weight support is p ∈ [0, BRIDGE] and form B's is p ∈ [1 - BRIDGE, 1],
// so at 0.38 the two are DISJOINT: across p ∈ [0.38, 0.62] — a quarter of every
// melt — neither form has any weight and the droplet cloud carries the picture
// alone. That is the DESIGN, not a bug: the cloud interpolates POSITIONS, which
// is the only real morph available here, and the note on bridgePresence below
// says the two are interchangeable.
//
// They stopped being interchangeable, which is what produced the "midway it
// jumps to the last morph" report. Measured through one melt at 1440x900, lit
// liquid area per frame against the endpoints:
//   m=0.19  100%   (form A solid)
//   m=0.30   49%   <- half the liquid gone in a single scroll step
//   m=0.41…0.70  ~52%   <- the void; droplets only, at half a form's solidity
//   m=0.82   94%   <- destination form slams back
// Widening the morph window (MELT_LO/HI 0.35/0.65 → 0.12/0.88) stretched that
// hole from ~65px of scroll to ~164px, which is why a long-standing shortfall
// only became visible now. Two separate things were wrong and BOTH are fixed
// below, neither of them here: the handoff SCHEDULE was modelled on a form-area
// law that does not hold (bridgePresence), and the cloud is genuinely less
// solid than the form it stands in for (FORM_SOLIDITY). Not a wider BRIDGE.
//
// Widening it was tried and measured, and is wrong. The field is THRESHOLDED,
// so summing two different shapes at partial weight is a cross-dissolve, not a
// morph: at 0.70 both forms sit at ~0.57 and neither clears the iso level (85%
// avg with a 46% dip); at 0.82 both sit at ~0.93 and their UNION clears it
// everywhere (125% avg — the liquid visibly swells). 0.50 + swell scored the
// same as 0.38 + swell (mid-avg 102% vs 101%), so the original value stands and
// the shared hero melt keeps its signed-off timing.
export const BRIDGE = 0.38;

/** Standard cubic-bezier easing evaluator (Newton + bisection fallback). */
function cubicBezier(p1x, p1y, p2x, p2y) {
  const cx = 3 * p1x,
    bx = 3 * (p2x - p1x) - cx,
    ax = 1 - cx - bx;
  const cy = 3 * p1y,
    by = 3 * (p2y - p1y) - cy,
    ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t;
  const Y = (t) => ((ay * t + by) * t + cy) * t;
  const DX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 5; i++) {
      const e = X(t) - x;
      if (Math.abs(e) < 1e-5) return Y(t);
      const d = DX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0,
      hi = 1;
    t = x;
    while (hi - lo > 1e-5) {
      t = (lo + hi) / 2;
      if (X(t) < x) lo = t;
      else hi = t;
    }
    return Y(t);
  };
}
export const arrive = cubicBezier(...EASE_POINTS.arrive);

export function bridgeRadiusEnvelope(p) {
  const rPad = BRIDGE * 0.35;
  const rWin = BRIDGE * 0.55;
  return (
    smooth01((p - rPad) / rWin) * (1 - smooth01((p - (1 - rPad - rWin)) / rWin))
  );
}

/**
 * The handoff FLOOR. The bridge envelope must never drive a droplet's presence
 * all the way down, because a cloud whose presence is scaled toward zero comes
 * apart: two droplets only neck while their gap is under 0.83 x radius, so the
 * ramps used to shatter the melt into loose beads at both ends. Rendering the
 * real bridge cloud and counting connected bodies across the ramp:
 *
 *   p      radius envelope (was)   density envelope + this floor
 *   0.16   34 bodies, largest 8%    5 bodies, largest 62%
 *   0.80   48 bodies, largest 4%   12 bodies, largest 19%
 *   0.30    3 bodies, largest 73%   3 bodies, largest 73%   (identical mid-melt)
 *
 * The remaining presence is taken away by the FORM, not by the envelope:
 * formShield already suppresses droplets once they are under a solid surface,
 * which is what the envelope was reaching for in the first place.
 *
 * …but it cannot be an actual floor. Presence must still reach 0 at both ends,
 * because the melt hands back to a state where these droplets are fully
 * absorbed; a floor left a 0.6 step at the release and moved the centre of mass
 * 113x the journey's median step. So the ramp keeps its endpoints and is made
 * STEEP instead: the cloud crosses the fragile band (where it would come apart
 * into beads) in a fraction of the timeline it used to spend there.
 */
export const BRIDGE_RAMP = 0.25;

/**
 * THE HANDOFF SCHEDULE — measured against the render, not modelled.
 *
 * The cloud takes over as the form gives up. How fast it should come up depends
 * entirely on how fast the form is actually LOSING AREA, and every previous
 * version of this function guessed at that instead of measuring it. It computed
 * `1 − qA^0.55 − qB^0.55` on the reasoning that "erosion pulls the boundary in
 * slowly, so a form at q = 0.5 still covers well over half its footprint".
 *
 * It does not. Rendering all eight forms at each q through formPresence
 * (scripts/melt-mass.mjs, off-GPU, exact) gives the truth:
 *
 *   q            1.0   0.8   0.6   0.4   0.3   0.2
 *   q^0.55       100%   88%   76%   60%   52%   41%     <- what this assumed
 *   MEASURED     100%   58%   25%    9%    1%    0%     <- ±3-10 across forms
 *
 * Erosion on a thin-featured vector form is violent, not slow: 42% of the area
 * is gone by q = 0.8 and the form has VANISHED by q = 0.3. So the old curve
 * credited a form that was no longer on screen with half its area, and held the
 * cloud back exactly when it was the only thing left. That is the cliff — on
 * melt 1→2 the liquid went 51k → 24k in one tenth of the melt, which is the
 * "midway it suddenly jumps to the last morph" report. Thickening the cloud
 * (the previous fix) raised the floor under that cliff without removing it.
 *
 * These knots are that measurement inverted: the density which, added to what
 * the form still has, keeps the rendered body on a smooth ramp between the two
 * silhouettes. Sampled every 0.05 of p and mirrored — the melt is symmetric.
 * The steep run between p = 0.20 and 0.30 is not arbitrary; it is the form's
 * own collapse, and the cloud has to match it or there is a hole. Seeded from
 * the solved curve, then coordinate-descended against the rendered excursions
 * over all seven melts. Measured against the q^0.55 curve it replaces, on the
 * same harness (mean over the seven, scripts/melt-mass.mjs):
 *
 *              dip     bump    step
 *   q^0.55    15.1%   23.5%   33.6%
 *   these      3.2%   11.0%   19.0%
 *
 * Two shapes were tried and rejected. A single smoothstep (any centre, any
 * width) cannot do it — searched exhaustively, the best one IS q^0.55, because
 * the curve has to be gentle early and then near-vertical through the form's
 * collapse. And linearising the form's own area instead (reparameterising
 * erosion so area ≈ q) does remove the dip entirely, but the form then holds
 * area while the cloud piles onto it and the two fields superadd: bump went to
 * 56-104%. The forms keep their signed-off dissolve; only the cloud's schedule
 * changed.
 *
 * Re-derive with `node scripts/melt-mass.mjs` if formPresence, SDF_MELT_ERODE
 * or the forms themselves ever change — all three move this curve.
 */
// The two tail samples intentionally rise faster than the original 0.03/0.10,
// then bridgeDensity compresses the sub-0.14 field band. Together they cross
// the scale-invariant pinprick regime quickly without reopening the mass hole:
// the current 41-frame gate measures mean dip/bump/step 6.4/17.2/27.0 against
// budgets 12/24/36, while the micro-island probe drops the pre-pass worst
// 3 islands / 154px to 2 / 77px.
const BRIDGE_KNOTS = [0, 0.075, 0.15, 0.23, 0.27, 0.52, 0.9, 1, 1, 1, 1];
const BRIDGE_DENSITY_LO = 0.055;
const BRIDGE_DENSITY_HI = 0.14;
export function bridgePresence(p) {
  const q = p > 0.5 ? 1 - p : p; // symmetric about mid-melt
  const x = clamp01(q * 2) * (BRIDGE_KNOTS.length - 1);
  const i = Math.min(BRIDGE_KNOTS.length - 2, Math.floor(x));
  const f = x - i;
  // smoothstep BETWEEN knots, so the density channel is C¹ everywhere and the
  // liquid never changes thickness in a visible step.
  return BRIDGE_KNOTS[i] + (BRIDGE_KNOTS[i + 1] - BRIDGE_KNOTS[i]) * (f * f * (3 - 2 * f));
}

// A metaball's centre field is radius-independent, so a low-density cloud does
// not become translucent: every member contracts into a hard pinprick first.
// Compress only that fragile tail with another C1 ramp. The bridge remains
// continuous, but spends far less screen time looking like forty-eight dots.
function bridgeDensity(presence) {
  return (
    presence *
    smooth01(
      (presence - BRIDGE_DENSITY_LO) /
        (BRIDGE_DENSITY_HI - BRIDGE_DENSITY_LO),
    )
  );
}

/**
 * How much each form's droplet decomposition must THICKEN to cover that form's
 * own silhouette — the §3.3 equivalence, measured per form instead of assumed.
 *
 * The design rests on "CLOUDS[n] IS form n's metaball decomposition", and the
 * note that justified it — "the bridge cloud carries 40861 px against the
 * form's ~40000" — is correct, but it was measured on form 0, THE MARK, and
 * generalised to the other seven. Rendering each cloud alone against its own
 * form (iso T = 1, off-GPU):
 *
 *   form        mark  web  software  ai  automation  data  branding  marketing
 *   cloud/form  103%  82%    87%    72%     72%       81%     68%       76%
 *
 * Only the mark holds. The seven pillar decompositions are 13-32% short, and
 * the deficit is a REST-STATE property of each cloud — nothing to do with
 * morphing — so it belongs per form, indexed like METABALL_STATES. A melt just
 * interpolates between the two, which means this composes for any pair: the
 * services scrub's consecutive melts, the hero's autocycle wrap 7→0, and the
 * arbitrary a→b jumps keyboard nav can ask for.
 *
 * Radius is the safe lever and only upward: two droplets neck while their gap
 * is under 0.83 x radius, so growing them merges the cloud, while SHRINKING is
 * the hazard the rest of this file warns about.
 */
export const FORM_SOLIDITY = [0.0, 0.073, 0.062, 0.138, 0.18, 0.096, 0.158, 0.155];

// The endpoint decompositions need all 48 canonical identities, including
// small coverage samples that live safely inside a solid form. Straight centre
// interpolation can expose those samples as unrelated pinprick balls while the
// cloud is carrying the frame. Keep their identity and min-travel assignment,
// but absorb their visible flight into the nearest substantial carrier mass.
// The correction rides bridge presence, so exact endpoints remain untouched.
const MICRO_R_LO = 0.017;
const MICRO_R_HI = 0.025;
const MICRO_OFFSET_KEEP = 0.28;
const MICRO_TETHER = 0.88;
const FLOW_ARC_GAIN = 0.09;
const FLOW_ARC_MAX = 0.022;
const carrierCache = new WeakMap();

function microWeight(r) {
  return 1 - smooth01((r - MICRO_R_LO) / (MICRO_R_HI - MICRO_R_LO));
}

function carriersFor(cloud) {
  let carriers = carrierCache.get(cloud);
  if (carriers) return carriers;
  carriers = new Uint8Array(cloud.length);
  for (let i = 0; i < cloud.length; i++) {
    let best = i;
    let bestD2 = Infinity;
    const minCarrierR = Math.max(MICRO_R_HI, cloud[i][2] * 1.35);
    for (let j = 0; j < cloud.length; j++) {
      if (j === i || cloud[j][2] < minCarrierR) continue;
      const dx = cloud[i][0] - cloud[j][0];
      const dy = cloud[i][1] - cloud[j][1];
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = j;
      }
    }
    carriers[i] = best;
  }
  carrierCache.set(cloud, carriers);
  return carriers;
}

/**
 * The swell one droplet carries at radius-progress `tr` through an a→b melt.
 *
 * A mid-melt BOOST on top of this was tried and dropped: the droplets are
 * strung out between two layouts while in flight, so it seemed they would be
 * sparser than either endpoint and need extra thickening where the cloud
 * carries alone. Measured, that correction buys almost nothing and costs a lot
 * — sweeping it 0 → 0.24 moved the mean dip only 6.6% → 5.7% while the bump
 * went 10.3% → 36.9%, because thickening the cloud where it already overlaps
 * the departing form is exactly where the two fields superadd. The endpoints
 * are the whole problem; in flight the cloud is fine.
 */
export function bridgeSwell(swA, swB, tr, pres) {
  return (swA + (swB - swA) * tr) * pres;
}

/** Min-travel droplet matching (§3.2): greedy nearest-neighbour, O(N² log N). */
export function matchClouds(A, B) {
  const pairs = [];
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const dx = A[i][0] - B[j][0],
        dy = A[i][1] - B[j][1];
      pairs.push([dx * dx + dy * dy, i, j]);
    }
  pairs.sort((a, b) => a[0] - b[0]);
  const perm = new Array(N).fill(-1);
  const used = new Uint8Array(N);
  let done = 0;
  for (const [, i, j] of pairs) {
    if (perm[i] >= 0 || used[j]) continue;
    perm[i] = j;
    used[j] = 1;
    if (++done === N) break;
  }
  return perm;
}

// rest→rest droplet correspondences are stable → cached for the session (§3.2)
const permCache = new Map();
export function permFor(a, b) {
  const key = `${a}->${b}`;
  let p = permCache.get(key);
  if (!p) {
    p = matchClouds(CLOUDS[a], CLOUDS[b]);
    permCache.set(key, p);
  }
  return p;
}

/**
 * ONE droplet of the bridge cloud at progress p, in CLOUD space — position
 * stagger-eased, radius leading, thickened by the two forms' solidity, and
 * thinned by the handoff schedule.
 *
 * This exists because the melt had drifted into TWO implementations. The
 * Services scrub carries the whole handoff on density and says so — "RADIUS IS
 * NEVER SCALED HERE… shrinking radius on the way in and out is what used to
 * shed the loose beads at both ends of every melt" — while packBridge, which
 * the hero uses, still multiplies radius by presence as well. Both call
 * themselves the §3.3 bridge. Sharing the geometry makes the ONE thing they
 * genuinely disagree about (see PRES_SCALES_RADIUS below) visible in one place,
 * and lets scripts/melt-mass.mjs gate the code the site actually runs.
 *
 * `out` is written in place: [x, y, r, density].
 */
export function meltDroplet(out, i, A, B, perm, stag, p, swA = 0, swB = 0) {
  const pres = bridgeDensity(bridgePresence(p));
  const lt = clamp01(p * (1 + STAGGER) - STAGGER * stag[i]);
  const tp = arrive(lt);
  const tr = arrive(clamp01(lt * RADIUS_LEAD));
  const a = A[i],
    b = B[perm[i]];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const travel = Math.hypot(dx, dy);
  const flowSign = CLOUDS.indexOf(A) <= CLOUDS.indexOf(B) ? 1 : -1;
  const arc =
    Math.min(FLOW_ARC_MAX, travel * FLOW_ARC_GAIN) *
    Math.sin(Math.PI * tp) *
    pres *
    flowSign;
  let x = a[0] + dx * tp;
  let y = a[1] + dy * tp;
  if (travel > 1e-5) {
    x += (-dy / travel) * arc;
    y += (dx / travel) * arc;
  }

  // Auxiliary samples travel with a nearby substantial mass instead of
  // crossing negative space as isolated beads. Both endpoint offsets are kept
  // partially, so the field still benefits from their coverage without the
  // motion collapsing into coincident discs.
  const microA = microWeight(a[2]);
  const microB = microWeight(b[2]);
  const micro = microA + (microB - microA) * tr;
  if (micro > 1e-4 && pres > 1e-4) {
    const carrierA = A[carriersFor(A)[i]];
    const carrierB = B[carriersFor(B)[perm[i]]];
    const ax = carrierA[0] + (a[0] - carrierA[0]) * MICRO_OFFSET_KEEP;
    const ay = carrierA[1] + (a[1] - carrierA[1]) * MICRO_OFFSET_KEEP;
    const bx = carrierB[0] + (b[0] - carrierB[0]) * MICRO_OFFSET_KEEP;
    const by = carrierB[1] + (b[1] - carrierB[1]) * MICRO_OFFSET_KEEP;
    const tether = micro * pres * MICRO_TETHER;
    out[0] = x + (ax + (bx - ax) * tp - x) * tether;
    out[1] = y + (ay + (by - ay) * tp - y) * tether;
  } else {
    out[0] = x;
    out[1] = y;
  }
  // The cloud THICKENS by exactly as much as it is standing in for the form
  // (see FORM_SOLIDITY): this droplet crosses from form A's shortfall to form
  // B's on its OWN radius ramp, and the correction rides presence — full where
  // the cloud carries the frame alone, identically 0 at both ends where it
  // hands back at its canonical size.
  out[2] =
    (a[2] + (b[2] - a[2]) * tr) *
    (1 + bridgeSwell(swA, swB, tr, pres));
  out[3] = pres;
  return out;
}

/** §3.3 bridge frame: write the melt droplets at progress p into `buf` from
 *  `offset` (positions stagger-eased, radius leads, envelope grows/shrinks the
 *  droplets inside the BRIDGE handoff windows). Returns the new ball count. */
export function packBridge(buf, offset, A, B, perm, stag, p, dBuf, swA = 0, swB = 0) {
  // Keep droplets out of fully solid forms: they take over after the source
  // has started dissolving and drain before the target is already solid.
  //
  // This envelope used to multiply the RADIUS, which is what made every melt
  // shed micro-balls at both ends. Two droplets only neck while their gap is
  // under 0.83 x radius, so scaling all 48 radii toward zero closes every
  // merge in the cloud proportionally — the mass necessarily breaks into
  // separate beads on the way in and again on the way out, and each bead stays
  // fully solid until it is culled, because a metaball's peak field does not
  // depend on its size. Driving DENSITY leaves the geometry (and therefore
  // every neck) intact while the liquid thins into and out of existence.
  const d = [0, 0, 0, 0];
  for (let i = 0; i < N; i++) {
    meltDroplet(d, i, A, B, perm, stag, p, swA, swB);
    const j = (offset + i) * 3;
    buf[j] = d[0];
    buf[j + 1] = d[1];
    // Radius ALSO rides the ramp here, unlike the Services scrub. This is the
    // hero, where the bridge droplets are the only liquid on the stage: they
    // must reach radius 0 at both ends, because the melt hands back to a state
    // with no droplets at all, and leaving radius full there stepped the
    // field's mass and moved the centre of mass ~107x the median. Services
    // instead hands off to a resting cloud that is already absorbed, so there
    // density alone can carry it and the necks survive.
    buf[j + 2] = d[2] * d[3];
    if (dBuf) dBuf[offset + i] = d[3];
  }
  return offset + N;
}

/**
 * Form PRESENCE q ∈ [0,1] → [field weight, erosion offset]. The transformation
 * must feel organic, never a pop: EROSION does the visible work — it moves the
 * form's boundary continuously (thin features dissolve first on the way out;
 * the skeleton emerges first and grows to the exact silhouette on the way in).
 * The weight only drains the residual field tail near q = 0, where the form is
 * already visually gone.
 */
export const formPresence = (q) => [
  smooth01(Math.min(q * 2.5, 1)),
  (1 - q) * SDF_MELT_ERODE,
];

/** Both forms' [weight, erosion] across a melt (A hands off, B lands). */
export function formPhase(p) {
  const [wA, eA] = formPresence(1 - smooth01(p / BRIDGE));
  const [wB, eB] = formPresence(smooth01((p - (1 - BRIDGE)) / BRIDGE));
  return { wA, eA, wB, eB };
}
