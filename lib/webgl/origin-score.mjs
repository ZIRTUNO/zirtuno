/**
 * THE ORIGIN's SCORE (R7) — the beat map of S7, stated once.
 *
 * S7 is one runway with one clock: the origin scene's p, measured by PageStage
 * across `.origin-journey`. Everything the chapter does hangs on that number,
 * and it used to hang on it from THREE places — the scene's envelopes, the
 * stylesheet's copy windows and the dawn's clamps — each retyping the beat
 * boundaries by hand. This module is the one table they now all read.
 *
 * Two consumers, and neither may drift from the other:
 *
 *   · the ORIGIN SCENE (scenes/origin.ts) — the liquid's envelopes and THE
 *     MIST's dials, pure functions of p (and of `lead`, the approach across the
 *     chapter's opening, which runs before p starts);
 *   · the ORIGIN DIRECTOR (components/chapters/OriginDirector.tsx) — the GSAP
 *     master timeline that choreographs the chapter's copy, SCRUBBED by the
 *     same p. GSAP owns the DOM; it never touches a droplet. The physics under
 *     it runs on its own clock and only ever reads dials.
 *
 * The eases are the house curves (lib/animation/easings.mjs), evaluated as
 * arithmetic, so a dial the liquid reads and a tween the copy runs on share
 * one shape without either side importing the other's runtime.
 *
 * PURITY: no DOM, no timers, node-runnable (scripts/verify/mist.mjs runs it).
 */

import { clamp01, smooth01 } from "./phys.mjs";
import { easeAt } from "../animation/easings.mjs";

/**
 * THE COPY WINDOWS — arrival (`from` over `span`) and release (`until` over
 * `exit`) of each beat's block, in p. Measured against the bands' PIN ranges
 * (scripts/probe/origin-bands.mjs at 1440x900: ideas 0.000-0.178 · tension
 * 0.189-0.389 · mark 0.411-0.589 · hold 0.600-0.800 · resolve 0.822-1.000)
 * so every release completes while its band is still pinned to the viewport
 * foot. `until` past 1 means the block holds to the end of the runway.
 */
export const ORIGIN_BEATS = [
  { id: "ideas", from: 0.0, span: 0.04, until: 0.139, exit: 0.035 },
  { id: "tension", from: 0.2, span: 0.04, until: 0.348, exit: 0.035 },
  { id: "mark", from: 0.4, span: 0.04, until: 0.545, exit: 0.035 },
  { id: "hold", from: 0.59, span: 0.04, until: 0.752, exit: 0.035 },
  { id: "resolve", from: 0.83, span: 0.04, until: 1.3, exit: 0.035 },
];

/** A beat's linear arrival/release at p (the numbers the band probe reads). */
export function copyWindow(beat, p) {
  return {
    inN: clamp01((p - beat.from) / beat.span),
    outN: clamp01((p - beat.until) / beat.exit),
  };
}

/**
 * THE ARC — every window the liquid and the mist move on, in p.
 *
 *   MEET       the two condensing bodies close from their poles to the meeting
 *   FUSE       the meeting → the exact mark (bind → 1, the form grows)
 *   GROW       the bodies condense at the poles out of the arriving vapour
 *   PURPOSE    the mark yields the right half of a wide stage to the thesis
 *   ECHO       a few droplets bud off the mark as seeds
 *   DRAIN      the mark erodes and its droplets sink into the vapour
 *
 *   EVAP       the share of the field that has boiled off — the APPEARANCE
 *   POLES      the two side attractors (the ideas draw their own weather)
 *   PULL       the centre — the point of contact — draws the whole field in
 *   CONDENSE   vapour that reaches a body is taken up as its skin
 *   RELEASE    the skin is breathed out again under the purpose
 *   SPELL      the vapour is drawn onto the letters of the name
 *   FADE       …and hands the letters to type
 *
 * THE ORDER THE CHAPTER IS READ IN, and the windows that carry each step:
 *
 *   S6 hands over        the scene's `on` rises exactly as Work's drains
 *   the field appears    EVAP, across the approach AND the first third of p
 *   the clouds condense  GROW, at the two poles the vapour is already drawn to
 *   everything moves in  PULL — the long one, the drawing's arrows
 *   the logo forms       MEET → FUSE, at the centre the inflow was aimed at
 *   the name             SPELL → FADE, the same vapour, spelling
 */
