"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { detectFieldTier, type FieldTier } from "@/lib/webgl/field-tier";
import { makeLoneDropDriver } from "@/lib/webgl/field-drivers";
import { LogoMark } from "@/components/hero/LogoMark";
import { cn } from "@/lib/utils";

// the unified liquid field is client-only (WebGL2) → lazy, no SSR.
const FieldStage = dynamic(() => import("@/components/field/FieldStage"), {
  ssr: false,
});

/**
 * 404 — the lone dispersed droplet (Design-Spells detail, R3): one living
 * droplet that stayed behind, two fragments drifting away. Same liquid, same
 * glass. Static tiers / reduced motion keep the fractured mark.
 */
export function LoneDroplet() {
  const reduced = useReducedMotion();
  const [stageRef, inView, seen] = useInView<HTMLDivElement>("200px");
  const [tier, setTier] = useState<FieldTier | null>(null);
  const [ready, setReady] = useState(false);
  const driver = useMemo(() => makeLoneDropDriver(), []);

  useEffect(() => {
    setTier(detectFieldTier());
  }, []);

  const enabled = !reduced && (tier === "full" || tier === "lite");

  return (
    <div className="lone-drop-stage" ref={stageRef} role="img" aria-label="404">
      <div
        className={cn("lone-drop-fallback", enabled && ready && "is-hidden")}
        aria-hidden="true"
      >
        <LogoMark variant="fractured" />
      </div>
      {enabled && seen && (
        <div className="lone-drop-canvas" aria-hidden="true">
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
