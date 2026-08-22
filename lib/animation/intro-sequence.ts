/**
 * S1.10 — THE ENTRY INTRO: "Two Ideas, One Form".
 *
 * The brand's first frame is its Origin argued in motion. AGENTS.md §2: Zéfiro
 * is force, Ventura is direction, and neither is the studio on its own — "force
 * without direction is only weather". The mark obliges, because it IS two
 * interlocking lobes joined into one continuous ribbon. So the intro draws it
 * as TWO lines that meet, and only then does it become a body.
 *
 *   1 SEED    a droplet crosses the black and strikes the contour.
 *   2 TRACE   from the impact, a hairline runs BOTH WAYS around the mark.
 *   3 MEET    the two heads close on the far terminal — one form.
 *   4 FLOOD   the silhouette fills from the meeting point outward, and the
 *             precise vector becomes liquid.
 *   5 BREATH  the filled mark answers the same kernel the CTA answers.
 *   6 DRAIN   it pours out of frame and the page is already alive underneath.
 *
 * ── one clock ──────────────────────────────────────────────────────────────
 * Everything above is ONE GSAP timeline. Not "a GSAP part, a Rive part and an
 * SVG part that happen to start together" — the timeline is the only clock in
 * the sequence, and every other system is a reader of it:
 *
 *   · DrawSVG's two heads are driven from a single proxy so they cannot drift.
 *   · The vector-liquid kernel is stepped by GSAP's ticker, and its impulses
 *     (`strike`) are fired from timeline callbacks, so the wave in the surface
 *     is always the wave the score asked for.
 *   · Rive, when a file is present, is SCRUBBED by timeline progress through a
 *     state-machine number input. It never autoplays. A layer that runs its own
 *     loop beside a sequence is a second clock, and two clocks is what makes
 *     motion read as assembled instead of authored.
 *
 * ── no fades ───────────────────────────────────────────────────────────────
 * Nothing in this sequence animates `opacity`. Every appearance is a MOVE, a
 * DRAW, a FLOOD or a THINNING — the impact ring dissipates by losing stroke
 * width, not by going transparent; the veil leaves by travelling, not by
 * dissolving. `verify-entry-veil.mjs` asserts this rather than trusting it.
 *
 * Geometry comes from `intro-trace.data.mjs`, which is generated from the
 * canonical mark — see scripts/generate-intro-trace.mjs.
 */

import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { lobedCirclePath, type Membrane } from "@/lib/motion/membrane.mjs";
import { INTRO_VIEW, RING, TRACE, TIPS, DOT } from "./intro-trace.data.mjs";

/**
 * The score, in seconds. Absolute times rather than relative offsets, because
 * the beats OVERLAP on purpose — the flood starts before the trace has fully
 * settled, the dot falls into the flood — and a chain of `+=` offsets makes
 * that impossible to read or to retime.
 */
export const SCORE = {
  /** the droplet crosses the black */
  seedIn: 0,
  seedDur: 0.55,
  /** it meets the contour: impact ring, and the line springs from the point */
  impact: 0.55,
  ringDur: 0.5,
  /** two heads, in opposite directions, on curvature-derived paces */
  trace: 0.6,
  traceDur: 1.23,
  /** they close on the seam — the far terminal */
  meet: 1.83,
  /** the silhouette fills from the meeting point outward */
  flood: 1.86,
  floodDur: 0.6,
  /** the mark's own dot arrives last and rings the surface */
  dot: 2.18,
  dotDur: 0.3,
  /** droplets leave the sharpest turns and are pulled back */
  drops: 2.3,
  dropsDur: 0.62,
  /** the autonomous swell — the surface is alive before it leaves */
  breath: 2.46,
  /** it pours out of frame; the page is already running underneath */
  drain: 2.72,
  drainDur: 0.7,
  /** total run — the veil unmounts here */
  end: 3.42,
  /** the skip control becomes available */
  skip: 1.0,
} as const;

/** The mark's swell ceiling, in px. A button may move 9; a 520 px logo needs
 *  more to read as liquid, and much more to read as broken. */
export const INTRO_MAX_N = 22;
/** Impulse strengths — measured, not guessed (see the tuning probe in the
 *  entry-veil spec): 2.2 gives an 8.3 px crest on a 560 px stage, 3.5 gives
 *  13.2 px. The dot LANDS, so it hits harder than the trace seed grazes. */
export const STRIKE_SEED = 1.5;
export const STRIKE_MEET = 2.2;
export const STRIKE_DOT = 3.5;

let registered = false;
function register() {
  if (registered) return;
  gsap.registerPlugin(CustomEase, DrawSVGPlugin);
  registered = true;
}

// ── the curtain ─────────────────────────────────────────────────────────────

