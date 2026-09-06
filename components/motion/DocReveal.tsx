"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { whenUncovered } from "@/lib/animation/curtain";

/**
 * The document-page entrance, ported from upsunday.co's legal bundle, which
 * does exactly this and nothing else:
 *
 *   document.querySelectorAll(".legal__section").forEach((el) =>
 *     gsap.from(el, { y: 30, opacity: 0, duration: .85, ease: "power3.out",
 *                     clearProps: "transform,opacity",
 *                     scrollTrigger: { trigger: el, start: "top 86%",
 *                                      once: true } }));
 *   window.addEventListener("load", () => ScrollTrigger.refresh());
 *
 * GSAP AND SCROLLTRIGGER, NOT A CSS TRANSITION. An earlier pass drove this from
 * CSS on `cubic-bezier(.165,.84,.44,1)`, the value usually quoted for
 * `power3.out`. `power3` is GSAP's QUART — 1−(1−t)⁴ — and that bezier is wrong
 * by up to 4.4%, concentrated in the first 200ms: at t=0.10 it reads 0.388
 * against the true 0.344, so the rise arrived visibly early. Reading the ease
 * out of GSAP removes the approximation entirely. `scratchpad/ease-check.mjs`
 * prints the comparison.
 *
 * ScrollTrigger is also the right instrument here, contrary to what the first
 * pass assumed: `LenisProvider` already does `lenis.on("scroll",
 * ScrollTrigger.update)` — the same wiring the reference's own bundle uses — so
 * triggers read Lenis's position, not a stale native scroll event.
 *
 * THE ONE THING THE REFERENCE DOES NOT HAVE TO SOLVE is when to start. It has
 * no curtain, so its sections animate as the document paints. This site opens
 * behind the entry veil and navigates behind the page veil, so the tweens are
 * built by `whenUncovered` rather than on mount — see `lib/animation/curtain.ts`
 * for why that is not a delay but an ordering fix.
 *
 * `fromTo`, not `from`, because the resting state is server-rendered in CSS to
 * avoid a flash: a `from` tween would read that CSS `opacity: 0` as its own
 * destination. The tweens are built first, then `data-doc-armed` comes off, so
 * GSAP's inline styles take over the hidden state without a gap. `clearProps`
 * hands each section back to plain CSS once it has landed.
 */
export default function DocReveal() {
  const reduced = useReducedMotion();

  useEffect(() => {
    const sections = gsap.utils.toArray<HTMLElement>("[data-doc-reveal]");
    if (!sections.length) return;

    // The arming attribute is looked up from the sections rather than used as
    // the entry point, and the cleanup puts it back. An effect has to be
    // idempotent: StrictMode runs mount → cleanup → mount in development, and
    // an earlier version keyed off `[data-doc-armed]` and then removed it, so
    // the second mount found nothing, returned early, and left the page with no
    // tweens at all — silently, because there is no error in doing nothing.
    const armed = [
      ...new Set(sections.map((el) => el.closest("[data-doc-armed]"))),
    ].filter((el): el is HTMLElement => el instanceof HTMLElement);
    const disarm = () =>
      armed.forEach((el) => el.removeAttribute("data-doc-armed"));

    if (reduced) {
      disarm();
      return () => armed.forEach((el) => el.setAttribute("data-doc-armed", ""));
    }

    gsap.registerPlugin(ScrollTrigger);

    // `gsap.core.Context` is not in gsap 3.15's exported types; take the type
    // from the factory so this cannot drift with a version bump.
    let ctx: ReturnType<typeof gsap.context> | null = null;

    // NOT on mount — when the page is actually on screen. The reference has no
    // curtain, so its sections animate the moment the document paints; here the
    // entry veil stands for ~3.42s and the page veil for the length of a
    // navigation, and React runs this page's effects BEFORE the layout's veil
    // effects. Built on mount, every section above the fold played and finished
    // behind an opaque curtain, and the visitor was handed an already-settled
    // page. `whenUncovered` waits for whichever curtain is up and has its own
    // hard cap, so a curtain that never lifts costs the animation, never the
    // content.
    const start = () => {
      ctx = gsap.context(() => {
        sections.forEach((section) => {
          gsap.fromTo(
            section,
            { y: 30, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.85,
              ease: "power3.out",
              immediateRender: true,
              clearProps: "transform,opacity",
              scrollTrigger: { trigger: section, start: "top 86%", once: true },
            },
          );
        });
      });
      disarm();
      // Start lines are measured here, which is now after the curtain, the
      // webfonts and the footer have all settled — so this refresh is belt and
      // braces rather than the load-bearing one it had to be on mount.
      ScrollTrigger.refresh();
    };

    const cancel = whenUncovered(start);

    return () => {
      cancel();
      ctx?.revert();
      armed.forEach((el) => el.setAttribute("data-doc-armed", ""));
    };
  }, [reduced]);

  return null;
}
