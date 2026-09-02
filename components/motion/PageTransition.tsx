"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import { usePageTransition } from "@/lib/animation/transition-context";

/** The start state of the reference's `onEnter`, minus the origin (below). */
const ENTER_FROM = { autoAlpha: 0, scale: 0.8, xPercent: -100 } as const;
const CLEAR = "transform,transformOrigin,opacity,visibility";

/** `useLayoutEffect` on the client, `useEffect` on the server, so the enter
 *  state can be written BEFORE paint without React's SSR warning. `active` is
 *  false during SSR, so the enter path never actually runs there. */
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Scale about what the visitor is LOOKING AT, not about the page's midpoint.
 *
 * `transform-origin` defaults to the element's own centre. The reference's
 * routes are viewport-sized, so that is invisible — but this homepage runs to
 * ~27 000 px, and scaling a box that tall about its centre displaces whatever
 * is on screen by 0.2 × its distance from that centre. Leaving the footer for
 * a legal page (scrollY ≈ 26 000) threw the visible content ~2 500 px clear of
 * the viewport, which is a black screen with a perfectly healthy `opacity: 1`.
 *
 * Pinning the origin to the middle of the viewport makes the scale behave the
 * way it does in the reference at any page height and any scroll position:
 * the content the visitor is reading stays put and simply gets smaller.
 * Must be read while the node is untransformed, or the rect lies.
 */
function viewportOrigin(node: HTMLElement): string {
  const top = node.getBoundingClientRect().top + window.scrollY;
  return `50% ${window.scrollY + window.innerHeight / 2 - top}px`;
}

/** Marks the window in which a transform is live on the page wrapper.
 *  `globals.css` uses it to clip the horizontal overflow the ±100% slide
 *  would otherwise add to the document, and to park the one full-viewport
 *  fixed overlay that cannot survive being scaled to 0.8. */
function markWindow(open: boolean) {
  const root = document.documentElement;
  if (open) root.dataset.pageTransition = "";
  else delete root.dataset.pageTransition;
}

type PageTransitionProps = {
  children: ReactNode;
  /** False on the first paint of a document — see `template.tsx`. */
  active: boolean;
};

/**
 * Port of the reference's `Transition.js` (stackblitz react-6rzfpp).
 *
 * The GSAP timelines are the reference's, tween for tween:
 *
 *   onEnter  set{autoAlpha:0, scale:.8, xPercent:-100}
 *            → to{autoAlpha:1, xPercent:0, .25} → to{scale:1, .25}
 *   onExit   to{scale:.8, .2} → to{xPercent:100, autoAlpha:0, .2}
 *
 * What is ours is everything needed to make that survive a real site rather
 * than three viewport-sized demo routes:
 *
 * 1. THE ORIGIN FOLLOWS THE VIEWPORT (`viewportOrigin`, above).
 *
 * 2. THE TRANSFORM IS CLEARED ON ARRIVAL. `position: fixed` resolves against
 *    the nearest transformed ancestor, and this wrapper contains the page's
 *    own fixed chrome — the `.side-index` rail above all. AGENTS.md §7 records
 *    what a lingering transform here costs: the rail measured the DOCUMENT's
 *    height (~29 000 px) and laid every mark out below the fold. So the
 *    wrapper holds a transform only while a timeline is actually running.
 *
 * 3. SCROLLTRIGGER IS REFRESHED AFTER THAT. Reveals mount during the enter
 *    timeline, so they compute their start/end against an ancestor that is
 *    translated a full viewport and scaled to 0.8.
 *
 * 4. THE EXIT'S LAST BEAT WAITS FOR THE ROUTE (see `runExit`).
 */
export default function PageTransition({
  children,
  active,
}: PageTransitionProps) {
  const host = useRef<HTMLDivElement>(null);
  const { toggleCompleted, registerExit } = usePageTransition();

  // onExit — played by the provider's link interceptor before it routes.
  //
  // The reference's two tweens, in order, with the route's readiness gating
  // the join between them. That seam is deliberate: the first tween ends with
  // the page fully VISIBLE (just pulled back to 0.8), and the second is the
  // one that empties the viewport. Holding at the seam means a slow route —
  // an uncompiled page in dev, a cold fetch on a bad connection — waits on a
  // page the visitor can still see, instead of on black. When the route is
  // already warm `ready` has settled by the time the first tween lands and the
  // two run back to back, exactly as the reference does.
  const runExit = useCallback((ready: Promise<void>) => {
    const node = host.current;
    if (!node) return Promise.resolve();
    markWindow(true);
    gsap.set(node, { transformOrigin: viewportOrigin(node) });

    const pullBack = new Promise<void>((resolve) => {
      gsap
        .timeline({ paused: true, onComplete: () => resolve() })
        .to(node, { scale: 0.8, duration: 0.2 })
        .play();
    });
    const leave = () =>
      new Promise<void>((resolve) => {
        gsap
          .timeline({ paused: true, onComplete: () => resolve() })
          .to(node, { xPercent: 100, autoAlpha: 0, duration: 0.2 })
          .play();
      });

    return Promise.all([pullBack, ready]).then(leave);
  }, []);

  useEffect(() => registerExit(runExit), [registerExit, runExit]);

  // onEnter — laid out before paint, so the settled page is never shown for a
  // frame before the timeline pulls it off screen.
  useIsoLayoutEffect(() => {
    const node = host.current;
    if (!active || !node) return;

    gsap.registerPlugin(ScrollTrigger);
    toggleCompleted(false);
    markWindow(true);
    gsap.set(node, { ...ENTER_FROM, transformOrigin: viewportOrigin(node) });

    const tl = gsap
      .timeline({
        paused: true,
        onComplete: () => {
          gsap.set(node, { clearProps: CLEAR });
          markWindow(false);
          ScrollTrigger.refresh();
          toggleCompleted(true);
        },
      })
      .to(node, { autoAlpha: 1, xPercent: 0, duration: 0.25 })
      .to(node, { scale: 1, duration: 0.25 })
      .play();

    return () => {
      tl.kill();
      gsap.set(node, { clearProps: CLEAR });
      markWindow(false);
    };
  }, [active, toggleCompleted]);

  return (
    <div ref={host} className="page-transition">
      {children}
    </div>
  );
}
