"use client";

import { motion } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { EASE_POINTS } from "@/lib/animation/easings";
import { useReducedMotion } from "@/lib/animation/reduced-motion";

/**
 * Page transition (S1.9) — a cyan wipe reveals each route, then content fades
 * up. template.tsx remounts on navigation, so this runs per route change.
 * Skipped entirely under reduced motion.
 *
 * It does NOT play on the first paint of a document. A transition needs
 * something to transition FROM: on a cold load the branded moment is the entry
 * veil (the wordmark assembling), and on a same-session reload — where the veil
 * is deliberately suppressed — the wipe was the only thing on screen, so the
 * site opened on a flat cyan field with no mark, no label and no progress cue.
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

  return (
    <>
      {isRouteChange && (
        <motion.div
          className="page-wipe"
          aria-hidden="true"
          initial={{ scaleY: 1 }}
          animate={{ scaleY: 0 }}
          transition={{ duration: 0.7, ease: EASE_POINTS.depart }}
        />
      )}
      <motion.div
        className="page-transition-content"
        initial={isRouteChange ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.5,
          delay: isRouteChange ? 0.12 : 0,
          ease: EASE_POINTS.arrive,
        }}
      >
        {children}
      </motion.div>
    </>
  );
}
