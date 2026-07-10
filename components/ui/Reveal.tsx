"use client";

import { motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
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
  /** Static inline styles (e.g. per-item CSS custom properties). */
  style?: CSSProperties;
  /** "rise" = fade + slide-up (default) · "blur" = the R5-D exposure reveal
   *  (fade + rise + 8px→0 defocus) for the Soul/Invitation acts' copy. */
  variant?: "rise" | "blur";
};

/**
 * Reusable enter animation (fade + slide-up; the "blur" variant adds an
 * 8px→0 defocus — copy resolving like light finding focus). Honors reduced
 * motion by rendering the resting (visible) state with no animation —
 * content is never hidden behind motion (S1.14). The blur filter is animated
 * once on entry and lands at exactly "blur(0px)"; Motion removes its inline
 * value on completion, so settled copy pays no compositing cost.
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
  style,
  variant = "rise",
}: RevealProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    const Tag = as;
    return (
      <Tag className={className} style={style}>
        {children}
      </Tag>
    );
  }

  // motion.div / motion.h1 / ... — dynamic tag lookup.
  const MotionTag = motion[as] as typeof motion.div;
  const transition = { duration, delay, ease: EASE_POINTS[ease] };
  const blur = variant === "blur";
  const hidden = blur
    ? { opacity: 0, y, filter: "blur(8px)" }
    : { opacity: 0, y };
  const shown = blur
    ? { opacity: 1, y: 0, filter: "blur(0px)" }
    : { opacity: 1, y: 0 };

  if (inView) {
    return (
      <MotionTag
        className={className}
        style={style}
        initial={hidden}
        whileInView={shown}
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
      style={style}
      initial={hidden}
      animate={shown}
      transition={transition}
    >
      {children}
    </MotionTag>
  );
}
