/**
 * THE SITE SCENE (R5-A) — the faithful port of makeSiteDriver into the scene
 * contract: Hero → Problem → Ecosystem → Services as ONE scene of the
 * conductor. Internals are the signed-off choreography, verbatim: the hero
 * machine (autocycle §3.3 melts, gooey cursor, keyboard), the pour, the
 * fracture, the travel/converge, the tendrils, the services melts and the
 * exit drain. What moved OUT (now conductor-owned): channel damping (same
 * PHYS taus), per-droplet inertia integration (same TAUP identity), the
 * ambient family packing (the scene contributes its calm multiplier), and
 * scroll-velocity smoothing (ctx.scrollVel).
 *
 * Phase D splits this into finer scenes when the act transitions are
 * redesigned; splitting during the structural port would risk the
 * visual-equivalence gate for zero Phase-A benefit.
 */

import {
  CLOUDS,
  N,
  STATE_COUNT,
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
  meltDroplet,
  packBridge,
  FORM_SOLIDITY,
  formPresence,
  formPhase,
  type SiteCallbacks,
} from "../field-drivers";
import {
  SDF_WARP_REST,
  SDF_WARP_MORPH,
  SDF_MELT_ERODE,
  CURSOR_R,
  CURSOR_TRAIL_N,
  CURSOR_SMOOTH,
  CURSOR_INFLUENCE_MARK,
} from "../sdf-glass-shader.mjs";
import { DURATIONS } from "../../animation/durations";
import type {
  SceneModule,
  SceneCtx,
  SceneGeom,
  SceneChannels,
  DropletOut,
  FormState,
  LightScore,
} from "./types";
import { centersMid, coordAt } from "./geom";

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

const HERO_DROPS = 1 + CURSOR_TRAIL_N; // gooey cursor chain length

// Surface churn held over each Services pillar. Roughly a melt's worth of warp
// on top of rest, so the material never stops moving while the form holds its
// column — the silhouette stays the exact vector form, only its skin travels.
const SVC_CHURN = (SDF_WARP_MORPH - SDF_WARP_REST) * 0.85;

