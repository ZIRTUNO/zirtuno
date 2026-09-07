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
 *   preset below keeps `open` high except the ones that are genuinely shut.
 *
 *   THE MOOD IS TENSION FIRST, HUE SECOND. `tension` smooths the lobes out — a
 *   calm droplet is irregular and organic, a furious one is taut and almost
 *   circular, which is exactly how surface tension reads on a real drop. Every
 *   state below is legible in a black-and-white screenshot, which is the test
 *   that separates a shape change from a colour change.
 *
 *   THE SURFACE IS THE CTAs' OWN. `makeMembrane` runs on the droplet's ring,
 *   so the hand-well, the travelling strike, the proximity wake, the tension
 *   and viscosity operators and the autonomous tide are not imitations of what
 *   a button does — they are the same kernel, on a different contour. The rest
 *   ring is a perfect circle and the lobe stays here, so `tension` can still
 *   pull the irregularity out as a mood.
 *
 *   IT NEVER LEAVES THE CYAN FAMILY. There are exactly two hue channels and
 *   both are cold: `chill` runs `--color-cyan` -> `--color-cyan-deep`, `glow`
 *   runs it -> `--color-cyan-glow`. A third, `lumen`, is not a hue at all — it
 *   is how much of itself the droplet is spending, which is what carries sleep
 *   and celebration without reaching for a second colour. All three tokens are
 *   in AGENTS.md 6's palette, and no warm one is reachable from this file BY
 *   CONSTRUCTION: the kernel emits numbers and never a colour literal,
 *   `app/contact.css` owns the tokens, and `verify/companion.mjs` asserts the
 *   absence against this file's own source text so a later tuning pass cannot
 *   quietly introduce one. `--color-warn` belongs to the form's error copy and
 *   is not this file's to spend.
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
 * The lab's full vocabulary is carried here — its LIFE CYCLE (sleeping, waking,
 * idle, listening, thinking, searching, working) and its REACTIONS (excited,
 * bored, suspicious, angry, drowsy, happy, curious, confused, surprised, proud,
 * shy, sad, laughing, scared, playful, celebrate) — under this site's own name
 * wherever one already existed for the same beat. `rest` IS the lab's idle,
 * `attend` IS listening, `ponder` IS thinking, `startled` IS being surprised by
 * a touch. Shipping a synonym for a pose that already exists would give the
 * shell two ways to say one thing and no way to tell which is current;
 * `ALIASES` below maps the lab's names onto ours for anyone reading across.
 *
 * The lab also carries a grid of EYE PRESETS — round pupils, tall bars, tilted
 * slashes, flat dashes, small dots. Here those are not separate art: `wide`,
 * `iris`, `slant` and `lift` are four more channels on the same vector, so an
 * eye style interpolates like everything else and a pose can sit half way
 * between a round eye and a slash.
 *
 * That is also why nothing in this file fades. Presence is radius, tension and
 * `lumen`, all scrubbed from the companion's own clock, so an interrupted
 * transition collapses from where it was instead of restarting. Opacity is
 * never animated as a reveal.
 *
 * ── GESTURES ARE NOT EXPRESSIONS ─────────────────────────────────────────────
 *
 * A pose is a place in the vector; a gesture is a decaying impulse ON TOP of
 * wherever the vector currently is. `shake` (a refusal), `hop` (a bounce),
 * `laugh` (a rhythmic mirth) and `wink` (one lid, deliberately slower than a
 * blink) are therefore NOT presets — they compose with every expression, they
 * survive an expression change mid-flight, and none of them can be "arrived at"
 * and get stuck. A laughing droplet that is then made angry stops laughing
 * because the mirth drains, not because a state machine cut it off.
 *
 * `hop` deliberately does NOT move the ring. It is exposed as `offset`, in
 * viewBox units, for the caller to add to its own transform — because a bounce
 * that displaces the geometry inside a fixed viewBox is a bounce that can clip
 * its own silhouette against the drawing surface, and `VIEW` is sized for the
 * widest SHAPE the kernel can reach, not for that shape plus a translation.
 *
 * ── DETERMINISM ──────────────────────────────────────────────────────────────
 *
 * `step(tMs)` integrates on a FIXED timestep off an accumulator, so the same
 * sequence of `express`/`aim`/`poke` calls at the same timestamps produces
 * byte-identical path strings whatever cadence the caller runs at. Blink
 * scheduling and the tremor both hash off integer counters rather than
 * `Math.random`, for the same reason. The breath is integrated as a PHASE
 * rather than read off `t`, so `rate` can change mid-breath without the chest
 * jumping a beat. The node gate depends on all of this.
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
   * Measured worst case at the current constants is about 54, reached by
   * `curious` (swell 1.11, lean 1.35) under a full-extension gaze with a HAND
   * PRESSED INTO THE SURFACE and a strike travelling. The hand is what moved
   * this: the membrane displaces the ring by up to `maxN` outward, and 52 was
   * sized before the surface could do that.
   *
   * NOTHING ADDED SINCE MAY SPEND THAT MARGIN ON A TRANSLATION. `hop` is a
   * caller-side offset for exactly this reason, and the swell of the loudest
   * new poses (`celebrate`, `excited`) is capped in the presets rather than in
   * code — the gate measures the reachable envelope and will say so.
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

  /**
   * THE WINK. Deliberately SLOWER than a blink and with a longer hold: a blink
   * is involuntary and reads as maintenance, a wink is addressed to somebody
   * and has to be seen to be read. At `BLINK_MS` nobody catches which eye it
   * was, and a wink nobody can identify is just a glitch.
   */
  WINK_MS: 300,
  WINK_DOWN: 0.3,
  WINK_HOLD: 0.34,

  /** Impulse decay constants (ms). */
  FLINCH_TAU: 190,
  NOD_TAU: 150,
  /** Peak squash of a flinch, as a fraction of R. */
  FLINCH_A: 0.16,
  /** Peak swell of a keystroke nod. */
  NOD_A: 0.035,

  /**
   * THE REFUSAL — a decaying oscillation on `tilt`, the droplet shaking its
   * head. Rotation cannot move a contained point out of its container, so this
   * is the one gesture that is safe to spend on the geometry rather than on the
   * caller's transform.
   */
  SHAKE_A: 0.15,
  SHAKE_MS: 132,
  SHAKE_TAU: 300,

  /**
   * THE BOUNCE. Amplitude in viewBox units, exposed through `offset` rather
   * than added to the ring — see the header. `|sin|` rather than `sin`, so it
   * reads as a body pushing off a floor rather than as something floating.
   */
  HOP_A: 5.4,
  HOP_MS: 340,
  HOP_TAU: 460,

  /**
   * THE LAUGH. A rhythmic swell and an eye-squeeze at the SAME frequency, so
   * the body and the face agree — a body that shakes while its eyes stay wide
   * reads as shivering, not laughing. Slow decay: mirth outlasts the beat that
   * caused it, which is the difference between laughing and being startled.
   */
  MIRTH_A: 0.042,
  MIRTH_MS: 205,
  MIRTH_TAU: 950,
  MIRTH_SQUEEZE: 0.38,
  /** How much of the bounce a laugh drives on its own. */
  MIRTH_HOP: 1.6,

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
 *   pulse    breath AMPLITUDE multiplier.
 *   chill    cyan -> cyan-deep. Cold.
 *
 * ── THE EYE STYLE, which the lab keeps as a grid of drawn presets ────────────
 *
 *   wide     pupil width multiplier. 1 is the round aperture this shipped
 *            with; under 1 is the tall bar; over 1 is the flat dash a closed
 *            or amused eye needs. Paired with a low `open` it is the whole
 *            difference between "asleep" and "squinting".
 *   iris     pupil SIZE. Small pupils in a wide aperture is the oldest fear
 *            cue there is, and it costs one channel.
 *   slant    pupil rotation, MIRRORED between the two eyes, so positive is
 *            the inward-down slash of a glare and negative is the outward-up
 *            tilt of mischief. Mirroring is what keeps it a face rather than
 *            a pair of parallel marks.
 *   lift     pupil home height. Positive drops both eyes, which under a
 *            lifted brow is how downcast reads without moving the gaze.
 *
 * ── PRESENCE ────────────────────────────────────────────────────────────────
 *
 *   glow     cyan -> cyan-glow. Bright. The other end of the same axis as
 *            `chill`, and the reason a mood can now be warm-feeling without
 *            any warm token existing: it is a LIGHT change, not a hue change.
 *   lumen    how much of itself the droplet is spending — the stroke's weight
 *            and the pupils' solidity. Below 1 it recedes (sleep, boredom,
 *            sorrow); above 1 it burns (celebration). It is not opacity as a
 *            reveal: rest is 1 and the droplet is never faded in.
 *   rate     breath FREQUENCY multiplier. Integrated as a phase, so it can
 *            change mid-breath. `pulse` says how deep, this says how fast, and
 *            the two together are the difference between sleeping and panic.
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
  "wide",
  "iris",
  "slant",
  "lift",
  "glow",
  "lumen",
  "rate",
];

