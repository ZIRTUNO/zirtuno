/**
 * FLUID CORE (R5-B) — the real physics under the one liquid.
 *
 * Phase A moved every droplet with a first-order low-pass toward analytic
 * targets. This core gives the liquid actual dynamics — velocity state,
 * momentum, interaction — while keeping the signed-off choreography exact:
 *
 *   - GOAL-SEEK: a critically-damped spring toward the scene target, with
 *     stiffness derived from the SAME per-droplet TAUP identity (heavy
 *     droplets lag more — the field stretches under scroll, now with
 *     genuine momentum instead of a filter).
 *   - REPULSION: short-range soft-core between free droplets — loose liquid
 *     reads volumetric, droplets never stack into coincident discs.
 *   - COHESION: droplets sharing a cluster id are drawn toward their
 *     cluster's centroid — fracture chunks hold together like liquid, the
 *     method's three masses ACCRETE by attraction, the origin's two idea
 *     masses travel as two coherent bodies.
 *   - CURL DRIFT: a divergence-free analytic flow field (two slow gyres +
 *     one faster octave) replaces "wander" for free droplets — organic,
 *     incompressible-feeling ambient motion.
 *   - CURSOR FIELD: a page-wide DISPLACEMENT well around the pointer — the
 *     core pushes liquid out, the rim draws it back, and the profile's net
 *     flux is ~0, so the hand moves liquid instead of evacuating it. A
 *     velocity-signed wake replaces the old fixed-handed vortex, and the
 *     whole field gains while the pointer is held down.
 *   - STRIKE: a click/tap injects a travelling pressure ring — a crest that
 *     pushes outward and a trough behind it that pulls back into the cavity,
 *     spreading at a finite speed with per-droplet arrival jitter, decaying
 *     geometrically and in time, and shedding a crown of spray from whatever
 *     liquid it lands on. Repeated strikes saturate: already-agitated liquid
 *     absorbs less than a still surface.
 *   - PINCH-OFF: when a free droplet's target strains far ahead of its body,
 *     it sheds 1–2 satellite micro-droplets with inherited velocity (TTL,
 *     shrink-out) — the classic real-fluid signature, budgeted to a pool.
 *
 * THE BIND CONTRACT (validated design, correction C2): scenes emit
 * bind ∈ [0,1] per droplet. Environmental forces scale by (1−bind), and the
 * OUTPUT position blends between the physics body and a byte-exact replica
 * of the legacy low-pass at the same PHYS taus:
 *
 *     out = mix(x_physics, x_lowpass, bind)
 *
 * so at bind = 1 (the §3.3 melts, resting footprints, the exact mark) the
 * motion is IDENTICAL to the signed-off Phase-A dynamics, and at bind = 0
 * (pours, scatters, echoes) the liquid is fully alive. Both states run
 * continuously. After each mix, the hidden share of each branch is rebased
 * onto the position that was actually shown; a later bind change therefore
 * continues from the visible droplet instead of exposing stale parallel
 * history.
 *
 * Pure .mjs (the sdf-core convention): no DOM, deterministic (hash-seeded),
 * node-runnable for the sim harness. The `?fphys=0` escape routes the
 * conductor back to the pure legacy block — this core never runs.
 */

import { N, TAUP, hash, clamp01, smooth01 } from "./phys.mjs";
import { temperTable, TEMPER_GAIN } from "./temperament.mjs";
import { moteTauScale } from "./motes.mjs";
import { curl, fbm1 } from "./noise.mjs";