/**
 * The black plane's leading edge, as a clip-path shape set ONCE.
 *
 * The obvious build — re-generate a `clip-path: path()` every frame so the
 * front ripples as it falls — repaints the whole viewport on every frame of
 * the exit, on top of the hero's WebGL, at the single moment the page is also
 * doing its first real work. This instead gives the plane a fixed liquid edge
 * and animates `transform`, which the compositor owns. The life comes from the
 * shape and the easing, not from re-drawing it 42 times.
 *
 * `amp` is the wave's headroom. The edge occupies y ∈ [0, 2·amp] inside the
 * box, so the plane rests at `translateY(-2·amp)`: that puts the wave's LOWEST
 * point on the viewport's top edge and leaves no uncovered strip above it — the
 * bug you get for free by resting it at `-amp` and reasoning about the crest
 * instead of the trough.
 */
export function curtainClip(w: number, h: number, amp: number): string {
  return `path("${edgeD(w, amp)} L${w.toFixed(1)} ${(h + amp * 2).toFixed(1)} L0 ${(h + amp * 2).toFixed(1)} Z")`;
}

/**
 * The same edge as an open path, so a cyan meniscus can be stroked on it.
 *
 * Summed sines were the first try and they read as a TILT, not as liquid: over
 * 1440 px, three harmonics of comparable width average into one gentle slope.
 * A draining sheet does not undulate evenly — it stays close to level and
 * CLINGS in a few places, and the clinging is what makes it liquid rather than
 * a diagonal. So: a flat front with three narrow tongues of different width and
 * weight, each a raised cosine (C¹ at its feet, so the stroke has no corners),
 * over a slight overall lean. Asymmetric on purpose; a symmetric front reads as
 * a shape, and this has to read as a surface.
 */