/**
 * Channels whose neutral value is not zero.
 *
 * Every preset that shipped before the eye-style channels existed sets `swell`,
 * `spread`, `gaze` and `pulse` explicitly, so listing them here changes nothing
 * for them — it is here so a NEW preset that omits one gets a droplet at rest
 * rather than a droplet of radius zero, which is what `?? 0` used to hand out.
 */
const DEFAULT = {
  swell: 1,
  spread: 1,
  gaze: 1,
  pulse: 1,
  wide: 1,
  iris: 1,
  lumen: 1,
  rate: 1,
};

const preset = (o) => {
  const v = new Float64Array(P.length);
  for (let i = 0; i < P.length; i++) v[i] = o[P[i]] ?? DEFAULT[P[i]] ?? 0;
  return v;
};

/**
 * THE EXPRESSIONS. One per thing a visitor can do to this form, plus the life
 * cycle a droplet left alone runs through on its own.
 *
 * Every one of these is reachable from every other one — they are points in a
 * continuous space, not nodes in a graph — so an interrupted transition is
 * always a legal state rather than a pose that has to finish.
 *
 * Grouped the way the reference groups them, because the grouping is the
 * argument: the LIFE CYCLE is what it does when nobody is doing anything to it,
 * and the REACTIONS are answers. A companion with only reactions is furniture
 * between events.
 */
