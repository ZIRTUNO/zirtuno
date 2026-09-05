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
 * The Services scrub and the S3 crossing share this vocabulary. Both run the
 * §3.3 handoff — formPhase drains the departing form while bridgePresence
 * raises the cloud that stands in for it — and they are exact complements
 * measured against each other, so neither can be re-timed alone.
 */
import { SDF_MELT_ERODE, MELT_SAT } from "./sdf-glass-shader.mjs";
import { EASE_POINTS } from "../animation/easings.mjs";
import { CLOUDS, N, PHYS, clamp01, hash, smooth01 } from "./phys.mjs";
import { CONFLUENCE } from "./confluence.mjs";
import { MELT_VOLUME } from "./melt-volume.data.mjs";

// Each pair has a different amount of overlapping liquid. A shared symmetric
// envelope added 14–17% extra area at the ends and then lost up to 10% in flight.
// These measured density curves hand over only the area the form gives up.
// Interpolate with monotone cubic tangents: continuous speed without stopping
// at every sample (smoothstep between samples did that), and no overshoot.
//
// THE SOURCE OF A MELT IS NOT ALWAYS A FORM. Six of the seven melts the site
// runs go form → form and key on CLOUDS; the FIRST one does not. THE CROSSING
// starts from THE CONFLUENCE — a symbol made of these droplets, with no vector
// behind it — so its key is `cross-1`, and it is the reason this table is
// resolved through a function instead of indexing CLOUDS directly. Without it
// the lookup below could not hit for the crossing at ANY p, and the first melt
// silently fell back to the pre-fit symmetric envelope: the one pair on the
// page whose handoff was never measured against its own render.
const sourceOf = (key) => (key === "cross" ? CONFLUENCE : CLOUDS[Number(key)]);
const volumeCurves = new WeakMap();
for (const [pair, values] of Object.entries(MELT_VOLUME)) {
  const [a, b] = pair.split("-");
  const slopes = new Float64Array(values.length);
  for (let i = 1; i < values.length - 1; i++) {
    const left = values[i] - values[i - 1];
    const right = values[i + 1] - values[i];
    if (left * right > 0) slopes[i] = (2 * left * right) / (left + right);
  }
  volumeCurves.set(sourceOf(a), { target: CLOUDS[Number(b)], values, slopes });
}

export function meltVolumePresence(A, B, p) {
  const curve = volumeCurves.get(A);
  if (!curve || curve.target !== B) return bridgeDensity(bridgePresence(p));
  // The ENDPOINTS come from the curve, not from a constant. A form → form melt
  // hands its cloud back absorbed at both ends and its table is 0 there, so this
  // is identical to the `return 0` it replaces. THE CROSSING is not absorbed at
  // p = 0 — the droplets are the whole body — and its table says so.
  if (p <= 0) return curve.values[0];
  if (p >= 1) return curve.values[curve.values.length - 1];
  const x = p * (curve.values.length - 1);
  const i = Math.min(Math.floor(x), curve.values.length - 2);
  const t = x - i, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * curve.values[i] +
    (t3 - 2 * t2 + t) * curve.slopes[i] +
    (-2 * t3 + 3 * t2) * curve.values[i + 1] +
    (t3 - t2) * curve.slopes[i + 1];
}

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

/**
 * THE TRANSPORT CURVE — and the single worst thing that was wrong with the melt.
 *
 * Position used to ride `arrive`, a hard ease-OUT. That is the right curve for
 * something that flies in and settles, and the wrong one for a morph, because
 * it puts all the motion at the START — where, in this melt, there is nothing
 * on screen to see it. Against the cloud's own visibility:
 *
 *   p              0.1    0.2    0.3    0.4    0.5    0.7    0.8
 *   arrive         40%    67%    83%    92%    96%   99.4%  99.9%   <- travelled
 *   bridgePresence 15%    27%    90%   100%   100%    90%    27%    <- visible
 *
 * The two are in ANTI-PHASE. Two thirds of every journey was completed while
 * the cloud was under 27% present, and by the time the liquid was fully on
 * screen there was 8% of the motion left to watch. So the middle of every melt
 * — the quarter of the timeline where neither form has any weight and the
 * droplets carry the picture alone — was a body sitting still. Rendered as a
 * contact sheet (scripts/melt-strip.mjs) frames p = 0.375 through 0.875 are
 * indistinguishable in all seven melts. That is the "it appears, does nothing,
 * then snaps to the next one" reading, and no amount of stagger, arc or
 * matching could have fixed it: the liquid was moving when it was invisible.
 *
 * `calm` is the symmetric in-out already in the vocabulary. It puts peak speed
 * at mid-melt, which is exactly where bridgePresence is 1 — the liquid now does
 * its travelling in the frames it is actually on screen for.
 */
