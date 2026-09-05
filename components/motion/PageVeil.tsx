"use client";

import { gsap } from "gsap";
import { useCallback, useEffect, useRef } from "react";
import { makeVeil, VEIL } from "@/lib/motion/veil.mjs";
import type { Veil } from "@/lib/motion/veil.mjs";
import { usePageTransition } from "@/lib/animation/transition-context";
import { useReducedMotion } from "@/lib/animation/reduced-motion";

/**
 * THE VEIL — the route transition's one moving part.
 *
 * The geometry is `lib/motion/veil.mjs`; this file is the clock, the DOM and
 * the handshake with `TransitionProvider`. It mounts ONCE, in the locale
 * layout, outside `template.tsx` — a curtain that unmounts halfway through the
 * navigation it is covering is not a curtain.
 *
 * WHY THIS REPLACES THE TRANSFORM. The transition it supersedes scaled and
 * slid the page wrapper itself, and a standing transform re-parents every
 * `position: fixed` descendant of the page (AGENTS.md §7). That cost the
 * previous implementation a per-run `transform-origin` pinned to the middle of
 * the viewport, a `clearProps` on arrival, an `overflow-x: clip` on the root, a
 * `ScrollTrigger.refresh()` after every enter, and a rule hiding `.cine-veils`
 * because a full-viewport fixed layer stops being full-viewport at `scale(.8)`.
 * Five workarounds for one root cause. A veil paints OVER the page and never
 * touches it, so none of them exist any more and neither does the class of bug
 * they were patching.
 *
 * THREE THINGS THIS OWNS:
 *
 *   THE STACK. Crest, body, ink — behind to in front, and first to last in
 *   time. On the way in they arrive in that order, so the page is swallowed by
 *   light before it is swallowed by black; on the way out the order reverses,
 *   so the black lifts first and a lit line is the last thing off the screen.
 *   Only the ink is opaque, and only the ink is load-bearing: it is what the
 *   route swap happens behind.
 *
 *   THE TWO GRADIENT UNITS. On COVER each layer's fill is in
 *   `objectBoundingBox`, so the ramp spans the growing shape and the lit stop
 *   rides the crest wherever it is. On REVEAL it is `userSpaceOnUse` over the
 *   viewBox, so the ramp is pinned to the viewport and the body simply drains
 *   off it rather than re-lighting as it shrinks. They agree exactly at the
 *   seam — a full-screen rectangle spans the viewport in both — which is what
 *   makes the flip between them invisible.
 *
 *   THE SEED. `veil.mjs` draws its column delays from a stream, not from
 *   `Math.random()`, so `?fveil=<n>` gives the capture sheet and the reviewer
 *   the same wave twice. Live, the stream starts somewhere random and every
 *   run advances it, so no two navigations in a session repeat.
 *
 * The paint is `globals.css` (`.page-veil`), not this file: stop colours are a
 * palette decision and belong with the palette. Offsets are attributes rather
 * than CSS because SVG `offset` is not a CSS property here — `offset` in CSS
 * means the motion path.
 */

/** Stop offsets per layer, front of the ramp first. Colours live in
 *  `globals.css` under `.page-veil`, keyed by these class names. */
const LAYERS = [
  { key: "crest", offsets: ["0%", "10%", "38%", "100%"] },
  { key: "body", offsets: ["0%", "18%", "55%", "100%"] },
  { key: "ink", offsets: ["0%", "22%", "60%", "100%"] },
] as const;

/** Two frames of grace before a reveal starts, so the incoming route has laid
 *  itself out behind the curtain rather than under the first frame of it. */
