"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { detectFieldTier, type FieldTier } from "@/lib/webgl/field-tier";
import { makeImpulseDriver } from "@/lib/webgl/field-drivers";
import { LogoMark } from "@/components/hero/LogoMark";
import { cn } from "@/lib/utils";

// the unified liquid field is client-only (WebGL2) → lazy, no SSR.
const FieldStage = dynamic(() => import("@/components/field/FieldStage"), {
  ssr: false,
});

export const EXHALE_EVENT = "zirtuno:exhale";

/**
 * S10 — the contact liquid: the EXACT resting mark, breathing. Additive only —
 * the labeled submit is the canonical action. On submit it "exhales": the
 * impulse driver (R1, unified field) bursts droplets off the mark and sinks
 * them back over ~1.5 s, triggered by the `zirtuno:exhale` window event the
 * form dispatches. Every tier the probe clears gets it live; the static mark
 * stays for reduced-motion / "none" / no-WebGL.
 */
export function ContactMetaball() {
  const reduced = useReducedMotion();
  const [stageRef, inView, seen] = useInView<HTMLDivElement>("250px");
  const [tier, setTier] = useState<FieldTier | null>(null);
  const [ready, setReady] = useState(false);
  const { driver, trigger } = useMemo(() => makeImpulseDriver(0), []);

  useEffect(() => {
    setTier(detectFieldTier());
  }, []);

  // the exhale gesture — a one-shot droplet pulse on submit
  useEffect(() => {
    const onExhale = () => trigger();
    window.addEventListener(EXHALE_EVENT, onExhale);
    return () => window.removeEventListener(EXHALE_EVENT, onExhale);
  }, [trigger]);

  const enabled = !reduced && (tier === "full" || tier === "lite");
  const hideFallback = enabled && ready;

  return (
    <div className="contact-metaball-stage" ref={stageRef} role="img" aria-label="Zirtuno">
      <LogoMark
        className={cn("contact-metaball-fallback", hideFallback && "is-hidden")}
      />
      {enabled && seen && (
        <div className="contact-metaball-canvas sdf-glass-breath">
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
