/**
 * THE SITE SCENE (R5-A) — the faithful port of makeSiteDriver into the scene
 * contract: Hero → Problem → Ecosystem → Services as ONE scene of the
 * conductor. Internals are the signed-off choreography, verbatim: the hero
 * machine (autocycle §3.3 melts, gooey cursor, keyboard), the pour, the
 * fracture, the travel/converge, the tendrils, the services melts and the
 * exit drain. What moved OUT (now conductor-owned): channel damping (same
 * PHYS taus), per-droplet inertia integration (same TAUP identity), the
 * ambient family packing (the scene contributes its calm multiplier), and
 * scroll-velocity smoothing (ctx.scrollVel). The current Hero owns its ribbon
 * separately; this scene begins its visible work with the pour into Problem.
 *
 * Phase D splits this into finer scenes when the act transitions are
 * redesigned; splitting during the structural port would risk the
 * visual-equivalence gate for zero Phase-A benefit.
 */

import {
  CLOUDS,
  N,
  STAG,
  clamp01,
  smooth01,
  hash,
  PHYS,
  VARY,
  wideScatter,
  clusterTargets,
  ORGANISM_SCALE,
} from "../phys.mjs";
import {
  gatherAnchor,
  gatherTiming,
  gatherDepth,
  gatherRadius,
  gatherOffsetX,
  gatherLeftEdge,
  FIELD_MIN_W,
  recede as gatherRecede,
  arrivalPulse,
  familyOffset,
  fuse as gatherFuse,
  env as gatherEnv,
  NODE_OF,
} from "../gathering.mjs";
import type { ScatterTarget } from "../phys.mjs";
import {
  permFor,
  matchClouds,
  meltDroplet,
  bridgePresence,
  bridgeDensity,
  FORM_SOLIDITY,
  formPresence,
  formPhase,
  morphPhase,
  meltSat,
} from "../field-drivers";
import {
  CONFLUENCE,
  CONFLUENCE_STAG,
  circulate,
} from "../confluence.mjs";
import {
  SDF_WARP_REST,
  SDF_WARP_MORPH,
} from "../sdf-glass-shader.mjs";
import type {
  SceneModule,
  SceneCtx,
  SceneGeom,
  SceneChannels,
  DropletOut,
  FormState,
  LightScore,
} from "./types";
import { HANDOFF, centersMid, coordAt, handoffMix } from "./geom";

// The eco runway progress pr ∈ [0,1] IS the gather clock. One clock, not two:
// the old pair (converge, then grow the circuit on top of it) described a mark
// that assembled and then had a diagram drawn around it. The gathering has no
// second act — capabilities arrive on their own schedules (gathering.mjs owns
// the timing) and the last stretch fuses them, so a single monotonic progress
// drives everything and every frame of it is scrub-safe.
// Within each service gap: a short hold on the pillar, then a LONG morph.
//
// This used to be 0.35 → 0.65, so the whole transformation was crammed into the
// middle 30% of the gap while the liquid sat still for the other 70%. At normal
// scroll speed that is a few hundred milliseconds of change bracketed by long
// stillness, which is why it read as a shape being swapped rather than a shape
// becoming another one — there was no motion to follow, just a before and an
// after. Giving the morph three quarters of the gap makes the transformation
// the thing you are actually scrolling through.
const MELT_LO = 0.12;
const MELT_HI = 0.88;

// THE CROSSING's correspondence. S3 no longer ends on a form, so the melt into
// the first pillar runs from THE CONFLUENCE's own cloud rather than from
// CLOUDS[0] — the same matcher, the same schedule, the same droplet kernel,
// just a source that is a symbol instead of a logo. Memoised at module scope
// because it is a pure function of two fixed clouds and every mount wants it.
let crossPerm: number[] | null = null;
const confluencePerm = () => (crossPerm ??= matchClouds(CONFLUENCE, CLOUDS[1]));

// ── THE SPIN ────────────────────────────────────────────────────────────────
// The resolved body turns, slowly, from the moment it exists until the melt
// takes it into the first service. Counter-clockwise, which is the sense that
// makes its three arms TRAIL: they curl clockwise from core to tip
// (confluence.mjs ARM_SWEEP), so turning the other way reads as a body being
// drawn round rather than as an object being rotated.
//
// One revolution every ~22 s. Slow enough that it never competes with the
// scroll — a reader crossing this passage sees a fraction of a turn — and slow
// enough to stay smooth on the governor's 30 Hz idle floor (0.6 deg/frame).
const SPIN_RATE = 0.046; // revolutions per second
// …and it comes to rest as the morph opens. "Until it morphs" is literal: the
// spin is the resolved body's own life, and the melt is where the body stops
// being itself.
const SPIN_STOP = 0.08; // melt progress over which the turn stops advancing
// …and the turn is fully UNWOUND by here, which is before form B opens at
// 1 - BRIDGE = 0.62. It has to be: the rotation is a transform on the DROPLETS,
// and the pillar's silhouette arrives on its own upright vector with no
// rotation of its own. Unwinding across the whole melt instead leaves the
// droplets up to half a turn out of register with the form the moment it
// emerges — two bodies in the same place disagreeing about which way up they
// are. Finishing first means the form only ever lands on liquid that already
// shares its orientation.
const SPIN_UNWIND = 0.55;
const TAU = Math.PI * 2;

// Surface churn held over each Services pillar. Roughly a melt's worth of warp
// on top of rest, so the material never stops moving while the form holds its
// column — the silhouette stays the exact vector form, only its skin travels.
const SVC_CHURN = (SDF_WARP_MORPH - SDF_WARP_REST) * 0.85;

// ── THE CROSSING (S3 → S4) ───────────────────────────────────────────────────
// Between the fuse closing and the first pillar there is a real gap — measured
// at 1849px to pillar 1's centre at 1440x900 — and the liquid used to spend all
// of it doing NOTHING. `fused` latches at 1, which absorbs every droplet
// (`densJ = 1 - fused`); SVC_CHURN, the one device that keeps a held silhouette
// alive, rides SP, which is 0 for the first 598px; and the traverse is a lerp
// between two constants 0.064 uv apart. One static mark translating 52px.
//
// The transition this wants is NOT invented ornament — a first attempt hung a
// bead chain off the mark and it read as a growth on the logo, because that is
// what an added decoration on a locked silhouette is. It is the melt that was
// already meant to be here: `virtual` below has always existed to give the
// organism → pillar-1 melt a runway, it was just handed 0.85vh and gated behind
// svcPos, so it fired at the END of the gap instead of filling it.
//
// So the crossing IS that melt, given the runway it was always asking for. The
// body settles from the fuse, moves into the Services column, and then spends
// the rest of the gap BECOMING the first service — which is also the argument
// S4 makes in words. Three beats, no new material.
const CROSS_SETTLE = 0.18; // the fuse's recoil owns the opening
// The first excursion is INWARD: ten lobes that have just merged are an
// irregular composite, and surface tension pulls a composite taut before it
// rebounds. Outward-first would read as a pop, which is an effect, not a cause.
const SETTLE_AMP = 0.1; // peak excursion as a fraction of the mark's scale
const SETTLE_DECAY = 3.4; // e-folding of the ring
const SETTLE_CYCLES = 1; // a whole cycle ends on an exact zero — no taper needed
// The traverse is done before the melt starts. A form that holds its place is
// what makes a melt read as a change of SHAPE rather than a thing flying about
// (see THE LOCKED COLUMN below), so the body takes its column first and
// transforms there — the two are never in flight at the same time.
const TRAVERSE_LO = 0.05;
const TRAVERSE_HI = 0.4;
// WHERE THE TRANSFORMATION BEGINS, as a fraction of the crossing: just after
// the traverse has parked the body in its column, so the two never overlap.
const MELT_OPENS_AT = 0.46;
// …and the runway that buys, as a fraction of the crossing rather than in
// viewports. A fixed 1.25vh gave the melt a different SHARE of the gap at every
// viewport, because the gap is not a fixed number of viewports: on a 390x844
// stage the crossing is 3.3vh rather than 2.05vh, so the same 1.25vh opened the
// melt at 0.65 and left a 700px hold in front of it — the exact defect this
// change exists to remove, reintroduced one breakpoint down. Expressed as a
// fraction it opens at MELT_OPENS_AT everywhere by construction.
//
// From cross_open = 1 - (1 - MELT_LO) * K / span, solved for K.
const SVC_RUNWAY = (1 - MELT_OPENS_AT) / (1 - MELT_LO);

