"use client";

import { useEffect, type ReactNode } from "react";
import PageTransition from "@/components/motion/PageTransition";
import { useReducedMotion } from "@/lib/animation/reduced-motion";

/**
 * Page transition (S1.9) — the GSAP slide-and-scale ported from the reference
 * (stackblitz react-6rzfpp). `template.tsx` remounts on navigation, so this is
 * the enter half; the exit half is played by `TransitionProvider`, which
 * intercepts the link click and routes only once the outgoing page has left.
 * Skipped entirely under reduced motion.
 *
 * It does NOT play on the first paint of a document. A transition needs
 * something to transition FROM: on a cold load the branded moment is the entry
 * veil (the wordmark assembling), and on a same-session reload — where the veil
 * is deliberately suppressed — the transition was the only thing on screen, so
 * the site opened on an empty stage with no mark, no label and no progress cue.
 * The flag is module scope: it survives the per-route remounts of this file and
 * resets with the document, which is exactly the lifetime we want. It is read
 * during render as `false` on both server and client, so hydration matches.
 */
let navigatedInThisDocument = false;

export default function Template({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const isRouteChange = navigatedInThisDocument;

  useEffect(() => {
    navigatedInThisDocument = true;
  }, []);

  if (reduced) return <>{children}</>;

  return <PageTransition active={isRouteChange}>{children}</PageTransition>;
}
