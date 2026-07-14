"use client";

import { CustomEase } from "gsap/CustomEase";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion } from "motion/react";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
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
 * once on entry and lands at exactly "blur(0px)". Scroll-bound reveals are
 * owned by GSAP/ScrollTrigger; Motion remains responsible only for local
 * mount motion (the hero). Settled copy has its animation styles cleared so
 * it pays no ongoing compositing cost.
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
  const revealRef = useRef<HTMLElement | null>(null);
  const blur = variant === "blur";

  useEffect(() => {
    if (!inView || reduced || !revealRef.current) return;

    gsap.registerPlugin(CustomEase, ScrollTrigger);

    const element = revealRef.current;
    const easeName = `zirtuno-reveal-${ease}`;
    const points = EASE_POINTS[ease];
    CustomEase.create(easeName, points.join(","));

    const hidden = blur
      ? { opacity: 0, y, filter: "blur(8px)" }
      : { opacity: 0, y };
    const shown = blur
      ? { opacity: 1, y: 0, filter: "blur(0px)" }
      : { opacity: 1, y: 0 };

    const clearProps = blur ? "opacity,transform,filter" : "opacity,transform";
    const tween = gsap.fromTo(element, hidden, {
      ...shown,
      duration,
      delay,
      ease: easeName,
      force3D: true,
      scrollTrigger: {
        trigger: element,
        start: "top 88%",
        once: true,
      },
      onComplete: () => gsap.set(element, { clearProps }),
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      gsap.set(element, { clearProps });
    };
  }, [blur, delay, duration, ease, inView, reduced, y]);

  if (reduced) {
    const Tag = as;
    return (
      <Tag data-reveal="" className={className} style={style}>
        {children}
      </Tag>
    );
  }

  // motion.div / motion.h1 / ... — dynamic tag lookup.
  const MotionTag = motion[as] as typeof motion.div;
  const transition = { duration, delay, ease: EASE_POINTS[ease] };
  const hidden = blur
    ? { opacity: 0, y, filter: "blur(8px)" }
    : { opacity: 0, y };
  const shown = blur
    ? { opacity: 1, y: 0, filter: "blur(0px)" }
    : { opacity: 1, y: 0 };

  if (inView) {
    const Tag = as;
    const initialStyle: CSSProperties = {
      ...style,
      opacity: 0,
      transform: `translate3d(0, ${y}px, 0)`,
      ...(blur ? { filter: "blur(8px)" } : null),
    };

    return (
      <Tag
        data-reveal=""
        ref={(node: HTMLElement | null) => {
          revealRef.current = node;
        }}
        className={className}
        style={initialStyle}
      >
        {children}
      </Tag>
    );
  }

  return (
    <MotionTag
      data-reveal=""
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