// ── tuning table (Phase-B feel constants — owner rounds may retune) ──────────
export const FLUID = {
  H_MS: 8, // fixed substep (ms)
  OMEGA_K: 1.8, // spring rate ω = OMEGA_K / (TAUP[i] in s) — matches the lag feel
  DAMP_Z: 1.15, // slightly super-critical — the V_MAX clamp breaks critical
  // symmetry on hard jumps; ζ > 1 keeps the approach slosh-free
  REP_RANGE: 1.15, // repulsion reach × (ri + rj)
  REP_A: 2.6, // repulsion acceleration ceiling (uv/s²)
  REP_D_MIN: 0.004, // distance floor — droplets have size; no 1/d blow-ups
  COH_A: 0.5, // cluster-centroid pull (uv/s² at 0.1 uv offset → 0.05)
  // Curl drift amplitude at bind 0 — the ambient current between transitions.
  //
  // This is a FORCE competing with the goal-seek spring, so what matters is not
  // its own size but its ratio to ω² — and ω = OMEGA_K / TAUP is 6.9…20 rad/s,
  // giving ω² = 48…400. At the original 0.016 the resulting wander was 0.0035 uv
  // on the heaviest droplet and 0.0004 on the lightest: sub-pixel at any real
  // canvas size. The liquid was technically in motion and visually dead, which
  // is why raising it slightly changed nothing.
  //
  // 0.13 put the heavy droplets at ~0.028 uv of wander and the light ones at
  // ~0.0034. The 8× spread was the point: the body moves through ITSELF instead
  // of translating as a slab, which is what makes it read as one material.
  //
  // R6-B: all of that reasoning was about equilibrium against a spring to a
  // POINT, and the leash retired that spring. Inside its free zone the curl is
  // no longer balanced by anything — it ACCELERATES the droplet, and the leash
  // decides how far it gets while this decides how fast. That splits a knob
  // that used to be one: LEASH_R now owns how loose the body looks, and this
  // owns how much it moves. Measured on a still composition, doubling it takes
  // path length from 7.3 to 11.5 droplet-radii per 10 s while the body's own
  // radius of gyration moves 0.5% — the liquid circulates more without the
  // composition growing.
  CURL_V: 0.26,
  // ── R6 temperament (see temperament.mjs for the distribution) ──────────────
  // Both are shares of CURL_V rather than free-standing numbers, so a curl
  // retune carries the character with it instead of silently changing the ratio
  // between the shared current and a droplet's own will.
  //
  // TEMPER_DRIFT is the droplet's private clock. At 0.55 the heaviest droplets
  // wander ~0.015 uv on their own account — visible at any real canvas size,
  // and roughly half what the shared gyres give them, which is the balance that
  // makes a body look like a population rather than like a fluid or like noise.
  TEMPER_DRIFT: 0.55,
  // TEMPER_SPIN is an angular rate², applied to the offset from target. 2.1
  // curves a droplet's approach into its station over ~1 s without ever letting
  // it close an orbit — a droplet that ORBITS its target instead of arriving at
  // it reads as unstable, not as alive.
  TEMPER_SPIN: 2.1,
  // ── THE LEASH (R6-B): freedom, bounded ─────────────────────────────────────
  //
  // How far a free droplet may drift from its authored station before anything
  // pulls it back, as a multiple of its own visible radius. This is the single
  // number that decides whether the liquid looks like a fluid or like a
  // formation: under the old point-spring the entire ambient current moved a
  // droplet 0.4-4 px, so nothing else in this file could be seen.
  //
  // Sized in RADII, not in uv, for the reason every mote constant is: a droplet
  // that may wander two of its own widths reads as loose at any scale, and the
  // compositions scale their radii with the stage. 2.4 puts a median droplet
  // (roam 0.89) about 2.8 radii out — far enough to circulate visibly, close
  // enough that neighbours still neck and the body keeps its silhouette.
  LEASH_R: 3.0,
  // The inner fraction of the leash that is COMPLETELY free — no restoring
  // force, and drag at LEASH_DRAG. Above it, grip ramps to full by the leash.
  LEASH_FREE: 0.45,
  // Drag inside the free zone, as a share of the critical damping outside it.
  // This is what lets the flow accumulate into real velocity: at full damping a
  // 0.29 uv/s² current settles at 0.015 uv/s and goes nowhere. At 0.1 it
  // settles near 0.1 uv/s, which crosses a leash in under a second — motion the
  // eye reads as travel rather than as jitter.
  LEASH_DRAG: 0.1,
  // ── EXCURSIONS: the leash BREATHES ─────────────────────────────────────────
  //
  // A fixed leash still leaves every droplet orbiting a permanent mark. The
  // body churns, which is most of the way there, but nothing ever GOES
  // anywhere — and a population where each member has a home it never leaves
  // is a formation however lively each member is.
  //
  // So roam varies in time, per droplet, on its own aperiodic clock. At any
  // moment most of the body is on a short tether and a few droplets are on a
  // long one: they break away, travel a real distance across the composition,
  // and are drawn back as their clock comes round. That is intermittency, which
  // is what actual liquid does — it is mostly coherent, with occasional
  // events — and it costs nothing structurally, because the leash is still
  // scaled by (1 − bind) and still collapses to zero for the melts.
  //
  // 1.35 against an fBm in [-1, 1], floored at 0.25, swings a droplet's leash
  // between a quarter and 2.35× its nominal. Against the skewed roam spread
  // (0.45…1.83) the population's effective range is 0.11…4.3 — a droplet at the
  // top of that has a leash of ~0.28 uv, which crosses a whole body.
  EXCURSION: 1.35,
  // Hz. Slow enough that an excursion reads as an event with a beginning and an
  // end rather than as a wobble; fast enough that several happen while a
  // visitor is looking at one chapter.
  EXCURSION_RATE: 0.11,
  /**
   * Population above which the pair force switches to a uniform grid.
   *
   * Below it, every pair is tested exactly as before — same order, same
   * accumulation, bit-identical results — so nothing about the shipped 48
   * changes, and no verification baseline moves. The grid only engages when the
   * population actually grows past what all-pairs can carry. Measured per
   * 60 Hz frame (2 substeps), the shipped v2 branch against the same force
   * through a grid:
   *
   *      N       all-pairs      grid
   *     48        0.012 ms   0.012 ms
   *    192        0.121 ms   0.028 ms
   *    768        1.777 ms   0.212 ms
   *   1536        7.616 ms   0.570 ms
   *
   * 96 is where the grid stops costing more than it saves. The v3 forces
   * evaluate wider bands per pair than this was measured on, so the real
   * crossover sits below the threshold rather than above it.
   */
  PAIR_GRID_MIN: 96,
  // ── the hand (hover) ───────────────────────────────────────────────────────
  // The previous field was a monotone repulsion: strength fell off from the
  // pointer to the influence edge and never changed sign. Integrated over the
  // disc that carries NET OUTWARD FLUX, so the hand did not displace liquid, it
  // evacuated a hole around itself — and any attempt to make it "stronger" only
  // cleared a bigger hole faster. The profile below is a WELL: an outward lobe
  // at q≈0.30 and a return lobe at q≈0.70, whose area-weighted integrals cancel
  // at CURSOR_RIM ≈ 0.53. At 0.5 the net flux is ~0.007 of the outward lobe —
  // volume-conserving to within a rounding error, which is why the push can be
  // roughly doubled without the field tearing itself open.
  CURSOR_RADIUS: 0.26, // pointer influence radius (uv)
  CURSOR_PUSH: 3.1, // radial profile ceiling (uv/s²)
  CURSOR_RIM: 0.5, // return-lobe share — the meniscus that keeps volume
  CURSOR_SWIRL: 0.34, // resting swirl (uv/s²) — a still hand still breathes
  // The wake. A fixed-handed vortex is the least liquid thing the old field
  // did: real flow past a moving body sheds COUNTER-rotating lobes either side
  // of its path, so the sign belongs to (pointer velocity × offset), not to the
  // code. At a standstill this term vanishes and CURSOR_SWIRL carries alone.
  CURSOR_WAKE: 2.4, // velocity-signed tangential ceiling (uv/s²)
  CURSOR_DRAG: 0.85, // pointer-velocity injection factor
  CURSOR_PRESS: 0.9, // extra field gain while the pointer is held down
  PRESS_TAU: 90, // ms — press rises and releases as a squeeze, not a switch
  V_MAX: 1.6, // velocity clamp (uv/s) — a flick stirs, never flings
  SAT_POOL: 14, // satellite droplet budget (48+14+3+12+probe ≤ 80)
  SAT_STRAIN: 0.085, // spawn when |target − body| exceeds this (uv)
  SAT_BIND_MAX: 0.4, // never shed from bound liquid (melts stay exact)
  SAT_COOLDOWN: 520, // per-droplet respawn cooldown (ms)
  SAT_TTL_MIN: 650, // satellite lifetime (ms)
  SAT_TTL_VAR: 550,
  SAT_R: 0.34, // satellite radius = parent r × this
  // Physics-v3 review constants. The v3 path is deliberately opt-in until
  // its signature feel has completed owner capture review; the default path
  // above remains byte-for-byte the signed-off R5-B behavior.
  V3_VISC_RANGE: 1.85, // local velocity matching reach × (ri + rj)
  V3_VISC_A: 2.4, // local viscosity acceleration (1/s)
  V3_ATTR_START: 1.2, // attraction begins after the repulsion shell
  V3_ATTR_RANGE: 2.35, // short cohesive band × (ri + rj)
  V3_ATTR_A: 0.24, // attraction acceleration ceiling (uv/s²)
  V3_SPREAD_A: 0.9, // bounded cluster-footprint correction
  V3_SPREAD_MAX: 0.16, // correction acceleration ceiling (uv/s²)
  OBSTACLE_MARGIN: 0.018, // breathing room around cached type/card bounds
  OBSTACLE_A: 2.1, // soft avoidance acceleration ceiling (uv/s²)
  // ── scroll coupling ────────────────────────────────────────────────────────
  // The conductor damped a scroll velocity and handed it to this core, which
  // never read it: scroll reached the ambient beads and the cadence governor
  // and stopped there. The spring does lag whenever a scene MOVES its targets,
  // but most of the page holds its targets still in viewport space, so between
  // the authored transitions scrolling produced no liquid response at all.
  // These three restore the missing half: the page is a container being dragged
  // past the fluid it carries.
  SCROLL_CLAMP: 2.2, // vh/s ceiling — matches the ambient STIR clamp
  SCROLL_LEAN: 0.85, // inertial body force opposite the travel (uv/s² per vh/s)
  SCROLL_SHEAR: 0.55, // cross-field shear — the body stretches, never slides as a slab
  SCROLL_STIR: 1.15, // scroll drives the ambient curl: flow you can actually see
  // ── the strike (click / tap) ───────────────────────────────────────────────
  // A click is a WAVE, not an impulse. Kicking every droplet on the same frame
  // is an explosion: the whole field moves at once, which is the one thing
  // liquid never does. The strike therefore travels — SHOCK_SPEED — as an
  // annulus SHOCK_WIDTH thick, and each droplet feels it only while the ring is
  // passing through it.
  SHOCK_SLOTS: 4, // concurrent strikes (a mash merges into these)
  SHOCK_A: 10, // crest acceleration ceiling (uv/s²)
  SHOCK_SPEED: 0.95, // wavefront speed (uv/s)
  SHOCK_WIDTH: 0.085, // annulus half-width (uv)
  SHOCK_REACH: 0.62, // uv the front travels before it is spent
  SHOCK_LIFE: 1050, // ms — total envelope
  // The trough is what makes it read as liquid rather than as a blast: behind
  // the crest the surface has been pushed away, and the cavity it left pulls
  // the next liquid back in. Crest out, trough in, settle.
  SHOCK_RECOIL: 0.52, // trough amplitude, share of the crest
  SHOCK_LAG: 1.55, // trough centre, in wave widths behind the crest
  // Naturality: never a clean ring. phys.mjs already refuses accidental rings
  // in its scatter generator for the same reason — a perfect circle is the
  // signature of arithmetic, not of a fluid. Two things break it: an angular
  // amplitude harmonic (the lobes/fingers a real crown throws) and a
  // per-droplet arrival jitter, which is the stronger of the two because it
  // desynchronises the front itself instead of only modulating it.
  SHOCK_SWIRL: 0.4, // lobed tangential shear (uv/s²)
  SHOCK_IRREG: 0.38, // angular + per-droplet amplitude irregularity
  SHOCK_FRONT_JIT: 0.24, // ± share of per-droplet front-arrival jitter
  // Mashing. Real liquid already in motion absorbs a second blow far less than
  // a still surface does, so strike amplitude divides by a decaying load count
  // instead of being rate-limited away. Fast repeats still register; they just
  // stop compounding into chaos.
  SHOCK_SATURATE: 0.55, // per-recent-strike amplitude divisor
  SHOCK_LOAD_TAU: 620, // ms — how fast the surface calms back down
  SHOCK_MERGE_MS: 110, // repeats inside this window fold into the live shock
  SHOCK_MERGE_R: 0.05, // … if they also land inside this radius (uv)
  SHOCK_SPRAY: 4, // crown droplets thrown per strike (from the sat pool)
  SHOCK_CROWN_R: 0.1, // only liquid this close to the impact throws a crown
  SHOCK_CROWN_V: 0.42, // crown ejection speed (uv/s)
  // ── mass response ──────────────────────────────────────────────────────────
  // Interaction forces were accelerations: every droplet answered the hand
  // identically regardless of size, which is how gravity behaves and not how a
  // blow does. Dividing by mass makes small beads spray and heavy bodies shrug,
  // and that size spread is most of what sells a strike as a physical event.
  MASS_REF: 0.03, // the canonical median droplet radius
  MASS_RESP_MIN: 0.55, // heaviest response floor
  MASS_RESP_MAX: 1.7, // lightest response ceiling
  SAT_RESPONSE: 1.45, // spray is light — it rides the field hardest
  // The atmosphere sits at AMBIENT_Z = 0.62, behind everything. It answers the
  // same forces at a fraction of the strength, which reads as depth rather than
  // as a second, weaker rule.
  AMB_RESPONSE: 0.55,
  AMB_OMEGA: 6.2, // ambient restore rate (rad/s) — buoyant, not springy
  AMB_ZETA: 0.85,
  AMB_MAX: 0.085, // ambient displacement clamp (uv)
  // ── what the FORMS feel ────────────────────────────────────────────────────
  // The eight owner-traced SVGs render from SDF textures, not from droplets, so
  // no force in this file could ever reach them: the most prominent liquid on
  // the page was the one part of it that did not answer a hand. These two are
  // DISPLACEMENTS in uv, not accelerations — a form has no velocity state, so it
  // answers with the spring's equilibrium rather than by integrating. Smaller
  // than the droplets' response for the obvious reason: a form is a large body
  // of liquid and a droplet is a bead.
  // Sized against the FORM, not against a droplet. A droplet is ~0.03 uv across,
  // so a 0.018 uv push moves it most of its own width and reads instantly. A
  // form is ~0.25 uv of half-extent, and its resting liquidWarp already breathes
  // its outline by a pixel or two — so the same number produced a dent about
  // nine pixels deep on a 250-pixel body, which is indistinguishable from that
  // breathing. It was measurable and invisible, which is the worst of both.
  // Owner-reviewed three times: 0.055 mangled the mark, 0.032 was still too
  // strong. Read these as a share of the FORM's own width rather than in uv —
  // a form spans iFormScale uv (~0.5), so 0.020 is a dent about 4% of the
  // silhouette deep. That is the scale at which it reads as liquid answering a
  // hand rather than as the mark being edited. `?fformtouch=<n>` multiplies
  // both at runtime, so the next round is a URL rather than a rebuild.
  FORM_TOUCH: 0.02, // peak hover displacement of the form surface (uv)
  FORM_SHOCK: 0.034, // peak strike displacement of the form surface (uv)
  // The form's OWN press gain, deliberately weaker than the droplets'
  // CURSOR_PRESS. Pressing into a bead can nearly double its displacement and
  // still look right because the bead is small; doing the same to a body a
  // quarter of the field wide is how the silhouette gets destroyed.
  FORM_PRESS: 0.4,
};

