"use client";

import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef } from "react";
import { MARK_D, DOT_D } from "@/lib/animation/intro-trace.data.mjs";
import {
  SPINE,
  HOOK,
  SPINE_DOT,
  SPINE_MARGIN,
  SPINE_VIEW,
} from "@/lib/animation/mark-spine.data.mjs";
import {
  quadsToPath,
  ribbonQuads,
  shareByLength,
  spinePath,
} from "@/lib/animation/mark-spine.mjs";
import { SECONDS } from "@/lib/animation/durations";
import { EASE_POINTS } from "@/lib/animation/easings";
import { useReducedMotion } from "@/lib/animation/reduced-motion";

/**
 * THE HEADER MARK DRAWS ITSELF.
 *
 * Modelled on GSAP's "Draw a path" demo, whose whole trick is in one attribute:
 * `fill="none"`. Nothing in that demo is filled — the stroke IS the figure, a
 * single continuous line that builds the form as it travels and then leaves
 * again as the tail catches the head.
 *
 * ── why a contour trace is the wrong answer ────────────────────────────────
 * The first build of this file ran a hairline around `MARK_D` and it was a rim
 * light on an already-finished logo: a SILHOUETTE, with the form fully present
 * the whole time. `MARK_D` records where the brush's EDGE ended up, which is
 * what you need to fill the mark and exactly the wrong description for drawing
 * it. The mark is natively one continuous brush stroke, so the other
 * description exists — `mark-spine.data.mjs` recovers it: the path the brush
 * travelled, and the brush's radius at every step (scripts/generate-mark-spine).
 *
 * ── why a mask and not a fat stroke ────────────────────────────────────────
 * The obvious build from there is to stroke the spine at the brush's width and
 * let that be the mark. It cannot be: the radius runs 8.7 -> 112.4 over this
 * spine, a 13x variation, and an SVG stroke has ONE width. A uniform stroke
 * would be a different logo, and AGENTS.md §4.3 makes the owner-traced form
 * sacred. So the spine drives a MASK over the canonical `MARK_D` + `DOT_D`
 * instead. Every frame shows the exact mark, partially revealed along its own
 * spine — there is no approximation on screen and nothing to resolve into at
 * the end.
 *
 * The generator proves the reveal reaches 100% of the artwork by rasterising
 * `ribbonQuads` itself, so "the logo is never permanently clipped" is measured
 * rather than assumed.
 *
 * ── no fades ───────────────────────────────────────────────────────────────
 * Nothing here animates `opacity`. The mark arrives by being DRAWN and leaves
 * by being UNDRAWN, and the counter-dot lands by growing — the same discipline
 * as `intro-sequence.ts`.
 */

/**
 * Where the baked geometry has to sit so it lands ON the painted mark.
 *
 * `.logo-mark` paints the source SVG with `center / contain`, which fits the
 * source VIEWBOX (2950x3200) — ink 2585.39 x 2912.02 at (173.86, 150.10), so
 * the ink stands at 2912.02/3200 = 0.9100 of the box. The baked geometry is
 * fitted to 0.78 of a 1000-unit box instead. Shrinking the viewBox about the
 * ink reconciles them:
 *
 *     side = 779.99 / 0.9100 = 857.13
 *     y0   = 110.00 - (150.10 / 3200) * 857.13 = 69.80
 *     x0   = 153.75 - 0.0933931 * 857.13       = 73.70
 *
 * Re-derive with `node scripts/_mark-fit.mjs`, which prints these four numbers
 * and nothing else. `_probe-brand-trace.mjs` measures the registration on the
 * running page; it was exact to 0.01 px at a 31.95 px mark.
 */
const TRACE_VIEWBOX = "73.7 69.8 857.13 857.13";

/** Full-box rect: "the mask hides nothing". The resting state, and what the
 *  SSR markup ships so the mark is whole before — and without — hydration. */
const OPEN_MASK = `M0 0H${SPINE_VIEW}V${SPINE_VIEW}H0Z`;

/** The two brush strokes, in the order a hand would make them (the generator
 *  orients both top-down rather than leaving them in Dijkstra's walk order). */
const STROKES = [SPINE, HOOK];
/** Nominal arc length for the counter-dot, which no stroke passes through. It
 *  buys the dot ~6% of the draw at the end — the mark's own full stop, and the
 *  same beat the entry intro gives it. */
