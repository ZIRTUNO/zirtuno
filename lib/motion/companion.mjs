/**
 * THE COMPANION (S10) — a procedural droplet that watches the contact form.
 *
 * DOM-free and deterministic, for the reason every kernel in this directory is:
 * the claims it makes are geometric, and a screenshot cannot check any of them.
 * `scripts/verify/companion.mjs` drives it with no clock and no browser.
 *
 * ── WHAT IT IS, AND WHAT IT DELIBERATELY IS NOT ──────────────────────────────
 *
 * It is ONE lobed droplet with two pupils cut into it. There is no head, no
 * brow, no mouth, no limb and no outline that is not liquid. That restraint is
 * the whole reason it is allowed on this page at all: AGENTS.md 4.16 makes
 * Contact a signature surface, and a mascot dropped onto a signature surface is
 * the "ornament on the mark" failure this project has already paid for once.
 *
 * So every expression is spent on the material rather than on parts:
 *
 *   THE BROW IS CUT INTO THE EYE. Anger does not add an eyebrow; it drops the
 *   INNER-top edge of each aperture (`brow`) and flattens the crown of the body
 *   (`crest`). The reader sees a scowl. The geometry only ever had one closed
 *   contour and two holes in it.
 *
 *   NARROWING IS NOT CLOSING. The first build spent anger on `open`, which
 *   shortens the pupil vertically — and a pupil that shortens reads as a
 *   closing eyelid, so `angry`, `effort` and `fail` all came out DROWSY. An
 *   angry eye stays open; what changes is the ANGLE of the lid above it. Every
 *   preset below keeps `open` high except the two that are genuinely shut.
 *
 *   THE MOOD IS TENSION, NOT HUE. `tension` smooths the lobes out — a calm
 *   droplet is irregular and organic, a furious one is taut and almost
 *   circular, which is exactly how surface tension reads on a real drop. The
 *   angry state is therefore legible in a black-and-white screenshot, which is
 *   the test that separates a shape change from a colour change.
 *
 *   THE SURFACE IS THE CTAs' OWN. `makeMembrane` runs on the droplet's ring,
 *   so the hand-well, the travelling strike, the proximity wake, the tension
 *   and viscosity operators and the autonomous tide are not imitations of what
 *   a button does — they are the same kernel, on a different contour. The rest
 *   ring is a perfect circle and the lobe stays here, so `tension` can still
 *   pull the irregularity out as a mood.
 *
 *   IT NEVER LEAVES CYAN. `chill` is the only colour channel and it runs
 *   `--color-cyan` -> `--color-cyan-deep`, i.e. COLDER. There is no warm
 *   channel in this file to reach for, by construction, so rule 4.8 cannot be
 *   broken by a later tuning pass. `--color-warn` is not imported here and must
 *   not be: the form's own error copy owns that token.
 *
 * ── THE EXPRESSION MODEL ─────────────────────────────────────────────────────
 *
 * Borrowed from the reference the owner brought (smontlouis/bible-strong-avatar
 * -lab): expressions are NAMED PRESETS over one parameter vector, and animation
 * is the interpolation between them rather than a per-state bespoke routine.
 * The lab does it with a timeline; this does it with a critically damped spring
 * per parameter, because the state here is driven by a human's hands and a
 * timeline cannot be interrupted mid-word.
 *
 * That is also why nothing in this file fades. Presence is radius and tension,
 * both scrubbed from the companion's own clock, so an interrupted transition
 * collapses from where it was instead of restarting. Opacity is never animated.
 *
 * ── DETERMINISM ──────────────────────────────────────────────────────────────
 *
 * `step(tMs)` integrates on a FIXED timestep off an accumulator, so the same
 * sequence of `express`/`aim`/`poke` calls at the same timestamps produces
 * byte-identical path strings whatever cadence the caller runs at. Blink
 * scheduling and the tremor both hash off integer counters rather than
 * `Math.random`, for the same reason. The node gate depends on all of this.
 */

import { hash, makeMembrane, splinePath } from "./membrane.mjs";

const TAU = 6.283185307179586;
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