export const FLUID_OBSTACLE_MAX = 12;
export const FLUID_OBSTACLE_STRIDE = 5; // cx, cy, half-width, half-height, weight

const H_S = FLUID.H_MS / 1000;

// The ambient flow is CURL NOISE (lib/webgl/noise.mjs) — v = (∂ψ/∂y, −∂ψ/∂x)
// of a value-noise fBm potential, so it is divergence-free by identity, rough
// at every scale, and aperiodic.
//
// What it replaced was four sinusoid octaves, and they failed for a reason that
// no amount of loosening the droplets could fix: the finest had a wavelength of
// 0.36 uv while neighbouring droplets sit ~0.07 uv apart, so every droplet in a
// body was inside the same eddy and got the same push. Bodies translated as
// rigid pieces — measured, the velocity directions of droplets within three
// radii correlated at 0.51 — and a body that moves as one piece reads as
// choreography whatever its parts are allowed to do. The noise ladder runs down
// to a 0.085 uv octave, which is the scale at which neighbours can finally
// disagree with each other.
const CURL_OUT = new Float32Array(2);

export function makeFluidCore(opts = {}) {
  const v3 = opts.v3 === true;
  // ── R6 temperament ─────────────────────────────────────────────────────────
  // Per-droplet character, deterministic from the identity hash. Every field is
  // a MULTIPLIER on a force below that already scales by (1 − bind), so this
  // adds no new path to a bound droplet and the exactness contract is untouched.
  // 0 is a neutral bypass (?ftemper=0): the table returns 1s and a zero spin, so
  // every expression it touches collapses to what it computed before R6.
  const temperGain = Number.isFinite(opts.temper)
    ? Math.max(0, Math.min(1, opts.temper))
    : TEMPER_GAIN;
  const temperOn = temperGain > 0;
  // ── R6 population ──────────────────────────────────────────────────────────
  // N is the AUTHORED droplet count (48) and stays exactly that: what the forms
  // are packed to and what the scenes address. POP is what this core simulates.
  // Motes are droplets N..POP, each a replica of host i % N with a derived
  // station — see motes.mjs. Defaulting to N makes every array, loop and force
  // below identical to pre-R6 when no larger population is asked for.
  const POP = Math.max(N, Math.floor(opts.pop) || N);
  // Per-droplet inertia over the full population. A mote is smaller than its
  // host, so it is lighter and answers faster — which is also what stops a host
  // and its motes travelling as one rigid clump. Entries below N are TAUP
  // itself, so the authored droplets keep their signed-off lag exactly.
  const TAUPOP = new Float32Array(POP);
  for (let i = 0; i < POP; i++)
    TAUPOP[i] = TAUP[i % N] * (i < N ? 1 : moteTauScale(i));
  // Sized to the SIMULATED population, not the authored one: the force loop
  // indexes this by droplet, and a table that stopped at N handed every mote an
  // undefined restlessness — which is NaN the moment it multiplies anything, and
  // which then spreads to the authored droplets through the pair force.
  const TMP = temperTable(POP, temperGain);
  // The leash is its OWN rollback axis, not a passenger of temperament: one is
  // how far a droplet may travel, the other is how it behaves while travelling,
  // and the repo's flag grammar is one per force. `?fleash=0` restores the
  // pre-R6-B spring-to-a-point exactly — every expression collapses to the
  // original term — which is the only honest way to A/B "is this too loose".
  const leashGain = Number.isFinite(opts.leash)
    ? Math.max(0, opts.leash)
    : 1;
  const LEASH_R = FLUID.LEASH_R * leashGain;
  // ?fformtouch=<n> — a live multiplier on what the FORMS feel, so the level can
  // be settled by reloading a URL instead of rebuilding. 1 = the table above.
  const formGain =
    Number.isFinite(opts.formGain) && opts.formGain >= 0 ? opts.formGain : 1;
  const obstacleFlow = v3 && opts.obstacles === true;
  // physics body (PD + forces), previous fixed-step body (render interpolation),
  // legacy shadow (byte-exact low-pass), velocity
  const XP = new Float32Array(POP * 2);
  const X0 = new Float32Array(POP * 2);
  const XL = new Float32Array(POP * 2);
  const V = new Float32Array(POP * 2);
  // Field x legitimately extends below zero on wide canvases. Initialization
  // must therefore be explicit; using XP/XL x < 0 as a sentinel resets any
  // left-side droplet directly to its target on the following frame.
  let seeded = false;
  // per-cluster accumulation scratch (id ≥ 0; small fixed table)
  const CMAX = 16;
  const csx = new Float32Array(CMAX);
  const csy = new Float32Array(CMAX);
  const cn = new Uint16Array(CMAX);
  // Physics-v3 uses droplet area as mass and preserves each authored
  // cluster's footprint instead of pulling every family toward a point.
  // These arrays are fixed scratch: no per-step allocation.
  const csm = new Float32Array(CMAX);
  const ctx = new Float32Array(CMAX);
  const cty = new Float32Array(CMAX);
  const csr = new Float32Array(CMAX);
  const ctr = new Float32Array(CMAX);

  // ── R6: the pair-force neighbourhood ───────────────────────────────────────
  // The pair force is the ONE super-linear term in this core: `for j = i+1 … POP`
  // at two substeps per frame is O(POP²), which is free at 48 and is not at 384.
  // Measured per 60 Hz frame on the shipped v2 branch — 48: 0.012 ms · 192:
  // 0.121 · 768: 1.777 · 1536: 7.616 — against the same force through this grid:
  // 0.012 · 0.028 · 0.212 · 0.570.
  //
  // Below FLUID.PAIR_GRID_MIN the grid is not built and every pair is tested in
  // the original order, so the shipped 48 keep bit-identical arithmetic and no
  // verification baseline moves. It engages only once the population is large
  // enough to need it.
  //
  // Counting-sort buckets rather than linked lists: the scan is then contiguous
  // in memory and each cell's members come out in ascending index order, which
  // keeps the `j > i` visit-each-pair-once rule trivially true.
  const useGrid = POP > FLUID.PAIR_GRID_MIN;
  const GRID_MAX = 4096;
  const gCell = useGrid ? new Int32Array(POP) : null;
  const gCount = useGrid ? new Int32Array(GRID_MAX + 1) : null;
  const gItems = useGrid ? new Int32Array(POP) : null;
  const nbrBuf = new Int32Array(POP);
  let gW = 1;
  let gH = 1;
  let gx0 = 0;
  let gy0 = 0;
  let gInv = 1;

  /** Bucket every live droplet by cell. Cell edge ≥ the widest interaction
   *  reach, so a 3×3 neighbourhood is a conservative superset of every pair. */
  const buildGrid = (R) => {
    let xmin = Infinity;
    let ymin = Infinity;
    let xmax = -Infinity;
    let ymax = -Infinity;
    let rMax = 0;
    for (let i = 0; i < POP; i++) {
      if (R[i] < 0.0012) continue;
      const x = XP[i * 2];
      const y = XP[i * 2 + 1];
      if (x < xmin) xmin = x;
      if (x > xmax) xmax = x;
      if (y < ymin) ymin = y;
      if (y > ymax) ymax = y;
      if (R[i] > rMax) rMax = R[i];
    }
    if (!(rMax > 0)) return false;
    // v3 reaches further than repulsion does (the cohesive band and the
    // viscosity kernel), so the cell has to be sized on the WIDEST of them or
    // the grid would quietly drop the forces that hold a cluster together.
    const reachMul = v3
      ? Math.max(FLUID.V3_ATTR_RANGE, FLUID.V3_VISC_RANGE, FLUID.REP_RANGE)
      : FLUID.REP_RANGE;
    let cell = Math.max(reachMul * 2 * rMax, 1e-4);
    const spanX = Math.max(xmax - xmin, 1e-4);
    const spanY = Math.max(ymax - ymin, 1e-4);
    // A single enormous droplet must not ask for a grid finer than the table:
    // grow the cell until the layout fits rather than truncating it, which
    // would silently lose neighbours at the far edge.
    for (let guard = 0; guard < 24; guard++) {
      gW = Math.max(1, Math.ceil(spanX / cell) + 1);
      gH = Math.max(1, Math.ceil(spanY / cell) + 1);
      if (gW * gH <= GRID_MAX) break;
      cell *= 1.5;
    }
    if (gW * gH > GRID_MAX) return false; // pathological — fall back to all-pairs
    gx0 = xmin;
    gy0 = ymin;
    gInv = 1 / cell;
    const cells = gW * gH;
    gCount.fill(0, 0, cells + 1);
    for (let i = 0; i < POP; i++) {
      if (R[i] < 0.0012) {
        gCell[i] = -1;
        continue;
      }
      const cx = Math.min(gW - 1, Math.max(0, ((XP[i * 2] - gx0) * gInv) | 0));
      const cy = Math.min(gH - 1, Math.max(0, ((XP[i * 2 + 1] - gy0) * gInv) | 0));
      const c = cy * gW + cx;
      gCell[i] = c;
      gCount[c + 1]++;
    }
    for (let c = 0; c < cells; c++) gCount[c + 1] += gCount[c];
    // Ascending droplet order within each cell falls out of scanning i upward.
    for (let i = 0; i < POP; i++) {
      const c = gCell[i];
      if (c >= 0) gItems[gCount[c]++] = i;
    }
    // undo the cursor advance so gCount[c] is the START of cell c again
    for (let c = cells; c > 0; c--) gCount[c] = gCount[c - 1];
    gCount[0] = 0;
    return true;
  };

  /** Candidates j > i for droplet i, into nbrBuf. Returns how many. */
  const neighboursOf = (i) => {
    const c = gCell[i];
    if (c < 0) return 0;
    const cx = c % gW;
    const cy = (c / gW) | 0;
    let n = 0;
    for (let oy = -1; oy <= 1; oy++) {
      const yy = cy + oy;
      if (yy < 0 || yy >= gH) continue;
      for (let ox = -1; ox <= 1; ox++) {
        const xx = cx + ox;
        if (xx < 0 || xx >= gW) continue;
        const cc = yy * gW + xx;
        const e = gCount[cc + 1];
        for (let k = gCount[cc]; k < e; k++) {
          const j = gItems[k];
          if (j > i) nbrBuf[n++] = j;
        }
      }
    }
    return n;
  };

  // satellites: fixed pool, TTL shrink-out
  const SP = FLUID.SAT_POOL;
  const sx = new Float32Array(SP);
  const sy = new Float32Array(SP);
  const svx = new Float32Array(SP);
  const svy = new Float32Array(SP);
  const sr0 = new Float32Array(SP);
  const sBorn = new Float64Array(SP); // absolute ms — see the note on kT0
  const sTtl = new Float32Array(SP).fill(0); // 0 = free slot (a duration)
  const lastSpawn = new Float64Array(POP).fill(-1e9);
  let spawnSeq = 0;

  /** Spawn one satellite into the first free pool slot. Shared by pinch-off
   *  (a straining droplet) and by the strike crown, so spray has exactly one
   *  definition and one budget however it was caused. */
  const spawnSat = (px, py, vx, vy, r, tMs, jit = 0, ttlScale = 1) => {
    for (let sl = 0; sl < SP; sl++) {
      if (sTtl[sl] > 0 && tMs - sBorn[sl] < sTtl[sl]) continue;
      spawnSeq++;
      sx[sl] = px;
      sy[sl] = py;
      svx[sl] = vx + (hash(spawnSeq, 77) - 0.5) * jit;
      svy[sl] = vy + (hash(spawnSeq, 78) - 0.5) * jit;
      sr0[sl] = Math.min(Math.max(r, 0.004), 0.011);
      sBorn[sl] = tMs;
      sTtl[sl] =
        (FLUID.SAT_TTL_MIN + FLUID.SAT_TTL_VAR * hash(spawnSeq, 79)) * ttlScale;
      return true;
    }
    return false;
  };

  // ── the strike: a fixed ring of travelling pressure waves ──────────────────
  const SHK = FLUID.SHOCK_SLOTS;
  const kx = new Float32Array(SHK);
  const ky = new Float32Array(SHK);
  // Float64, deliberately. These hold ABSOLUTE performance.now() milliseconds,
  // and a Float32 mantissa is exact only to ~16.7e6 — 4.6 hours of uptime, past
  // which stored times quantise to 1 ms and coarsen from there. Worse, and
  // immediately: rounding a double to the nearest float can round UP, so
  // `tMs - kT0[k]` came out slightly NEGATIVE on the very frame the strike was
  // registered, and the age < 0 guard below then swallowed its crown.
  const kT0 = new Float64Array(SHK).fill(-1e9);
  const kAmp = new Float32Array(SHK);
  const kPhase = new Float32Array(SHK); // per-strike angular seed (no two alike)
  const kCrown = new Uint8Array(SHK); // 1 = this wave has not thrown spray yet
  let strikeSeq = 0;
  let loadN = 0; // recent-strike count, decayed
  let loadT = -1e9;
  let newestK = -1;

  /**
   * Register a strike at (x, y) in field uv. `strength` (default 1) scales the
   * blow — the shell raises it for a fast stab. Safe to call at any rate: a
   * repeat inside the merge window folds into the live wave, and every strike
   * divides by the decayed load, so the surface saturates the way an agitated
   * one really does instead of accumulating without limit.
   */
  const strike = (x, y, tMs, strength = 1) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(tMs))
      return;
    // decay the outstanding load to now, then charge this strike against it
    loadN =
      loadT > -1e8 ? loadN * Math.exp(-(tMs - loadT) / FLUID.SHOCK_LOAD_TAU) : 0;
    loadT = tMs;
    const amp =
      Math.min(Math.max(strength, 0), 2) / (1 + loadN * FLUID.SHOCK_SATURATE);
    loadN += 1;

    // A quick repeat on the same spot deepens the live wave instead of starting
    // a second front a few ms behind it — two near-identical rings crossing is
    // a visual stutter, not a harder hit.
    if (
      newestK >= 0 &&
      tMs - kT0[newestK] < FLUID.SHOCK_MERGE_MS &&
      Math.hypot(x - kx[newestK], y - ky[newestK]) < FLUID.SHOCK_MERGE_R
    ) {
      kAmp[newestK] = Math.min(kAmp[newestK] + amp * 0.6, 1.8);
      return;
    }

    // otherwise take a spent slot, else the wave that is furthest along
    let slot = 0;
    let oldest = Infinity;
    for (let k = 0; k < SHK; k++) {
      if (tMs - kT0[k] >= FLUID.SHOCK_LIFE) {
        slot = k;
        break;
      }
      if (kT0[k] < oldest) {
        oldest = kT0[k];
        slot = k;
      }
    }
    strikeSeq++;
    kx[slot] = x;
    ky[slot] = y;
    kT0[slot] = tMs;
    kAmp[slot] = amp;
    kPhase[slot] = hash(strikeSeq, 83) * 6.283;
    kCrown[slot] = 1;
    newestK = slot;
  };

  /** 0..1 — how much strike energy is still in the field. The conductor feeds
   *  this to the cadence governor, so a click can never land on an idle 30 Hz
   *  page and play its wave at half rate. */
  const shockEnergy = (tMs) => {
    let e = 0;
    for (let k = 0; k < SHK; k++) {
      const age = tMs - kT0[k];
      if (age < 0 || age >= FLUID.SHOCK_LIFE) continue;
      const p = age / FLUID.SHOCK_LIFE;
      const v = kAmp[k] * (1 - p) * (1 - p);
      if (v > e) e = v;
    }
    return clamp01(e);
  };

  /**
   * Pack what the FORMS should feel this frame, as DISPLACEMENTS in field uv:
   * `touchOut` = [px, py, radius, gain], `shockOut` = [x, y, front, amp] × slots.
   *
   * The split matters. Everything time-dependent — how far each front has
   * travelled, how much of its amplitude is left — is resolved HERE, against the
   * same wave state the droplets read, so the shader evaluates only a spatial
   * profile and cannot drift out of step with the physics. A spent slot writes
   * amp 0, which is the shader's exact-identity case.
   *
   * Returns true while anything is live.
   */
  const formUniforms = (tMs, env, touchOut, shockOut) => {
    let live = false;
    touchOut[0] = env.px;
    touchOut[1] = env.py;
    touchOut[2] = FLUID.CURSOR_RADIUS;
    touchOut[3] = env.pon
      ? FLUID.FORM_TOUCH * (1 + FLUID.FORM_PRESS * (env.press || 0)) * formGain
      : 0;
    if (touchOut[3] > 0) live = true;
    for (let k = 0; k < SHK; k++) {
      const o = k * 4;
      shockOut[o + 3] = 0;
      const ageMs = tMs - kT0[k];
      if (ageMs < 0 || ageMs >= FLUID.SHOCK_LIFE) continue;
      const front = (ageMs / 1000) * FLUID.SHOCK_SPEED;
      if (front > FLUID.SHOCK_REACH) continue;
      const p = ageMs / FLUID.SHOCK_LIFE;
      const spread = 1 / Math.sqrt(1 + front / 0.14);
      shockOut[o] = kx[k];
      shockOut[o + 1] = ky[k];
      shockOut[o + 2] = front;
      shockOut[o + 3] =
        FLUID.FORM_SHOCK * kAmp[k] * (1 - p) * (1 - p) * spread * formGain;
      live = true;
    }
    return live;
  };

  /**
   * The displacement the FORMS take, evaluated at one point on the CPU.
   *
   * This is the spatial half of what `formTouch()` does per fragment in
   * sdf-glass-shader.mjs, and it deliberately reads the SAME `touchU`/`shockU`
   * arrays that were uploaded to the shader — so the amplitudes are computed
   * exactly once, in formUniforms, and the two evaluators cannot disagree about
   * how far along a wave is or how hard the hand is pressing. Only the profile
   * shape is written twice, once per language, and both take their constants
   * from FLUID.
   *
   * Its consumer is the conductor's BOUND liquid. A §3.3 melt runs at bind = 1,
   * where every environmental force is switched off by contract — which is
   * correct for the physics and wrong for the picture, because mid-morph the
   * stage is nothing BUT bound droplets, and the liquid went dead to the hand
   * exactly when it was most alive to look at. Applying this at pack time gives
   * them the same render displacement the form halves already take, so the one
   * iso-surface stays coherent, while the physics body, the legacy shadow and
   * every melt landing remain untouched.
   */
  const formDisplace = (x, y, touchU, shockU, tMs, out) => {
    let dxAcc = 0;
    let dyAcc = 0;

    const gain = touchU[3];
    if (gain > 0) {
      const rr = touchU[2];
      const dx = x - touchU[0];
      const dy = y - touchU[1];
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2);
        const q = d / rr;
        const q3 = q * q * q;
        const taper = 1 - q3 * q3;
        const outward = Math.exp(-(q - 0.3) * (q - 0.3) * 18);
        const back = Math.exp(-(q - 0.7) * (q - 0.7) * 30);
        const nearFade = q < 0.12 ? q / 0.12 : 1;
        const ang = Math.atan2(dy, dx);
        const lobe = 1 + 0.18 * Math.sin(3 * ang + (tMs / 1000) * 0.6);
        const radial =
          (outward - FLUID.CURSOR_RIM * back) * taper * nearFade * lobe;
        const dd = d > 1e-4 ? d : 1e-4;
        dxAcc += (dx / dd) * radial * gain;
        dyAcc += (dy / dd) * radial * gain;
      }
    }

    for (let k = 0; k < SHK; k++) {
      const o = k * 4;
      const amp = shockU[o + 3];
      if (amp <= 0) continue;
      const dx = x - shockU[o];
      const dy = y - shockU[o + 1];
      const d = Math.hypot(dx, dy);
      if (d < 1e-5) continue;
      const u = (d - shockU[o + 2]) / FLUID.SHOCK_WIDTH;
      if (u > 2.4 || u < -(FLUID.SHOCK_LAG + 2.4)) continue;
      const crest = Math.exp(-u * u * 1.35);
      const lag = u + FLUID.SHOCK_LAG;
      const trough = Math.exp(-lag * lag * 0.9);
      // GLSL fract() is x - floor(x), which is NOT JS's % for negatives — the
      // shader and this must pick the same lobes or the form and the droplets
      // beside it would finger in different directions.
      const h = Math.sin(shockU[o] * 127.1 + shockU[o + 1] * 311.7) * 43758.5453;
      const seed = (h - Math.floor(h)) * 6.283;
      const ang = Math.atan2(dy, dx);
      const lobe =
        1 +
        FLUID.SHOCK_IRREG *
          (0.62 * Math.sin(3 * ang + seed) +
            0.38 * Math.sin(5 * ang - seed * 1.7));
      const v = (crest - FLUID.SHOCK_RECOIL * trough) * Math.max(lobe, 0) * amp;
      dxAcc += (dx / d) * v;
      dyAcc += (dy / d) * v;
    }

    out[0] = dxAcc;
    out[1] = dyAcc;
    return out;
  };

  // Shared force scratch. Every consumer — the 48, the spray, the conductor's
  // ambient family — reads the SAME field definition through the helpers below,
  // so there is never a second, drifting copy of what the hand and the strike
  // do to liquid.
  const A2 = new Float32Array(2);

  /** Inverse-mass response for a body of radius r, clamped either side. */
  const massResp = (r) => {
    const m = FLUID.MASS_REF / Math.max(r, 1e-4);
    return m < FLUID.MASS_RESP_MIN
      ? FLUID.MASS_RESP_MIN
      : m > FLUID.MASS_RESP_MAX
        ? FLUID.MASS_RESP_MAX
        : m;
  };

  /** The hand. Accumulates into A2; see CURSOR_RIM for the flux argument. */
  const cursorAccel = (x, y, env) => {
    if (!env.pon) return;
    const rr = FLUID.CURSOR_RADIUS;
    const dx = x - env.px;
    const dy = y - env.py;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return;
    const d = Math.sqrt(d2);
    const q = d / rr;
    const dd = d > 1e-4 ? d : 1e-4;
    const nx = dx / dd;
    const ny = dy / dd;
    // Exact zero at the influence edge. An abrupt cutoff here reads as a hard
    // circle of stillness travelling with the pointer.
    const q3 = q * q * q;
    const taper = 1 - q3 * q3;
    // the well: an outward lobe, then the rim that returns what it displaced
    const outward = Math.exp(-(q - 0.3) * (q - 0.3) * 18);
    const back = Math.exp(-(q - 0.7) * (q - 0.7) * 30);
    // Under the pointer itself the radial direction is meaningless — fade the
    // radial term out rather than let it chatter between frames.
    const nearFade = q < 0.12 ? q / 0.12 : 1;
    const radial = (outward - FLUID.CURSOR_RIM * back) * taper * nearFade;
    const fall = (1 - q * q) * taper; // tangential/drag falloff
    const gain = 1 + FLUID.CURSOR_PRESS * (env.press || 0);
    const push = FLUID.CURSOR_PUSH * radial * gain;
    A2[0] += nx * push;
    A2[1] += ny * push;
    // Wake: signed by (pointer velocity × offset), so the two sides of the
    // hand's path counter-rotate the way flow past a real body does. At a
    // standstill this vanishes and CURSOR_SWIRL carries the term alone.
    // Clamp the raw pointer speed, THEN apply the falloff — clamping the
    // already-attenuated value would make the ceiling distance-dependent, so a
    // flick would stay unbounded everywhere except right under the pointer.
    const cross = env.pvx * ny - env.pvy * nx;
    const wake = (cross > 1.2 ? 1.2 : cross < -1.2 ? -1.2 : cross) * fall;
    const tang = (FLUID.CURSOR_SWIRL * fall + FLUID.CURSOR_WAKE * wake) * gain;
    A2[0] += -ny * tang;
    A2[1] += nx * tang;
    // the hand drags the liquid with it
    const drag = FLUID.CURSOR_DRAG * fall * gain;
    A2[0] += env.pvx * drag;
    A2[1] += env.pvy * drag;
  };

  /**
   * The strike. Accumulates into A2. `jitA`/`jitB` are the body's own hashes
   * (front-arrival and amplitude). Passing them in rather than deriving them
   * here is what lets droplets, spray and the ambient family each carry a
   * stable — and different — irregularity through the same wave.
   */
  const shockAccel = (x, y, tMs, jitA, jitB) => {
    for (let k = 0; k < SHK; k++) {
      const ageMs = tMs - kT0[k];
      if (ageMs < 0 || ageMs >= FLUID.SHOCK_LIFE) continue;
      const dx = x - kx[k];
      const dy = y - ky[k];
      const d = Math.hypot(dx, dy);
      if (d < 1e-5) continue;
      // the front, arriving at this body's own moment
      const front =
        (ageMs / 1000) *
        FLUID.SHOCK_SPEED *
        (1 + FLUID.SHOCK_FRONT_JIT * (jitA - 0.5) * 2);
      if (front > FLUID.SHOCK_REACH) continue;
      const u = (d - front) / FLUID.SHOCK_WIDTH;
      if (u > 2.4 || u < -(FLUID.SHOCK_LAG + 2.4)) continue; // outside the ring
      const crest = Math.exp(-u * u * 1.35);
      const lag = u + FLUID.SHOCK_LAG;
      const trough = Math.exp(-lag * lag * 0.9);
      const p = ageMs / FLUID.SHOCK_LIFE;
      // 2D cylindrical spreading — the ring thins as its circumference grows
      const spread = 1 / Math.sqrt(1 + front / 0.14);
      const theta = Math.atan2(dy, dx);
      // lobes + a per-body offset: the crown fingers instead of ringing
      const ang =
        1 +
        FLUID.SHOCK_IRREG *
          (0.62 * Math.sin(3 * theta + kPhase[k]) +
            0.38 * Math.sin(5 * theta - kPhase[k] * 1.7) +
            (jitB - 0.5) * 1.2);
      const amp =
        FLUID.SHOCK_A *
        kAmp[k] *
        (1 - p) *
        (1 - p) *
        spread *
        (ang > 0 ? ang : 0);
      const radial = (crest - FLUID.SHOCK_RECOIL * trough) * amp;
      const nx = dx / d;
      const ny = dy / d;
      A2[0] += nx * radial;
      A2[1] += ny * radial;
      // A lobed shear, not a spin: alternating sign around the ring is what a
      // real crown does as it breaks into fingers.
      const tang =
        crest * amp * FLUID.SHOCK_SWIRL * Math.sin(3 * theta + kPhase[k] * 2.3);
      A2[0] += -ny * tang;
      A2[1] += nx * tang;
    }
  };

  /**
   * Sample the INTERACTION field (hand + strikes) at a point, for families the
   * core does not integrate itself — today the conductor's ambient lava-lamp
   * beads. Writes [ax, ay] into `out`. Deliberately excludes goal-seek,
   * repulsion, cohesion, curl and scroll: those belong to the canonical 48.
   */
  const probe = (x, y, tMs, env, out, jitA = 0.5, jitB = 0.5) => {
    A2[0] = 0;
    A2[1] = 0;
    cursorAccel(x, y, env);
    shockAccel(x, y, tMs, jitA, jitB);
    out[0] = A2[0];
    out[1] = A2[1];
    return out;
  };

  let acc = 0; // substep accumulator (ms)

  /**
   * Advance the fluid and write the OUTPUT positions into P (n*2).
   * T/BIND/CLUS = blended scene targets; R = current radii (read-only, for
   * interaction ranges); env = { px, py, pvx, pvy, pon, vel } (field uv).
   */
  const step = (P, T, BIND, CLUS, R, dtMs, tMs, env) => {
    // ── legacy shadow: the EXACT Phase-A low-pass (frame-rate corrected) ──────
    const first = !seeded;
    for (let i = 0; i < POP; i++) {
      const kp = 1 - Math.exp(-dtMs / TAUPOP[i]);
      if (first) {
        XL[i * 2] = T[i * 2];
        XL[i * 2 + 1] = T[i * 2 + 1];
      } else {
        XL[i * 2] += (T[i * 2] - XL[i * 2]) * kp;
        XL[i * 2 + 1] += (T[i * 2 + 1] - XL[i * 2 + 1]) * kp;
      }
      if (first) {
        XP[i * 2] = T[i * 2];
        XP[i * 2 + 1] = T[i * 2 + 1];
        X0[i * 2] = T[i * 2];
        X0[i * 2 + 1] = T[i * 2 + 1];
        V[i * 2] = 0;
        V[i * 2 + 1] = 0;
      }
    }
    if (first) seeded = true;

    // ── physics body: fixed-step substepped semi-implicit Euler ──────────────
    acc += dtMs;
    const maxSteps = 14; // dt is clamped upstream (≤100ms) — safety anyway
    let steps = 0;
    while (acc >= FLUID.H_MS && steps < maxSteps) {
      acc -= FLUID.H_MS;
      steps++;
      const tSubMs = tMs - acc;
      const t = tSubMs / 1000;

      // Scroll, resolved once per substep. Positive = scrolling down, which
      // drags the content (and every target pinned to it) UP the viewport, so
      // the fluid's own mass answers downward.
      const scroll = Math.max(
        -FLUID.SCROLL_CLAMP,
        Math.min(FLUID.SCROLL_CLAMP, env.vel || 0),
      );
      // The ambient current runs faster while the page moves and settles back
      // when it stops — the curl stays divergence-free either way, so this
      // reads as the whole body flowing rather than droplets being pushed.
      const curlGain =
        FLUID.CURL_V *
        (1 + FLUID.SCROLL_STIR * (Math.abs(scroll) / FLUID.SCROLL_CLAMP));

      // Preserve the preceding fixed-step state. Rendering interpolates X0→XP
      // with the accumulator remainder, so 144/165 Hz displays never repeat a
      // stale body on zero-substep frames and catch up on the next frame.
      X0.set(XP);

      // cluster centroids (physics body positions, free-ish droplets only)
      csx.fill(0);
      csy.fill(0);
      cn.fill(0);
      if (v3) {
        csm.fill(0);
        ctx.fill(0);
        cty.fill(0);
        csr.fill(0);
        ctr.fill(0);
      }
      for (let i = 0; i < POP; i++) {
        const c = CLUS[i];
        if (c < 0 || c >= CMAX || R[i] < 0.0012) continue;
        const mass = v3 ? Math.max(R[i] * R[i], 1e-6) : 1;
        csx[c] += XP[i * 2] * mass;
        csy[c] += XP[i * 2 + 1] * mass;
        if (v3) {
          csm[c] += mass;
          ctx[c] += T[i * 2] * mass;
          cty[c] += T[i * 2 + 1] * mass;
        }
        cn[c]++;
      }
      if (v3) {
        for (let i = 0; i < POP; i++) {
          const c = CLUS[i];
          if (c < 0 || c >= CMAX || cn[c] < 2 || R[i] < 0.0012) continue;
          const mass = Math.max(R[i] * R[i], 1e-6);
          const mx = csx[c] / csm[c];
          const my = csy[c] / csm[c];
          const tx = ctx[c] / csm[c];
          const ty = cty[c] / csm[c];
          csr[c] += Math.hypot(XP[i * 2] - mx, XP[i * 2 + 1] - my) * mass;
          ctr[c] += Math.hypot(T[i * 2] - tx, T[i * 2 + 1] - ty) * mass;
        }
      }

      // Rebuilt every substep: the bodies have moved since the last one, and a
      // stale bucket is a dropped force rather than a slightly wrong one.
      const gridLive = useGrid && buildGrid(R);

      for (let i = 0; i < POP; i++) {
        const b = clamp01(BIND[i]);
        const free = 1 - b;
        const ix = i * 2;
        const x = XP[ix];
        const y = XP[ix + 1];
        const tau = TAUPOP[i] / 1000;
        const om = FLUID.OMEGA_K / tau;

        // ── THE LEASH (R6-B) — a station, not a stake ────────────────────────
        //
        // The goal-seek used to be a stiff spring to a POINT: om² · (T − x) with
        // om = OMEGA_K / TAUP, so ω² lands between 77 and 343. Equilibrium
        // displacement under a steady force is F/ω², and the whole ambient
        // current — curl plus the droplet's own drift — is worth 0.29 uv/s².
        // Measured, that is 0.4 to 4.2 PIXELS of wander on a droplet 20 px
        // across. Every environmental force in this file was a whisper against
        // that spring, and no amount of per-droplet character could change it:
        // the droplets differed in which whisper they got.
        //
        // So the constraint changes shape. A droplet is CONTAINED IN A
        // NEIGHBOURHOOD of its target rather than pinned to it. Inside the
        // leash there is no restoring force at all and only a light drag, so
        // the flow genuinely carries it — that is advection, and it is the
        // thing that reads as fluid. Outside, a full-strength spring pulls it
        // back to THE NEAREST POINT ON THE LEASH, never to the centre: a spring
        // to the centre would fire it through the middle and out the far side,
        // which is a bouncing ball, not a contained liquid.
        //
        // The macro contract is untouched, and by the same gate as everything
        // else: the leash is scaled by `free`, so at bind = 1 it is identically
        // zero and this expression collapses to the original stiff spring, term
        // for term. The §3.3 melts, the resting footprints and the exact mark
        // move exactly as they were signed off.
        const dtx = T[ix] - x;
        const dty = T[ix + 1] - y;
        // The droplet's own roam, breathing on its own clock — see EXCURSION.
        const roam = temperOn
          ? TMP.roam[i] *
            Math.max(
              0.25,
              1 + FLUID.EXCURSION * fbm1(t * FLUID.EXCURSION_RATE, i + 5000),
            )
          : 1;
        const leash = LEASH_R * R[i] * free * roam;
        let ax;
        let ay;
        if (leash > 1e-5) {
          const dd = Math.sqrt(dtx * dtx + dty * dty);
          const q = dd / leash;
          // Grip rises smoothly from the inner free zone to the leash, so the
          // droplet is not handed a step change in drag as it drifts out.
          const grip = smooth01((q - FLUID.LEASH_FREE) / (1 - FLUID.LEASH_FREE));
          const over = dd > leash ? (dd - leash) / dd : 0;
          const damp =
            2 *
            FLUID.DAMP_Z *
            om *
            (FLUID.LEASH_DRAG + (1 - FLUID.LEASH_DRAG) * grip);
          ax = om * om * dtx * over - damp * V[ix];
          ay = om * om * dty * over - damp * V[ix + 1];
        } else {
          ax = om * om * dtx - 2 * FLUID.DAMP_Z * om * V[ix];
          ay = om * om * dty - 2 * FLUID.DAMP_Z * om * V[ix + 1];
        }

        if (free > 0.01 && R[i] >= 0.0012) {
          // Pair forces. The signed-off v2 branch stays verbatim. Physics v3
          // adds area-weighted momentum, a short cohesive band, and local
          // viscosity so separated beads reconnect as one material.
          // The candidate list. Without the grid this is literally i+1 … POP in
          // order, so the arithmetic below sees the same j values in the same
          // sequence it always has.
          let cand;
          if (gridLive) {
            cand = neighboursOf(i);
          } else {
            cand = POP - i - 1;
            for (let q = 0; q < cand; q++) nbrBuf[q] = i + 1 + q;
          }
          for (let q = 0; q < cand; q++) {
            const j = nbrBuf[q];
            if (R[j] < 0.0012) continue;
            const fj = 1 - clamp01(BIND[j]);
            if (fj < 0.01) continue;
            const dx = x - XP[j * 2];
            const dy = y - XP[j * 2 + 1];
            const d2 = dx * dx + dy * dy;
            if (d2 < 1e-8) continue;
            const radii = R[i] + R[j];
            const reach = FLUID.REP_RANGE * radii;
            const d = Math.max(Math.sqrt(d2), FLUID.REP_D_MIN);
            if (!v3) {
              if (d2 > reach * reach) continue;
              const push = FLUID.REP_A * (1 - d / reach) * free * fj;
              const inv = push / d;
              ax += dx * inv;
              ay += dy * inv;
              // Symmetric kick applied here; j's own loop starts after i.
              V[j * 2] -= dx * inv * H_S;
              V[j * 2 + 1] -= dy * inv * H_S;
              continue;
            }

            const mi = Math.max(R[i] * R[i], 1e-6);
            const mj = Math.max(R[j] * R[j], 1e-6);
            const invMass = 1 / (mi + mj);
            // Equal sizes retain the v2 force. Smaller beads yield more to a
            // larger body, matching area-weighted liquid mass.
            const wi = 2 * mj * invMass;
            const wj = 2 * mi * invMass;
            const nx = dx / d;
            const ny = dy / d;

            if (d < reach) {
              const push = FLUID.REP_A * (1 - d / reach) * free * fj;
              ax += nx * push * wi;
              ay += ny * push * wi;
              V[j * 2] -= nx * push * wj * H_S;
              V[j * 2 + 1] -= ny * push * wj * H_S;
            } else {
              const attrStart = FLUID.V3_ATTR_START * radii;
              const attrReach = FLUID.V3_ATTR_RANGE * radii;
              if (CLUS[i] === CLUS[j] && d > attrStart && d < attrReach) {
                const u =
                  (d - attrStart) / Math.max(attrReach - attrStart, 1e-5);
                const pull =
                  Math.sin(Math.PI * u) * FLUID.V3_ATTR_A * free * fj;
                ax -= nx * pull * wi;
                ay -= ny * pull * wi;
                V[j * 2] += nx * pull * wj * H_S;
                V[j * 2 + 1] += ny * pull * wj * H_S;
              }
            }

            const viscReach = FLUID.V3_VISC_RANGE * radii;
            if (d < viscReach) {
              const fall = 1 - d / viscReach;
              const visc = FLUID.V3_VISC_A * fall * fall * free * fj;
              const dvx = V[j * 2] - V[ix];
              const dvy = V[j * 2 + 1] - V[ix + 1];
              ax += dvx * visc * wi;
              ay += dvy * visc * wi;
              V[j * 2] -= dvx * visc * wj * H_S;
              V[j * 2 + 1] -= dvy * visc * wj * H_S;
            }
          }

          // cohesion toward the cluster centroid
          const c = CLUS[i];
          if (c >= 0 && c < CMAX && cn[c] > 1) {
            const mass = v3 ? csm[c] : cn[c];
            const mx = csx[c] / mass;
            const my = csy[c] / mass;
            // R6: how strongly THIS droplet answers its group. Below 1 it hangs
            // at the edge of its cluster and drifts; above 1 it clings to the
            // middle. The cluster still holds — sociable is a multiplier on the
            // pull, never a sign change — but it stops being a rigid body.
            const soc = temperOn ? TMP.sociable[i] : 1;
            ax += (mx - x) * FLUID.COH_A * free * soc;
            ay += (my - y) * FLUID.COH_A * free * soc;
            if (v3) {
              const dx = x - mx;
              const dy = y - my;
              const d = Math.hypot(dx, dy);
              const correction = Math.max(
                -FLUID.V3_SPREAD_MAX,
                Math.min(
                  FLUID.V3_SPREAD_MAX,
                  (ctr[c] / mass - csr[c] / mass) * FLUID.V3_SPREAD_A,
                ),
              );
              if (d > 1e-5) {
                ax += (dx / d) * correction * free;
                ay += (dy / d) * correction * free;
              }
            }
          }

          // curl drift — divergence-free ambient flow (velocity target)
          curl(x, y, t, CURL_OUT);
          const cx = CURL_OUT[0];
          const cy = CURL_OUT[1];
          // a gentle body force along the flow — a current, not a rail (the
          // spring balances it into a slowly-moving equilibrium drift)
          //
          // R6: scaled by this droplet's own restlessness. Before, every droplet
          // took the same share of the same three gyres and differed only in how
          // fast it answered — they differed in RESPONSE, never in INTENT, which
          // is exactly why a free body read as one mass being carried. The skew
          // law puts the median droplet BELOW the old flat 1.0 and spends the
          // range on a short tail, so the body as a whole is calmer than it was
          // and a few droplets are markedly livelier.
          const restless = temperOn ? TMP.restless[i] : 1;
          ax += cx * curlGain * free * 2.2 * restless;
          ay += cy * curlGain * free * 2.2 * restless;

          if (temperOn) {
            // ── the droplet's OWN clock ──────────────────────────────────────
            // Independent of the shared gyres and of every neighbour, so two
            // droplets sitting in the same patch of current still disagree about
            // where they are going. This is the term that keeps a quiet section
            // in motion when nothing else is moving: the gyres are page-wide and
            // slow, and a composition holding its targets still gets nothing out
            // of them. Kept small and slow deliberately — the difference between
            // a body that breathes and a body that vibrates is entirely here.
            // fBm in time, not a sinusoid. A sine retraces its own path
            // exactly, which is the most literal choreography available; three
            // octaves of value noise do not repeat over any duration a visitor
            // will watch, and still read as drift rather than as jitter.
            const wf = TMP.wanderF[i];
            const drift = FLUID.CURL_V * FLUID.TEMPER_DRIFT * free * restless;
            ax += fbm1(t * wf, i * 2) * drift;
            ay += fbm1(t * wf, i * 2 + 1) * drift;

            // ── the orbital tendency ─────────────────────────────────────────
            // A signed tangential force about the droplet's OWN target — not
            // about the cluster, and not about the page. So a droplet does not
            // simply settle onto its station, it circles it, and the direction
            // is its own. Bounded by the offset it is already at, so a droplet
            // sitting exactly on target feels nothing and this can never launch
            // anything: it curves an approach, it does not add energy to a
            // resting body.
            const ox = T[ix] - x;
            const oy = T[ix + 1] - y;
            const spin = TMP.spin[i] * FLUID.TEMPER_SPIN * free;
            ax += -oy * spin;
            ay += ox * spin;
          }

          // The scroll body force. Both terms scale by `free`, so bound liquid
          // — the §3.3 melts, resting footprints, the exact mark — never feels
          // them and the bind contract is untouched. The lean is differential
          // by construction: equilibrium offset is a/ω² and ω comes from each
          // droplet's own TAUP, so heavy droplets sag further than light ones
          // and the body stretches internally instead of translating.
          if (scroll !== 0) {
            ay -= scroll * FLUID.SCROLL_LEAN * free;
            ax += (x - 0.5) * scroll * FLUID.SCROLL_SHEAR * free;
          }

          // ── interaction: the hand and the strike ──────────────────────
          // Both live in the shared helpers, so the spray and the conductor's
          // ambient beads answer the SAME field through probe() instead of a
          // second copy that drifts out of tune. Mass response is applied here
          // rather than inside the helpers because each family carries its own
          // idea of mass — and both terms still scale by `free`, so the bind
          // contract is untouched and bind=1 liquid feels neither.
          A2[0] = 0;
          A2[1] = 0;
          cursorAccel(x, y, env);
          shockAccel(x, y, tSubMs, hash(i, 63), hash(i, 64));
          const resp = massResp(R[i]) * free;
          ax += A2[0] * resp;
          ay += A2[1] * resp;

          // Typography-aware flow is a v3-only review layer. PageStage feeds
          // a small, cached set of field-space rectangles; only free liquid
          // sees them, so form endpoints and the bind=1 bridge remain exact.
          if (obstacleFlow && env.obstacleCount > 0 && env.obstacles) {
            const obstacleCount = Math.min(
              env.obstacleCount,
              FLUID_OBSTACLE_MAX,
            );
            const margin = FLUID.OBSTACLE_MARGIN + R[i] * 0.65;
            for (let oi = 0; oi < obstacleCount; oi++) {
              const off = oi * FLUID_OBSTACLE_STRIDE;
              const ocx = env.obstacles[off];
              const ocy = env.obstacles[off + 1];
              const ohx = env.obstacles[off + 2];
              const ohy = env.obstacles[off + 3];
              const weight = env.obstacles[off + 4];
              if (weight <= 0 || ohx <= 0 || ohy <= 0) continue;

              const dx = x - ocx;
              const dy = y - ocy;
              const qx = Math.abs(dx) - ohx;
              const qy = Math.abs(dy) - ohy;
              let nx = 0;
              let ny = 0;
              let fall = 0;

              if (qx > 0 || qy > 0) {
                const ex = Math.max(qx, 0) * (dx < 0 ? -1 : 1);
                const ey = Math.max(qy, 0) * (dy < 0 ? -1 : 1);
                const d = Math.hypot(ex, ey);
                if (d >= margin || d < 1e-7) continue;
                nx = ex / d;
                ny = ey / d;
                fall = 1 - d / margin;
              } else {
                // Inside a rectangle, leave through the nearest edge. Use the
                // authored target as the deterministic tie-break at center.
                const edgeX = ohx - Math.abs(dx);
                const edgeY = ohy - Math.abs(dy);
                if (edgeX < edgeY)
                  nx = dx === 0 ? (T[ix] < ocx ? -1 : 1) : dx < 0 ? -1 : 1;
                else
                  ny = dy === 0 ? (T[ix + 1] < ocy ? -1 : 1) : dy < 0 ? -1 : 1;
                fall = 1;
              }

              const push = FLUID.OBSTACLE_A * fall * fall * weight * free;
              ax += nx * push;
              ay += ny * push;
            }
          }
        }

        // integrate (semi-implicit)
        V[ix] += ax * H_S;
        V[ix + 1] += ay * H_S;
        // velocity clamp — a flick stirs, never flings
        const sp = Math.hypot(V[ix], V[ix + 1]);
        if (sp > FLUID.V_MAX) {
          const k = FLUID.V_MAX / sp;
          V[ix] *= k;
          V[ix + 1] *= k;
        }
        XP[ix] += V[ix] * H_S;
        XP[ix + 1] += V[ix + 1] * H_S;
      }
    }
    if (steps === maxSteps) acc = 0; // spiral-of-death guard

    // Standard fixed-step render interpolation. This intentionally renders
    // one H_MS slice behind the simulation; the 8 ms latency is imperceptible,
    // while every display cadence receives a continuously moving body.
    const alpha = Math.min(Math.max(acc / FLUID.H_MS, 0), 1);

    // ── output: mix(interpolated physics, legacy); BOTH states follow output
    for (let i = 0; i < POP; i++) {
      const b = clamp01(BIND[i]);
      const ix = i * 2;
      const xPhys = X0[ix] + (XP[ix] - X0[ix]) * alpha;
      const yPhys = X0[ix + 1] + (XP[ix + 1] - X0[ix + 1]) * alpha;
      const ox = xPhys * (1 - b) + XL[ix] * b;
      const oy = yPhys * (1 - b) + XL[ix + 1] * b;
      P[ix] = ox;
      P[ix + 1] = oy;

      // Keep each hidden branch rooted in the droplet that was actually
      // rendered. At bind=0 the legacy shadow is fully hidden, so it inherits
      // P exactly; at bind=1 the physics body does the same. Intermediate bind
      // rebases both in proportion to their hidden share. This prevents a bind
      // rise from revealing a stale XL position (the cross-page teleport) and
      // prevents a bind release from revealing a stale XP position, while the
      // two sacred endpoints remain unchanged: bind=0 is the physics body and
      // bind=1 is the byte-exact legacy low-pass.
      XP[ix] += (ox - XP[ix]) * b;
      XP[ix + 1] += (oy - XP[ix + 1]) * b;
      X0[ix] += (ox - X0[ix]) * b;
      X0[ix + 1] += (oy - X0[ix + 1]) * b;
      XL[ix] += (ox - XL[ix]) * (1 - b);
      XL[ix + 1] += (oy - XL[ix + 1]) * (1 - b);

      // Bound motion carries no free-liquid momentum. Preserve the signed-off
      // damping threshold while the positional handoff above stays continuous
      // for every intermediate bind value.
      if (b > 0.5) {
        V[ix] *= 1 - b * 0.5;
        V[ix + 1] *= 1 - b * 0.5;
      }

      // pinch-off: a straining free droplet sheds spray
      if (
        b <= FLUID.SAT_BIND_MAX &&
        R[i] > 0.006 &&
        tMs - lastSpawn[i] > FLUID.SAT_COOLDOWN
      ) {
        const dx = T[ix] - XP[ix];
        const dy = T[ix + 1] - XP[ix + 1];
        // STRAIN IS MEASURED PAST THE LEASH, not from the station.
        //
        // Pinch-off means "this droplet's target has run away from its body" —
        // a droplet being stretched. Under the old point-spring, distance from
        // target WAS that, because a settled droplet sat on its target. With
        // the leash a free droplet lives 2-4 radii out as a matter of course,
        // which is 0.06-0.13 uv — permanently past SAT_STRAIN. Left uncorrected
        // the field sheds spray continuously from liquid that is merely
        // drifting, and the energy governor never sees the page go idle.
        const sRoam = temperOn
          ? TMP.roam[i] *
            Math.max(
              0.25,
              1 +
                FLUID.EXCURSION *
                  fbm1((tMs / 1000) * FLUID.EXCURSION_RATE, i + 5000),
            )
          : 1;
        const sLeash = LEASH_R * R[i] * (1 - b) * sRoam;
        const sd = Math.sqrt(dx * dx + dy * dy) - sLeash;
        if (sd > FLUID.SAT_STRAIN) {
          if (
            spawnSat(
              XP[ix] + dx * 0.22,
              XP[ix + 1] + dy * 0.22,
              V[ix] * 0.55,
              V[ix + 1] * 0.55,
              R[i] * FLUID.SAT_R,
              tMs,
              0.08,
            )
          )
            lastSpawn[i] = tMs;
        }
      }
    }

    // ── the crown ──────────────────────────────────────────────────────────
    // A strike throws spray from whatever liquid it landed ON. Spray must come
    // from a body of liquid and never from empty space: click on bare page and
    // the wave still travels outward, but nothing is thrown, because there was
    // nothing there to throw. One crown per strike, from the shared pool.
    for (let k = 0; k < SHK; k++) {
      if (!kCrown[k]) continue;
      kCrown[k] = 0;
      const age = tMs - kT0[k];
      if (age < 0 || age >= FLUID.SHOCK_LIFE) continue;
      let thrown = 0;
      for (let i = 0; i < POP && thrown < FLUID.SHOCK_SPRAY; i++) {
        if (BIND[i] > FLUID.SAT_BIND_MAX || R[i] < 0.006) continue;
        const dx = P[i * 2] - kx[k];
        const dy = P[i * 2 + 1] - ky[k];
        const d = Math.hypot(dx, dy);
        if (d > FLUID.SHOCK_CROWN_R || d < 1e-5) continue;
        const nx = dx / d;
        const ny = dy / d;
        // nearer liquid is thrown harder — the blow is centred, not uniform
        const sp =
          FLUID.SHOCK_CROWN_V *
          kAmp[k] *
          (1 - d / FLUID.SHOCK_CROWN_R) *
          (1 - clamp01(BIND[i] / FLUID.SAT_BIND_MAX));
        if (
          spawnSat(
            P[i * 2] + nx * R[i] * 0.8,
            P[i * 2 + 1] + ny * R[i] * 0.8,
            nx * sp + V[i * 2] * 0.3,
            ny * sp + V[i * 2 + 1] * 0.3,
            R[i] * FLUID.SAT_R,
            tMs,
            0.16,
            0.85,
          )
        )
          thrown++;
      }
    }

    // satellites drift ballistically with mild drag
    const dtS = dtMs / 1000;
    for (let s = 0; s < SP; s++) {
      if (sTtl[s] <= 0) continue;
      const age = tMs - sBorn[s];
      if (age >= sTtl[s]) {
        sTtl[s] = 0;
        continue;
      }
      // Spray is liquid too. It used to be the one family that ignored the
      // pointer entirely — beads coasting through a stirred field on their own
      // ballistic rails — and being the lightest thing here it should answer
      // hardest, not least.
      probe(sx[s], sy[s], tMs, env, A2, hash(s, 63), hash(s, 64));
      svx[s] += A2[0] * FLUID.SAT_RESPONSE * dtS;
      svy[s] += A2[1] * FLUID.SAT_RESPONSE * dtS;
      const ss = Math.hypot(svx[s], svy[s]);
      if (ss > FLUID.V_MAX) {
        const kk = FLUID.V_MAX / ss;
        svx[s] *= kk;
        svy[s] *= kk;
      }
      svx[s] *= 1 - 1.4 * dtS;
      svy[s] *= 1 - 1.4 * dtS;
      sx[s] += svx[s] * dtS;
      sy[s] += svy[s] * dtS;
    }
  };

  /** Pack live satellites into the ball buffer; returns the new count. */
  const packSatellites = (buf, count, ballMax, tMs, dBuf) => {
    for (let s = 0; s < SP && count < ballMax; s++) {
      if (sTtl[s] <= 0) continue;
      const p = (tMs - sBorn[s]) / sTtl[s];
      if (p >= 1) continue;
      // Spray SWELLS in and THINS out. The lifetime envelope used to drive the
      // radius, which is precisely how spray became "popping dots": a metaball
      // holds full contrast at every size (peak field is scale-invariant), so a
      // shrinking satellite stayed a hard bead right up to the cull. Driving
      // density instead lets it thin away, and keeps its radius large enough to
      // stay merged with the parent while it is still near it.
      const env = Math.min(p / 0.12, 1) * (1 - p) * (1 - p * 0.3);
      const r = sr0[s] * (0.55 + 0.45 * env);
      const dens = env;
      if (r < 0.0015 || dens < 0.02) continue;
      buf[count * 3] = sx[s];
      buf[count * 3 + 1] = sy[s];
      buf[count * 3 + 2] = r;
      if (dBuf) dBuf[count] = dens;
      count++;
    }
    return count;
  };

  return {
    step,
    packSatellites,
    strike,
    probe,
    shockEnergy,
    formUniforms,
    formDisplace,
  };
}
