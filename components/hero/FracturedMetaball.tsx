"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { detectFieldTier, type FieldTier } from "@/lib/webgl/field-tier";
import { makeScatterDriver } from "@/lib/webgl/field-drivers";
import { LogoMark } from "@/components/hero/LogoMark";
import { cn } from "@/lib/utils";

// the unified liquid field is client-only (WebGL2) → lazy, no SSR.
const FieldStage = dynamic(() => import("@/components/field/FieldStage"), {
  ssr: false,
});

// How far the mark is broken in S3 (0 = whole, 1 = fully dispersed). R2 will
// scrub this per symptom; until then The Problem holds the broken state.
const FRACTURE_HOLD = 0.9;

/**
 * S3.2 · The Problem — the mark granulated into desaturated, slowly drifting
 * droplets: the SCATTER driver on the unified liquid field (R1 — same engine,
 * shading and droplets as the hero; the retired raymarch is gone). Every tier
 * the probe clears gets it live, mobile included; the static fractured mark
 * stays for reduced-motion / "none" / no-WebGL. S4 runs the same driver
 * backwards — the converge payoff reassembles exactly this state.
 */
export function FracturedMetaball({ ariaLabel = "Zirtuno" }: { ariaLabel?: string }) {
  const reduced = useReducedMotion();
  const [stageRef, inView, seen] = useInView<HTMLDivElement>("250px");
  const [tier, setTier] = useState<FieldTier | null>(null);
  const [ready, setReady] = useState(false);
  // plain mutable holder (not a React ref — the driver reads it per frame)
  const driver = useMemo(() => makeScatterDriver({ current: FRACTURE_HOLD }), []);

  useEffect(() => {
    setTier(detectFieldTier());
  }, []);

  const enabled = !reduced && (tier === "full" || tier === "lite");
  const hideFallback = enabled && ready;

  return (
    <div className="fractured-stage" data-fractured-metaball ref={stageRef}>
      <LogoMark
        variant="fractured"
        ariaLabel={ariaLabel}
        className={cn("fractured-fallback", hideFallback && "is-hidden")}
      />
      {enabled && seen && (
        <div className="fractured-canvas">
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
