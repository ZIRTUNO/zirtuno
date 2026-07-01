"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { detectFieldTier, type FieldTier } from "@/lib/webgl/field-tier";
import { makeScatterDriver, arrive } from "@/lib/webgl/field-drivers";
import { LogoMark } from "@/components/hero/LogoMark";
import { cn } from "@/lib/utils";

// the unified liquid field is client-only (WebGL2) → lazy, no SSR.
const FieldStage = dynamic(() => import("@/components/field/FieldStage"), {
  ssr: false,
});

/**
 * S4 · Ecosystem core — the CONVERGE: the scatter driver run backwards on the
 * unified liquid field (R1). The S3 droplets fly home, the colour blooms back
 * from grey to vivid cyan, and the EXACT mark re-forms — the visitor earns
 * "ecossistemas, não peças soltas". On desktop the converge is pinned and
 * scroll-scrubbed (progress 1 → 0); elsewhere it plays once, timed, when the
 * diagram enters view. The static mark stays for reduced-motion / "none".
 */
export function EcosystemCore({ ariaLabel = "Zirtuno" }: { ariaLabel?: string }) {
  const reduced = useReducedMotion();
  const [stageRef, inView, seen] = useInView<HTMLDivElement>("250px");
  const [tier, setTier] = useState<FieldTier | null>(null);
  const [desktop, setDesktop] = useState(false);
  const [ready, setReady] = useState(false);
  // plain mutable holder (not a React ref): 1 = dispersed (S3's exit state) …
  // 0 = the mark. The scrub/tween effects write it; the driver reads per frame.
  const [driver, progress] = useMemo(() => {
    const p = { current: 1 };
    return [makeScatterDriver(p), p] as const;
  }, []);

  useEffect(() => {
    setTier(detectFieldTier());
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const enabled = !reduced && (tier === "full" || tier === "lite");

  // Desktop: pin the diagram and scrub the converge to scroll (1 → 0).
  useEffect(() => {
    if (!enabled || !desktop) return;
    const pinEl = stageRef.current?.closest(".eco-radial") as HTMLElement | null;
    if (!pinEl) return;

    gsap.registerPlugin(ScrollTrigger);
    const st = ScrollTrigger.create({
      trigger: pinEl,
      start: "center center",
      end: "+=110%",
      pin: true,
      scrub: 0.6,
      onUpdate: (self) => {
        progress.current = 1 - self.progress;
      },
      onLeave: () => {
        progress.current = 0;
      },
      onLeaveBack: () => {
        progress.current = 1;
      },
    });
    // recompute pin offsets once layout/fonts have settled
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 300);
    return () => {
      window.clearTimeout(id);
      st.kill();
    };
  }, [enabled, desktop, stageRef, progress]);

  // Mobile / no-pin: the converge plays once, timed, when first seen.
  useEffect(() => {
    if (!enabled || desktop || !seen) return;
    let raf = 0;
    const t0 = performance.now();
    const DUR = 2600;
    const tick = (now: number) => {
      const p = Math.min((now - t0) / DUR, 1);
      progress.current = 1 - arrive(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, desktop, seen, progress]);

  const hideFallback = enabled && ready;

  return (
    <div className="eco-core-stage" data-ecosystem-core ref={stageRef}>
      <LogoMark
        ariaLabel={ariaLabel}
        className={cn("eco-core-fallback", hideFallback && "is-hidden")}
      />
      {enabled && seen && (
        <div className="eco-core-canvas">
          <FieldStage
            driver={driver}
            play={inView}
            tier={tier === "lite" ? "lite" : "full"}
            onReady={() => setReady(true)}
            onContextLost={() => setReady(false)}
          />
        </div>
      )}
    </div>
  );
}