export const ORIGIN_ARC = {
  MEET: [0.14, 0.32],
  FUSE: [0.32, 0.47],
  GROW: [0.03, 0.26],
  PURPOSE_IN: [0.56, 0.66],
  PURPOSE_OUT: [0.78, 0.85],
  ECHO: [0.62, 0.81],
  DRAIN: [0.84, 0.96],
  /** The field keeps ARRIVING after the runway starts. `lead` alone put the
   *  vapour at full population before p had moved, so the chapter opened on a
   *  finished storm and the whole appearance was over before the story began
   *  (scripts/probe/origin-approach.mjs). The boil is now two thirds a
   *  function of p, and the stage fills while the bodies condense. */
  EVAP: [0.0, 0.32],
  POLES_ON: [0.02, 0.18],
  POLES_OFF: [0.3, 0.46],
  /** THE CONVERGENCE — the chapter's subject, and the one window that has to
   *  be long. It opens while the bodies are still condensing (the drawing's
   *  arrows are already there as the clouds form) and reaches full only at the
   *  fusion, so the inflow is legible across a third of the runway instead of
   *  resolving inside a fifth of it. */
  PULL_ON: [0.1, 0.42],
  PULL_REST: [0.48, 0.58], // …and eases to a breath once the mark has formed
  PULL_OFF: [0.8, 0.86],
  /** Condensation waits for something to condense ONTO. Opened at 0.03 the
   *  bodies took up the field as skin faster than the boil could replace it,
   *  and the stage went bare at exactly the beat that should read as fullest. */
  CONDENSE_ON: [0.12, 0.34],
  CONDENSE_OFF: [0.84, 0.9],
  RELEASE_ON: [0.6, 0.72],
  RELEASE_OFF: [0.86, 0.92],
  SPELL: [0.845, 0.93],
  FADE: [0.955, 0.995],
};

/** The most of the population S7 ever boils off. Held under 1 so the field
 *  keeps black between its specks — a dusting the eye can count arrows in,
 *  which is what the drawing is, rather than the fog a full 36 864 makes. */
export const EVAP_MAX = 0.78;

/** The most of the field any body may take up as skin at once. */
export const CONDENSE_MAX = 0.8;

/** smoothstep across a window. */
export const ramp = (p, w) => smooth01((p - w[0]) / (w[1] - w[0]));
/** the house ease across a window. */
export const easeRamp = (name, p, w) =>
  easeAt(name, clamp01((p - w[0]) / (w[1] - w[0])));

/**
 * The envelope set, as one stable object rewritten per frame (no allocation
 * in the frame loop). `update(p, lead, wide)`:
 *   p     the runway's progress, 0..1 (conductor-damped)
 *   lead  the approach across the chapter's opening, 0..1 — runs BEFORE p
 *   wide  0..1, how wide the stage is (the purpose split only exists wide)
 */
