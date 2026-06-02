"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/lib/animation/reduced-motion";

/**
 * S6.3 — the connector line that draws phase-to-phase, scrubbed to scroll
 * progress through the method timeline. Sets `--method-draw` (0→1) on the
 * `.method` track; CSS scales the bright cyan line by it. Reduced motion shows
 * the line fully drawn (static).
 */
export function MethodLine() {
  const ref = useRef<HTMLLIElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const track = ref.current?.closest(".method") as HTMLElement | null;
    if (!track) return;
    if (reduced) {
      track.style.setProperty("--method-draw", "1");
      return;
    }
    gsap.registerPlugin(ScrollTrigger);
    const st = ScrollTrigger.create({
      trigger: track,
      start: "top 78%",
      end: "bottom 62%",
      scrub: 0.5,
      onUpdate: (self) =>
        track.style.setProperty("--method-draw", String(self.progress)),
    });
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 300);
    return () => {
      window.clearTimeout(id);
      st.kill();
    };
  }, [reduced]);

  return <li ref={ref} className="method-draw" aria-hidden="true" />;
}