export const EXPRESSIONS = {
  // ── the life cycle ────────────────────────────────────────────────────────

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

  /**
   * Nobody has been here for a while. The lids come down, the eye widens into
   * a dash, the surface goes slack and it looks somewhere else — boredom is
   * an averted gaze more than it is a droop, which is why the shell aims it
   * away rather than trusting the pose alone.
   */
  bored: preset({
    open: 0.6,
    squint: 0.3,
    brow: 0.12,
    askew: 0.22,
    crest: 0.18,
    tension: 0.14,
    swell: 0.96,
    lean: 0.15,
    tilt: -0.07,
    sag: 0.22,
    spread: 1.02,
    gaze: 0.85,
    pulse: 0.6,
    wide: 1.16,
    iris: 0.96,
    lumen: 0.74,
    rate: 0.78,
    chill: 0.14,
  }),

  /** Longer still. Heavy lids, a real droop, a slow chest. */
  drowsy: preset({
    open: 0.4,
    squint: 0.06,
    brow: 0.2,
    crest: 0.12,
    tension: 0.16,
    swell: 0.97,
    lean: 0.3,
    tilt: 0.1,
    sag: 0.32,
    spread: 1,
    gaze: 0.55,
    pulse: 1.2,
    wide: 1.26,
    iris: 0.94,
    lift: 0.5,
    lumen: 0.62,
    rate: 0.58,
    chill: 0.22,
  }),

  /**
   * Out. The lids are shut and BOWED — `squint` negative under a low `open` is
   * the shallow arc of a sleeping eye, where `open: 0` alone would draw a flat
   * line that reads as switched off rather than as asleep. The chest is deep
   * and slow (`pulse` high, `rate` low), which is the whole tell: a still
   * droplet is broken, a slowly breathing one is asleep.
   */
  sleeping: preset({
    open: 0.17,
    squint: -0.88,
    crest: -0.14,
    tension: 0.05,
    swell: 0.94,
    lean: 0.08,
    sag: 0.44,
    spread: 1.02,
    gaze: 0.15,
    pulse: 2.1,
    wide: 1.46,
    iris: 0.96,
    lift: 0.7,
    lumen: 0.38,
    rate: 0.42,
    chill: 0.3,
  }),

  /**
   * Coming back. Half-lidded, still sagging, but the chest has picked up and
   * the light is returning — the pose exists so waking is a TRANSITION the
   * reader can watch rather than a cut from sleeping straight to attention.
   */
  waking: preset({
    open: 0.58,
    squint: -0.34,
    brow: -0.14,
    // ONE EYE COMES UP FIRST, which is both true and the thing that stops this
    // reading as `bored` on the contact sheet — the two were within a hair of
    // each other on every other channel, and a transient nobody can identify
    // is a transient that may as well not exist.
    askew: 0.46,
    crest: -0.04,
    tension: 0.14,
    swell: 1.02,
    lean: 0.35,
    tilt: 0.06,
    sag: 0.16,
    spread: 1.02,
    gaze: 0.5,
    pulse: 1.5,
    wide: 1.14,
    lift: 0.3,
    lumen: 0.72,
    rate: 0.8,
    chill: 0.12,
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

  /**
   * SCANNING. The reader is moving through the page fast and it is trying to
   * keep up: wide aperture, small iris, gaze spent past its own limit and the
   * body leading. Distinct from `notice` — that is one pointer arriving, this
   * is something moving too quickly to fix on.
   */
  searching: preset({
    open: 1.14,
    squint: 0.06,
    brow: -0.06,
    askew: 0.14,
    crest: -0.04,
    tension: 0.42,
    swell: 1.03,
    lean: 1.1,
    spread: 1.06,
    gaze: 1.3,
    pulse: 0.8,
    wide: 0.96,
    iris: 0.86,
    lumen: 1.06,
    rate: 1.2,
    glow: 0.14,
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

  /**
   * HEADS DOWN. `read` is watching somebody type; this is the droplet doing
   * the work itself — tighter, faster-breathing, the aperture narrowed to a
   * bar. It is what a sustained burst of typing earns, where a few keys earn
   * `read`.
   */
  working: preset({
    open: 0.9,
    squint: 0.26,
    brow: 0.44,
    crest: 0.32,
    tension: 0.64,
    swell: 1.01,
    lean: 0.9,
    tilt: 0.05,
    spread: 0.96,
    gaze: 0.9,
    pulse: 0.55,
    wide: 0.88,
    iris: 1.02,
    lumen: 1.04,
    rate: 1.35,
    chill: 0.18,
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

  // ── reactions ─────────────────────────────────────────────────────────────

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
   * NOT CONVINCED, and unlike `doubt` this is not about the form. The eye
   * narrows to a slanted bar, one brow climbs and the whole body cocks over.
   * It is what a pointer that keeps circling him earns.
   */
  suspicious: preset({
    open: 0.68,
    squint: 0.44,
    brow: 0.72,
    askew: 0.7,
    crest: 0.4,
    tension: 0.56,
    swell: 0.97,
    lean: 0.5,
    tilt: 0.14,
    spread: 0.93,
    gaze: 1.05,
    pulse: 0.45,
    wide: 1.3,
    iris: 0.92,
    slant: 0.17,
    lumen: 0.95,
    rate: 0.9,
    chill: 0.3,
  }),

  /**
   * A submit was rejected AGAIN. The brow drives hard down and inward, the
   * crown flattens, the surface goes taut and it trembles. `open` stays at
   * 0.95: this is a glare, and a glare is wide-eyed. The `slant` puts the
   * inward-down slash on the aperture itself, which is the lab's angry eye and
   * costs no new geometry.
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
    slant: 0.2,
    iris: 1.04,
    lumen: 1.08,
    rate: 1.5,
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
    glow: 0.22,
    lumen: 1.08,
  }),

  /**
   * PLEASED, held rather than flashed. `approve` is a beat; this is a mood —
   * the closed, bowed arcs of a smiling eye, the body opened out, the light up.
   */
  happy: preset({
    open: 0.52,
    squint: -0.82,
    brow: -0.2,
    crest: -0.22,
    tension: 0.1,
    swell: 1.09,
    lean: 0.6,
    sag: -0.1,
    spread: 1.06,
    gaze: 0.8,
    pulse: 1.3,
    wide: 1.32,
    lumen: 1.14,
    rate: 1.2,
    glow: 0.42,
  }),

  /**
   * IT DID THE THING. Chest out, chin up — the body swells and tilts BACK
   * (negative `tilt`), the lids come halfway down in satisfaction rather than
   * in sleep, and the gaze goes middle-distance. A proud face does not stare
   * at you; it looks past you.
   */
  proud: preset({
    /**
     * NARROWED, NOT SHUT — and that distinction cost a revision. The first
     * numbers paired a low `open` with a wide aperture, which is the same
     * recipe as `drowsy`, and on the contact sheet a proud droplet read as a
     * sleepy one. Satisfaction narrows an eye VERTICALLY while it stays round;
     * sleep flattens it into a dash. The pride is carried by the body instead:
     * the biggest `swell` short of celebration, the chin tilted back and the
     * eyes lifted (`lift` negative) to look past the reader rather than at
     * them.
     */
    open: 0.8,
    squint: 0.4,
    brow: -0.06,
    crest: -0.12,
    tension: 0.34,
    swell: 1.12,
    lean: 0.45,
    tilt: -0.07,
    sag: -0.2,
    spread: 1.05,
    gaze: 0.55,
    pulse: 1.1,
    wide: 0.98,
    iris: 1.04,
    lift: -0.45,
    lumen: 1.12,
    rate: 0.95,
    glow: 0.3,
  }),

  /**
   * KEYED UP. Everything is faster: `rate` nearly doubles, the light comes up
   * and the body leans in. Paired with a `hop` from the shell, this is the one
   * pose that reads as a body that cannot keep still.
   */
  excited: preset({
    open: 1.28,
    squint: -0.16,
    brow: -0.34,
    crest: -0.2,
    tension: 0.3,
    swell: 1.1,
    lean: 1.15,
    sag: -0.14,
    spread: 1.06,
    gaze: 1.2,
    pulse: 1.8,
    iris: 1.1,
    lumen: 1.26,
    rate: 1.9,
    glow: 0.56,
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
    wide: 0.94,
    rate: 1.7,
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
    rate: 1.15,
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
    // Stated rather than defaulted: this is what keeps it apart from `sad`.
    wide: 0.96,
    lift: 0.42,
    lumen: 0.8,
    rate: 0.85,
    chill: 0.46,
  }),

  /**
   * SORRY, generally. `fail` is what a dead endpoint earns and it carries the
   * tremor of something that just went wrong; this is the quieter, longer
   * version — for a visitor who gave up, or an error that has been on screen
   * long enough to stop being news. Milder brow, deeper sag, dimmer.
   */
  sad: preset({
    open: 0.72,
    squint: 0.06,
    brow: -0.78,
    askew: -0.14,
    crest: 0.08,
    tension: 0.2,
    swell: 0.92,
    lean: 0.25,
    sag: 0.44,
    spread: 0.97,
    gaze: 0.6,
    pulse: 0.7,
    // Wider and lower than `fail`, which sits next to it in the trigger table
    // and was within a hair of it on the sheet. `fail` is a flinch and keeps a
    // rounder eye; sorrow is a long flat one, dropped.
    wide: 1.24,
    iris: 0.95,
    lift: 1.05,
    lumen: 0.78,
    rate: 0.85,
    chill: 0.34,
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
    wide: 1.3,
    lumen: 1.16,
    rate: 1.1,
    glow: 0.4,
  }),

  /**
   * THE SEND LANDED — the burst, not the settled state. Everything `delivered`
   * does, louder and brighter, and the shell pairs it with a `hop` and a
   * `laugh`. It is deliberately a WINDOW: the shell holds it for about two
   * seconds and then falls back to `delivered`, because a droplet that
   * celebrates indefinitely stops reading as pleased and starts reading as
   * stuck.
   */
  celebrate: preset({
    open: 0.32,
    squint: -0.98,
    brow: -0.2,
    crest: -0.28,
    tension: 0.08,
    swell: 1.13,
    lean: 0.3,
    sag: -0.22,
    spread: 1.12,
    gaze: 0.35,
    pulse: 2,
    wide: 1.5,
    lumen: 1.42,
    rate: 2,
    glow: 0.82,
  }),

  /**
   * IT IS FUNNY. The eyes squeeze to bowed dashes and the body oscillates —
   * but only the POSE is here; the rhythm is `laugh()`, an impulse, because a
   * laugh that is a preset is a laugh that stops the instant the mood changes
   * instead of dying down like a real one.
   */
  laughing: preset({
    open: 0.24,
    squint: -0.95,
    brow: -0.12,
    crest: -0.24,
    tension: 0.12,
    swell: 1.1,
    lean: 0.35,
    tilt: 0.05,
    sag: -0.05,
    spread: 1.08,
    gaze: 0.4,
    pulse: 1.9,
    wide: 1.44,
    lumen: 1.22,
    rate: 2.1,
    glow: 0.5,
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
    lumen: 1.06,
    glow: 0.12,
  }),

  /**
   * IT DOES NOT FOLLOW. One brow far up, the other eye narrowed and tilted,
   * the whole body cocked — and the shell pairs it with a `shake`, which is
   * what makes it read as "no, what?" rather than as a lopsided stare.
   */
  confused: preset({
    open: 0.96,
    squint: 0.12,
    brow: 0.22,
    askew: 0.88,
    crest: 0.06,
    tension: 0.3,
    swell: 1,
    lean: 0.5,
    tilt: 0.17,
    spread: 1.03,
    gaze: 0.9,
    pulse: 0.7,
    slant: 0.1,
    lift: 0.35,
    lumen: 1,
    rate: 1.05,
    chill: 0.12,
  }),

  /**
   * SOMETHING HAPPENED. Taller and rounder than `startled` and with none of
   * its recoil: `startled` is being touched — a body flinching away — and this
   * is a thing appearing, which the body leans very slightly TOWARD.
   */
  surprised: preset({
    open: 1.5,
    squint: -0.24,
    brow: -0.55,
    crest: -0.14,
    tension: 0.7,
    swell: 1.05,
    lean: 0.5,
    sag: -0.18,
    spread: 1.1,
    gaze: 1.15,
    pulse: 2.3,
    wide: 0.94,
    iris: 1.12,
    lift: -0.3,
    lumen: 1.18,
    rate: 1.75,
    glow: 0.22,
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
    rate: 1.8,
    chill: 0.12,
  }),

  /**
   * ACTUAL FEAR, which `startled` is not. The tell is the IRIS: a wide
   * aperture with a small pupil in it is the oldest fear cue there is, and it
   * is the reason `iris` exists as a channel. The body shrinks, leans hard
   * away and trembles at nearly the tremor's ceiling.
   */
  scared: preset({
    open: 1.36,
    squint: 0.06,
    brow: -0.6,
    askew: -0.12,
    crest: -0.04,
    tension: 0.82,
    swell: 0.86,
    lean: -0.9,
    tilt: -0.06,
    jitter: 0.62,
    sag: 0.12,
    spread: 1.12,
    gaze: 1.2,
    pulse: 2.4,
    wide: 0.9,
    iris: 0.74,
    lumen: 0.92,
    rate: 2.2,
    chill: 0.4,
  }),

  /**
   * BEING LOOKED AT TOO LONG. It shrinks, leans away, drops its eyes and its
   * light — but keeps one brow up, because shy is not sad and the difference
   * is that shy is still interested.
   */
  shy: preset({
    open: 0.66,
    squint: 0.12,
    brow: -0.3,
    askew: 0.34,
    crest: 0.06,
    tension: 0.42,
    swell: 0.9,
    lean: -0.7,
    tilt: -0.13,
    sag: 0.16,
    spread: 0.94,
    gaze: 0.55,
    pulse: 0.7,
    wide: 1.04,
    iris: 0.9,
    lift: 0.8,
    lumen: 0.86,
    rate: 1.25,
    chill: 0.18,
  }),

  /**
   * IT WANTS ANOTHER GO. The mischief tilt — `slant` NEGATIVE, so the pupils
   * cant outward-up where a glare cants inward-down — one brow high, the body
   * cocked and bouncing. This is what repeated pokes earn before laughter.
   */
  playful: preset({
    open: 1.08,
    squint: -0.3,
    brow: -0.26,
    askew: 0.76,
    crest: -0.16,
    tension: 0.26,
    swell: 1.06,
    lean: 0.9,
    tilt: 0.16,
    sag: -0.1,
    spread: 1.05,
    gaze: 1.1,
    pulse: 1.5,
    iris: 1.06,
    slant: -0.15,
    lumen: 1.14,
    rate: 1.6,
    glow: 0.36,
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
    rate: 1.2,
    chill: 0.1,
  }),
};

export const EXPRESSION_NAMES = Object.freeze(Object.keys(EXPRESSIONS));

/**
 * The reference's names for poses this site already had one for.
 *
 * NOT a second set of presets and not something the shell uses: it is here so
 * anyone reading the lab's grid against this file can find the same beat, and
 * so `express()` does not silently fall through to `rest` if somebody reaches
 * for the lab's word. Adding real duplicates would give the shell two ways to
 * say one thing and no way to tell which is current.
 */
export const ALIASES = Object.freeze({
  idle: "rest",
  listening: "attend",
  thinking: "ponder",
  waiting: "hold",
});

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
 * `reach` IS MEASURED, NOT ASSUMED, and that is what changed when the eye-style
 * channels arrived. The old call passed the pupil's nominal radius, which was
 * only ever right for a round aperture: `wide` can stretch one to 1.5x, `open`
 * can stretch it vertically to 1.5x, a negative `squint` bows its floor further
 * down still, and every one of those makes the true extent larger than the
 * number the clamp was given. Rather than model that — a page of algebra that a
 * later taste pass would silently invalidate — `pupilPath` now builds the
 * aperture around its own origin FIRST and hands over the largest radius it
 * actually found. That is exact for any shape this file can ever draw, and it
 * quietly fixed the pre-existing case too: `startled` (open 1.45) was already
 * being clamped as though its eye were a third shorter than it is.
 *
 * The slack is the other correction: LEAN displaces the ring by w(a) x lean x R
 * x LEAN_K, where w runs 0.35 at the base to 1.0 at the crown. Toward the gaze
 * it always adds room, but proving the sign for every gaze direction is a page
 * of algebra a later tuning pass would silently invalidate. Subtracting the full
 * 0.65 differential costs about three pixels of stare and needs no proof.
 *
 * The flinch is deliberately NOT in here: it is a linear map applied to the
 * body and the pupils alike, and a linear map cannot move a contained point out
 * of its container. Nor is `tilt`: a rotation about the body's own centre moves
 * the aperture and the silhouette together.
 */
export function containPupil(cx, cy, reach, v, radiusAt, out) {
  const d = Math.hypot(cx, cy);
  if (d < 1e-6) {
    out.x = cx;
    out.y = cy;
    return out;
  }
  const a = Math.atan2(cy, cx);
  const slack = Math.abs(v[PARAM.lean]) * COMP.R * COMP.LEAN_K * 0.65;
  const room = radiusAt(a) - reach - COMP.CLEAR - slack;
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
  /** The aperture around its own origin, before it is placed. See `containPupil`. */
  const ex = new Float64Array(pn);
  const ey = new Float64Array(pn);
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
  /** The gestures. Envelopes in 0..1 that decay on their own constants. */
  let shakeE = 0;
  let hopE = 0;
  let mirth = 0;
  /** Phases, integrated rather than read off `t`, so an interrupted gesture
   *  does not jump when a new one is added to it. */
  let shakePh = 0;
  let hopPh = 0;
  let mirthPh = 0;

  // Clocks.
  let t = 0;
  let last = -1;
  let acc = 0;
  let blinkAt = COMP.BLINK_MIN_MS;
  let blinkT = -1;
  let blinks = 0;
  let winkT = -1;
  let winkSide = -1;
  /** The breath, as an accumulated phase — see `rate` in the vector's doc. */
  let breathPh = 0;
  let name = "rest";
  let dirty = true;

  function scheduleBlink() {
    blinks++;
    const r = hash(blinks, seed * 7.3);
    blinkAt = t + COMP.BLINK_MIN_MS + r * (COMP.BLINK_MAX_MS - COMP.BLINK_MIN_MS);
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

    // THE BREATH IS A PHASE, not a modulus of the clock. `rate` is a live
    // channel, and `(t * rate) % BREATH_MS` would jump the chest to a different
    // point in its cycle every time the rate changed — which is exactly what
    // waking up, panicking and calming down all do.
    breathPh += ((h * 1000) / COMP.BREATH_MS) * Math.max(0, v[PARAM.rate]);
    if (breathPh > 1) breathPh -= Math.floor(breathPh);

    // Impulses decay on their own constants; they are never sprung, because a
    // flinch that bounces back reads as a bounce rather than as a flinch.
    if (flinch > 0) flinch *= Math.exp((-h * 1000) / COMP.FLINCH_TAU);
    if (nod > 0) nod *= Math.exp((-h * 1000) / COMP.NOD_TAU);
    if (flinch < COMP.EPS_I) flinch = 0;
    if (nod < COMP.EPS_I) nod = 0;

    // The gestures. Envelope and phase are separate so that re-triggering one
    // mid-swing tops the envelope up without restarting the swing — a second
    // poke during a bounce makes it bounce HIGHER, which is what a body does,
    // rather than snapping it back to the floor to start again.
    if (shakeE > 0) {
      shakePh += (h * 1000) / COMP.SHAKE_MS;
      shakeE *= Math.exp((-h * 1000) / COMP.SHAKE_TAU);
      if (shakeE < COMP.EPS_I) shakeE = 0;
    }
    if (hopE > 0) {
      hopPh += (h * 1000) / COMP.HOP_MS;
      hopE *= Math.exp((-h * 1000) / COMP.HOP_TAU);
      if (hopE < COMP.EPS_I) hopE = 0;
    }
    if (mirth > 0) {
      mirthPh += (h * 1000) / COMP.MIRTH_MS;
      mirth *= Math.exp((-h * 1000) / COMP.MIRTH_TAU);
      if (mirth < COMP.EPS_I) mirth = 0;
    }
  }

  /** Closure at the current time for a lid running on `dur` from `at`. */
  function lidP(at, dur, down, hold) {
    if (at < 0) return 0;
    const e = (t - at) / dur;
    if (e < 0 || e > 1) return 0;
    const shut = down + hold;
    if (e < down) return e / down;
    if (e < shut) return 1;
    return 1 - (e - shut) / (1 - shut);
  }

  /** Blink closure at the current time: 0 open, 1 shut. Both eyes. */
  function blinkP() {
    return lidP(blinkT, COMP.BLINK_MS, COMP.BLINK_DOWN, COMP.BLINK_HOLD);
  }

  /** Wink closure for ONE side. Zero for the other eye, by definition. */
  function winkP(side) {
    if (side !== winkSide) return 0;
    return lidP(winkT, COMP.WINK_MS, COMP.WINK_DOWN, COMP.WINK_HOLD);
  }

  /** The mirth oscillator, shared by the chest and the eyes so they agree. */
  function mirthWave() {
    return mirth > 0 ? mirth * Math.sin(mirthPh * TAU) : 0;
  }

  function breathNow() {
    return (
      1 +
      COMP.BREATH_A * v[PARAM.pulse] * Math.sin(breathPh * TAU) +
      COMP.NOD_A * nod +
      COMP.MIRTH_A * mirthWave()
    );
  }

  /** The live rotation: the pose's own tilt plus whatever refusal is running. */
  function tiltNow() {
    return (
      v[PARAM.tilt] +
      (shakeE > 0 ? shakeE * COMP.SHAKE_A * Math.sin(shakePh * TAU) : 0)
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
    const tilt = tiltNow();
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
    const f = (((a / TAU) % 1) + 1) % 1;
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

    /**
     * Switch expression. The reference's own names for poses this file already
     * has are accepted through `ALIASES`; anything else falls through to rest
     * and never throws.
     */
    express(next) {
      const key = EXPRESSIONS[next] ? next : (ALIASES[next] ?? null);
      const p = key ? EXPRESSIONS[key] : null;
      name = p ? key : "rest";
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

    // ── the gestures ─────────────────────────────────────────────────────────
    //
    // All four TOP UP rather than restart: the envelope is raised and the phase
    // is left where it was, so a second trigger mid-swing makes the gesture
    // bigger instead of resetting it to the start. That is the difference
    // between a body being pushed again and an animation being replayed.

    /** A refusal — the head shake. */
    shake(amount = 1) {
      if (shakeE <= 0) shakePh = 0;
      shakeE = clamp(shakeE + amount, 0, 1.3);
    },

    /** A bounce. Exposed through `offset`; it never displaces the ring. */
    hop(amount = 1) {
      if (hopE <= 0) hopPh = 0;
      hopE = clamp(hopE + amount, 0, 1.4);
    },

    /** Mirth. Drives the chest, the eye-squeeze and part of the bounce. */
    laugh(amount = 1) {
      if (mirth <= 0) mirthPh = 0;
      mirth = clamp(mirth + amount, 0, 1.2);
    },

    /**
     * ONE lid, deliberately. `side` is -1 (left) or +1 (right); anything else
     * is taken as the left, because a wink with no side is a blink and the
     * caller almost certainly meant to pick one.
     */
    wink(side = -1) {
      if (winkT >= 0) return;
      winkSide = side > 0 ? 1 : -1;
      winkT = t;
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
      if (winkT >= 0 && t - winkT > COMP.WINK_MS) winkT = -1;
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
     *
     * BUILT AT THE ORIGIN, THEN PLACED. The aperture's own shape is assembled
     * around (0,0) first, its true extent measured off those vertices, and only
     * then is it clamped into the body and translated. That order is what makes
     * containment exact for any eye style — see `containPupil`.
     */
    pupilPath(side) {
      // THE ASYMMETRY. `askew` splits the two eyes: one brow lifts while the
      // other narrows. A face whose halves agree exactly reads as a diagram.
      const askew = v[PARAM.askew] * (side < 0 ? 1 : -1);
      // The mirth squeeze runs on the SAME oscillator as the chest, so a
      // laughing body and a laughing face are in phase. `abs` because a laugh
      // squeezes the eyes on both halves of the cycle, unlike the chest.
      const squeeze = 1 - COMP.MIRTH_SQUEEZE * Math.abs(mirthWave());
      const openNow = Math.max(
        0,
        v[PARAM.open] *
          (1 - blinkP()) *
          (1 - winkP(side)) *
          squeeze *
          (1 - 0.22 * Math.max(0, askew)),
      );
      if (openNow < 0.045) return "";

      const pr = COMP.PR * (0.9 + 0.1 * v[PARAM.swell]) * Math.max(0.2, v[PARAM.iris]);
      const wide = Math.max(0.2, v[PARAM.wide]);
      const squint = v[PARAM.squint];
      const brow = v[PARAM.brow] - askew * 0.75;
      // MIRRORED, so the two eyes cant toward each other rather than running
      // parallel. Parallel slashes read as a typographic mark; mirrored ones
      // read as a brow line, which is the only reason this channel earns a slot.
      const slant = v[PARAM.slant] * (side < 0 ? 1 : -1);
      const cs = Math.cos(slant);
      const ss = Math.sin(slant);

      let reach = 0;
      for (let i = 0; i < pn; i++) {
        const b = (i / pn) * TAU;
        const cb = Math.cos(b);
        const sb = Math.sin(b);
        const lobe = 1 + 0.05 * Math.sin(3 * b + seed * 2.1);

        const x = cb * pr * lobe * wide;
        let y = sb * pr * lobe * openNow;

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

        // The eye style's rotation, about the aperture's OWN centre — which is
        // why it happens here, before the pupil is placed in the body.
        const rx = x * cs - y * ss;
        const ry = x * ss + y * cs;
        ex[i] = rx;
        ey[i] = ry;
        const d = Math.hypot(rx, ry);
        if (d > reach) reach = d;
      }

      const homeX = side * COMP.SPREAD * v[PARAM.spread];
      const homeY = COMP.EYE_Y + v[PARAM.lift];
      const g = v[PARAM.gaze];
      containPupil(
        homeX + gx * COMP.GAZE_R * g,
        homeY + gy * COMP.GAZE_R * g,
        reach,
        v,
        radiusAt,
        hit,
      );
      const cx = hit.x;
      const cy = hit.y;

      const tilt = tiltNow();
      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);
      const kA = 1 - COMP.FLINCH_A * flinch;
      const kP = 1 + COMP.FLINCH_A * flinch * 0.55;

      for (let i = 0; i < pn; i++) {
        let fx = cx + ex[i];
        let fy = cy + ey[i];
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

    /** 0 -> --color-cyan, 1 -> --color-cyan-deep. Cold. */
    get chill() {
      return clamp(v[PARAM.chill], 0, 1);
    },

    /**
     * 0 -> --color-cyan, 1 -> --color-cyan-glow. Bright.
     *
     * The other end of `chill`'s axis, and the reason a mood can read as warm
     * without a warm token existing anywhere: this is a LIGHT change inside the
     * brand's own three cyans, not a hue leaving them.
     */
    get glow() {
      return clamp(v[PARAM.glow], 0, 1);
    },

    /**
     * How much of itself it is spending. Under 1 it recedes, over 1 it burns.
     * NOT a reveal — rest is exactly 1 and nothing here ever fades in.
     */
    get lumen() {
      return clamp(v[PARAM.lumen], 0, 1.6);
    },

    /**
     * The bounce, in viewBox units, for the caller to add to its own transform.
     *
     * It is not in the ring on purpose: `VIEW` is sized for the widest SHAPE
     * this kernel can reach, and spending that margin on a translation is how a
     * liquid ends up with a straight edge cut across it.
     */
    get offset() {
      const e = hopE + COMP.MIRTH_HOP * mirth;
      if (e <= 0) return { x: 0, y: 0 };
      return {
        x: 0,
        y: -COMP.HOP_A * e * Math.abs(Math.sin(hopPh * TAU)),
      };
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
     * and cut a travelling wave off halfway round the body — and every gesture,
     * for the same reason.
     */
    get settled() {
      if (mem.charge() > 0.02) return false;
      if (flinch > 0 || nod > 0 || blinkT >= 0 || winkT >= 0) return false;
      if (shakeE > 0 || hopE > 0 || mirth > 0) return false;
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
     *
     * Note that the `sleeping` EXPRESSION is not this: that is a pose, with a
     * slow deep chest, and a droplet in it is still being drawn every frame.
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