export function edgeD(w: number, amp: number): string {
  // centre, half-width, weight — in fractions of the viewport's width
  const tongues: [number, number, number][] = [
    [0.19, 0.17, 0.92],
    [0.53, 0.1, 0.5],
    [0.82, 0.2, 1.0],
  ];
  const bump = (t: number) => {
    if (t <= -1 || t >= 1) return 0;
    const c = Math.cos((t * Math.PI) / 2);
    return c * c;
  };
  const n = 64;
  let d = `M0 ${amp.toFixed(1)}`;
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    let cling = 0;
    for (const [c, s, wt] of tongues) cling += wt * bump((u - c) / s);
    // the lean: the sheet lets go of one side a beat before the other
    const lean = 0.16 * (u - 0.5);
    const y = amp * (1 - Math.min(1, cling) + lean);
    d += `L${(u * w).toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

// ── elements the sequence drives ────────────────────────────────────────────

export type IntroEls = {
  /** transform host for the whole mark — this is what falls at the drain */
  stage: HTMLElement;
  /** the flooded body (the liquid), masked by `flood` */
  body: SVGPathElement;
  /** the drawn contour — vector line first, then the body's rim light */
  trace: SVGPathElement;
  /** the mask shape the flood grows */
  flood: SVGPathElement;
  /** the droplet that crosses the black and strikes */
  seed: SVGCircleElement;
  /** the impact ring — a LOBED contour, not a circle, and it dissipates by
   *  thinning rather than by fading */
  ring: SVGPathElement;
  /** the mark's own counter-dot, which arrives last */
  dot: SVGCircleElement;
  /** pinch-off satellites at the sharpest turns */
  drops: SVGCircleElement[];
  /** the black plane */
  curtain: HTMLElement;
  /** the cyan meniscus stroked on the curtain's leading edge */
  edge: SVGPathElement;
};

export type IntroHooks = {
  /** 0..1 timeline progress — the Rive layer's only input */
  onProgress?: (p: number) => void;
  /** the sequence is over; unmount the veil */
  onDone: () => void;
  /**
   * The clock the LIQUID runs on, in ms. Live, this is `performance.now()`.
   * Held (`?zintro=hold`), it is the timeline's own time — which makes the
   * whole sequence, surface deformation included, a pure function of playhead
   * position and therefore capturable frame by frame. A harness that seeks a
   * timeline but leaves the physics on wall time is photographing two
   * different moments and calling it one.
   */
  now: () => number;
};

/**
 * Build the sequence. `stagePx` is the mark's rendered size — the kernel runs
 * in REAL PIXELS (membrane.mjs is tuned in px/ms throughout), so the ring is
 * handed over pre-scaled and the static paths get an SVG transform instead.
 */
export function buildIntroTimeline(
  els: IntroEls,
  membrane: Membrane,
  stagePx: number,
  viewport: { w: number; h: number },
  hooks: IntroHooks,
): gsap.core.Timeline {
  register();

  const k = stagePx / INTRO_VIEW;
  const px = (v: number) => v * k;
  const seedX = px(TRACE.seedX);
  const seedY = px(TRACE.seedY);
  const meetX = px(TRACE.meetX);
  const meetY = px(TRACE.meetY);

  // How far the flood must reach to cover the mark from the meeting point.
  let cover = 0;
  for (let i = 0; i < RING.n; i++) {
    const d = Math.hypot(px(RING.x[i]) - meetX, px(RING.y[i]) - meetY);
    if (d > cover) cover = d;
  }
  cover *= 1.04;

  const eA = CustomEase.create("ziPaceA", TRACE.easeA);
  const eB = CustomEase.create("ziPaceB", TRACE.easeB);

  // The kernel's own path is the ONE geometry: trace, body and physics are the
  // same 220 vertices, so the drawn line and the liquid it becomes cannot
  // drift apart by even a sub-pixel.
  const restD = membrane.path();
  els.trace.setAttribute("d", restD);
  els.body.setAttribute("d", restD);

  // Pre-state. Set, never tweened from — a veil that animates its own setup is
  // a veil that flashes on a slow first frame.
  gsap.set(els.trace, { drawSVG: "50% 50%", strokeWidth: Math.max(1.2, stagePx * 0.004) });
  gsap.set(els.flood, { attr: { d: "" } });
  gsap.set(els.ring, { attr: { d: "" }, strokeWidth: 0 });
  gsap.set(els.dot, {
    attr: { cx: px(DOT.cx), cy: px(DOT.cy) - stagePx * 0.5, r: 0 },
  });
  gsap.set(els.drops, { attr: { r: 0 } });
  gsap.set(els.seed, {
    attr: {
      cx: seedX - stagePx * 0.62,
      cy: seedY - stagePx * 0.44,
      r: stagePx * 0.014,
    },
  });
  const amp = curtainAmp(viewport.w);
  gsap.set(els.curtain, { y: -amp * 2 });
  gsap.set(els.stage, { y: 0, scale: 1 });

  const tl = gsap.timeline({
    paused: true,
    onUpdate: hooks.onProgress ? () => hooks.onProgress!(tl.progress()) : undefined,
    onComplete: hooks.onDone,
  });

  // ── 1 · SEED ──────────────────────────────────────────────────────────────
  // Gravity is not an ease name, it is two different eases on two axes: the
  // horizontal carry bleeds off, the fall accumulates.
  tl.to(
    els.seed,
    { attr: { cx: seedX }, duration: SCORE.seedDur, ease: "power1.out" },
    SCORE.seedIn,
  ).to(
    els.seed,
    { attr: { cy: seedY }, duration: SCORE.seedDur, ease: "power2.in" },
    SCORE.seedIn,
  );

  // ── 2 · IMPACT ────────────────────────────────────────────────────────────
  tl.call(
    () => {
      membrane.strike(seedX, seedY, hooks.now(), STRIKE_SEED, true);
    },
    undefined,
    SCORE.impact,
  );
  // the droplet is absorbed by the contour it struck — it shrinks into it
  tl.to(
    els.seed,
    { attr: { r: 0 }, duration: 0.22, ease: "power2.in" },
    SCORE.impact,
  );
  // The ring dissipates by LOSING WIDTH — no opacity anywhere in this file —
  // and it is a lobed contour rather than a circle. A perfect circle was the
  // one piece of generic-loader geometry in an otherwise entirely organic
  // composition, and it read as exactly that. Same `lobedCirclePath` the flood
  // front uses, so the impact and the flood are visibly the same material.
  const shock = { r: 0 };
  tl.fromTo(
    shock,
    { r: stagePx * 0.012 },
    {
      r: stagePx * 0.19,
      duration: SCORE.ringDur,
      ease: "power2.out",
      onUpdate: () => {
        els.ring.setAttribute("d", lobedCirclePath(seedX, seedY, shock.r, 3, 40));
      },
    },
    SCORE.impact,
  ).fromTo(
    els.ring,
    { strokeWidth: stagePx * 0.01 },
    { strokeWidth: 0, duration: SCORE.ringDur, ease: "power2.out" },
    SCORE.impact,
  );

  // ── 3 · TRACE ─────────────────────────────────────────────────────────────
  // Two heads, one proxy. Independent tweens on the same element would fight
  // over `drawSVG`; independent tweens on two proxies could drift by a frame
  // and land the meeting off the beat. One value, two curvature-derived paces,
  // one write.
  const head = { p: 0 };
  tl.to(
    head,
    {
      p: 1,
      duration: SCORE.traceDur,
      ease: "none",
      onUpdate: () => {
        const a = 50 * (1 - eA(head.p));
        const b = 50 + 50 * eB(head.p);
        gsap.set(els.trace, { drawSVG: `${a}% ${b}%` });
      },
    },
    SCORE.trace,
  );

  // ── 4 · MEET → FLOOD ──────────────────────────────────────────────────────
  tl.call(
    () => {
      // The dash pattern has done its work. Clearing it frees the stroke to
      // follow a `d` that is about to start moving every frame — a stale
      // absolute dasharray on a lengthening path opens a hairline gap at the
      // seam, which is exactly where the eye is at this moment.
      gsap.set(els.trace, { clearProps: "strokeDasharray,strokeDashoffset" });
      membrane.strike(meetX, meetY, hooks.now(), STRIKE_MEET, true);
    },
    undefined,
    SCORE.meet,
  );
  const join = { r: 0 };
  tl.fromTo(
    join,
    { r: stagePx * 0.01 },
    {
      r: stagePx * 0.26,
      duration: 0.62,
      ease: "power3.out",
      onUpdate: () => {
        els.ring.setAttribute("d", lobedCirclePath(meetX, meetY, join.r, 11, 44));
      },
    },
    SCORE.meet,
  ).fromTo(
    els.ring,
    { strokeWidth: stagePx * 0.012 },
    { strokeWidth: 0, duration: 0.62, ease: "power3.out" },
    SCORE.meet,
  );

  const front = { r: 0 };
  tl.to(
    front,
    {
      r: cover,
      duration: SCORE.floodDur,
      // A liquid front is fast at the pour and slow as it runs out of energy.
      ease: "power2.out",
      onUpdate: () => {
        els.flood.setAttribute(
          "d",
          lobedCirclePath(meetX, meetY, front.r, 7, 56),
        );
      },
    },
    SCORE.flood,
  );

  // ── 5 · THE DOT, THE DROPLETS, THE BREATH ─────────────────────────────────
  tl.to(
    els.dot,
    { attr: { r: px(DOT.r) }, duration: 0.16, ease: "power1.out" },
    SCORE.dot,
  ).to(
    els.dot,
    { attr: { cy: px(DOT.cy) }, duration: SCORE.dotDur, ease: "power2.in" },
    SCORE.dot,
  );
  tl.call(
    () => {
      membrane.strike(px(DOT.cx), px(DOT.cy), hooks.now(), STRIKE_DOT, true);
    },
    undefined,
    SCORE.dot + SCORE.dotDur,
  );

  // Restraint is the brief: three droplets, not a particle system. They leave
  // along the surface normal at the sharpest turns and are drawn back by the
  // same tension that holds the outline together, so nothing is ever "spawned"
  // and nothing is ever left behind.
  const launch = [TIPS[0], TIPS[2], TIPS[4]].filter(Boolean);
  els.drops.forEach((drop, i) => {
    const tip = launch[i];
    if (!tip) return;
    const x0 = px(tip.x);
    const y0 = px(tip.y);
    const reach = stagePx * (0.052 + 0.018 * i);
    gsap.set(drop, { attr: { cx: x0, cy: y0 } });
    tl.to(
      drop,
      { attr: { r: stagePx * (0.014 - 0.002 * i) }, duration: 0.14, ease: "power1.out" },
      SCORE.drops + i * 0.07,
    )
      .to(
        drop,
        {
          attr: { cx: x0 + tip.nx * reach, cy: y0 + tip.ny * reach },
          duration: SCORE.dropsDur * 0.55,
          ease: "power2.out",
        },
        SCORE.drops + i * 0.07,
      )
      .to(
        drop,
        {
          attr: { cx: x0, cy: y0, r: 0 },
          duration: SCORE.dropsDur * 0.45,
          ease: "power2.in",
        },
        SCORE.drops + i * 0.07 + SCORE.dropsDur * 0.55,
      );
  });

  tl.call(() => membrane.setTide(1), undefined, SCORE.breath);

  // ── 6 · DRAIN ─────────────────────────────────────────────────────────────
  tl.call(() => membrane.setTide(0), undefined, SCORE.drain);
  // The mark leads and the black follows: the last thing on screen is a sheet
  // of liquid sliding off the bottom, over a hero whose own cyan horizon is
  // already running there.
  tl.to(
    els.stage,
    {
      y: viewport.h * 0.5 + stagePx * 0.75,
      scale: 0.9,
      duration: SCORE.drainDur,
      ease: "power3.in",
    },
    SCORE.drain,
  );
  tl.to(
    els.curtain,
    {
      y: viewport.h + amp * 2,
      duration: SCORE.drainDur,
      ease: "power2.in",
    },
    SCORE.drain + 0.06,
  );
  // the meniscus thins as the sheet accelerates away
  tl.to(
    els.edge,
    { strokeWidth: 0, duration: SCORE.drainDur * 0.8, ease: "power1.in" },
    SCORE.drain + 0.12,
  );

  return tl;
}

/** Headroom for the curtain's tongues, scaled to the viewport's width. */
export function curtainAmp(w: number): number {
  return Math.max(36, Math.min(96, w * 0.06));
}