export const COMP = {
  /** Body radius at rest, in the local space the viewBox maps. */
  R: 34,
  /** Body ring samples. 56 carries the crest's flattening without faceting. */
  RING_N: 56,
  /** Pupil ring samples. */
  PUPIL_N: 26,
  /** Pupil radius at rest. */
  PR: 6.9,
  /** Half the distance between the two pupils at rest. */
  SPREAD: 11.4,
  /**
   * Pupils sit slightly ABOVE the body's centre. A pair of apertures on the
   * equator of a circle reads as two holes; the same pair one radius-eighth up
   * reads as a face, and costs nothing.
   */
  EYE_Y: -2.2,
  /**
   * How far a pupil may travel from its home before the clamp takes over.
   *
   * THE FIRST BUILD SHIPPED 6.8 AND THE GAZE WAS INVISIBLE. With a pupil of
   * 7.6 and a clearance of 3.4 inside a body of 34, the containment clamp —
   * not this number — was setting the travel, and the eight compass directions
   * on the contact sheet were indistinguishable from each other. A companion
   * whose headline behaviour is that it LOOKS at things has to actually look
   * at them. The pupil and the clearance came down to make room for this.
   */
  GAZE_R: 10.5,
  /** Minimum liquid left between a pupil's edge and the body's. */
  CLEAR: 2.6,
  /**
   * HALF THE DRAWING SURFACE, in the same units as `R`.
   *
   * It lives here rather than in the component because there is no such thing
   * as a liquid with a straight edge cut across it: a silhouette clipped by its
   * own viewBox is a rendering bug that looks like a design decision. The
   * component writes `viewBox` from this number and the gate sweeps every
   * expression, every gaze angle and every strike against it, so the two can
   * never drift — which is the failure `.fl-svg`'s own comment in
   * `app/contact.css` records having shipped once already.
   *
   * Measured worst case at the current constants is 54.3, reached by `curious`
   * (swell 1.11, lean 1.35) under a full-extension gaze with a HAND PRESSED
   * INTO THE SURFACE and a strike travelling. The hand is what moved this: the
   * membrane displaces the ring by up to `maxN` outward, and 52 was sized
   * before the surface could do that.
   */
  VIEW: 60,
  /** Lobe amplitude — `lobedCirclePath`'s value, verbatim. */
  LOBE: 0.055,
  /** How far the crown leans toward what the companion is looking at. */
  LEAN_K: 0.115,
  /** Tremor amplitude at jitter = 1 (px), and its tick. */
  TREM: 1.15,
  TREM_MS: 62,

  /** Fixed integration step. */
  DT: 1000 / 120,
  /** Catch-up ceiling: a backgrounded tab must not integrate a whole minute. */
  MAX_STEPS: 8,

  /**
   * Expression spring. UNDERDAMPED, and that is the difference between a pose
   * changing and a body changing pose: at zeta 1.0 every expression arrived
   * dead, slid into place and stopped, which is correct arithmetic and lifeless
   * animation. At 0.74 a pose overshoots a few percent and settles back, so the
   * droplet has mass. It costs about 180 ms of ring on a big change, which is
   * inside the ladder and is exactly the part a reader reads as alive.
   */
  OMEGA_E: 15.5,
  ZETA_E: 0.74,
  /**
   * Gaze spring. Softer and UNDERDAMPED on purpose — an eye that arrives dead
   * on target reads as a servo, and the 0.86 leaves the half-pixel settle that
   * makes it read as a body with mass. See `arrive-is-a-landing-curve`: this is
   * watched travelling, so it is a spring rather than a front-loaded ease.
   */
  OMEGA_G: 12.0,
  ZETA_G: 0.86,

  /**
   * THE IDLE WANDER. Where it looks when nothing is telling it where to look.
   *
   * A droplet holding a dead-ahead stare whenever the pointer is elsewhere
   * reads as switched off. Two octaves at mutually irrational periods, so the
   * path never repeats — the same reason `aura-gl`'s octaves drift, and the
   * difference between weather and a loop.
   *
   * `WANDER_A` is deliberately under half the gaze's reach: idle attention
   * drifts, it does not scan.
   */
  WANDER_MS: 5200,
  WANDER_A: 0.42,

  /** The breath, on the house 8s clock (`--dur-breath`). */
  BREATH_MS: 8000,
  BREATH_A: 0.026,

  /**
   * Blink: the closure itself, and the window it is scheduled in.
   *
   * THE HOLD IS LOAD-BEARING. The first version was a triangle — down, then
   * straight back up — which touches full closure for one instant. At 60 Hz
   * that instant falls between two samples almost every time, so the lid never
   * actually shut and the blink read as a flicker rather than as a blink. A
   * real lid closes fast, RESTS shut for 20-30 ms, then opens slower. The
   * plateau is that rest, and it is also what makes the closed state
   * observable to the gate at all.
   */
  BLINK_MS: 148,
  BLINK_DOWN: 0.34,
  BLINK_HOLD: 0.18,
  BLINK_MIN_MS: 2600,
  BLINK_MAX_MS: 7400,

  /** Impulse decay constants (ms). */
  FLINCH_TAU: 190,
  NOD_TAU: 150,
  /** Peak squash of a flinch, as a fraction of R. */
  FLINCH_A: 0.16,
  /** Peak swell of a keystroke nod. */
  NOD_A: 0.035,

  /** Below these the companion is arithmetically asleep. */
  EPS_V: 0.0025,
  EPS_I: 0.004,
};