export const flow = cubicBezier(...EASE_POINTS.calm);

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
 * Extra radius at mid-morph, on top of FORM_SOLIDITY — see meltDroplet.
 *
 * 0.06 clears the residual dip on the three melts whose clouds cover least
 * without spending much shape; past ~0.10 it stops paying, because the mass it
 * adds lands as an over-shoot at mid-morph rather than filling the ramps.
 */
export const MID_SWELL = 0.0;

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
// Re-fitted against the saturating combination law (scripts/fit-bridge-
// schedule.mjs, jointly with FORM_SOLIDITY, against area AND shape) and it
// came back UNCHANGED — the law bounds how far overlapping sources push the
// iso outward without changing how fast the cloud has to arrive, so the
// schedule measured for the plain sum still holds. Re-run that fit if the
// saturation ceiling moves far.
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
export function bridgeDensity(presence) {
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
 *   cloud/form   77%  63%    67%    53%     55%       65%     52%       61%
 *
 * RE-DERIVED AT THE MORPH'S SATURATION CEILING (sdf-glass-shader MELT_SAT).
 * Under the plain sum these read 103/82/87/72/72/81/68/76% and the table was
 * 0.00-0.18, because a large part of a cloud's coverage came from overlap
 * BETWEEN its droplets rather than from the droplets. Bounding that overlap is
 * the inflation fix, and this is what pays the mass back — which is safe to do
 * only BECAUSE the ceiling is in force: it stops the fattened droplets filling
 * the concavities they used to fill, so mass returns without the roundness.
 * Re-derive with scripts/derive-form-solidity.mjs after any change to
 * MELT_SAT. The table applies ONLY during a morph (it rides bridge presence,
 * which is 0 at both endpoints), so no resting cloud is fattened by it.
 *
 * IT IS A FUNCTION OF THE COMBINATION LAW (SDF_FIELD_N). Under the old plain
 * sum these read 103/82/87/72/72/81/68/76% and the table was 0.00-0.18, because
 * most of a cloud's coverage came from superaddition BETWEEN its droplets
 * rather than from the droplets. That fill is exactly what the p-norm removes,
 * so the clouds now cover ~half their forms and the growth needed to close it
 * is three to five times what it was. Re-derive with
 * scripts/derive-form-solidity.mjs — which reproduces the old table exactly
 * when run at n = 1, so the two are the same measurement, not two guesses.
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
//
// THE TETHER RIDES `pres`, AND THAT WAS TRIED THE OTHER WAY. Because `pres` is
// the density schedule and a metaball's peak field is size-independent, a
// droplet at low density is a hard bead of radius r x sqrt(dens) — so across
// every drain the necks open (lit radius 0.49x r by p = 0.80) while this
// correction, multiplied by the same number, collapses to a tenth of strength.
// Re-gating it on its own end-ramp envelope instead — 1 across the body of the
// melt, 0 at both endpoints, the shape `meltSat` uses — is the obvious repair
// and it is WRONG. Measured on scripts/tools/melt-islands.mjs it left the
// crossing unchanged (2/39 frames) and cost the six form -> form melts:
// total micro frames 26 -> 38, with 6->7 going 9 -> 17. A stronger tether pulls
// the small samples off their own footprint and opens gaps where there were
// none, which is the failure it exists to prevent, wearing a different hat.
// `pres` stays.
const carrierCache = new WeakMap();

/**
 * THE TRANSPORT SCHEDULE — when each droplet moves, and for how long.
 *
 * What this replaces: every droplet shared one window, opened by a stagger key
 * that was literally the droplet's x coordinate in the source form. Measured
 * through all seven melts (scripts/melt-flow.mjs):
 *
 *   SPREAD  0.13   the whole cloud passes its own halfway mark inside 13% of
 *                  the timeline — 48 droplets stepping off as one rank
 *   DISP    2.53   …whose velocity profiles then differ by up to 4.8x
 *
 * …and one number they do NOT justify. The obvious reading of DISP is "make
 * every droplet move at the same speed", and that is wrong: a deforming body
 * has a velocity field that is smooth in SPACE, so a parcel crossing the form
 * genuinely does travel faster than one nudging sideways, at the same time.
 * Built that way and measured, equal-speed windows made COH worse (1.04 →
 * 1.11) — it buys timing variety by shearing neighbours apart, which is the
 * confetti failure wearing a different hat.
 *
 * What liquid actually does is arrive as a WAVE that is smooth across the
 * body: neighbours move at nearly the same moment and in nearly the same
 * direction, while parts of the form a lobe away are seconds out of phase. So
 * each droplet gets a window [start, start + win] where:
 *
 *   win    varies only mildly with travel — enough that a long haul is not
 *          forced through the same keyhole as a nudge, not so much that
 *          neighbours desynchronise. WIN_SPAN caps every window below the
 *          full timeline, which is what leaves the wave any slack to sweep at
 *          all; without it, start = phase x (1 - win) collapses to zero.
 *   start  a wave sweeping along the melt's OWN net transport direction, so
 *          the seven melts stop sharing one left→right wipe. Projection is
 *          continuous in space, so the wave is smooth by construction and
 *          adds phase variety WITHOUT shear. The leading edge goes first and
 *          the body follows itself: the liquid reaches rather than is pushed.
 *
 * MASS_LAG and WAVE_JITTER are the two terms that are deliberately NOT smooth
 * in space — they keep the wave from reading as a ruler — so they are the two
 * that cost coherence, and they are kept small for exactly that reason.
 *
 * Exactness is structural, not tuned: start >= 0 and start + win <= 1 by
 * construction, so every droplet is still exactly at A at p = 0 and exactly at
 * B at p = 1, for any value of the constants below.
 */
export const WIN_SPAN = 0.76; // longest window — the rest of the timeline is the wave's
export const WIN_MIN = 0.72; // …and the shortest, as a fraction of that
export const WIN_POW = 0.5; // travel → window shaping
export const WAVE = 0.7; // spread 0.26 at 22 island-frames; 0.8 buys 0.03 more for 2
export const MASS_LAG = 0.18; // heavy droplets follow the light ones (PHYS.TAUP's law)
export const WAVE_JITTER = 0.07; // per-droplet break-up, so the wave is not a ruler

const scheduleCache = new WeakMap();
function scheduleFor(A, B, perm, stag) {
  let sc = scheduleCache.get(perm);
  if (sc) return sc;
  const n = perm.length;
  const travel = new Float64Array(n);
  let mx = 0,
    my = 0,
    tMax = 1e-6;
  for (let i = 0; i < n; i++) {
    const dx = B[perm[i]][0] - A[i][0];
    const dy = B[perm[i]][1] - A[i][1];
    travel[i] = Math.hypot(dx, dy);
    if (travel[i] > tMax) tMax = travel[i];
    mx += dx;
    my += dy;
  }
  // The wave axis is where the mass is actually GOING. When the two forms sit
  // on top of each other the net vector is meaningless, and the baked spatial
  // key is the honest fallback rather than an arbitrary direction.
  const mLen = Math.hypot(mx, my);
  const axis = mLen > 1e-3;
  const ax = axis ? mx / mLen : 0;
  const ay = axis ? my / mLen : 0;

  const ph = new Float64Array(n);
  let rLo = Infinity,
    rHi = -Infinity,
    jLo = Infinity,
    jHi = -Infinity;
  for (let i = 0; i < n; i++) {
    const r = A[i][2];
    if (r < rLo) rLo = r;
    if (r > rHi) rHi = r;
    const p = axis ? A[i][0] * ax + A[i][1] * ay : stag[i];
    if (p < jLo) jLo = p;
    if (p > jHi) jHi = p;
    ph[i] = p;
  }
  const rSpan = Math.max(rHi - rLo, 1e-6);
  const jSpan = Math.max(jHi - jLo, 1e-6);

  let phLo = Infinity,
    phHi = -Infinity;
  for (let i = 0; i < n; i++) {
    // downstream first — 1 - projection, so the far edge reaches and the rest
    // of the body is drawn after it
    const lead = 1 - (ph[i] - jLo) / jSpan;
    const mass = (A[i][2] - rLo) / rSpan;
    ph[i] = lead + MASS_LAG * mass + WAVE_JITTER * hash(i, 31);
    if (ph[i] < phLo) phLo = ph[i];
    if (ph[i] > phHi) phHi = ph[i];
  }
  const phSpan = Math.max(phHi - phLo, 1e-6);

  // Scheduling the small coverage samples with their spatial carrier was tried
  // here — the theory being that a speck left out of phase with its own lobe is
  // what the island probe counts as a bead. Measured, it is not: micro frames
  // went 23 → 24 at WAVE 0.8 and 24 → 23 at 1.0, which is the probe's own
  // noise. The fragmentation is the wave separating REAL masses, so it is
  // priced in WAVE below rather than papered over here.
  const start = new Float64Array(n);
  const win = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const w =
      WIN_SPAN *
      (WIN_MIN + (1 - WIN_MIN) * Math.pow(travel[i] / tMax, WIN_POW));
    const phase = 0.5 + ((ph[i] - phLo) / phSpan - 0.5) * WAVE;
    win[i] = w;
    start[i] = phase * (1 - w); // ⇒ start >= 0 and start + w <= 1, always
  }
  sc = { start, win };
  scheduleCache.set(perm, sc);
  return sc;
}

