"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { EASE_POINTS } from "@/lib/animation/easings";
import { useReducedMotion } from "@/lib/animation/reduced-motion";

/**
 * Page transition (S1.9) — a cyan wipe reveals each route, then content fades
 * up. template.tsx remounts on navigation, so this runs per route change.
 * Skipped entirely under reduced motion.
 */
export default function Template({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  if (reduced) return <>{children}</>;

  return (
    <>
      <motion.div
        className="page-wipe"
        aria-hidden="true"
        initial={{ scaleY: 1 }}
        animate={{ scaleY: 0 }}
        transition={{ duration: 0.7, ease: EASE_POINTS.depart }}
      />
      <motion.div
        className="page-transition-content"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.12, ease: EASE_POINTS.arrive }}
      >
        {children}
      </motion.div>
    </>
  );
}