/**
 * THE PARAMETER VECTOR. Every expression is a point in this space and nothing
 * else; adding a state means adding a preset, never a new code path.
 *
 *   open     pupil aperture, 1 = wide. 0 closes the lid.
 *   squint   the lower lid. Positive rises through the middle (scrutiny);
 *            NEGATIVE bows it down, which with a low `open` is the shallow
 *            upward arc of a contented closed eye.
 *   brow     the upper lid's ANGLE, and the single most expressive channel
 *            here. Positive drops the INNER corner (anger, effort, doubt);
 *            negative drops the OUTER one and lifts the inner (worry, sorrow,
 *            the failed send). One scalar cannot do both jobs, which is why
 *            it is not folded into `crest` — the first build tried that and
 *            `fail` came out with no sad brow at all.
 *   askew    the DIFFERENCE between the two eyes: positive lifts the left
 *            brow and narrows the right. A face whose halves agree perfectly
 *            reads as a diagram; one raised brow is the whole of skepticism,
 *            and it is the cheapest expressiveness in this file.
 *   crest    the CROWN's flatness. Positive flattens the top of the body,
 *            negative rounds it up. The scowl's silhouette.
 *   tension  surface tautness. Smooths the lobes toward a circle.
 *   swell    overall scale.
 *   lean     how far the crown leads toward the gaze. Negative leans AWAY.
 *   tilt     whole-body rotation (radians).
 *   jitter   tremor amplitude.
 *   sag      deflation: the base pools and the body drops.
 *   spread   pupil separation multiplier.
 *   gaze     how much of the gaze vector the pupils actually spend.
 *   pulse    breath amplitude multiplier.
 *   chill    cyan -> cyan-deep. The ONLY colour channel, and it is cold.
 */
const P = [
  "open",
  "squint",
  "brow",
  "askew",
  "crest",
  "tension",
  "swell",
  "lean",
  "tilt",
  "jitter",
  "sag",
  "spread",
  "gaze",
  "pulse",
  "chill",
];

const preset = (o) => {
  const v = new Float64Array(P.length);
  for (let i = 0; i < P.length; i++) v[i] = o[P[i]] ?? 0;
  return v;
};

/**
 * THE EXPRESSIONS. One per thing a visitor can do to this form.
 *
 * Every one of these is reachable from every other one — they are points in a
 * continuous space, not nodes in a graph — so an interrupted transition is
 * always a legal state rather than a pose that has to finish.
 */
