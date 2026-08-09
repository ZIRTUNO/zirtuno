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
  arrivalPulse,
  familyOffset,
  fuse as gatherFuse,
  env as gatherEnv,
  NODE_OF,
} from "../gathering.mjs";
import type { ScatterTarget } from "../phys.mjs";
import {
  STAGGER,
  RADIUS_LEAD,
  arrive,
  permFor,
  packBridge,
  bridgePresence,
  BRIDGE_SWELL,
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
      if (Math.abs(aspect - cachedAspect) > 0.02) {
        cachedAspect = aspect;
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
        Teco = wideScatter(aspect, 0.5, 0.5, 1);
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
      jOx = svcOx * SP;
      // One write carries the whole departure: the form's own offset, the
      // droplets' home footprint and the §3.3 bridge all read jOy, so the body
      // and its liquid leave together instead of separating on the way out.
      jOy = svcOy * SP - exitDrop;
      const inServices = pa !== pb || pa > 0;
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
      tx += (eco.tx - tx) * TR * 0.42;
      ty += (eco.ty - ty) * TR * 0.42;

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
        const anchor = gatherAnchor(node, aspect);
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
      let jr = bb[2] * jScale * VARY[i] * (1 - e) + gr * e;
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
      bindJ = Math.max(e * 0.35, fused);
      if (fused > 0.7) clusJ = -1;
      // the fracture's unstable chunks still cohere before the gathering starts
      if (TR < 0.6 && F < 0.85 && e < 0.1)
        clusJ = Math.min((hash(i, 11) * 4) | 0, 3);
      if (inSvcMelt) {
        // the §3.3 services bridge is the journey target while melting
        const A = CLOUDS[pa],
          B = CLOUDS[pb];
        const pm = permFor(pa, pb),
          st = STAG[pa];
        const lm = clamp01(mState * (1 + STAGGER) - STAGGER * st[i]);
        const tp = arrive(lm);
        const trr = arrive(clamp01(lm * RADIUS_LEAD));
        const aa = A[i],
          bb2 = B[pm[i]];
        jx = 0.5 + jOx + (aa[0] + (bb2[0] - aa[0]) * tp - 0.5) * jScale;
        jy = 0.5 + jOy + (aa[1] + (bb2[1] - aa[1]) * tp - 0.5) * jScale;
        // RADIUS IS NEVER SCALED HERE. The whole handoff is carried by presence
        // (which is the form's exact complement), so the cloud keeps the size
        // that makes it the same body as the form — and keeps its droplets in
        // contact with each other, since they only neck while their gap is
        // under 0.83 x radius. Shrinking radius on the way in and out is what
        // used to shed the loose beads at both ends of every melt.
        // The cloud THICKENS by exactly as much as it is standing in for the
        // form (see BRIDGE_SWELL): full swell where it carries the frame alone,
        // none at either end where it hands back at its canonical size.
        const pres = bridgePresence(mState);
        const bridgeR =
          (aa[2] + (bb2[2] - aa[2]) * trr) * jScale * (1 + BRIDGE_SWELL * pres);
        const handoff = smooth01(clamp01(mState / 0.14));
        jr = jr * (1 - handoff) + bridgeR * handoff;
        // PRESENCE IS THE FORM'S COMPLEMENT — the cloud is exactly as present
        // as the form is absent, so the total on screen never changes. It opens
        // at 0 where the gathered droplets arrive absorbed at 0, so the seam
        // needs no blend of its own.
        densJ = pres;
        bindJ = 1; // the §3.3 bridge is analytic-exact — physics hands off
        clusJ = -1;
        depth = 0; // the services body is the near plane, always
      } else if (node >= 0) {
        // A hovered capability swells and pulls its own family forward — the
        // system answering a touch, on the same channel the circuit used.
        const hov = ctx.ch.hov ?? -1;
        if (hov === node && e > 0.05 && fused < 0.85) {
          const w = (1 - fused) * e;
          jr *= 1 + 0.5 * w;
          depth *= 1 - 0.55 * w;
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