const DOT_LEN = 120;
const RIBBON_SHARE =
  (SPINE.len + HOOK.len) / (SPINE.len + HOOK.len + DOT_LEN);
/** How much of the spine behind the pen stays lit — the wet edge of the ink.
 *  A line that accumulated instead would end up being the silhouette again. */
const WET = 0.16;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The pen is clamped to the part of the spine that is INSIDE the mark.
 *
 * The generator pushes `ext` samples past each tip so a flat reveal front can
 * sweep clean off the end (see ribbonQuads). Those samples are outside the
 * artwork, which is invisible for the mask — it is clipped by the mark — and
 * very visible for the pen, which would shoot a hairline out into the bar at
 * both ends of every draw.
 */
const inked = (s: { x: number[]; ext: number }, t: number) => {
  const span = s.x.length - 1;
  const lo = s.ext / span;
  const hi = (span - s.ext) / span;
  return clamp01((t - lo) / (hi - lo)) * (hi - lo) + lo;
};

let registered = false;
function register() {
  if (registered) return;
  gsap.registerPlugin(CustomEase);
  registered = true;
}

export function BrandDraw() {
  const reduced = useReducedMotion();
  const revealRef = useRef<SVGPathElement>(null);
  const penRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const pathname = usePathname();
  // React's useId contains colons, which are not legal at the head of an XML
  // name and make `url(#…)` unreliable across engines.
  const maskId = `brand-draw-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const reveal = revealRef.current;
    const pen = penRef.current;
    const dot = dotRef.current;
    if (reduced || !reveal || !pen || !dot) return;
    register();

    const brand = reveal.closest<HTMLElement>(".topbar-brand");

    /* Two curves, neither of them `arrive`. `arrive` is a LANDING curve — it
       puts 40% of the travel in the first 100ms and then creeps, which on a
       moving pen reads as a snap followed by a stall (measured: 401ms of a
       700ms tween carries visible motion). `calm` and `breath` are broadly
       even, and differ enough from each other that the draw and the erase do
       not feel like the same move played backwards. */
    const eDraw = CustomEase.create("ziDrawIn", EASE_POINTS.calm.join(","));
    const eWipe = CustomEase.create("ziDrawOut", EASE_POINTS.breath.join(","));

    /* ONE state object, one write per frame.
       `head` is how much of the mark has been laid down; `tail` is how much has
       been taken back off the start. [tail, head] is the demo's `drawSVG
       "a% b%"` in the only form this geometry can express it. */
    const state = { head: 1, tail: 0 };

    const paint = () => {
      const h = clamp01(state.head);
      const t = clamp01(state.tail);
      const ribbonH = clamp01(h / RIBBON_SHARE);
      const ribbonT = clamp01(t / RIBBON_SHARE);
      const heads = shareByLength(STROKES, ribbonH);
      const tails = shareByLength(STROKES, ribbonT);

      let d = "";
      let penD = "";
      for (let i = 0; i < STROKES.length; i++) {
        if (heads[i] <= tails[i]) continue;
        d += quadsToPath(ribbonQuads(STROKES[i], heads[i], SPINE_MARGIN, tails[i]));
        // the wet edge rides the stroke actually in hand
        if (heads[i] < 1 && heads[i] > 0) {
          const tip = inked(STROKES[i], heads[i]);
          const back = inked(STROKES[i], Math.max(tails[i], heads[i] - WET));
          if (tip > back) penD = spinePath(STROKES[i], tip, back);
        }
      }
      reveal.setAttribute("d", d || "M0 0Z");
      pen.setAttribute("d", penD);

      // the dot is the last beat of the draw and the first thing the wipe takes
      const dotIn = clamp01((h - RIBBON_SHARE) / (1 - RIBBON_SHARE));
      const dotOut = clamp01((t - RIBBON_SHARE) / (1 - RIBBON_SHARE));
      const dotP = t > RIBBON_SHARE ? 1 - dotOut : dotIn;
      dot.setAttribute("r", ((SPINE_DOT.r + SPINE_MARGIN) * dotP).toFixed(1));
    };

    let anim: gsap.core.Tween | gsap.core.Timeline | null = null;
    const run = <T extends gsap.core.Tween | gsap.core.Timeline>(next: T) => {
      const previous = anim;
      anim = next;
      previous?.kill();
      return next;
    };

    /** The mark builds itself from nothing and stays. */
    const draw = () => {
      state.tail = 0;
      state.head = 0;
      paint();
      return run(
        gsap.to(state, {
          head: 1,
          duration: SECONDS.medium,
          ease: eDraw,
          onUpdate: paint,
        }),
      );
    };

    /**
     * The demo's loop, once: the tail chases the head off the end, then the
     * head lays the mark back down from the top. There IS a single frame with
     * nothing on screen at the seam between them — that is the reference's own
     * behaviour (`to 100% 100%` finishes empty at the end, `from 0% 0%` starts
     * empty at the start), and at a 29 px mark it reads as the line completing
     * a lap rather than as a gap.
     */
    const snake = () =>
      run(
        gsap
          .timeline()
          .to(state, {
            tail: 1,
            duration: SECONDS.short,
            ease: eWipe,
            onUpdate: paint,
          })
          .set(state, { tail: 0, head: 0 })
          .to(state, {
            head: 1,
            duration: SECONDS.medium,
            ease: eDraw,
            onUpdate: paint,
          }),
      );

    const enter = () => {
      // only from a settled mark — re-triggering mid-draw would stutter
      if (state.head === 1 && state.tail === 0) snake();
    };
    brand?.addEventListener("mouseenter", enter);
    brand?.addEventListener("focus", enter);

    /* ── the arrival, behind the veil ────────────────────────────────────────
       On a hard load the entry intro is drawing this same mark at 520 px, so
       the header waits and takes the handoff: the big mark drains out of frame,
       the small one writes itself into the corner. On a client-side route
       change there is no veil and the draw is simply the header arriving.

       TWO signals, because the veil has two ways to finish. It sets
       `data-zveil="seen"` when it plays through; when it DECLINES to play (QA
       params, reduced motion, already seen) it only unmounts, and it does that
       in a commit after this effect has run — so a check for the element at
       mount time still finds it, and watching the attribute alone would wait
       for ever on exactly the loads where the intro never ran. */
    const veil = document.querySelector(".entry-veil");
    const observers: MutationObserver[] = [];
    const settle = () => {
      if (document.documentElement.dataset.zveil !== "seen" && veil?.isConnected) return;
      observers.forEach((o) => o.disconnect());
      draw();
    };

    if (!veil) {
      draw();
    } else {
      // hold the mark off screen until the handoff, so it does not appear
      // whole and then redraw itself a second later
      state.head = 0;
      paint();
      const attrs = new MutationObserver(settle);
      attrs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-zveil"],
      });
      observers.push(attrs);
      /* `childList` on the veil's PARENT, not `subtree` on the document: body's
         direct children change a handful of times in a session, where a subtree
         observer would fire on every mutation the liquid and the chapters make
         during the second this is listening. */
      if (veil.parentNode) {
        const removal = new MutationObserver(settle);
        removal.observe(veil.parentNode, { childList: true });
        observers.push(removal);
      }
    }

    return () => {
      observers.forEach((o) => o.disconnect());
      anim?.kill();
      brand?.removeEventListener("mouseenter", enter);
      brand?.removeEventListener("focus", enter);
      reveal.setAttribute("d", OPEN_MASK);
      pen.setAttribute("d", "");
      dot.setAttribute("r", "0");
    };
  }, [reduced, pathname]);

  if (reduced) return null;

  return (
    <svg className="brand-draw" viewBox={TRACE_VIEWBOX} aria-hidden="true" focusable="false">
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={SPINE_VIEW}
          height={SPINE_VIEW}
        >
          {/* Ships OPEN. With no JS — and before hydration — the mark is simply
              whole, which is the correct resting state for a brand mark in the
              chrome. The effect above closes it only when it is about to draw. */}
          <path ref={revealRef} d={OPEN_MASK} fill="#fff" />
          {/* the counter-dot's own reveal, so it can land after the strokes */}
          <circle ref={dotRef} cx={SPINE_DOT.cx} cy={SPINE_DOT.cy} r={0} fill="#fff" />
        </mask>
      </defs>

      <g mask={`url(#${maskId})`}>
        <path className="brand-draw-ink" d={MARK_D} />
        <path className="brand-draw-ink" d={DOT_D} />
      </g>

      {/* the wet edge of the ink, riding the pen */}
      <path ref={penRef} className="brand-draw-pen" d="" />
    </svg>
  );
}