function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** `?fveil` pins the wave for captures and review. Any `?f*` param already
 *  suppresses the entry intro (see the locale layout's pre-paint script), so a
 *  pinned veil and a deterministic page arrive together. */
function captureSeed(): number | null {
  try {
    const raw = new URLSearchParams(window.location.search).get("fveil");
    if (raw === null) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed >>> 0 : 1;
  } catch {
    return null;
  }
}

export default function PageVeil() {
  const reduced = useReducedMotion();
  const { registerVeil } = usePageTransition();

  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const veilRef = useRef<Veil | null>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const seedRef = useRef(0);
  /** Which run owns the veil. Bumped by every entry point; a run that no longer
   *  matches it has been superseded and must not write to the DOM again. */
  const runRef = useRef(0);

  if (veilRef.current === null) veilRef.current = makeVeil();

  useEffect(() => {
    seedRef.current = captureSeed() ?? ((Math.random() * 0xffffffff) >>> 0);
  }, []);

  /** Push the kernel's current geometry at the DOM. Attribute writes, not
   *  React state: this runs every frame and a re-render per frame would cost
   *  more than the paint it is scheduling. */
  const draw = useCallback(() => {
    const veil = veilRef.current;
    if (!veil) return;
    for (let i = 0; i < VEIL.LAYERS; i++) {
      pathRefs.current[i]?.setAttribute("d", veil.path(i));
    }
  }, []);

  /** What the page can see: `cover`/`reveal` take the pointer (the curtain is
   *  opaque, so a click under it would be a click on something invisible),
   *  `wash` deliberately does not (it hides nothing and the page below it is
   *  live), `idle` is not rendered at all. */
  const stage = useCallback((value: string) => {
    const svg = svgRef.current;
    if (svg) svg.dataset.veil = value;
  }, []);

  /**
   * One run of the kernel, on GSAP's clock. Resolves TRUE only if it played to
   * the end and still owns `runRef` — false if it was superseded, interrupted,
   * or had nothing to draw into.
   *
   * IT MUST SETTLE EITHER WAY, and that is not decoration. `kill()` fires
   * `onInterrupt` and never `onComplete` (verified against gsap 3.15), so a
   * version of this that only resolved from `onComplete` left a dangling
   * promise behind every interrupted run — and `cover()` awaits one of those
   * before `TransitionProvider` is allowed to push. A tween killed mid-cover
   * therefore swallowed the click outright: no navigation, and `leavingRef`
   * never cleared, so nothing could navigate afterwards either. Two ordinary
   * things kill a tween mid-cover — a competing `wash()` from a history pop,
   * and the registration effect re-running when `prefers-reduced-motion`
   * changes — and the second one is reproducible on demand.
   *
   * The tween itself is LINEAR on purpose: every curve in this transition is
   * per column, inside `veil.mjs`, so the clock must not ease anything twice.
   */
  const play = useCallback(
    (mode: "cover" | "reveal", layerCount: number, token: number) =>
      new Promise<boolean>((resolve) => {
        const veil = veilRef.current;
        if (!veil || !svgRef.current) return resolve(false);
        // A newer run claimed the veil while this one was waiting on a paint.
        if (runRef.current !== token) return resolve(false);

        tweenRef.current?.kill();
        const total = veil.arm(mode, seedRef.current++, layerCount);
        const units = mode === "cover" ? "cover" : "reveal";
        for (let i = 0; i < VEIL.LAYERS; i++) {
          pathRefs.current[i]?.setAttribute("fill", `url(#zv-${units}-${i})`);
        }
        veil.seek(0);
        draw();

        const clock = { t: 0 };
        tweenRef.current = gsap.to(clock, {
          t: total,
          duration: total,
          ease: "none",
          onUpdate: () => {
            if (veil.seek(clock.t)) draw();
          },
          onComplete: () => {
            veil.seek(total);
            draw();
            resolve(runRef.current === token);
          },
          onInterrupt: () => resolve(false),
        });
      }),
    [draw],
  );

  /** Park the veil: nothing armed, nothing painted, nothing hittable. */
  const rest = useCallback(() => {
    stage("idle");
    for (let i = 0; i < VEIL.LAYERS; i++) {
      pathRefs.current[i]?.setAttribute("d", "");
    }
  }, [stage]);

  useEffect(() => {
    if (reduced) return;

    // Every entry point claims the veil before it touches anything. Whoever
    // claimed last owns the DOM; everyone else unwinds without a further write,
    // which is what keeps a superseded run from calling `rest()` over the top
    // of the run that replaced it and blanking the curtain for a frame.
    const runner = {
      /** Close over the page, and let the route warm behind the same 0.72s. */
      cover: async (ready: Promise<void>) => {
        const token = ++runRef.current;
        stage("cover");
        // Deliberately NOT gated on the run still being ours: this is what the
        // provider waits on before routing, so it has to settle even when the
        // curtain was taken away mid-cover. Resolving early costs a transition;
        // not resolving costs the navigation.
        await Promise.all([play("cover", VEIL.LAYERS, token), ready]);
      },
      /** Drain off the top. Held until here, the swap has already happened. */
      reveal: async () => {
        const token = ++runRef.current;
        stage("reveal");
        await afterPaint();
        if (await play("reveal", VEIL.LAYERS, token)) rest();
      },
      /** A back/forward arrives with the page ALREADY changed, so there is
       *  nothing to cover for and covering would only hide what the visitor
       *  came back to see. The crest alone crosses the viewport instead: the
       *  same current, the same light, nothing hidden. */
      wash: async () => {
        const token = ++runRef.current;
        stage("wash");
        await afterPaint();
        if (!(await play("cover", 1, token))) return;
        if (await play("reveal", 1, token)) rest();
      },
      covered: () => veilRef.current?.covered ?? false,
    };

    const dispose = registerVeil(runner);
    return () => {
      dispose();
      tweenRef.current?.kill();
      tweenRef.current = null;
    };
  }, [play, reduced, registerVeil, rest, stage]);

  // Reduced motion never gets a curtain, and there is no point shipping the
  // element to a document that will not animate it.
  if (reduced) return null;

  return (
    <svg
      ref={svgRef}
      className="page-veil"
      data-veil="idle"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {LAYERS.map((layer, i) => {
          const stops = layer.offsets.map((offset, s) => (
            <stop key={offset + s} offset={offset} className={`zv-s${s}`} />
          ));
          return (
            <g key={layer.key}>
              {/* COVER — the ramp spans the shape, so the lit stop is always
                  ON the crest, wherever in the viewport the crest has got to. */}
              <linearGradient
                id={`zv-cover-${i}`}
                className={`zv-${layer.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                {stops}
              </linearGradient>
              {/* REVEAL — the ramp is nailed to the viewport, so the body
                  drains off a fixed gradient instead of re-lighting as it
                  shrinks. Identical to the above at full cover, which is the
                  only moment the two are ever swapped. */}
              <linearGradient
                id={`zv-reveal-${i}`}
                className={`zv-${layer.key}`}
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1="0"
                x2="0"
                y2="100"
              >
                {stops}
              </linearGradient>
            </g>
          );
        })}
      </defs>
      {LAYERS.map((layer, i) => (
        <path
          key={layer.key}
          ref={(node) => {
            pathRefs.current[i] = node;
          }}
          className={`page-veil-layer zv-${layer.key}`}
          fill={`url(#zv-cover-${i})`}
          d=""
        />
      ))}
    </svg>
  );
}
