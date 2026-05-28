"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { EASE_POINTS, type EasingName } from "@/lib/animation/easings";

type Tag = "div" | "p" | "span" | "h1" | "h2" | "h3" | "li" | "ul";

type RevealProps = {
  children: ReactNode;
  /** Animate on mount (hero) vs. when scrolled into view (chapters). */
  inView?: boolean;
  delay?: number;
  /** Vertical offset to rise from, px. */
  y?: number;
  duration?: number;
  ease?: EasingName;
  as?: Tag;
  className?: string;
};

/**
 * Reusable enter animation (fade + slide-up). Honors reduced motion by
 * rendering the resting (visible) state with no animation — content is never
 * hidden behind motion (S1.14).
 */
export function Reveal({
  children,
  inView = false,
  delay = 0,
  y = 12,
  duration = 0.8,
  ease = "arrive",
  as = "div",
  className,
}: RevealProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  // motion.div / motion.h1 / ... — dynamic tag lookup.
  const MotionTag = motion[as] as typeof motion.div;
  const transition = { duration, delay, ease: EASE_POINTS[ease] };

  if (inView) {
    return (
      <MotionTag
        className={className}
        initial={{ opacity: 0, y }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-12% 0px" }}
        transition={transition}
      >
        {children}
      </MotionTag>
    );
  }

  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
    >
      {children}
    </MotionTag>
  );
}
