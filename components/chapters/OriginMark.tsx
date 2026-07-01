"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
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
 * S8 Beat 2 — "the mark forms." The converge driver on the unified liquid
 * field (R1 — same engine as the hero and S4): dispersed droplets drift home
 * and crystallise into the EXACT mark, once, when the beat enters view. Every
 * tier the probe clears gets it live; the static SVG mark stays for
 * reduced-motion / "none" / no-WebGL.
 */
export function OriginMark() {
  const reduced = useReducedMotion();
  const [stageRef, inView, seen] = useInView<HTMLDivElement>("250px");
  const [tier, setTier] = useState<FieldTier | null>(null);
  const [ready, setReady] = useState(false);
  // plain mutable holder (not a React ref): 1 = dispersed … 0 = the mark, formed
  const [driver, progress] = useMemo(() => {
    const p = { current: 1 };
    return [makeScatterDriver(p), p] as const;
  }, []);

  useEffect(() => {
    setTier(detectFieldTier());
  }, []);

  const enabled = !reduced && (tier === "full" || tier === "lite");

  // the converge plays once, timed, on first view
  useEffect(() => {
    if (!enabled || !seen) return;
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
  }, [enabled, seen, progress]);

  const hideFallback = enabled && ready;

  return (
    <div className="origin-mark-stage" ref={stageRef} role="img" aria-label="Zirtuno">
      <div
        className={cn("origin-mark-fallback", hideFallback && "is-hidden")}
        aria-hidden="true"
      >
        <LogoMark />
      </div>
      {enabled && seen && (
        <div className="origin-mark-canvas sdf-glass-breath">
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