export const EXPRESSIONS = {
  /** Nobody is here. Loose, irregular, breathing on the 8 s clock. */
  rest: preset({
    open: 1,
    tension: 0.12,
    swell: 1,
    lean: 0.55,
    spread: 1,
    gaze: 1,
    pulse: 1,
  }),

  /** A pointer entered the page. It looks up, opens, and locks on. */
  notice: preset({
    open: 1.1,
    brow: -0.12,
    crest: -0.06,
    tension: 0.26,
    swell: 1.04,
    lean: 0.95,
    sag: -0.03,
    spread: 1.03,
    gaze: 1.15,
    pulse: 0.7,
  }),

  /** A field took focus. Upright, attentive, tighter. */
  attend: preset({
    open: 1.04,
    squint: 0.05,
    brow: 0.05,
    crest: 0.1,
    tension: 0.44,
    swell: 1.06,
    lean: 1.05,
    sag: -0.08,
    spread: 1,
    gaze: 1.05,
    pulse: 0.5,
    chill: 0.06,
  }),

  /** Keys are landing. Concentration — the brow comes down, the eye stays open. */
  read: preset({
    open: 0.94,
    squint: 0.18,
    brow: 0.34,
    crest: 0.22,
    tension: 0.52,
    swell: 1.02,
    lean: 0.8,
    tilt: 0.02,
    spread: 0.97,
    gaze: 0.95,
    pulse: 0.35,
    chill: 0.1,
  }),

  /** The textarea, with something long in it. Softer, further away, brow up. */
  ponder: preset({
    open: 0.92,
    squint: 0.08,
    brow: -0.35,
    askew: 0.3,
    crest: -0.05,
    tension: 0.2,
    swell: 1,
    lean: 0.35,
    tilt: -0.07,
    sag: 0.06,
    spread: 1.05,
    gaze: 0.7,
    pulse: 0.9,
    chill: 0.04,
  }),

  /**
   * Something in the field is wrong, but the visitor is still typing it — and
   * this is also what the FIRST rejected submit gets. Skepticism, not anger:
   * half the brow and a tenth of the tremor, so there is somewhere to escalate
   * to. Being glared at for one mistyped email is worse than no companion.
   */
  doubt: preset({
    open: 0.88,
    squint: 0.2,
    brow: 0.6,
    askew: 0.55,
    crest: 0.34,
    tension: 0.46,
    swell: 0.98,
    lean: 0.6,
    tilt: 0.11,
    jitter: 0.05,
    sag: 0.08,
    spread: 0.94,
    gaze: 0.95,
    pulse: 0.5,
    chill: 0.24,
  }),

  /**
   * A submit was rejected AGAIN. The brow drives hard down and inward, the
   * crown flattens, the surface goes taut and it trembles. `open` stays at
   * 0.95: this is a glare, and a glare is wide-eyed.
   *
   * Colour moves 0.62 toward cyan-deep and no further — colder, never warmer.
   */
  angry: preset({
    open: 0.95,
    squint: 0.32,
    brow: 1.45,
    crest: 0.92,
    tension: 0.95,
    swell: 0.93,
    lean: 1.2,
    jitter: 0.55,
    sag: -0.05,
    spread: 0.9,
    gaze: 1.25,
    pulse: 0.25,
    chill: 0.62,
  }),

  /** A field that was invalid just became valid. Wide, round, lifted. */
  approve: preset({
    open: 1.22,
    squint: -0.1,
    brow: -0.1,
    crest: -0.15,
    tension: 0.18,
    swell: 1.1,
    lean: 0.7,
    sag: -0.12,
    spread: 1.06,
    gaze: 1,
    pulse: 1.2,
  }),

  /** The request is in flight. A wince: braced, taut, fast-breathing. */
  effort: preset({
    open: 0.74,
    squint: 0.42,
    brow: 0.85,
    crest: 0.5,
    tension: 0.9,
    swell: 0.9,
    lean: 1,
    jitter: 0.14,
    spread: 0.92,
    gaze: 0.6,
    pulse: 2.2,
    chill: 0.3,
  }),

  /** Accepted, not yet confirmed. Waiting, looking past the reader. */
  hold: preset({
    open: 0.84,
    squint: 0.1,
    brow: -0.2,
    crest: 0.05,
    tension: 0.4,
    swell: 0.98,
    lean: 0.3,
    sag: 0.05,
    spread: 1,
    gaze: 0.5,
    pulse: 1.6,
    chill: 0.18,
  }),

  /**
   * Delivery failed. The brow goes NEGATIVE — outer corners down, inner
   * corners lifted — which is sorrow, not fury, and it is the whole reason
   * `brow` is a signed channel. A 500 is not the visitor's fault and a
   * companion that scowls at them for it has the blame backwards.
   */
  fail: preset({
    open: 0.82,
    squint: 0.12,
    brow: -0.95,
    askew: -0.22,
    crest: 0.1,
    tension: 0.28,
    swell: 0.9,
    lean: 0.4,
    tilt: 0.04,
    jitter: 0.06,
    sag: 0.5,
    spread: 0.95,
    gaze: 0.7,
    pulse: 0.6,
    chill: 0.46,
  }),

  /**
   * Confirmed. The lids close and the lower one BOWS DOWN (`squint` negative),
   * which is the shallow upward arc of a contented shut eye. Closing `open`
   * alone draws a flat line, and a flat line does not read as pleased — it
   * reads as unconscious. The body opens and the tension goes out of it.
   */
  delivered: preset({
    open: 0.3,
    squint: -0.95,
    crest: -0.25,
    tension: 0.06,
    swell: 1.12,
    lean: 0.2,
    sag: -0.06,
    spread: 1.1,
    gaze: 0.4,
    pulse: 1.4,
  }),

  /**
   * THE CURSOR IS ON HIM. Not near — on. Wide, lifted, one brow up, leaning
   * INTO the hand rather than away from it: `dodge` is what a cursor passing
   * close by earns, and this is what deliberate attention earns. The two have
   * to differ or being touched feels the same as being crowded.
   */
  curious: preset({
    open: 1.26,
    squint: -0.12,
    brow: -0.3,
    askew: 0.62,
    crest: -0.18,
    tension: 0.34,
    swell: 1.11,
    lean: 1.35,
    tilt: 0.07,
    sag: -0.16,
    spread: 1.08,
    gaze: 1.2,
    pulse: 1.5,
  }),

  /**
   * HE WAS CLICKED. A whole-body recoil: the eyes go wide, the surface snaps
   * taut and it trembles. Held briefly and then released — startle is an
   * event, not a mood, and one that outstayed its welcome would read as fear.
   */
  startled: preset({
    open: 1.45,
    squint: -0.2,
    brow: -0.5,
    crest: -0.1,
    tension: 0.86,
    swell: 0.88,
    lean: -0.5,
    jitter: 0.7,
    sag: -0.2,
    spread: 1.14,
    gaze: 1.3,
    pulse: 2.6,
    chill: 0.12,
  }),

  /** The cursor came too close. It leans AWAY — the negative lean. */
  dodge: preset({
    open: 1.15,
    brow: -0.2,
    tension: 0.6,
    swell: 0.95,
    lean: -1,
    tilt: -0.14,
    jitter: 0.05,
    spread: 1,
    gaze: 1,
    pulse: 0.6,
    chill: 0.1,
  }),
};

export const EXPRESSION_NAMES = Object.freeze(Object.keys(EXPRESSIONS));

/** Index of each named parameter, for callers that want one channel. */
export const PARAM = Object.freeze(
  P.reduce((m, k, i) => {
    m[k] = i;
    return m;
  }, {}),
);

/**
 * The body's radius multiplier at angle `a`. Exported because the pupil clamp
 * and the node gate both need the SAME function the contour is drawn from — a
 * containment proof against an approximation of the silhouette proves nothing
 * about the silhouette.
 */
export function bodyLobe(a, seed, tension) {
  const l =
    COMP.LOBE *
    (0.62 * Math.sin(3 * a + seed) + 0.38 * Math.sin(5 * a - seed * 1.7));
  // Tension pulls the irregularity out. A furious drop is nearly a circle.
  return 1 + l * (1 - 0.72 * clamp(tension, 0, 1));
}