/**
 * A DIVERGENCE-FREE SWIRL, sampled in cloud space.
 *
 * The route each droplet takes used to be a straight line plus one bow: a
 * single perpendicular sine whose direction was the same for all 48 droplets
 * and whose sign came from whether the melt ran up or down the form list. All
 * of the cloud bulging the same way at the same moment is a swinging rigid
 * body, not a flow.
 *
 * This is the stream function of a small stationary flow field — offsets come
 * from curl(ψ), so they are incompressible BY CONSTRUCTION. That matters for
 * more than realism: a divergence-free displacement cannot locally pile the
 * cloud up or pull it apart, so it perturbs the routes without touching the
 * mass budget that melt-mass.mjs gates. Neighbours sample almost the same
 * value and travel together; droplets a lobe apart curve differently. That is
 * what braids the cloud instead of scattering it.
 */
const SWIRL_K1 = 5.7;
const SWIRL_K2 = 9.3;
const SWIRL_MIX2 = 0.42;
const SWIRL_GAIN = 0.19; // fraction of the droplet's own travel
const SWIRL_MAX = 0.03; // uv ceiling, so a long haul cannot fly off the form

function swirlU(x, y) {
  return (
    Math.sin(SWIRL_K1 * x + 1.7) * Math.cos(SWIRL_K1 * y + 0.6) +
    SWIRL_MIX2 * Math.sin(SWIRL_K2 * x + 0.9) * Math.cos(SWIRL_K2 * y - 2.1)
  );
}
function swirlV(x, y) {
  return -(
    Math.cos(SWIRL_K1 * x + 1.7) * Math.sin(SWIRL_K1 * y + 0.6) +
    SWIRL_MIX2 * Math.cos(SWIRL_K2 * x + 0.9) * Math.sin(SWIRL_K2 * y - 2.1)
  );
}

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