export function makeSiteScene(cbs: SiteCallbacks = {}): SceneModule {
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

  // ── hero machine (autocycle / melt / queue) ─────────────────────────────────
  const texReady = new Array(STATE_COUNT).fill(false) as boolean[];
  let hState = 0;
  let hTarget = 0;
  let hPhase: "rest" | "melt" = "rest";
  let hMorphT = 0;
  let hDwell = 0;
  let hQueued = -1;
  let perm: number[] = [];
  let stag: number[] = [];
  const scratch = new Float32Array(N * 3); // hero bridge cloud (form-local)
  const scratchD = new Float32Array(N).fill(1); // …and its presence channel
  // One Services droplet, written in place by the shared melt kernel. Keeping
  // this fixed scratch is both allocation-free and what makes the browser run
  // the exact geometry measured by scripts/melt-mass.mjs.
  const serviceDrop = new Float32Array(4);
  const startMelt = (s: number) => {
    perm = permFor(hState, s);
    stag = STAG[hState];
    hTarget = s;
    hMorphT = 0;
    hPhase = "melt";
    cbs.onHeroActive?.(s - 1);
  };

  // ── gooey cursor chain (same spring family as the old hero) ─────────────────
  const drops = Array.from({ length: HERO_DROPS }, () => ({ x: 0.5, y: 0.5 }));
  let cursorOn = 0;
  let markMul = 1;

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
  let EXW = 1; // exit drain (radii)
  let exitDrop = 0; // uv the seventh form has fallen out of frame
  let jScale = ORGANISM_SCALE;
  let jOx = 0;
  let jOy = 0;
  let inSvcMelt = false;
  let svcBridge = false; // the §3.3 bridge owns the droplets (whole pillar)
  let svcB = 0; // …its destination form (= pa on the degenerate last pillar)
  let svcM = 0; // …and its progress (0 there, so it is that form's rest cloud)
  let pa = 0;
  let pb = 0;
  let heroBridge = false;
  let pourR = 0;
  let stirY = 0;
  let hp = 0; // damped heroPhase
  let gather = 0; // the S3 clock (0 = dispersed and far, 1 = one near body)
  let fused = 0; // the closing collapse of the three lobes into the mark
  let ambW = 1;
  let hOx = 0;
  let hOy = 0;
  let hScale = 0.5;
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
      exit: 0,
      pairA: 0,
      pairB: 0,
      pairM: 0,
      heroPlay: 1,
      heroHover: 0,
      heroManual: -1,
      heroDwellMs: DURATIONS.autocycle,
      heroPx: 0.5,
      heroPy: 0.5,
      heroCursorOn: 0,
      heroOx: 0,
      heroOy: 0,
      heroScale: 0.5,
      hov: -1, // hovered/focused circuit organ (slot index; -1 = none)
    },
    // raw passthroughs: the pair triple self-manages its snap-or-damp; the
    // hero machine inputs are events/geometry applied 1:1 (as today)
    damp: {
      on: false,
      pairA: false,
      pairB: false,
      pairM: false,
      heroPlay: false,
      heroHover: false,
      heroManual: false,
      heroDwellMs: false,
      heroPx: false,
      heroPy: false,
      heroCursorOn: false,
      heroOx: false,
      heroOy: false,
      heroScale: false,
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
    formReady: (s) => {
      texReady[s] = true;
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
      const mr = g.rect("method") ?? g.rect("methodBox");
      if (mr) out.exit = clamp01((vh * 1.45 - mr.top) / (vh * 0.55));
      const pillars = g.list("pillars");
      if (pillars.length >= 2 && out.svcPos > 0.02) {
        // virtual pre-pillar centre gives the organism → pillar-1 melt a runway
        const centers = centersMid(pillars);
        const virtual = centers[0] - vh * 0.85;
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
        const sCx = 0.5 + Math.min(0.14 * aspect, Math.max(aspect / 2 - 0.34, 0));
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
      // BOUNDARY: Services → Método. The seventh form POURS OUT of the frame
      // rather than evaporating where it stands. Draining radius in place left
      // a liquid-dead band before Método and read as the material being
      // switched off; falling out of frame is a departure, and the momentum
      // carries into the next chapter instead of stopping at its edge.
      const EXD = smooth01(clamp01(ch.exit));
      // squared: a fall accelerates. Linear travel reads as a slide.
      exitDrop = EXD * EXD * 0.9;
      // The body stays a BODY while it leaves — the drain only finishes it off
      // once it is already mostly past the bottom edge.
      // Held later still. At 0.55 the body had already thinned to near
      // invisibility while Método was only beginning to arrive; the overlap is
      // what removes the seam, so the mass survives most of the fall.
      EXW = 1 - smooth01(clamp01((EXD - 0.72) / 0.28));
      jScale = ORGANISM_SCALE + (svcScale - ORGANISM_SCALE) * SP;
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
      jOx = ecoOx * ecoIn * (1 - SP) + svcOx * SP;
      // One write carries the whole departure: the form's own offset, the
      // droplets' home footprint and the §3.3 bridge all read jOy, so the body
      // and its liquid leave together instead of separating on the way out.
      jOy = svcOy * SP - exitDrop;
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
      hOx = ch.heroOx;
      hOy = ch.heroOy;
      hScale = ch.heroScale;

      // ── hero machine tick ──────────────────────────────────────────────────
      const atHero = hp < 0.04;
      if (hPhase === "melt") {
        hMorphT += dt;
        if (hMorphT >= DURATIONS.morph) {
          hState = hTarget;
          hPhase = "rest";
          hDwell = 0;
          cbs.onHeroActive?.(hState - 1);
        }
      }
      const man = ch.heroManual < 0 ? null : ch.heroManual | 0;
      if (hPhase === "rest") {
        if (man != null && man !== hState && texReady[man]) {
          startMelt(man);
        } else if (hQueued >= 0 && hQueued !== hState && texReady[hQueued]) {
          const q = hQueued;
          hQueued = -1;
          startMelt(q);
        } else if (man == null && ch.heroPlay > 0.5 && !(ch.heroHover > 0.5) && atHero) {
          hDwell += dt;
          const next = (hState + 1) % STATE_COUNT;
          if (hDwell >= ch.heroDwellMs && texReady[next]) startMelt(next);
        }
      } else if (man != null && man !== hTarget) {
        hQueued = man; // retarget applies on arrival (no snap)
      }

      // ── gooey cursor (hero only; presence drains as the hero pours out) ────
      const cGoal = ch.heroCursorOn > 0.5 && atHero ? 1 : 0;
      if (cursorOn > 0.003 || cGoal > 0) {
        const goalMul =
          hPhase === "rest" && hState === 0 ? CURSOR_INFLUENCE_MARK : 1;
        markMul += (goalMul - markMul) * (1 - Math.exp(-dt / 160));
        cursorOn += (cGoal - cursorOn) * (1 - Math.exp(-dt / (cGoal ? 110 : 60)));
        if (cursorOn < 0.01 && cGoal > 0) {
          for (const d of drops) {
            d.x = ch.heroPx;
            d.y = ch.heroPy;
          } // materialise AT the pointer (no fly-in)
        }
        const ck = 1 - Math.pow(1 - CURSOR_SMOOTH, dt / 16.7);
        const ckt = 1 - Math.pow(1 - CURSOR_SMOOTH * 0.7, dt / 16.7);
        drops[0].x += (ch.heroPx - drops[0].x) * ck;
        drops[0].y += (ch.heroPy - drops[0].y) * ck;
        for (let i = 1; i < HERO_DROPS; i++) {
          drops[i].x += (drops[i - 1].x - drops[i].x) * ckt;
          drops[i].y += (drops[i - 1].y - drops[i].y) * ckt;
        }
      } else cursorOn = 0;

      // ── hero presence (the pour) + form-slot ownership ─────────────────────
      // The resting form erodes thin-edges-first across heroPhase 0.04 → 0.62;
      // its droplets emerge on the footprint and stream to the journey.
      // The Hero's liquid is the lab ribbon on its own surface, so the page
      // field holds no mark behind it. The mark first appears at convergence.
      const heroQ = 0;
      const [heroW, heroE] = formPresence(heroQ);
      const meltP = clamp01(hMorphT / DURATIONS.morph);
      const meltEnv = hPhase === "melt" ? Math.sin(Math.PI * meltP) : 0;

      let warp =
        SDF_WARP_REST +
        Math.min(Math.abs(ctx.scrollVel) * 0.003, 0.004); // scroll agitates

      if (heroW > 0.002) {
        // hero owns the form slots (journey form weight is 0 out here)
        formOut.ox = hOx;
        formOut.oy = hOy;
        formOut.scale = hScale;
        if (hPhase === "melt") {
          const ph = formPhase(meltP);
          formOut.a = hState;
          formOut.b = hTarget;
          formOut.fa = ph.wA * heroW;
          formOut.fb = ph.wB * heroW;
          formOut.ea = ph.eA + heroE;
          formOut.eb = ph.eB + heroE;
          warp += (SDF_WARP_MORPH - SDF_WARP_REST) * meltEnv;
        } else {
          formOut.a = hState;
          formOut.b = hState;
          formOut.fa = heroW;
          formOut.fb = 0;
          formOut.ea = heroE;
          formOut.eb = 0;
        }
      } else {
        formOut.ox = jOx;
        formOut.oy = jOy;
        formOut.scale = jScale;
        if (inServices) {
          formOut.a = pa;
          formOut.b = pb;
          if (pa === pb) {
            // degenerate pair (last pillar) — a solid rest, never a weight dip
            formOut.fa = 1;
            formOut.fb = 0;
            formOut.ea = 0;
            formOut.eb = 0;
          } else {
            const ph = formPhase(mState);
            formOut.fa = ph.wA;
            formOut.fb = ph.wB;
            formOut.ea = ph.eA;
            formOut.eb = ph.eB;
            warp +=
              (SDF_WARP_MORPH - SDF_WARP_REST) * Math.sin(Math.PI * mState);
          }
          // CHURN. A form that holds its position for a whole pillar has to
          // stay visibly ALIVE or it reads as a placed image being scrolled
          // past. This is surface motion only — the silhouette is still the
          // exact vector form, it is just never still — and it rides SP so the
          // gathering and the exit are unaffected.
          warp += SVC_CHURN * SP * (0.72 + 0.28 * Math.sin(ctx.t * 0.53));
        } else {
          // The mark is the RESULT of the fuse, never a thing the droplets
          // assemble around. Its field weight rides `fused`, which is 0 until
          // the last capability has arrived — so through the whole gathering
          // there is no form at all, only liquid, and the mark exists for the
          // first time at the moment the three lobes become one body.
          const [w, e] = formPresence(fused);
          formOut.a = 0;
          formOut.b = 0;
          formOut.fa = w;
          formOut.fb = 0;
          formOut.ea = e;
          formOut.eb = 0;
        }
        // exit: the form erodes away before the sticky layer unsticks
        // The form holds its weight while it falls and only erodes once it is
        // leaving the frame — dissolving it on the spot was the "obvious cut"
        // this boundary is meant to remove.
        const exE = smooth01(clamp01((smooth01(clamp01(ch.exit)) - 0.55) / 0.45));
        formOut.fa *= 1 - exE;
        formOut.fb *= 1 - exE;
        formOut.ea += exE * SDF_MELT_ERODE;
        formOut.eb += exE * SDF_MELT_ERODE;
      }
      formOut.warp = warp;

      // ── per-droplet shared factors ──────────────────────────────────────────
      heroBridge = false;
      if (hPhase === "melt" && heroW > 0.002) {
        packBridge(
          scratch,
          0,
          CLOUDS[hState],
          CLOUDS[hTarget],
          perm,
          stag,
          meltP,
          scratchD,
          FORM_SOLIDITY[hState],
          FORM_SOLIDITY[hTarget],
        );
        heroBridge = true;
      }
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
      ambW =
        (1 - 0.5 * smooth01(gather) * (1 - SP)) *
        (1 - SP) *
        EXW *
        smooth01((hp - 0.66) / 0.3);

      // governor activity (R5-C): the hero melt, the gooey cursor and the
      // services melt are the scene's FAST clocks — everything else is
      // scroll-scrubbed (the conductor's velocity term covers it) or slow
      // enough (wander, tendril march, warp) for the 30 Hz idle floor.
      actW = Math.max(hPhase === "melt" ? 1 : 0, cursorOn, inSvcMelt ? 1 : 0);

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
      let hd = 1;
      if (heroBridge) {
        hx = scratch[i * 3];
        hy = scratch[i * 3 + 1];
        hr = scratch[i * 3 + 2];
        hd = scratchD[i];
      } else {
        hx = bb[0];
        hy = bb[1];
        hr = bb[2] * pourR * (0.55 + 0.45 * VARY[i]);
      }
      // stage into field space
      hx = 0.5 + hOx + (hx - 0.5) * hScale;
      hy = 0.5 + hOy + (hy - 0.5) * hScale;
      hr *= hScale;

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

      // the mark's own footprint — where everything ends up once fused
      const mx = 0.5 + jOx + (bb[0] - 0.5) * jScale;
      const my = 0.5 + jOy + (bb[1] - 0.5) * jScale;

      const node = NODE_OF(i);
      let e = 0; // this droplet's arrival (0 = still out in the dark)
      let depth = 1; // 1 = far, 0 = near
      let gx = mx;
      let gy = my;
      let gr = bb[2] * jScale;

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
        gr = bb[2] * jScale * (0.5 + 0.5 * e);
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
      let jr = bb[2] * jScale * VARY[i] * rec * (1 - e) + gr * e;
      // …and the same for light: depth is the chapter's argument, so unarrived
      // liquid has to actually be far, not merely elsewhere.
      depth = Math.min(1, depth + (1 - rec) * (1 - e));
      // THE HANDOFF. The droplets are how the mark arrives, not what it is:
      // as the fuse closes, they drain and the form's exact silhouette takes
      // over. Without this the thirty gathered masses simply pile onto the
      // mark's footprint and inflate it into an amorphous blob — the form is
      // underneath the whole time, drowned by the liquid that carried it.
      // Same principle as the §3.3 bridge: liquid leaves before the form is
      // solid. But it leaves by THINNING, not by shrinking — scaling thirty
      // radii toward zero pulled every gathered mass out of contact with its
      // neighbours and left a rash of small, fully-solid beads sitting on the
      // mark's silhouette (a metaball's peak field does not fall with its
      // size). Density takes the presence away instead, so the masses stay
      // merged the whole way in and are simply no longer there at full fuse;
      // radius now only relieves the pile-up that would inflate the mark.
      // `fused` LATCHES at 1 once the mark has formed, and that is deliberate:
      // from here on the exact SILHOUETTE is the subject, so the carrying
      // droplets stay absorbed through the Services pillars too and only the
      // form is drawn. The §3.3 branch below hands them their presence back for
      // the duration of each melt, which is the only time they are the subject
      // again. Scoping this to the gathering alone re-exposed 48 droplets at
      // every pillar rest and inflated the visible liquid by ~70%, embossing
      // exactly the lumpy silhouettes this is meant to remove.
      jr *= 1 - 0.35 * fused;
      densJ = 1 - fused;

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
        const A = CLOUDS[pa],
          B = CLOUDS[svcB];
        const pm = permFor(pa, svcB),
          st = STAG[pa];
        meltDroplet(
          serviceDrop,
          svcIdx[i], // the parcel this slot carries — see svcIdx
          A,
          B,
          pm,
          st,
          svcM,
          FORM_SOLIDITY[pa],
          FORM_SOLIDITY[svcB],
        );
        jx = 0.5 + jOx + (serviceDrop[0] - 0.5) * jScale;
        jy = 0.5 + jOy + (serviceDrop[1] - 0.5) * jScale;
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
        bindJ = 1; // the §3.3 bridge is analytic-exact — physics hands off
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
      // THE EXIT dissolves, it does not shrink. EXW used to scale every radius
      // toward zero on the way into Método, which is the same fragmentation as
      // the melt ramps: the departing body broke into a scatter of small solid
      // dots that then blinked out one at a time. Taking presence away instead
      // lets the mass thin and go, still whole.
      out.d = (hd + (densJ - hd) * li) * EXW;
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

    extras(ctx: SceneCtx, push) {
      // cursor chain (hero only)
      if (cursorOn > 0.003) {
        const cw = cursorOn * markMul * (1 - smooth01(hp * 3));
        for (let j = 0; j < HERO_DROPS; j++) {
          const r = CURSOR_R * Math.pow(0.58, j) * cw;
          if (r < 0.002) continue;
          push(drops[j].x, drops[j].y, r);
        }
      }
    },
  };
}