/**
 * Keep a pupil inside the body.
 *
 * THE ONE INVARIANT THIS FILE CANNOT BREAK. A gaze that pushes a pupil through
 * the silhouette does not read as looking hard at something, it reads as a
 * rendering bug, and it is reachable from ordinary input: `angry` deliberately
 * spends `gaze` 1.25.
 *
 * `radiusAt` IS THE DRAWN CONTOUR, not a model of it. Once the membrane joined,
 * an analytic radius stopped being the truth: a hand pressed into the surface
 * dents it by up to `maxN`, and a clamp that did not know about the dent would
 * let a pupil sit outside a body that had moved away from it. So the companion
 * measures the ring it just built - membrane displacement, tremor and every
 * expression term included - and this only has to correct for the deformations
 * applied AFTER that point.
 *
 * The slack is one of them: LEAN displaces the ring by w(a) x lean x R x
 * LEAN_K, where w runs 0.35 at the base to 1.0 at the crown. Toward the gaze it
 * always adds room, but proving the sign for every gaze direction is a page of
 * algebra a later tuning pass would silently invalidate. Subtracting the full
 * 0.65 differential costs about three pixels of stare and needs no proof.
 *
 * The flinch is deliberately NOT in here: it is a linear map applied to the
 * body and the pupils alike, and a linear map cannot move a contained point out
 * of its container.
 */
export function containPupil(cx, cy, pr, v, radiusAt, out) {
  const d = Math.hypot(cx, cy);
  if (d < 1e-6) {
    out.x = cx;
    out.y = cy;
    return out;
  }
  const a = Math.atan2(cy, cx);
  const slack = Math.abs(v[PARAM.lean]) * COMP.R * COMP.LEAN_K * 0.65;
  const room = radiusAt(a) - pr - COMP.CLEAR - slack;
  if (room <= 0 || d <= room) {
    out.x = cx;
    out.y = cy;
    return out;
  }
  const k = room / d;
  out.x = cx * k;
  out.y = cy * k;
  return out;
}

/**
 * One companion. Owns its parameter state, its two springs, its clocks and its
 * scratch buffers; allocates on construction and never per frame.
 */