/**
 * How hard the assignment is pulled toward a SMOOTH displacement field, and
 * why there is a second stage here at all.
 *
 * Min-travel alone is a shuffle. It minimises the total distance the cloud
 * covers and says nothing about whether NEIGHBOURS agree, so it routinely
 * sends two droplets sitting on the same lobe to targets pointing in opposite
 * directions. Measured across the seven melts, the roughness of the
 * displacement field — each droplet's displacement against the mean of its own
 * neighbourhood, over the mean displacement — came out at 0.94.
 *
 * That number is the ceiling on everything else. The rendered cloud's velocity
 * coherence measured 1.04 (scripts/melt-flow.mjs), which is the same number:
 * the melt was as incoherent as its correspondence and no easing, stagger or
 * flow field could have gone below it. A liquid deformation is a CONTINUOUS
 * MAP; a permutation chosen only for travel is not one, and no amount of
 * tuning downstream of it buys the property back.
 *
 * So the greedy result is kept as the seed and relaxed against
 *
 *   E = Σ |D_i|²  +  W · Σ_edges |D_i − D_j|²
 *
 * by 2-opt swaps on a symmetric k-nearest graph over the SOURCE cloud. The
 * first term is the original objective; the second is the one that was
 * missing. Deterministic iteration order, so §3.2 still holds — the
 * permutation is stable for every repeated A → B and still cached for the
 * session. It costs travel and buys continuity, which is the trade the whole
 * chapter is about.
 */