// ── THE DEPARTURE (S5 → S6) ──────────────────────────────────────────────────
// The seventh form used to LEAVE THE FRAME: exitDrop translated it 0.79 uv
// downward across ~400px of scroll, so the mark travelled about 710px of screen
// while the page moved 400 — a solid silhouette dragged across MÉTODO'S OWN
// HEADLINE at nearly three times scroll speed, and then gone. Everything about
// that is the opposite of what this material is: it is a translation, the one
// move liquid never makes on its own.
//
// It was there to cover an absence. A Services pillar is carried ENTIRELY by
// the form — the bridge absorbs its droplets (`densJ = serviceDrop[3]`, which
// is 0 on a rest plateau) — and invariant C1 forbids forms from crossfading
// between scenes. So at this one seam the handoff had no material at all: a
// form switching off and, a screen away, an unrelated cloud fading up. The fall
// was motion borrowed to hide that there was nothing to hand over.
//
// The material was always there; it was absorbed. THE RELEASE gives it back:
// the form's presence is handed to the 48 droplets that are already sitting
// inside its silhouette, so the mark BOILS INTO LIQUID where it stands. That
// liquid is then what crosses to Método — and Método's first phase (Diagnosis)
// IS a fragmented cloud, so the arrival needs nothing invented either. The
// finished method dissolves back into the raw material that diagnosis examines.
//
// ── THE BEATS ────────────────────────────────────────────────────────────────
// The departure used to be TWO fractions of one clock laid end to end (release
// 0 → 0.45, crossing 0.45 → 1) and, measured, it did not read as two of
// anything: the seventh form went from solid to gone across 193px of scroll at
// vh = 700, out of the 321px the release was nominally given. Three causes,
// none of them the budget:
//
//   1. THE EASES COMPOUNDED. exit was smoothstepped, divided by EX_RELEASE,
//      smoothstepped again, divided by EX_SURF and smoothstepped a third time.
//      Each pass steepens the middle by 1.5x, so the release moved at 4.34x its
//      own clock where the clock was steepest and barely moved at either end.
//      A budget spent that way is not a passage, it is a cut with a ramp glued
//      to each side of it. Every beat below is ONE smoothstep of the RAW clock
//      over its OWN window — the windows overlap, the eases never nest.
//   2. THE CROSSING STARTED INSIDE THE RELEASE. See the grip in read().
//   3. THERE WAS NO PLATEAU. Silhouette, boil, scattered dots, with nothing
//      between the second and the third: the released liquid never once existed
//      as a body of its own before it was being carried somewhere else.
//
// So the clock is longer (1.32vh against 1.02vh — see HANDOFF) and it carries
// five beats instead of two. Windows are fractions of that raw clock; where two
// overlap, that overlap IS the event named in the third column.
//
//   still     0.00 → 0.05   the seventh form, held, after 0.28vh of rest
//   sweat     0.05 → 0.44   droplets bead out of a silhouette that is still solid
//   swell     0.05 → 0.56   mass gathers, peaks at the give, relaxes as it goes
//   give      0.21 → 0.56   the silhouette erodes — the overlap with sweat is the bulge
//   hold      0.56 → 0.58   free liquid, whole, in its own column, going nowhere
//   crossing  0.58 → 1.00   the weights carry it to Método's column
//
const EX_SWEAT_LO = 0.05;
const EX_SWEAT_HI = 0.44;
// The two halves of the release do NOT share one curve. Locking them as exact
// complements is right about mass and wrong about reading order: the erosion is
// the half that does the visible work, so on a single curve the silhouette was
// already unrecognisable at a third of the way in, while the liquid meant to
// replace it had barely surfaced. A body that is about to come apart BULGES
// first — it sweats, swells and only then gives way. So the droplets lead over
// the sweat and the silhouette yields over the give, the two overlapping
// through the middle. The brief surplus of mass in that overlap is the bulge,
// and it is the whole tell that the liquid coming out is the same body rather
// than a second thing arriving.
const EX_GIVE_LO = 0.21;
const EX_GIVE_HI = 0.56;
// …and where the crossing opens, which is also where the hold ends. Read from
// the shared window so the arrival side cannot drift from it.
const EX_CROSS_LO = HANDOFF.cross;
// The release as ONE envelope, for the things that answer to the whole of it
// rather than to a beat: the atmosphere clearing, the grip loosening, the
// surface boiling and the cadence governor.
const EX_RELEASE = EX_GIVE_HI;
// Per-droplet spread of the sweat, so the body surfaces as a boil rather than
// switching on as one sheet — the same device the melts use for their windows.
// Wider than the 0.42 it inherited because the sweat is now a beat rather than
// a third of one: at 0.55 the first and last droplet break the surface 0.28vh
// of scroll apart, which is a body coming to the boil rather than a texture.
const EX_STAGGER = 0.55;
// THE SWELL's peak excursion, as a signed fraction of the body's own scale —
// the same device THE CROSSING's settle uses one chapter earlier, so the
// departure borrows nothing the page has not already shown. Small on purpose:
// this is a body gathering itself, not a pulse.
const EX_SWELL = 0.055;
// …and the grip has a FLOOR. Free liquid whose target strains more than
// FLUID.SAT_STRAIN (0.085 uv) ahead of its body sheds a satellite — but only
// while bind ≤ FLUID.SAT_BIND_MAX (0.4). Releasing the body to bind 0 and then
// asking it to travel 0.67 uv between the two columns satisfies both clauses on
// every frame of the crossing, so it shed spray continuously up to the whole
// 14-satellite pool: hard beads, radius-clamped too small to neck with
// anything, drifting BALLISTICALLY away from the liquid and across Método's
// headline. They read as glitches because they are causeless — spray is this
// material's answer to a STRIKE (a click crown, a flick), and a scroll-scrubbed
// chapter handoff has nothing striking it. Staying above SAT_BIND_MAX makes
// that impossible by construction rather than by tuning, and 0.55 still leaves
// 45% of the motion to the physics body and 45% of full strength to curl,
// cohesion and repulsion — enough for the boil to be liquid, not enough to
// throw anything off it.
const EX_BIND_FLOOR = 0.55;

