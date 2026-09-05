"use client";

import { useEffect, useLayoutEffect, type ReactNode } from "react";
import { usePageTransition } from "@/lib/animation/transition-context";

/** `useLayoutEffect` on the client, `useEffect` on the server, so the arrival
 *  is announced BEFORE paint without React's SSR warning. `isRouteChange` is
 *  false during SSR, so the arrival path never actually runs there. */
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Page transition (S1.9) — THE VEIL, ported from GSAP's Dynamic Morphing demo.
 * See `lib/motion/veil.mjs` for the geometry and `PageVeil.tsx` for the
 * runtime; the curtain itself is mounted in the locale layout, outside this
 * file, because it has to outlive the route it is covering.
 *
 * All this template does is remount — which is the one signal the App Router
 * gives that a navigation has committed — and hand that fact to the provider.
 * It renders NO wrapper of its own. The transition it replaced wrapped the
 * page in a transformed div, and a standing transform re-parents every
 * `position: fixed` descendant of the page (AGENTS.md §7); a curtain painted
 * over the top needs no wrapper, so there is nothing left here to get wrong.
 *
 * It does NOT play on the first paint of a document. A transition needs
 * something to transition FROM: on a cold load the branded moment is the entry
 * veil (the wordmark assembling), and on a same-session reload — where the veil
 * is deliberately suppressed — the transition was the only thing on screen, so
 * the site opened on an empty stage with no mark, no label and no progress cue.
 * The flag is module scope: it survives the per-route remounts of this file and
 * resets with the document, which is exactly the lifetime we want. It is read
 * during render as `false` on both server and client, so hydration matches.
 *
 * Reduced motion is handled inside the provider and the curtain (which does not
 * render at all), so this file has no branch for it.
 */
let navigatedInThisDocument = false;

export default function Template({ children }: { children: ReactNode }) {
  const { enter } = usePageTransition();
  const isRouteChange = navigatedInThisDocument;

  useIsoLayoutEffect(() => {
    navigatedInThisDocument = true;
    if (isRouteChange) enter();
  }, [isRouteChange, enter]);

  return <>{children}</>;
}