export function makeOriginEnvelopes() {
  const A = ORIGIN_ARC;
  const e = {
    // the liquid
    q1: 0,
    q2: 0,
    q4: 0,
    q5: 0,
    grow: 0,
    purpose: 0,
    formIn: 0,
    formOut: 0,
    // the mist
    evap: 0,
    poles: 0,
    pull: 0,
    condense: 0,
    recirc: 0,
    release: 0,
    spell: 0,
    fade: 1,
    curl: 1,
    floorOn: 1,
    // light
    key: 0,
    vignette: 0,
    exposure: 1,
    update(p, lead, wide) {
      p = clamp01(p);
      lead = clamp01(lead);
      wide = clamp01(wide);
      e.q1 = ramp(p, A.MEET);
      e.q2 = ramp(p, A.FUSE);
      e.q4 = ramp(p, A.ECHO);
      e.q5 = ramp(p, A.DRAIN);
      // The bodies condense on `calm`. They used to land on `arrive`, which
      // front-loads 40% of its travel into the first tenth of the window — a
      // landing curve, right for something being SET DOWN and wrong for
      // something being ACCUMULATED. Over a window this short it read as two
      // clouds appearing whole, then waiting. `calm` spends the window evenly,
      // so mass visibly gathers for as long as the vapour is arriving.
      e.grow = easeRamp("calm", p, A.GROW);
      e.purpose = ramp(p, A.PURPOSE_IN) * (1 - ramp(p, A.PURPOSE_OUT)) * wide;
      e.formIn = smooth01((e.q2 - 0.5) / 0.45);
      e.formOut = smooth01((p - 0.86) / 0.11);

      // THE ENTRANCE. `evap` is a POPULATION THRESHOLD, not a rate: the mist
      // emits a dormant particle when evap clears its stable hash, and an
      // emitted particle never goes back. So this number IS the share of the
      // field that has appeared, and however it is shaped is exactly how the
      // appearance reads.
      //
      // It used to be `calm(lead)` alone, and `lead` is spent before p starts
      // — so the field was already complete on the chapter's first measured
      // frame and the whole arrival happened over 0.85 of a viewport, behind
      // the opening headline, while Work was still on the stage. The approach
      // now carries only the first THIRD of the population, and the rest
      // arrives across p's opening act — the specks keep coming while the
      // clouds gather and the pull takes hold, which is the whole of what the
      // drawing shows. End to end the appearance spans ~2.9 viewports of
      // scroll against 0.85 (scripts/probe/origin-approach.mjs).
      e.evap = EVAP_MAX * easeAt("calm", lead) * (0.3 + 0.7 * ramp(p, A.EVAP));
      e.poles = ramp(p, A.POLES_ON) * (1 - ramp(p, A.POLES_OFF));
      // The pull carries the whole field in for the meeting, then eases to
      // 0.4 once the mark has formed: what still arrives is captured as
      // skin, and at full strength that inflow drew a fur of streaks around
      // the silhouette. The mark reads; the weather around it keeps moving.
      e.pull =
        ramp(p, A.PULL_ON) *
        (1 - 0.6 * ramp(p, A.PULL_REST)) *
        (1 - ramp(p, A.PULL_OFF));
      // Condensation is a POPULATION SHARE, like evap: the dial is the
      // fraction of the field a body is allowed to take up. Run to 1 it took
      // ALL of it — and skin inside a body's own field is drawn out by
      // `bodyFade`, so by the meeting the stage had gone bare at exactly the
      // beat that is supposed to read as an inflow. Half the field condenses;
      // the other half stays free and keeps streaming in, which is the
      // convergence the drawing is of. CONDENSE_MAX is the cap, not a scale on
      // the window — the shape of arrival and release is unchanged.
      e.condense =
        CONDENSE_MAX * ramp(p, A.CONDENSE_ON) * (1 - ramp(p, A.CONDENSE_OFF));
      // THE RETURN rides the pull: the field cycles for exactly as long as
      // there is an inflow to cycle, and is still by the time the name is
      // spelled. Not all of it — what stays is the centre's own glow.
      e.recirc = 0.85 * e.pull;
      e.release = ramp(p, A.RELEASE_ON) * (1 - ramp(p, A.RELEASE_OFF));
      e.spell = easeRamp("calm", p, A.SPELL);
      e.fade = 1 - ramp(p, A.FADE);
      // THE WEATHER YIELDS TO THE CONVERGENCE. Curl is what makes the field
      // look alive when nothing is asking it to go anywhere; run at full gain
      // UNDER the pull it fights it, and the stage reads as turbulence that
      // happens to be drifting rather than as a field being drawn in. The
      // drawing has one arrow direction everywhere, so the curl stands down as
      // the pull stands up — enough is left (0.45 at full inflow) that the
      // streams still braid on the way in.
      // Calmer again while the name is being spelled: the letters have to be
      // read, and a vapour still churning smears them.
      e.curl = (1 - 0.55 * e.pull) * (1 - 0.7 * e.spell);
      // the type band's wall is down only while the vapour is spelling INTO it
      e.floorOn = 1 - e.spell;

      // ── act IV light (R5-D, retimed) — the emotional peak ────────────────
      // The key lifts continuously as the field converges and the two ideas
      // fuse, stays lifted while the mark holds, and lets go with the drain.
      // The vignette closes over the approach (intimacy) and OPENS at the
      // fusion. Exposure supplies the restrained material afterglow — never a
      // page flash.
      //
      // R7-B: the key was 0.46 at the fusion and held there through the whole
      // purpose beat. Measured on the live stage that put 2.8% of the frame
      // past luma 200 with the vapour removed entirely (?fmist=0) — the LIGHT
      // was blowing the mark out, not the material. The peak is a third of
      // what it was; the mark is lit, not lamped. The vignette is untouched:
      // it closes and opens, it never adds.
      e.key = 0.17 * e.q2 * (1 - 0.8 * e.q5) + 0.05 * e.pull * (1 - e.q2);
      e.vignette = 0.16 * e.q1 * (1 - e.q2);
      e.exposure = 1 + 0.018 * e.q2 * (1 - e.q5);
      return e;
    },
  };
  return e;
}