export function makeSiteScene(): SceneModule {
  const base = CLOUDS[0];

  // ── aspect-cached targets + services placement ──────────────────────────────
  let cachedAspect = -1;
  let Tclu: ScatterTarget[] = [];
  let Tdis: ScatterTarget[] = [];
  let Teco: ScatterTarget[] = [];
  let svcOx = 0;
  let svcOy = 0;
  let svcScale = ORGANISM_SCALE;
  let ecoOx = 0; // uv x of THE GATHERING's field centre (type owns the column)
  let stageW = 0; // viewport width — decides whether the column exists at all
  let cachedWide = -1;

  // One Services droplet, written in place by the shared melt kernel. Keeping
  // this fixed scratch is both allocation-free and what makes the browser run
  // the exact geometry measured by scripts/melt-mass.mjs.
  const serviceDrop = new Float32Array(4);
  // THE CIRCULATION's scratch: [dx, dy, radius multiplier], written in place by
  // confluence.mjs so target() stays allocation-free like every other scene.
  const circ = new Float32Array(3);
  let circW = 0; // its amplitude this frame — a scene clock, not a droplet one
  // THE SPIN's accumulated angle, and this frame's applied rotation. Kept in
  // (-pi, pi] while it is still turning: rotation is 2*pi-periodic, so wrapping
  // is exact and invisible, and it stops the unwind below from having to spend
  // however many whole turns a reader happened to bank while dwelling here.
  let spinAng = 0;
  let spinCos = 1;
  let spinSin = 0;

  // ── pair melt: snap on pair switch, damp otherwise (self-managed) ───────────
  let lastPair = "0-0";
  let mState = 0;

  /**
   * THE PARCELS — which droplet of the current form's cloud each slot carries.
   *
   * The §3.3 correspondence is defined PER PAIR: slot i runs A[i] → B[perm[i]].
   * So a slot that finishes melt a→b sits at CLOUDS[b][perm_ab[i]], and the next
   * melt b→c then asks that same slot to START at CLOUDS[b][i] — a DIFFERENT
   * droplet of the same cloud. The silhouette is identical either way, which is
   * why this survived so long, but per droplet it is a full teleport: measured
   * over the seven pillar boundaries the relabel displaces a slot by 0.35 cloud
   * uv on average and up to 0.76.
   *
   * It was visible because it lands exactly where the cloud is dying. Presence
   * reaches 0 at both endpoints, but the conductor low-passes density over
   * PHYS.TAU_RADIUS and only culls under 0.004, while a metaball breaks the
   * surface at BALL_CORE² = 0.0324 — so for several frames after every boundary
   * the droplets are still hard-edged beads, and bind = 1 renders the jump as a
   * fast slide instead of absorbing it. Recorded off the live page, the frame
   * after a pillar flip stepped droplets 0.050 uv against the 0.0002 they were
   * doing the frame before: a 250x jump, six frames of it, then all 48 dropped
   * under the iso at once. That is the flash of specks at the end of a morph.
   *
   * Carrying the assignment forward makes the boundary EXACTLY continuous —
   * slot i's new target is the position it already holds. The rendered set of
   * balls is unchanged at every m; this is a relabel, not new geometry.
   */
  const svcIdx = new Uint8Array(N);
  const resetParcels = () => {
    for (let i = 0; i < N; i++) svcIdx[i] = i;
  };
  resetParcels();

  /**
   * Carry the parcel assignment across a pillar boundary. Pairs always chain by
   * one (read() derives both from a single pillar index), so a forward step is
   * (a,b) → (b,c) and a backward one (b,c) → (a,b). Anything else is a scroll
   * that skipped a pillar outright, where no correspondence survives and the
   * canonical labelling is the honest answer.
   */
  const carryParcels = (la: number, lb: number, na: number, nb: number) => {
    if (lb === na) {
      if (la === lb) return; // a degenerate pair carries no melt to speak of
      const p = permFor(la, lb); // forward — the melt that just finished
      for (let i = 0; i < N; i++) svcIdx[i] = p[svcIdx[i]];
    } else if (nb === la) {
      if (na === nb) return;
      const p = permFor(na, nb); // backward — undo the melt we are re-entering
      const inv = new Uint8Array(N);
      for (let j = 0; j < N; j++) inv[p[j]] = j;
      for (let i = 0; i < N; i++) svcIdx[i] = inv[svcIdx[i]];
    } else resetParcels();
  };

  // ── per-frame factors (computed once in tick, read by target/form/extras) ──
  let F = 0; // fracture
  let TR = 0; // travel
  let SP = 0; // services position
  let EXW = 1; // exit: the atmosphere clears (the BODY no longer drains)
  let exRel = 0; // THE RELEASE — form presence handed back to its own liquid
  let exSurf = 0; // …its leading half: the droplets coming out of the body
  let exGive = 0; // …its trailing half: the silhouette letting go
  let exSwell = 0; // THE SWELL — mass gathered before the give (signed scale)
  let jScale = ORGANISM_SCALE;
  let jOx = 0;
  let jOy = 0;
  let inSvcMelt = false;
  let svcBridge = false; // the §3.3 bridge owns the droplets (whole pillar)
  let svcB = 0; // …its destination form (= pa on the degenerate last pillar)
  let svcM = 0; // …and its progress (0 there, so it is that form's rest cloud)
  let pa = 0;
  let pb = 0;
  let pourR = 0;
  let stirY = 0;
  let hp = 0; // damped heroPhase
  let gather = 0; // the S3 clock (0 = dispersed and far, 1 = one near body)
  let fused = 0; // the closing collapse of the three lobes into the mark
  let settle = 0; // THE CROSSING's recoil ring (signed scale fraction)
  let ambW = 1;
  let actW = 1; // governor activity — fast internal motion demands 60 Hz
  const scoreOut: Partial<LightScore> = {
    exposure: 1,
    key: 0,
    vignette: 0,
    mute: 0,
  };
  const formOut: FormState = {
    a: 0,
    b: 0,
    fa: 1,
    fb: 0,
    ea: 0,
    eb: 0,
    ox: 0,
    oy: 0,
    scale: 0.5,
    warp: SDF_WARP_REST,
  };

  return {
    id: "site",
    forms: [0, 1, 2, 3, 4, 5, 6, 7],
    channels: {
      on: 1,
      heroPhase: 0,
      fracture: 0,
      travel: 0,
      gather: 0,
      svcPos: 0,
      cross: 0,
      exit: 0,
      pairA: 0,
      pairB: 0,
      pairM: 0,
      hov: -1, // hovered/focused circuit organ (slot index; -1 = none)
    },
    // raw passthroughs: the pair triple self-manages its snap-or-damp.
    damp: {
      on: false,
      pairA: false,
      pairB: false,
      pairM: false,
      hov: false, // discrete organ index — never damp across slots
    },
    anchors: {
      hero: "#hero",
      runway: "[data-organism]",
      services: "#services",
      // The departure is timed against the chapter it hands TO, not the one it
      // is leaving. Specifically against the element MÉTODO'S OWN entry
      // envelope watches (method scene, rIn), because that — not the chapter
      // box — is where its liquid actually arrives.
      method: "#method .method-journey",
      methodBox: "#method",
    },
    lists: {
      symptoms: "#problem .symptom",
      pillars: "#services .pillar",
    },

    read(g: SceneGeom, out: SceneChannels) {
      const vh = g.vh;
      stageW = g.vw; // read runs before tick; the field split needs real px
      const cy = vh * 0.5;
      const hr = g.rect("hero");
      if (hr) out.heroPhase = clamp01(-hr.top / (hr.height * 0.72));

      // S3 — the fracture, one notch per symptom shard
      const symptoms = g.list("symptoms");
      if (symptoms.length >= 2) {
        const u = coordAt(cy, centersMid(symptoms));
        const kk = Math.floor(u);
        const frac = u - kk;
        const stepped = kk + smooth01((frac - 0.25) / 0.5); // hold on each shard
        out.fracture = clamp01(stepped / (symptoms.length - 1));
      }

      // S3 → S4 travel + the gather runway
      const rw = g.rect("runway");
      if (rw) {
        out.travel = clamp01((vh - rw.top) / (vh * 0.9));
        out.gather = clamp01(-rw.top / Math.max(rw.height - vh, 1));
      }

      // S4 → S5: the organism clears the services HEADLINE (drift + scale
      // start as the section approaches, not when the first pillar arrives)
      const sr = g.rect("services");
      if (sr) {
        out.svcPos = clamp01((vh * 0.92 - sr.top) / (vh * 0.85));
        // (exit is timed against Método's arrival below, not the services box)
        // presence: this scene's grip fades once the services have fully left
        // (long after the exit drain made everything invisible) — the method
        // scene takes the weights from here
        out.on = clamp01((sr.bottom + vh * 0.2) / (vh * 0.8));
      }

      // S4 → S5: the seventh form pours out across MÉTODO'S ARRIVAL. It used
      // to be timed off the services box and finished while that section was
      // still fully on screen, which left a band of scroll — measured at
      // ~420px — where the site scene had drained and Método had not yet
      // taken over: a stage with nothing on it, which is a cut no matter how
      // smoothly each side faded. Timing the departure against the chapter it
      // hands TO makes the two overlap by construction.
      //
      // Método's own rIn opens at its journey top = 1.15vh and completes at
      // 0.80vh. Draining across 1.45vh → 0.90vh puts this scene's departure
      // INSIDE that window, so the two overlap instead of meeting at a point.
      // Timing it off #method's box instead left a screen of intro copy
      // between the two — the ~420px of empty stage the boundary gate found.
      //
      // The span is HANDOFF.span rather than 0.55vh because the departure has
      // five beats to fit (see THE BEATS), not the two it started with: a
      // release long enough to read as a body coming apart rather than a form
      // being switched off, a plateau where that liquid simply exists, and a
      // crossing that is a real 0.59 uv journey between the two columns.
      // 0.55vh gave the whole thing 495px, which is why it could only ever be a
      // cut with a fall drawn over it — and why a first pass at this fix, on
      // 0.78vh, still moved the liquid across the stage at 1.7x scroll speed. A
      // passage the reader outruns is a drag whichever way it points. At 1.32vh
      // the crossing gets 0.554vh for 0.59uv, so it never exceeds 1.25x scroll.
      //
      // Opening at 1.52vh still leaves the seventh form its rest: it is solid
      // from 1.80vh, and the first beat is 0.05 of the clock of nothing at all,
      // so 0.33vh — 230px at vh = 700 — passes with the silhouette dead still
      // before a single droplet beads out of it.
      const mr = g.rect("method") ?? g.rect("methodBox");
      if (mr) {
        out.exit = clamp01((vh * HANDOFF.open - mr.top) / (vh * HANDOFF.span));
        // …and this scene's GRIP is THE CROSSING's, and nothing else's.
        // Presence is what weights this scene's droplet targets against
        // Método's, and that blend is a pure POSITION average — a scene at
        // weight 0.5 pulls the shared droplets halfway to its own targets even
        // when its own density is 0.
        //
        // This used to be a `min` against the #services tail above, and the
        // tail is what actually won: measured, `on` fell LINEARLY from
        // exit = 0.245 — the services box leaving the viewport — reaching 0.61
        // by exit = 0.558, while the authored curve above it was still at 1.0
        // until exit = 0.45. So the crossing began in the middle of the
        // release: the droplets were already being pulled toward Método's wide
        // scatter while the seventh form was still boiling out of its own
        // silhouette, which is why the body never once read as a body. The
        // released liquid had no beat of its own because the handoff had
        // started before it finished arriving.
        //
        // The tail stays as the fallback for a stage with no Método rect to
        // read; where there is one, the exit clock owns the grip outright and
        // the arrival side is its exact complement (see handoffMix).
        out.on = 1 - handoffMix((out.exit - EX_CROSS_LO) / (1 - EX_CROSS_LO));
      }
      const pillars = g.list("pillars");

      // THE CROSSING CLOCK, read before the melt schedule because the melt's
      // own gate now depends on it. 0 where the runway's bottom reaches the
      // fold — which IS where the gather clock reaches 1, so the fuse closes
      // exactly at 0 — and 1 where pillar 1's centre reaches the viewport
      // middle. Both anchors come from the SAME frame's rects, so the span is a
      // layout constant and the progress is a pure function of scroll:
      // scrub-safe and reversible like every other clock here.
      const centers = pillars.length >= 2 ? centersMid(pillars) : null;
      // the crossing's own length, in px of scroll — one measurement, shared by
      // the clock and by the melt runway it has to stay in step with
      let crossSpan = 0;
      if (rw && centers) {
        crossSpan = Math.max(centers[0] - cy - (rw.bottom - vh), 1);
        out.cross = clamp01((vh - rw.bottom) / crossSpan);
      }

      // The melt schedule opens on the CROSSING, not on the services box.
      // svcPos does not reach 0.02 until 598px after the fuse has closed, which
      // is most of the gap spent with the mark switched off — that gate is what
      // deferred the transition to the end of the passage it was meant to be.
      if (centers && (out.svcPos > 0.02 || out.cross > 0.001)) {
        // virtual pre-pillar centre gives the organism → pillar-1 melt a runway
        // …floored at the runway's bottom so the melt can never begin before
        // the gathering it follows has actually finished, at any viewport.
        const virtual = Math.max(
          centers[0] - (crossSpan > 0 ? crossSpan * SVC_RUNWAY : vh * 0.85),
          rw ? rw.bottom : -Infinity,
          // …and, on narrow stages, no earlier than Services itself. Below
          // FIELD_MIN_W the eco-stack is RENDERED (globals.css hides it on that
          // same breakpoint, which is why this reads the same constant rather
          // than inventing a second one), and it is full-width body copy — ten
          // capabilities with their descriptions. A melt running through that
          // puts 48 droplets on type that has to be read, which is the one
          // thing the S3 field/column split exists to prevent. Wide stages give
          // the copy the left column and the form the right, so there the two
          // never meet and the melt is free to run through the outro.
          g.vw < FIELD_MIN_W && sr ? sr.top : -Infinity,
        );
        const uu = coordAt(cy, [virtual, ...centers]) - 1; // ∈ [-1, n-1]
        const idx = Math.floor(uu);
        const frac = uu - idx;
        const m =
          frac <= MELT_LO
            ? 0
            : frac >= MELT_HI
              ? 1
              : (frac - MELT_LO) / (MELT_HI - MELT_LO);
        out.pairA = Math.max(idx + 1, 0);
        out.pairB = Math.min(idx + 2, 7);
        out.pairM = m;
      } else {
        out.pairA = 0;
        out.pairB = 0;
        out.pairM = 0;
      }
    },

    presence(ctx: SceneCtx) {
      return ctx.ch.on;
    },

    tick(ctx: SceneCtx) {
      const aspect = ctx.aspect;
      // The field split is a WIDTH decision (the column is a CSS breakpoint),
      // so the cache key carries it too — an aspect that happens not to move
      // across a resize must not leave the liquid composed for the other one.
      const colWide = stageW >= FIELD_MIN_W ? 1 : 0;
      if (Math.abs(aspect - cachedAspect) > 0.02 || colWide !== cachedWide) {
        cachedAspect = aspect;
        cachedWide = colWide;
        // S3's liquid lives right of the copy column on wide stages
        const sCx =
          0.5 + Math.min(0.14 * aspect, Math.max(aspect / 2 - 0.34, 0));
        // SERVICES: the form is the subject, so it holds the CENTRE of the
        // THE LOCKED COLUMN. The form owns the right half of the stage and
        // holds the viewport's vertical centre for the entire pillar; the copy
        // owns the left half and the two never meet. Centring the form over the
        // whole width — what this did before — put it on top of the instrument
        // band and the headline for the whole of each transition, so every melt
        // played out across type that was trying to be read. A form that never
        // moves also makes the melt legible as a CHANGE OF SHAPE rather than a
        // thing flying about: the only thing in motion is the silhouette.
        //
        // uv x for a page fraction f is 0.5 + (f - 0.5) * aspect, so the centre
        // of the right column (f = 0.75) is an offset of 0.25 * aspect.
        const wide = aspect >= 1.4;
        svcOx = wide ? 0.25 * aspect : 0;
        svcOy = wide ? 0 : 0.24; // narrow stacks: form above the copy
        svcScale = wide ? 0.62 : 0.38;
        Tclu = clusterTargets(aspect, sCx);
        Tdis = wideScatter(aspect, sCx, 0.5, 0.85);
        // THE GATHERING's dispersed field is scattered inside the FIELD, not
        // across the whole stage. A full-bleed scatter put loose liquid behind
        // the chapter's own type for the entire runway, which is the other half
        // of why the names read as dropped on top of something — they were.
        // The tighter spread also makes the constellation a composition rather
        // than confetti: the eye can see three groups in it.
        ecoOx = gatherOffsetX(aspect, stageW);
        Teco = wideScatter(aspect, 0.5 + ecoOx, 0.5, 0.74);
        // …and hold every target inside the field. wideScatter's own clamp is
        // measured from the stage centre, which keeps liquid in FRAME but says
        // nothing about the column, so the scatter's left tail reached under
        // the type. Soft, not hard: the outermost targets compress toward the
        // edge rather than stacking on it, which would read as a wall.
        const edge = gatherLeftEdge(aspect, stageW);
        for (const t of Teco)
          if (t.tx < edge) t.tx = edge - (edge - t.tx) * 0.18;
      }
      const dt = ctx.dt;
      const ch = ctx.ch;
      const k = 1 - Math.exp(-dt / PHYS.TAU_CHANNEL);

      // pair melt: snap on pair switch (rest boundaries render the same exact
      // form on both readings), damp otherwise — self-managed on RAW channels
      pa = ch.pairA | 0;
      pb = ch.pairB | 0;
      const pairKey = pa + "-" + pb;
      const mRaw = clamp01(ch.pairM);
      if (pairKey !== lastPair) {
        const cut = lastPair.indexOf("-");
        carryParcels(+lastPair.slice(0, cut), +lastPair.slice(cut + 1), pa, pb);
        lastPair = pairKey;
        mState = mRaw;
      } else {
        mState += (mRaw - mState) * k;
      }

      hp = clamp01(ch.heroPhase);
      F = smooth01(clamp01(ch.fracture));
      TR = smooth01(clamp01(ch.travel));
      gather = clamp01(ch.gather);
      fused = gatherFuse(gather);
      SP = smooth01(clamp01(ch.svcPos));
      // THE CIRCULATION's amplitude. Alive exactly while the resolved body is
      // the subject: it opens with the fuse and is gone before the crossing
      // melt starts, so the melt's source cloud is the exact station table and
      // both of its endpoints stay exact.
      circW = fused * (1 - smooth01(clamp01(ch.cross / 0.5))) * (1 - SP);
      // THE SPIN advances while the body is the subject, and is brought to rest
      // across the opening of the melt.
      const turning = 1 - smooth01(clamp01(mState / SPIN_STOP));
      spinAng += (dt / 1000) * SPIN_RATE * TAU * fused * turning;
      if (mState < 0.001) spinAng = (((spinAng + Math.PI) % TAU) + TAU) % TAU - Math.PI;
      // THE UNWIND. The melt ends on the pillar's own upright vector, so the
      // residual angle has to go — and it goes by riding the morph's own eased
      // progress, which makes it part of the transformation rather than a
      // second animation played over it. Exact at both ends: the full turn at
      // m = 0 (where the melt's source IS the spinning body) and none at m = 1.
      // …and it is gone for good once the crossing is behind us: every pillar
      // from the first on renders its own upright vector, so the rotation has
      // to be the identity there rather than a frozen residual.
      const spinNow =
        pa === 0
          ? spinAng * (1 - morphPhase(clamp01(mState / SPIN_UNWIND)))
          : 0;
      spinCos = Math.cos(spinNow);
      spinSin = Math.sin(spinNow);
      // BOUNDARY: Services → Método. The seventh form RELEASES ITS MASS where
      // it stands (see THE DEPARTURE). No translation: the body stays in its
      // column and stops being a form, which is the only way a liquid leaves.
      //
      // The earlier note here argued that "draining radius in place left a
      // liquid-dead band" and that falling out of frame fixed it. The premise
      // was right and the remedy was not: the band was dead because the drain
      // took the droplets away too, so nothing was left to hand over. Handing
      // the form's presence TO the droplets fills the same band with the same
      // mass, and the departure then needs no borrowed momentum.
      //
      // ONE EASE PER BEAT, all of them over the RAW clock. `ch.exit` is linear
      // in scroll; every window below smoothsteps it exactly once, so each beat
      // moves at most 1.5x its own clock. The chain this replaces —
      // smooth01(exit) → /EX_RELEASE → smooth01 → /EX_SURF → smooth01 — hit
      // 4.34x, which is the entire reason the transformation arrived in one
      // glance. Same budget, spent evenly.
      const EXC = clamp01(ch.exit);
      exRel = smooth01(EXC / EX_RELEASE);
      exSurf = smooth01((EXC - EX_SWEAT_LO) / (EX_SWEAT_HI - EX_SWEAT_LO));
      exGive = smooth01((EXC - EX_GIVE_LO) / (EX_GIVE_HI - EX_GIVE_LO));
      // THE SWELL — beat two, and the one piece of new choreography here. The
      // note above has always claimed the body "sweats, swells and only then
      // gives way", but the only mechanism for the swell was the surplus mass
      // in the sweat/give overlap, which is a change of DENSITY and reads as
      // texture rather than as a body gathering itself. This is the excursion
      // the sentence describes, on the scale channel the settle already uses:
      // it rises while the droplets bead out, peaks exactly where the erosion
      // opens, and relaxes as the silhouette goes — so it is monotone in each
      // half and never pops back.
      exSwell =
        EX_SWELL *
        smooth01((EXC - EX_SWEAT_LO) / (EX_GIVE_LO - EX_SWEAT_LO)) *
        (1 - exGive);
      // The atmosphere still clears on the way out — a dozen unattached
      // lava-lamp beads drifting through a chapter boundary are the same loose
      // micro-balls the Services composition exists to keep out. (Services
      // already holds ambW at 0 through TRV; this keeps the narrow-stage and
      // early-exit cases honest.)
      EXW = 1 - exRel;
      // ── THE CROSSING ──────────────────────────────────────────────────────
      // Two beats before the melt takes over. Both are 0 at CX = 0 and 0 by the
      // time the melt opens, so the fuse still lands on the exact mark and the
      // §3.3 bridge still starts from the exact pose it always did.
      const CX = clamp01(ch.cross);
      // THE SETTLE — the fuse's recoil. A whole cycle of sine is 0 at u = 0 and
      // exactly 0 at u = 1, so the ring closes without a taper to hide a
      // remainder; the exponential only decides how much survives to the end.
      // Negative: taut first, rebound second.
      const su = clamp01(CX / CROSS_SETTLE);
      settle =
        su >= 1
          ? 0
          : -SETTLE_AMP *
            Math.exp(-SETTLE_DECAY * su) *
            Math.sin(SETTLE_CYCLES * 2 * Math.PI * su);
      // THE TRAVERSE — the body takes its column, and is finished doing so
      // before the melt starts. It used to ride SP, which is only at 0.75 when
      // the melt opens: the mark was still growing while pillar 1 was already
      // melting, two transformations fighting for the same frames. `max` keeps
      // the endpoint identity on any layout where the two clocks order
      // differently (narrow stacks, very tall viewports) or where `cross`
      // cannot be read at all.
      //
      // …on WIDE stages only. Narrow ones are a vertical STACK, not a column
      // beside copy — svcOx is 0 there, so the traverse's whole effect is to
      // lift and shrink the mark early, over an eco-stack that is still being
      // read. The melt already waits for Services on narrow (see `virtual`),
      // and SP tracks Services, so riding SP keeps the body where the chapter's
      // own copy expects it and gives up nothing: there is no column to take.
      const TRV =
        colWide === 1
          ? Math.max(
              SP,
              smooth01(
                clamp01((CX - TRAVERSE_LO) / (TRAVERSE_HI - TRAVERSE_LO)),
              ),
            )
          : SP;
      // …and both scale excursions this scene owns ride the same channel: THE
      // CROSSING's recoil ring on the way in, THE SWELL on the way out. They
      // are one chapter apart and can never overlap, so a single signed sum is
      // exact rather than a convenience.
      jScale =
        (ORGANISM_SCALE + (svcScale - ORGANISM_SCALE) * TRV) *
        (1 + settle + exSwell);
      // The body fuses inside THE GATHERING's field and then travels to the
      // Services column. Both are right of centre, so the handoff is a short
      // move rather than the old jump from dead centre — and at SP = 1 this is
      // still exactly svcOx, so every Services rest and melt is unchanged.
      //
      // Ramped on the GATHER clock, not on travel. Travel completes inside
      // roughly one viewport as the runway's top crosses the fold, so hanging
      // the field offset on it moved the mark's whole footprint across the
      // stage in that short window — the boundary gate reads that as a
      // teleport at the seam, and it is right to: it is a lateral slide with
      // no cause on screen. The runway is three and a half viewports long, so
      // the same move spread over its first third is under the per-frame
      // threshold at every scroll speed, and it lands long before the fuse
      // makes the mark's position matter.
      const ecoIn = smooth01(clamp01(gather / 0.34));
      jOx = ecoOx * ecoIn * (1 - TRV) + svcOx * TRV;
      // The form's own offset, the droplets' home footprint and the §3.3 bridge
      // all read jOy, so the body and its liquid share one position — which is
      // what lets the release surface the droplets exactly inside the
      // silhouette they came out of, with no offset of their own to explain.
      jOy = svcOy * TRV;
      const inServices = pa !== pb || pa > 0;
      // The bridge owns the Services droplets for the WHOLE pillar range, not
      // only while a melt is strictly in flight. Gating it to the open interval
      // handed them back to the gathered target — the mark's own footprint, a
      // form away — on every rest plateau: a second teleport on top of the
      // parcel relabel, landing in the same still-surfacing frames. A
      // degenerate pair (the last pillar) is simply its own rest cloud at m = 0.
      svcBridge = inServices;
      svcB = pa === pb ? pa : pb;
      svcM = pa === pb ? 0 : mState;
      // …while this still means "a melt is MOVING", which is the only thing the
      // cadence governor and the key-light lift should answer to.
      inSvcMelt = pa !== pb && mState > 0.0005 && mState < 0.9995;

      let warp =
        SDF_WARP_REST + Math.min(Math.abs(ctx.scrollVel) * 0.003, 0.004); // scroll agitates

      formOut.ox = jOx;
      formOut.oy = jOy;
      formOut.scale = jScale;
      formOut.meltP = inServices && pa !== pb ? mState : -1;
      // THE INFLATION FIX, and the only place it applies. A morph's 48
      // droplets are a crowd whose pile-up rounds the body; every other liquid
      // on this page is held together BY that same overlap and must not be
      // touched. They never share a frame, and a lone droplet is exact at any
      // ceiling, so this rides the morph's envelope and is identically the
      // historical plain sum everywhere else — including at both endpoints of
      // every morph, so it arrives and leaves with nothing to see.
      formOut.sat = inServices && pa !== pb ? meltSat(mState) : 0;
      if (inServices) {
          formOut.a = pa;
          formOut.b = pb;
          if (pa === 0) {
            // THE CROSSING — S3 hands over to the first pillar.
            //
            // There is no form A. The old crossing was a MORPH: the mark's SDF
            // deformed into the web form's through their correspondence field,
            // with `fa` carrying the whole body. THE CONFLUENCE has no vector
            // behind it, so form A's weight is 0 — which also means `morph`
            // must be off, since the morph branch multiplies its single term by
            // iFormA and would render nothing at all.
            //
            // What lands the pillar instead is the site's OTHER law for a form
            // arriving, the one the fuse and the exit drain already speak:
            // EROSION does the visible work, so the web silhouette grows out of
            // its own skeleton to the exact vector while the droplets that
            // carried it across drain away underneath (formPhase / densJ, one
            // clock, exact complements).
            // THE PAIR IS THE LEGACY ONE, UNCHANGED. formPhase lands form B
            // and bridgePresence drains the cloud, both on the same `m` — the
            // two were measured against each other (melt.mjs: "the cloud takes
            // over as the form gives up… measured against the render") and they
            // only hold as a pair. The crossing's one difference is that its
            // first half has ALREADY HAPPENED: S3's fuse spent three viewports
            // dissolving a dispersed field into this body, so the droplet
            // presence is HELD at full through the front half instead of rising
            // from zero, and the back half runs the measured drain verbatim.
            //
            // Every other pairing was built and measured (scripts/
            // verify-confluence.mjs, THE MASS BUDGET). Draining on the mapped
            // half against a form on `m` empties the stage to 23% at m = 0.67;
            // draining on the form's WEIGHT empties it to 11% at 0.79, because
            // formPresence saturates weight at q = 0.4 while EROSION goes on
            // eating the silhouette to q = 1 — the area is not the weight, which
            // is the whole reason bridgePresence is a measured table and not a
            // curve. This pair holds 91% / 119%.
            const { wB, eB } = formPhase(mState);
            formOut.a = 0;
            formOut.b = pb;
            formOut.fa = 0;
            formOut.fb = wB;
            formOut.ea = 0;
            formOut.eb = eB;
            warp +=
              (SDF_WARP_MORPH - SDF_WARP_REST) * Math.sin(Math.PI * mState);
          } else if (pa === pb) {
            // degenerate pair (last pillar) — a solid rest, never a weight dip
            formOut.fa = 1;
            formOut.fb = 0;
            formOut.ea = 0;
            formOut.eb = 0;
          } else {
            // THE §3.3 HANDOFF, which is the same law the crossing above runs:
            // form A erodes away while the 48-droplet cloud condenses on its
            // footprint, travels, and fuses into form B as its weight rises.
            // formPhase and bridgePresence are exact complements measured
            // against each other, so the total on screen never steps.
            const ph = formPhase(mState);
            formOut.fa = ph.wA;
            formOut.fb = ph.wB;
            formOut.ea = ph.eA;
            formOut.eb = ph.eB;
            warp +=
              (SDF_WARP_MORPH - SDF_WARP_REST) * Math.sin(Math.PI * mState);
          }
        } else {
          // NO FORM AT ALL, for the whole of the Problem and the Ecosystem.
          //
          // This used to open form 0 on `fused` — the Zirtuno mark rasterised
          // to an SDF, faded up over the liquid that had just spent three
          // viewports converging, with that liquid deleted underneath it. The
          // chapter's claim is that the fragments stop being separate; the
          // resolution is now the fragments themselves, standing on THE
          // CONFLUENCE's stations (see target()), so there is no vector on this
          // stage until the first service pillar erodes in at the crossing.
          //
          // `a` stays 0 because the stage gates its whole frame on form A's
          // texture being built (components/field/FieldStage) — an index that
          // is always loaded, at weight zero, costs nothing and keeps that gate
          // honest.
          formOut.a = 0;
          formOut.b = 0;
          formOut.fa = 0;
          formOut.fb = 0;
          formOut.ea = 0;
          formOut.eb = 0;
        }
        // THE BREATH. A form that holds its position has to stay visibly ALIVE
        // or it reads as a placed image being scrolled past. Surface motion
        // only — the silhouette is still the exact vector form, it is just
        // never still.
        //
        // This used to ride SP alone, which meant it covered the seven pillars
        // and nothing else. The one passage where the mark holds LONGEST is the
        // crossing, and SP is 0 for the first half of it: the gathered mark sat
        // at exactly SDF_WARP_REST for 598px, which is the frozen-logo half of
        // the reported fault. `fused` opens it at the moment the mark exists,
        // and it is still 0 for the whole gathering (where the liquid, not the
        // form, is the subject) and through the exit.
        const alive = Math.max(SP, fused * smooth01(clamp01(ch.cross / 0.08)));
        warp += SVC_CHURN * alive * (0.72 + 0.28 * Math.sin(ctx.t * 0.53));
        // THE RELEASE, form side — the exact complement of what the droplets
        // gain in target(). Routed through formPresence rather than a linear
        // fade because that is the site's one law for a form leaving: EROSION
        // does the visible work, so the boundary retreats continuously and the
        // thin features (the flare, the tendrils) go first while the trunk is
        // still solid. The weight only clears the residual field tail at the
        // very end, where the silhouette has already eaten itself away. A
        // linear fade on weight is a form going transparent, which is the one
        // thing this material is not allowed to do.
        const [exW, exEro] = formPresence(1 - exGive);
        formOut.fa *= exW;
        formOut.fb *= exW;
        formOut.ea += exEro;
        formOut.eb += exEro;
        // …and it boils while it goes. The surface churn that keeps a held
        // pillar alive is pushed to a full melt's worth of warp exactly where
        // the silhouette is coming apart, so the erosion reads as the body
        // giving way rather than as a mask closing over a still shape.
        warp += (SDF_WARP_MORPH - SDF_WARP_REST) * Math.sin(Math.PI * exRel);
      formOut.warp = warp;

      // ── per-droplet shared factors ──────────────────────────────────────────
      // NO BRIDGE CLOUD. The form now carries the whole transformation, so the
      // 48 droplets would be a second full body summed on top of the first —
      // measured at 171% area and circ 0.278 even at a quarter density, worse
      // than the bridge they replaced (scripts/melt-shape.mjs, flow+g). The
      // liquid vocabulary through a melt is carried instead by the surface
      // warp above, the gooey cursor and the ambient family, none of which the
      // old melt could show because there was no form for them to act on.
      // The page field remains invisible through the Hero and grows into the
      // Problem choreography only as the Hero is leaving.
      pourR = smooth01((hp - 0.72) / 0.26);
      // loose liquid drags with the scroll (bounded — a flick stirs, never flings)
      stirY = Math.max(-2.2, Math.min(2.2, ctx.scrollVel)) * PHYS.STIR;

      // ambient calm — always alive, calmer where a composition must read
      // The Hero belongs to the lab ribbon. The shared ambient family used to
      // hold weight 1 at the top of the page, so lava-lamp droplets drifted
      // across the headline — the one thing separating the shipped Hero from
      // the lab. It fades in with the pour instead.
      // Services gets NO atmosphere. Each pillar is one form alone in its
      // column with the copy beside it, and a dozen unattached lava-lamp beads
      // drifting through that composition are exactly the loose micro-balls the
      // melts get blamed for — they cross the headline and the instrument band
      // with no relationship to the form at all. The gathering keeps its
      // atmosphere, because there the scattered liquid IS the subject.
      // …and it clears on the TRAVERSE, not on SP. The crossing melt now runs
      // where SP is only ~0.26, so on the old gate a dozen unattached
      // lava-lamp beads drifted through the first and longest melt on the page
      // — the exact loose micro-balls the rule above exists to keep out of a
      // Services composition. The traverse is finished before the melt opens,
      // so the stage is clear of atmosphere by the time it does.
      ambW =
        (1 - 0.5 * smooth01(gather) * (1 - TRV)) *
        (1 - TRV) *
        EXW *
        smooth01((hp - 0.66) / 0.3);

      // governor activity (R5-C): the services melt is the scene's FAST clock;
      // everything else is
      // scroll-scrubbed (the conductor's velocity term covers it) or slow
      // enough (wander, tendril march, warp) for the 30 Hz idle floor.
      //
      // THE RELEASE joins them, and it has to. The old exit qualified for the
      // idle floor honestly: its droplets were absorbed and its form rode a
      // scroll-derived offset, so a stopped reader saw a still frame. The
      // release hands 48 droplets from bind 1 to bind 0 — repulsion, cohesion
      // and curl take the body over and physically rearrange it — and that is
      // live motion on the wall clock, not on the scrollbar. At 30 Hz it
      // stutters exactly where the material is meant to look most alive.
      // Only the release: once it is done the liquid is loose and drifting,
      // which is the same slow ambient Método's own cloud already runs at.
      // …and it runs from the first bead through THE HOLD, not just through the
      // release. The hold is free liquid rearranging on the WALL clock with the
      // scroll stopped — the one beat where a stopped reader is meant to see
      // the body still moving — so gating it on exRel alone (which saturates at
      // the give's close) dropped exactly that beat to the 30 Hz idle floor.
      // The crossing beyond it is scroll-scrubbed like every other travel.
      const exBoil = EXC > 0.004 && EXC < EX_CROSS_LO + 0.1 ? 1 : 0;
      // …and THE SPIN joins them, for the same reason the release did: the
      // governor's rule is that a TRULY IDLE liquid may draw every other frame,
      // and a body turning on the wall clock with the scroll stopped is not
      // idle. Left off this list the resolved confluence is the one thing on
      // the page that moves while the governor believes nothing does.
      actW = Math.max(
        inSvcMelt ? 1 : 0,
        exBoil,
        fused * (1 - SP),
      );

      // ── act II light (R5-D): the argument told in exposure ────────────────
      // The fracture pulls the light DOWN (the problem darkens the room) and
      // the travel gives it back; convergence is the first light-rise — the
      // reunified mark earns a key lift the dispersed field never had. Both
      // are IN-the-liquid grades (iExpo/iKey); copy is never dimmed here —
      // the DOM only feels the vignette breathing closed through Problem.
      const dip = F * (1 - TR);
      // The light rise IS the fuse — the reunified mark earns a key lift the
      // dispersed field never had. This read `ctx.ch.converge`, a channel that
      // no longer exists after the gather rename; the undefined propagated to
      // NaN exposure and multiplied the whole fragment to nothing, so the
      // liquid rendered as pure black across the entire chapter.
      const rise = fused * (1 - SP);
      scoreOut.exposure = 1 - 0.16 * dip + 0.06 * rise;
      scoreOut.key =
        0.3 * rise + (inSvcMelt ? 0.12 * Math.sin(Math.PI * mState) : 0);
      scoreOut.vignette = 0.22 * dip;
      // Problem's fractured liquid loses some of its brand energy, then
      // regains cyan through the seek. Keep enough chroma for continuity.
      scoreOut.mute = 0.28 * dip;
    },

    target(i: number, ctx: SceneCtx, out: DropletOut) {
      const t = ctx.t;
      const aspect = ctx.aspect;
      const bb = base[i];
      // hero-side target
      let hx: number;
      let hy: number;
      let hr: number;
      // presence (field density) rather than size — see BRIDGE_PRESENCE_FLOOR
      const hd = 1;
      // The hero's droplets are the POUR and nothing else now. They used to be
      // retargeted onto the melt bridge for the length of every autocycle
      // morph; the morph is the form's own deformation, so they stay on their
      // base footprint and the melt has no droplet body at all.
      hx = bb[0];
      hy = bb[1];
      hr = bb[2] * pourR * (0.55 + 0.45 * VARY[i]);
      // stage into field space at the fixed scale used since the Hero stopped
      // owning a form stage.
      hx = 0.5 + (hx - 0.5) * 0.5;
      hy = 0.5 + (hy - 0.5) * 0.5;
      hr *= 0.5;

      // ── journey-side target: fracture → dispersed → THE GATHERING ───────────
      //
      // The dispersed field is not a waypoint on the way to the mark any more:
      // it is the STATE the chapter begins in, and every droplet leaves it on
      // its own capability's schedule. Nothing "converges" as a block.
      let bindJ = 0; // journey-side bind (exactness of the current regime)
      let clusJ = -1; // cohesion group
      let densJ = 1; // journey-side field presence (1 = solid liquid)
      const clu = Tclu[i],
        dis = Tdis[i],
        eco = Teco[i];
      let tx = clu.tx + (dis.tx - clu.tx) * F;
      let ty = clu.ty + (dis.ty - clu.ty) * F;
      // BOUNDARY: Problem → Ecosystem. Only a PARTIAL re-centring. Carrying the
      // whole field from the Problem's off-centre scatter to a centred one made
      // the liquid slide sideways as a block before the chapter began — a move
      // with no cause, which reads as a scene change. The fracture's dispersed
      // field IS the gathering's starting state; travel only eases it into the
      // runway's frame, and each capability makes the rest of the journey
      // itself, on its own schedule, as part of arriving.
      // …and then the GATHER clock finishes it. 0.42 alone was right when the
      // eco scatter was centred on the stage: the destination was barely a move,
      // so a partial one was enough. Now the field is a real place — it is the
      // half of the stage the type does not own — and stopping at 42% of the way
      // there left loose liquid drifting across the column for the whole
      // chapter, which is the same "type with blobs on it" the composition
      // exists to end. The connective liquid is being drawn in too; letting the
      // clock carry it home is both the fix and the more honest physics.
      const ecoPull = Math.max(TR * 0.42, smooth01((gather - 0.04) / 0.5));
      tx += (eco.tx - tx) * ecoPull;
      ty += (eco.ty - ty) * ecoPull;

      // THE CONFLUENCE's own station — where this droplet ends up once fused.
      //
      // This used to be the mark's footprint, `bb`, which is CLOUDS[0]: the
      // gathering's ten families converged onto the Zirtuno logo's own metaball
      // decomposition, were then absorbed (`densJ = 1 - fused`), and the SDF of
      // the logo was drawn in their place. The chapter's argument is that these
      // fragments STOP BEING SEPARATE, and a vector mark faded up over the
      // liquid that had just done the work is the one thing on the page that
      // contradicts it.
      //
      // So the destination is a symbol the droplets ARE: three arms running in
      // from the three systems' own bearings, merged into one core
      // (confluence.mjs). Droplet i's seat is fixed and addressable, which is
      // what lets a capability arrive at ITS OWN place on ITS OWN system's arm
      // rather than anywhere in a cloud — the fuse is legible for the first
      // time, because you can see which mass went where.
      const st = CONFLUENCE[i];
      // …and the resolved body BREATHES, on its own clock. A form that holds
      // still reads as an image being scrolled past; SVC_CHURN answers that for
      // the pillars by warping the FORM sample, and this symbol has no form, so
      // it takes the droplet-side equivalent: a slow wave running down each arm
      // into the core. Faded in by the fuse and out again by the crossing melt,
      // so both endpoints are the exact station table.
      if (circW > 0.002) circulate(circ, i, t, circW);
      else {
        circ[0] = 0;
        circ[1] = 0;
        circ[2] = 1;
      }
      // …and THE SPIN turns the whole station table about the body's own centre
      // before it is staged. A rotation of the cloud, not of the canvas: every
      // droplet keeps its identity, its radius and its capability, so the rack
      // focus, the melt correspondence and the fuse all go on addressing the
      // same seats.
      const sx = st[0] + circ[0] - 0.5;
      const sy = st[1] + circ[1] - 0.5;
      const mx = 0.5 + jOx + (sx * spinCos - sy * spinSin) * jScale;
      const my = 0.5 + jOy + (sx * spinSin + sy * spinCos) * jScale;

      const node = NODE_OF(i);
      let e = 0; // this droplet's arrival (0 = still out in the dark)
      let depth = 1; // 1 = far, 0 = near
      let gx = mx;
      let gy = my;
      let gr = st[2] * circ[2] * jScale;

      if (node >= 0) {
        // one of the ten capabilities: it has a lobe to arrive at, a depth to
        // come forward through, and two family members it holds on to
        const fam = familyOffset(i);
        const tm = gatherTiming(node);
        // family members lead each other slightly, so a capability arrives as a
        // small stream rather than three dots moving in lockstep
        e = gatherEnv(gather, { d: tm.d + fam.lead * 0.03, w: tm.w });
        depth = gatherDepth(node, gather);
        const pulse = arrivalPulse(node, gather);
        const anchor = gatherAnchor(node, aspect, stageW);
        const ax = anchor.x + fam.x;
        const ay = anchor.y + fam.y;
        // arrive at the lobe, then be drawn into the body by the fuse
        gx = ax + (mx - ax) * fused;
        gy = ay + (my - ay) * fused;
        gr = gatherRadius(i, depth, pulse);
        // Gathered mass keeps its cluster id so cohesion holds each capability
        // together in flight — this is what makes ten families read as ten
        // BODIES crossing the dark rather than thirty independent beads.
        if (e > 0.12 && fused < 0.6) clusJ = node % 16;
      } else {
        // the connective liquid: no lobe of its own, it simply comes forward
        // and becomes the body the capabilities arrive into
        e = gatherEnv(gather, { d: 0.5 + 0.22 * hash(i, 71), w: 0.3 });
        depth = 1 - e;
        gr = st[2] * circ[2] * jScale * (0.5 + 0.5 * e);
      }

      // Where the droplet actually is: out in the dispersed dark, or gathered.
      // The blend IS the travel — there is no separate "converge" transform.
      let jx = tx + (gx - tx) * e;
      let jy = ty + (gy - ty) * e;
      // THE RECEDE. The un-gathered half of this blend used to hold the mark's
      // own footprint radius, which is a constant: a droplet that had not been
      // called yet was the same size and the same brightness at the start of
      // the runway as it was two viewports later. That is why the middle of the
      // chapter had no motion in it to follow — the only thing the clock
      // actually changed was position, and a scatter shuffling inside its own
      // bounds does not read as change. Falling back into the dark first gives
      // the arrival something to arrive FROM.
      const rec = gatherRecede(TR);
      let jr = st[2] * jScale * VARY[i] * rec * (1 - e) + gr * e;
      // …and the same for light: depth is the chapter's argument, so unarrived
      // liquid has to actually be far, not merely elsewhere.
      depth = Math.min(1, depth + (1 - rec) * (1 - e));
      // NO HANDOFF. This is the passage that used to delete the liquid:
      //
      //     jr *= 1 - 0.35 * fused;
      //     densJ = 1 - fused;
      //
      // …because the droplets that carried the gathering would otherwise pile
      // onto the mark's footprint and inflate its silhouette into a blob. That
      // was the correct fix for a resolution made of vector geometry, and it is
      // exactly what has to go now that the resolution is made of the droplets
      // themselves. There is nothing underneath them to protect: THE CONFLUENCE
      // is 48 stations and this is the liquid standing on them, so it keeps
      // full density and its authored radius all the way through the fuse.
      //
      // The Services pillars are unaffected — the §3.3 branch below still takes
      // these droplets over for the whole pillar range and still absorbs them
      // under each form, which is where a silhouette IS the subject.

      // loose liquid drags with the scroll; gathered liquid has been claimed
      jy += stirY * (1 - e);
      // The fluid core owns free-liquid micro-motion. Preserve the authored
      // drift only for the exact ?fphys=0 rollback, where no curl field exists.
      if (!ctx.physics) {
        const drift = PHYS.DRIFT * (1 - e);
        jx += drift * Math.sin(t * dis.f1 + i * 1.7);
        jy += drift * Math.cos(t * dis.f2 + i * 2.3);
      }
      // Free while crossing, exact once fused under the mark. The middle is
      // deliberately loose: that is where the merging is visible.
      //
      // THE CLAIM is the third term. At bind ≈ 0 a droplet barely tracks its
      // authored target at all — it is advected by curl, repulsion and
      // cohesion — so "the scatter lives in the field" was true of the targets
      // and not of the liquid: droplets drifted out of the field and settled
      // on the column, which the obstacle could only partly push back.
      //
      // This is not a bind bypass dressed up as composition. The chapter's
      // claim is that this liquid is being CLAIMED — drawn out of a dispersed
      // state into one body — so the degree to which the authored composition
      // governs it should rise with the gather clock by construction. It is
      // still a minority term: the field goes on merging, drifting and
      // answering the cursor, it simply stops wandering out of frame. Zero at
      // the fracture (The Problem is untouched) and superseded by `fused`.
      const claimed = 0.3 * smooth01(gather) * (1 - SP);
      bindJ = Math.max(e * 0.35, fused, claimed);
      if (fused > 0.7) clusJ = -1;
      // the fracture's unstable chunks still cohere before the gathering starts
      if (TR < 0.6 && F < 0.85 && e < 0.1)
        clusJ = Math.min((hash(i, 11) * 4) | 0, 3);
      if (svcBridge) {
        // the §3.3 services bridge is the journey target across the pillar
        //
        // …and on the FIRST pillar the source is THE CONFLUENCE, not CLOUDS[0].
        // The crossing out of S3 used to be a form morph — the mark's SDF
        // deformed into the web form's through their correspondence field — and
        // there is no mark any more. What there is instead is a body already
        // made of these 48 droplets, so the crossing is the melt this file
        // already speaks: the same matcher, the same per-droplet schedule, the
        // same kernel, run from a symbol instead of from a logo. Form A's
        // solidity is 0 because there is no form A to stand in for; the body
        // becomes the first service by TRAVELLING, and the service's silhouette
        // erodes in underneath it (see the form staging above).
        const crossing = pa === 0;
        const A = crossing ? CONFLUENCE : CLOUDS[pa],
          B = CLOUDS[svcB];
        const pm = crossing ? confluencePerm() : permFor(pa, svcB),
          stg = crossing ? CONFLUENCE_STAG : STAG[pa];
        meltDroplet(
          serviceDrop,
          svcIdx[i], // the parcel this slot carries — see svcIdx
          A,
          B,
          pm,
          stg,
          svcM,
          crossing ? 0 : FORM_SOLIDITY[pa],
          FORM_SOLIDITY[svcB],
        );
        // The crossing carries THE SPIN with it, unwinding (see spinNow). The
        // rotation is applied to the melt's OUTPUT rather than to its source,
        // which is what keeps both endpoints exact — at m = 0 this is the
        // spinning body's own pose, at m = 1 it is the pillar's upright rest —
        // and leaves the correspondence, the schedule and the swirl untouched.
        // Every other pillar has spinCos = 1 by construction.
        const bx = serviceDrop[0] - 0.5;
        const by = serviceDrop[1] - 0.5;
        jx = 0.5 + jOx + (bx * spinCos - by * spinSin) * jScale;
        jy = 0.5 + jOy + (bx * spinSin + by * spinCos) * jScale;
        // RADIUS IS NEVER SCALED HERE. The whole handoff is carried by presence
        // (which is the form's exact complement), so the cloud keeps the size
        // that makes it the same body as the form — and keeps its droplets in
        // contact with each other, since they only neck while their gap is
        // under 0.83 x radius. Shrinking radius on the way in and out is what
        // used to shed the loose beads at both ends of every melt.
        // The shared kernel also owns the measured per-form solidity and the
        // density schedule, so live Services and the off-GPU gate cannot drift.
        const bridgeR = serviceDrop[2] * jScale;
        // The radius seam exists ONCE — where the gathered body hands its
        // droplets to the first pillar melt. From pillar 1 on the bridge already
        // owns them, so re-opening this blend at every boundary would step the
        // radius back to the gathered one for exactly the frames the density
        // tail is still above the iso.
        const handoff = pa === 0 ? smooth01(clamp01(svcM / 0.14)) : 1;
        jr = jr * (1 - handoff) + bridgeR * handoff;
        // PRESENCE IS THE FORM'S COMPLEMENT — the cloud is exactly as present
        // as the form is absent, so the total on screen never changes. It opens
        // at 0 where the gathered droplets arrive absorbed at 0, so the seam
        // needs no blend of its own.
        densJ = serviceDrop[3];
        // …EXCEPT ACROSS THE CROSSING, where the droplets ARE the body. On
        // every other pillar boundary a form holds full presence for the whole
        // transformation and any density here is a second body summed onto it.
        // On the first there is no form until the web silhouette erodes in, so
        // zero density would blank the stage for two thirds of the passage.
        //
        // The law is not invented for this: it is bridgePresence — the schedule
        // melt-mass.mjs MEASURED for a cloud handing over to a landing form —
        // read on its second half, so it starts at 1 (the confluence, standing
        // alone) and reaches 0 exactly as pillar 1 becomes solid. formPhase
        // drives the form side from the same clock, so the two are complements
        // by construction rather than by tuning.
        if (crossing)
          densJ =
            svcM <= 0.5 ? 1 : bridgeDensity(bridgePresence(svcM));
        // …and THE RELEASE is that same complement, run one last time with no
        // form on the other side of it. On the seventh pillar svcM is 0, so the
        // bridge holds these droplets at the form's exact rest footprint with
        // density 0 — the body's own liquid, present and invisible. Lifting
        // density is therefore not a reveal of something new; it is the same
        // mass changing which of its two representations carries it.
        //
        // Staggered per droplet so the silhouette comes apart as a boil rather
        // than a sheet switching on: each one surfaces on its own window, the
        // device every melt in this file already uses for its schedules.
        if (exSurf > 0)
          densJ = Math.max(
            densJ,
            smooth01(
              clamp01((exSurf - EX_STAGGER * hash(i, 23)) / (1 - EX_STAGGER)),
            ),
          );
        // The grip goes with it, ALL of it. The bridge is analytic-exact while
        // the form owns the body, but a released body is FREE liquid, and the
        // difference is the whole difference between flowing and sliding: at
        // bind 1 the droplets track the blended target exactly, so a crossing
        // between two columns is 48 dots being carried across in formation —
        // the same translation the fall was, turned on its side. At bind 0 the
        // core still goal-seeks, but through a damped spring with curl,
        // cohesion and repulsion on top, and PINCH-OFF live: a free droplet
        // whose target strains ahead of its body sheds a satellite, which is
        // this material's own way of stretching. Método's state 0 is free
        // liquid too, so the two scenes agree about the physics as well as the
        // position and nothing has to be reconciled at the seam — both of them
        // now hold the same floor while the handoff is in flight.
        bindJ = 1 - (1 - EX_BIND_FLOOR) * exRel;
        clusJ = -1;
        depth = 0; // the services body is the near plane, always
      } else if (node >= 0) {
        // THE RACK FOCUS. Touching a capability does not just swell its own
        // mass — it changes which plane the field is focused on. The touched
        // family comes to the front and everything else falls back, the way a
        // lens answers, so the response reads as the composition attending to
        // one thing rather than as a bead getting bigger.
        const hov = ctx.ch.hov ?? -1;
        if (hov >= 0 && e > 0.05 && fused < 0.98) {
          const w = (1 - 0.35 * fused) * e;
          if (hov === node) {
            jr *= 1 + 0.5 * w;
            depth *= 1 - 0.75 * w;
          } else {
            // the rest of the body steps back — never out of sight, just off
            // the plane the reader is being pointed at
            jr *= 1 - 0.14 * w;
            depth = Math.min(1, depth + 0.42 * w);
          }
        }
      }

      // the pour: hero side ⟶ journey side, each droplet on its own schedule
      const li = smooth01((hp - 0.08 - 0.42 * hash(i, 15)) / 0.44);
      out.x = hx + (jx - hx) * li;
      out.y = hy + (jy - hy) * li;
      out.r = hr + (jr - hr) * li;
      // THE EXIT dissolves, it does not shrink — and it no longer drains at
      // all. EXW used to scale this toward zero on the way into Método, which
      // took the departing body off the stage before Método had one; the seam
      // that remained was covered by the fall. The release carries it now
      // (densJ above), so the mass simply stays, changes hands and travels.
      out.d = hd + (densJ - hd) * li;
      // physics attributes (R5-B): the hero side is analytic-exact (rest
      // footprint / §3.3 bridge); looseness grows through the pour and lands
      // at the journey regime's own exactness
      out.bind = 1 - li * (1 - bindJ);
      out.cluster = li > 0.6 ? clusJ : -1;
      // DEPTH is the chapter's argument (R5-C's iBallZ + the absorption grade
      // do the rest): scattered tools are far and half-lit, an ecosystem is
      // near and bright. The hero side is always the near plane, so the pour
      // carries each droplet OUT into the dark before the gathering earns it
      // back — the loss is what makes the recovery mean anything.
      out.z = li * depth * (1 - SP);
    },

    form() {
      return formOut;
    },

    ambient() {
      return ambW;
    },

    activity() {
      return actW;
    },

    score() {
      return scoreOut;
    },

  };
}