const SMOOTH_K = 4; // neighbourhood defining the graph
const SMOOTH_W = 2.4; // plateaus above ~1.2 — the 2-opt finds the same optimum
const SMOOTH_PASSES = 24;

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
  return relaxMatch(A, B, perm);
}

/** Seeded 2-opt relaxation toward a continuous displacement field (see above). */
function relaxMatch(A, B, perm) {
  const n = perm.length;
  const adj = Array.from({ length: n }, () => []);
  const link = (i, j) => {
    if (!adj[i].includes(j)) adj[i].push(j);
    if (!adj[j].includes(i)) adj[j].push(i);
  };
  for (let i = 0; i < n; i++) {
    const order = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const dx = A[i][0] - A[j][0],
        dy = A[i][1] - A[j][1];
      order.push([dx * dx + dy * dy, j]);
    }
    order.sort((p, q) => p[0] - q[0]);
    for (let k = 0; k < SMOOTH_K && k < order.length; k++) link(i, order[k][1]);
  }

  const disp = new Float64Array(n * 2);
  const sync = (i) => {
    disp[i * 2] = B[perm[i]][0] - A[i][0];
    disp[i * 2 + 1] = B[perm[i]][1] - A[i][1];
  };
  for (let i = 0; i < n; i++) sync(i);

  // Only D_i and D_j move in a swap, so only the edges touching them change.
  const seen = new Set();
  const localE = (i, j) => {
    let e = 0;
    seen.clear();
    for (const k of [i, j]) {
      e += disp[k * 2] ** 2 + disp[k * 2 + 1] ** 2;
      for (const m of adj[k]) {
        const key = k < m ? k * n + m : m * n + k;
        if (seen.has(key)) continue;
        seen.add(key);
        const dx = disp[k * 2] - disp[m * 2];
        const dy = disp[k * 2 + 1] - disp[m * 2 + 1];
        e += SMOOTH_W * (dx * dx + dy * dy);
      }
    }
    return e;
  };

  for (let pass = 0; pass < SMOOTH_PASSES; pass++) {
    let improved = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const before = localE(i, j);
        const t = perm[i];
        perm[i] = perm[j];
        perm[j] = t;
        sync(i);
        sync(j);
        if (localE(i, j) < before - 1e-12) improved++;
        else {
          const u = perm[i];
          perm[i] = perm[j];
          perm[j] = u;
          sync(i);
          sync(j);
        }
      }
    if (!improved) break;
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
export function meltDroplet(out, i, A, B, perm, stag, p, swA = 0, swB = 0, presOverride) {
  // `presOverride` exists for ONE caller: scripts/fit-bridge-schedule, which
  // has to evaluate a candidate schedule without mutating the module. It must
  // be a parameter rather than something the harness reconstructs, because
  // presence is not only the density channel — it also scales the radius swell,
  // the swirl amplitude and the micro-tether, so a harness that overrode only
  // out[3] would be fitting a droplet the renderer never draws. Undefined is
  // the fitted Services path (other pairs retain the shared envelope).
  const pres =
    presOverride === undefined ? meltVolumePresence(A, B, p) : presOverride;
  const sc = scheduleFor(A, B, perm, stag);
  // Each droplet on its OWN window — see scheduleFor. The clamp is what makes
  // both endpoints exact: outside its window a droplet is pinned to A or to B.
  const lt = clamp01((p - sc.start[i]) / sc.win[i]);
  const tp = flow(lt);
  const tr = flow(clamp01(lt * RADIUS_LEAD));
  const a = A[i],
    b = B[perm[i]];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const travel = Math.hypot(dx, dy);
  let x = a[0] + dx * tp;
  let y = a[1] + dy * tp;
  // The route bends through the swirl field. Sampled at the droplet's own
  // MIDPOINT rather than its live position, so this stays a fixed displacement
  // per droplet instead of a feedback loop that could wind up; the sin envelope
  // takes it to exactly zero at both endpoints.
  if (travel > 1e-5) {
    const amp =
      Math.min(SWIRL_MAX, travel * SWIRL_GAIN) * Math.sin(Math.PI * tp) * pres;
    const mx = a[0] + dx * 0.5;
    const my = a[1] + dy * 0.5;
    x += swirlU(mx, my) * amp;
    y += swirlV(mx, my) * amp;
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
  // …plus THE MID-MORPH BOOST, which is the dip's own shape.
  //
  // FORM_SOLIDITY is measured on a cloud AT REST against its own form, so it
  // under-compensates the middle, where the cloud is strung between two
  // layouts and sparser than either endpoint. That is the residual dip on the
  // three melts whose clouds cover least (ai, automation, marketing).
  //
  // This was tried under the plain sum and rejected — "thickening the cloud
  // where it already overlaps the departing form is exactly where the two
  // fields superadd", bump 10.3% → 36.9%. That objection was about the SUM,
  // and the saturation ceiling is what removes it: overlap can no longer pile
  // up, so the boost lands as mass instead of as swell. Rides `pres`, so it is
  // identically 0 at both endpoints and cannot touch a resting cloud.
  const mid = MID_SWELL * Math.sin(Math.PI * clamp01(p)) * pres;
  out[2] =
    (a[2] + (b[2] - a[2]) * tr) *
    (1 + bridgeSwell(swA, swB, tr, pres) + mid);
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

/** Match the form's handoff to the conductor's radius/density low-pass.
 * Filtering progress before evaluating the nonlinear erosion is not equivalent:
 * a fast scroll then lands a solid form on top of droplets still draining.
 * Filter the actual four channels, with the same tau as their liquid partner.
 * The caller seeds this state on a pair change; exact endpoints still settle
 * to the original weights and zero erosion. Droplet integration is untouched.
 */
export function dampFormPhase(out, p, dt) {
  const target = formPhase(p);
  const k = 1 - Math.exp(-dt / PHYS.TAU_RADIUS);
  for (const key of ["wA", "eA", "wB", "eB"]) {
    const delta = target[key] - out[key];
    out[key] = Math.abs(delta) < 1e-7 ? target[key] : out[key] + delta * k;
  }
  return out;
}

/**
 * THE MELT'S EASED PROGRESS — raw scroll/time progress → the curve the
 * transformation is actually watched on.
 *
 * formPhase and bridgePresence both consume the RAW m, because they are
 * measured complements and re-timing either one alone would open a hole in the
 * mass budget. Anything that has to stay in step with the melt VISUALLY rather
 * than by mass — the crossing's spin unwind is the one caller today — reads
 * this instead, so it accelerates and settles with the body rather than
 * running its own clock over the top.
 *
 * `calm`, the symmetric in-out already in the vocabulary: peak speed at
 * mid-melt, and exact at both ends (0 → 0, 1 → 1) so a caller can hold it
 * across a rest plateau without a seam.
 */
export function morphPhase(p) {
  return flow(clamp01(p));
}

/**
 * THE MORPH'S SATURATION CEILING at progress p — the term that bounds how far
 * a crowd of droplets may push the iso-surface outward.
 *
 * THE SHAPE OF THIS ENVELOPE IS THE WHOLE FIX, and the first version had it
 * backwards. It rode sin(pi*p), tightest at mid-morph, on the reasoning that
 * mid-morph is where the body is roundest. It is — but roundness is not what
 * reads as inflation. SWELL is: the body growing BIGGER than either form it
 * connects. And swell peaks near the ENDS, at p ~ 0.1 and ~ 0.9, where the
 * departing form is still strong and the cloud has already come up, so the two
 * superadd on top of each other. melt-mass measures exactly that as `bump`,
 * and its per-melt profile puts the peak in the first tenth every time.
 *
 * A sin envelope is loosest precisely there — meltSat(0.1) was MELT_SAT/0.31,
 * three times the ceiling — so the old shape left the swell untouched and
 * spent itself on the one stretch that was not the complaint.
 *
 * So the ceiling is now FLAT across the morph and ramps off only in the last
 * few percent at each end. It is in force wherever a form and the cloud
 * overlap, which is where the pile-up happens, and it still reaches the exact
 * historical sum at both endpoints so the rest plateaus either side are
 * untouched and the transition in and out has nothing to see.
 *
 * Returns 0 where the ceiling is loose enough to be indistinguishable from the
 * sum, which is the shader's exact-identity path (iFieldSat <= 0).
 */
export const SAT_OFF = 40; // beyond this the law and the sum differ by < 0.5%
export const SAT_RAMP = 0.07; // fraction of the morph spent arriving/leaving
export function meltSat(p) {
  const q = clamp01(p);
  const env = smooth01(q / SAT_RAMP) * smooth01((1 - q) / SAT_RAMP);
  if (env < 1e-4) return 0;
  const c = MELT_SAT / env;
  return c >= SAT_OFF ? 0 : c;
}