export function makeCompanion(seed = 1) {
  const n = COMP.RING_N;
  const pn = COMP.PUPIL_N;

  /**
   * THE SURFACE IS A REAL MEMBRANE — the CTAs' own kernel, on the droplet's
   * ring.
   *
   * The owner asked for "the same property from our CTAs on him", and the
   * honest reading of that is not to imitate the hand-well and the strike but
   * to RUN THEM: `makeMembrane` takes an arbitrary closed contour through
   * `opts.ring`, so the droplet gets the same displacement well, the same
   * travelling shock, the same proximity wake, the same tension and viscosity
   * operators and the same autonomous tide that every button on the site runs.
   * `components/contact/Companion.tsx` registers with `membrane-runtime`, so it
   * is also driven by the same scheduler, off the same pointer.
   *
   * THE REST RING IS A PERFECT CIRCLE, deliberately. The lobe lives in this
   * file, where `tension` can smooth it out as a mood — baking the irregularity
   * into the membrane's rest would freeze it, and a furious droplet could no
   * longer go taut. So the membrane contributes displacement and the expression
   * contributes shape, and the two compose per vertex.
   *
   * Uniform angular sampling is uniform ARC sampling on a circle, which is what
   * `ringRest` needs for its Laplacian to be a real surface-tension operator,
   * and the outward normal is simply the radius.
   */
  const ringX = new Float64Array(n);
  const ringY = new Float64Array(n);
  const ringNx = new Float64Array(n);
  const ringNy = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    ringNx[i] = Math.cos(a);
    ringNy[i] = Math.sin(a);
    ringX[i] = ringNx[i] * COMP.R;
    ringY[i] = ringNy[i] * COMP.R;
  }
  const mem = makeMembrane(0, 0, {
    ring: { n, x: ringX, y: ringY, nx: ringNx, ny: ringNy },
    // Both in the viewBox's units, not CSS pixels, so the surface behaves the
    // same at every rendered size. The defaults are scaled off a button's short
    // side and are far too tight on a body this small: a hand well narrower
    // than a pupil reads as a dimple rather than as a surface answering.
    handR: COMP.R * 0.95,
    maxN: COMP.R * 0.26,
  });
  mem.step(0);

  // Live vector, target vector, velocity. One spring per channel.
  const v = Float64Array.from(EXPRESSIONS.rest);
  const target = Float64Array.from(EXPRESSIONS.rest);
  const vel = new Float64Array(P.length);

  // Body and pupil scratch. Reused every frame, by contract.
  const bx = new Float64Array(n);
  const by = new Float64Array(n);
  /**
   * The body's radius per vertex BEFORE lean, tilt and the flinch — the frame
   * the pupil clamp works in. Rebuilt in `step`, so containment is measured
   * against the contour that will actually be drawn, membrane dent included,
   * rather than against an analytic circle the membrane has already left.
   */
  const rk = new Float64Array(n);
  const px = new Float64Array(pn);
  const py = new Float64Array(pn);
  const hit = { x: 0, y: 0 };

  // Gaze, in normalized units. (0,0) is straight at the reader.
  let gx = 0;
  let gy = 0;
  let gvx = 0;
  let gvy = 0;
  let tgx = 0;
  let tgy = 0;
  /** Set while a caller is aiming. Cleared by `release`, which starts the wander. */
  let aimed = false;

  // Impulses.
  let flinch = 0;
  let fdx = 0;
  let fdy = 1;
  let nod = 0;

  // Clocks.
  let t = 0;
  let last = -1;
  let acc = 0;
  let blinkAt = COMP.BLINK_MIN_MS;
  let blinkT = -1;
  let blinks = 0;
  let name = "rest";
  let dirty = true;

  function scheduleBlink() {
    blinks++;
    const r = hash(blinks, seed * 7.3);
    blinkAt =
      t +
      COMP.BLINK_MIN_MS +
      r * (COMP.BLINK_MAX_MS - COMP.BLINK_MIN_MS);
  }

  /**
   * THE IDLE WANDER — where it looks when nobody is telling it where to look.
   *
   * A droplet that holds a dead-ahead stare whenever the pointer is elsewhere
   * reads as switched off; eyes that drift, settle and drift again read as
   * something thinking. Two octaves at mutually irrational periods, so the path
   * never repeats and never returns to the same place twice — the same trick
   * `aura-gl` uses to keep a background from reading as a loop.
   *
   * Deterministic in `t`, so the node gate still sees one simulation.
   */
  function wander() {
    const a = t / COMP.WANDER_MS;
    return {
      x:
        0.62 * Math.sin(a * 1.0 + seed) +
        0.38 * Math.sin(a * 2.37 - seed * 1.7),
      y:
        0.55 * Math.sin(a * 0.83 - seed * 2.1) +
        0.3 * Math.sin(a * 1.91 + seed * 0.6),
    };
  }

  function integrate(h) {
    const oe = COMP.OMEGA_E;
    const ze = COMP.ZETA_E;
    for (let i = 0; i < v.length; i++) {
      const a = -2 * ze * oe * vel[i] - oe * oe * (v[i] - target[i]);
      vel[i] += a * h;
      v[i] += vel[i] * h;
    }

    // Nothing is aiming it: it looks around on its own.
    if (!aimed) {
      const w = wander();
      tgx = w.x * COMP.WANDER_A;
      tgy = w.y * COMP.WANDER_A;
    }

    const og = COMP.OMEGA_G;
    const zg = COMP.ZETA_G;
    const ax = -2 * zg * og * gvx - og * og * (gx - tgx);
    const ay = -2 * zg * og * gvy - og * og * (gy - tgy);
    gvx += ax * h;
    gvy += ay * h;
    gx += gvx * h;
    gy += gvy * h;

    // Impulses decay on their own constants; they are never sprung, because a
    // flinch that bounces back reads as a bounce rather than as a flinch.
    if (flinch > 0) flinch *= Math.exp((-h * 1000) / COMP.FLINCH_TAU);
    if (nod > 0) nod *= Math.exp((-h * 1000) / COMP.NOD_TAU);
    if (flinch < COMP.EPS_I) flinch = 0;
    if (nod < COMP.EPS_I) nod = 0;
  }

  /** Blink closure at the current time: 0 open, 1 shut. */
  function blinkP() {
    if (blinkT < 0) return 0;
    const e = (t - blinkT) / COMP.BLINK_MS;
    if (e < 0 || e > 1) return 0;
    const down = COMP.BLINK_DOWN;
    const shut = down + COMP.BLINK_HOLD;
    if (e < down) return e / down;
    if (e < shut) return 1;
    return 1 - (e - shut) / (1 - shut);
  }

  function breathNow() {
    const ph = (t % COMP.BREATH_MS) / COMP.BREATH_MS;
    return (
      1 +
      COMP.BREATH_A * v[PARAM.pulse] * Math.sin(ph * TAU) +
      COMP.NOD_A * nod
    );
  }

  /**
   * Build the body contour for the current state.
   *
   * ONE PASS, IN `step`, rather than inside `bodyPath`. Three things need the
   * same geometry in the same frame — the body's path, the pupil clamp and the
   * gate's containment sweep — and recomputing it per caller was both wasteful
   * and a way for the three to disagree by a breath phase.
   */
  function build() {
    const breath = breathNow();
    const lean = v[PARAM.lean];
    const tilt = v[PARAM.tilt];
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    const trem = v[PARAM.jitter] * COMP.TREM;
    const tick = Math.floor(t / COMP.TREM_MS);
    const swell = v[PARAM.swell];
    const crest = v[PARAM.crest];
    const sag = Math.max(0, v[PARAM.sag]);
    const tension = v[PARAM.tension];
    // The flinch is a LINEAR map, applied to the body and the pupils alike: a
    // linear map takes the interior of a polygon to the interior of its image,
    // so a hard press cannot eject an aperture. See `containPupil`.
    const kA = 1 - COMP.FLINCH_A * flinch;
    const kP = 1 + COMP.FLINCH_A * flinch * 0.55;

    // The membrane's displaced ring. Normal AND tangential — which is why the
    // point is taken whole rather than reduced to a radius: `dt` is real motion
    // and dropping it would quietly flatten every travelling wave.
    const ring = mem.points();

    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const topness = Math.max(0, -Math.sin(a));
      const downness = Math.max(0, Math.sin(a));

      let k = swell * breath * bodyLobe(a, seed, tension);
      k *= 1 - 0.3 * crest * Math.pow(topness, 1.7);
      k *= 1 + 0.1 * sag * Math.pow(downness, 1.4);

      let x = ring.px[i] * k;
      let y = ring.py[i] * k;

      if (trem > 0) {
        const j = trem * (hash(i, tick + seed) - 0.5);
        x += Math.cos(a) * j;
        y += Math.sin(a) * j;
      }

      // What the pupil clamp measures against: this vertex's distance from the
      // centre, before the whole body is moved by the lean, the tilt or a blow.
      rk[i] = Math.hypot(x, y);

      // The base pools and the whole body settles when it deflates.
      y += sag * COMP.R * 0.16 * downness;

      // The crown leads the lean. A body that translates as a rigid disc reads
      // as a sticker being dragged; a crown that arrives first reads as
      // something leaning.
      const w = 0.35 + 0.65 * topness;
      x += lean * gx * COMP.R * COMP.LEAN_K * w;
      y += lean * gy * COMP.R * COMP.LEAN_K * w;

      if (flinch > 0) {
        const al = (x * fdx + y * fdy) * kA;
        const pe = (-x * fdy + y * fdx) * kP;
        x = al * fdx - pe * fdy;
        y = al * fdy + pe * fdx;
      }

      bx[i] = x * ct - y * st;
      by[i] = x * st + y * ct;
    }
  }

  /** The body's radius toward `a`, read off the contour that will be drawn. */
  function radiusAt(a) {
    const f = ((a / TAU) % 1 + 1) % 1;
    const s = f * n;
    const i0 = Math.floor(s) % n;
    const i1 = (i0 + 1) % n;
    const u = s - Math.floor(s);
    return rk[i0] * (1 - u) + rk[i1] * u;
  }

  return {
    // ── the Driven contract, so `membrane-runtime` can schedule this exactly
    //    as it schedules a CTA ───────────────────────────────────────────────

    /**
     * The pointer, in the membrane's own space — the caller converts from the
     * element's box, because only it knows the viewBox mapping.
     */
    hand(x, y, vx, vy) {
      mem.hand(x, y, vx, vy);
      dirty = true;
    },
    press(down) {
      mem.press(down);
      dirty = true;
    },
    /** A travelling shock from a point, the same wave a pressed CTA runs. */
    strike(x, y, tMs, strength) {
      mem.strike(x, y, tMs, strength);
      dirty = true;
    },
    arrive(fromBelow, tMs) {
      mem.arrive(fromBelow, tMs);
    },
    setTide(on) {
      mem.setTide(on);
    },
    scroll(pxPerSec) {
      mem.scroll(pxPerSec);
    },

    /**
     * Look at a point, in normalized units where 1 is "as far as the eye
     * travels". Values outside the unit disc are clamped to it, so a caller
     * does not have to know the geometry to aim.
     */
    aim(nx, ny) {
      const d = Math.hypot(nx, ny);
      const k = d > 1 ? 1 / d : 1;
      tgx = nx * k;
      tgy = ny * k;
      aimed = true;
    },

    /** Stop aiming. The gaze goes back to wandering on its own. */
    release() {
      aimed = false;
    },

    /** Switch expression. An unknown name falls through to rest, never throws. */
    express(next) {
      const p = EXPRESSIONS[next];
      name = p ? next : "rest";
      target.set(p ?? EXPRESSIONS.rest);
    },

    /**
     * A press. `nx, ny` is the direction the blow came from, in the same
     * normalized space as `aim` — the body squashes along that axis.
     */
    poke(nx, ny, amount = 1) {
      const d = Math.hypot(nx, ny) || 1;
      fdx = nx / d;
      fdy = ny / d;
      flinch = clamp(amount, 0, 1.4);
    },

    /** A keystroke landed. Adds to the nod without resetting its decay. */
    tick(amount = 1) {
      nod = clamp(nod + 0.55 * amount, 0, 1.2);
    },

    /** Blink now, if one is not already running. */
    blink() {
      if (blinkT < 0) {
        blinkT = t;
        scheduleBlink();
      }
    },

    /**
     * Advance to `tMs`. Returns true if anything moved, so a caller can park
     * its loop. Fixed step off an accumulator: cadence cannot change the
     * result, which is what makes the node gate meaningful.
     */
    step(tMs) {
      if (last < 0) {
        last = tMs;
        t = 0;
        blinkAt = COMP.BLINK_MIN_MS;
        mem.step(tMs);
        build();
        return true;
      }
      acc += Math.max(0, tMs - last);
      last = tMs;
      let steps = 0;
      while (acc >= COMP.DT && steps < COMP.MAX_STEPS) {
        integrate(COMP.DT / 1000);
        t += COMP.DT;
        acc -= COMP.DT;
        steps++;
      }
      // A tab that was away for a minute discards the backlog rather than
      // fast-forwarding through it in one frame.
      if (steps >= COMP.MAX_STEPS) acc = 0;
      if (blinkT >= 0 && t - blinkT > COMP.BLINK_MS) blinkT = -1;
      if (blinkT < 0 && t >= blinkAt) {
        blinkT = t;
        scheduleBlink();
      }
      // The membrane runs on the WALL clock, not the accumulator: it owns its
      // own sub-stepping and its shock timings are in real milliseconds.
      const moved = mem.step(tMs);
      build();
      const was = dirty;
      dirty = false;
      return moved || was || steps > 0;
    },

    /** The body contour, built by the last `step`. */
    bodyPath() {
      return splinePath(bx, by);
    },

    /**
     * One pupil. `side` is -1 (left) or +1 (right).
     *
     * Returns "" when the aperture has closed past the point where a contour
     * would be a line — the caller draws nothing rather than a zero-height
     * sliver, which anti-aliases into a grey smudge.
     */
    pupilPath(side) {
      // THE ASYMMETRY. `askew` splits the two eyes: one brow lifts while the
      // other narrows. A face whose halves agree exactly reads as a diagram.
      const askew = v[PARAM.askew] * (side < 0 ? 1 : -1);
      const openNow = Math.max(
        0,
        v[PARAM.open] * (1 - blinkP()) * (1 - 0.22 * Math.max(0, askew)),
      );
      if (openNow < 0.045) return "";

      const pr = COMP.PR * (0.9 + 0.1 * v[PARAM.swell]);
      const homeX = side * COMP.SPREAD * v[PARAM.spread];
      const homeY = COMP.EYE_Y;
      const g = v[PARAM.gaze];
      containPupil(
        homeX + gx * COMP.GAZE_R * g,
        homeY + gy * COMP.GAZE_R * g,
        pr,
        v,
        radiusAt,
        hit,
      );
      const cx = hit.x;
      const cy = hit.y;

      const squint = v[PARAM.squint];
      const brow = v[PARAM.brow] - askew * 0.75;
      const tilt = v[PARAM.tilt];
      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);
      const kA = 1 - COMP.FLINCH_A * flinch;
      const kP = 1 + COMP.FLINCH_A * flinch * 0.55;

      for (let i = 0; i < pn; i++) {
        const b = (i / pn) * TAU;
        const cb = Math.cos(b);
        const sb = Math.sin(b);
        const lobe = 1 + 0.05 * Math.sin(3 * b + seed * 2.1);

        const x = cx + cb * pr * lobe;
        let y = cy + sb * pr * lobe * openNow;

        // THE LOWER LID. Positive rises through the middle — scrutiny, and at
        // 0.4 a wince. NEGATIVE bows it down, which is the half of a contented
        // closed eye that a low `open` alone cannot draw: an eye that just gets
        // shorter reads as unconscious, one that also curves reads as pleased.
        y -= squint * pr * 0.55 * Math.max(0, sb);

        // THE BROW, and the only place it exists — drawn INTO the aperture, so
        // the companion still has exactly one body and two holes in it.
        //
        // `lid` brings the whole upper edge down by the brow's strength; the
        // second term TILTS it. Positive drops the inner corner (inner meaning
        // toward the other eye), which is the asymmetry a scowl is made of;
        // negative drops the outer and lifts the inner, which is the asymmetry
        // of worry.
        const inner = side < 0 ? cb : -cb;
        const lid = Math.abs(brow) * 0.26;
        y += pr * Math.max(0, -sb) * (lid + brow * 0.85 * Math.max(0, inner));

        let fx = x;
        let fy = y;
        if (flinch > 0) {
          const al = (fx * fdx + fy * fdy) * kA;
          const pe = (-fx * fdy + fy * fdx) * kP;
          fx = al * fdx - pe * fdy;
          fy = al * fdy + pe * fdx;
        }

        px[i] = fx * ct - fy * st;
        py[i] = fx * st + fy * ct;
      }
      return splinePath(px, py);
    },

    /** 0 -> --color-cyan, 1 -> --color-cyan-deep. The only colour this emits. */
    get chill() {
      return clamp(v[PARAM.chill], 0, 1);
    },

    get expression() {
      return name;
    },

    /** Milliseconds of integrated time. Deterministic. */
    get time() {
      return t;
    },

    /** 0..1 proximity wake, straight off the membrane — the CTAs' own signal. */
    get aware() {
      return mem.aware;
    },

    /** 0..1 — how much strike energy is still in the surface. */
    get charge() {
      return mem.charge();
    },

    /**
     * Arithmetically finished — the EXPRESSION's sleep signal.
     *
     * `mem.asleep` is deliberately NOT folded in. A membrane has its own breath
     * and never reports asleep on a surface that is being drawn, so including
     * it made this permanently false and therefore useless. What IS included is
     * the surface's remaining shock energy, so a caller cannot park on `settled`
     * and cut a travelling wave off halfway round the body.
     */
    get settled() {
      if (mem.charge() > 0.02) return false;
      if (flinch > 0 || nod > 0 || blinkT >= 0) return false;
      if (Math.abs(gvx) > COMP.EPS_V || Math.abs(gvy) > COMP.EPS_V) return false;
      for (let i = 0; i < vel.length; i++) {
        if (Math.abs(vel[i]) > COMP.EPS_V) return false;
      }
      return true;
    },

    /**
     * The runtime's sleep signal. NEVER true while it is on screen: the breath
     * runs on an 8 s clock and the liquid does not freeze (AGENTS.md 4.14).
     * Parking is the caller's job, through visibility.
     */
    get asleep() {
      return false;
    },

    /** Read-only view of the live vector, for the gate. */
    get params() {
      return v;
    },

    /** Live gaze, for the gate's containment sweep. */
    get gaze() {
      return { x: gx, y: gy };
    },

    /** The body's radius toward an angle, off the drawn contour. For the gate. */
    radiusAt,
  };
}
