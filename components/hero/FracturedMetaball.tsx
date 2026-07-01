"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { detectFieldTier, type FieldTier } from "@/lib/webgl/field-tier";
import { makeScatterDriver, clamp01, smooth01 } from "@/lib/webgl/field-drivers";
import { LogoMark } from "@/components/hero/LogoMark";
import { cn } from "@/lib/utils";

// the unified liquid field is client-only (WebGL2) → lazy, no SSR.
const FieldStage = dynamic(() => import("@/components/field/FieldStage"), {
  ssr: false,
});

// The fracture arc across the seven symptoms (R2 choreography): the mark enters
// barely cracked and each symptom pushes the fragments one notch further out;
// the chapter EXITS fully dispersed (1.0) — unresolved — which is exactly the
// state S4's converge begins from (P2 continuity).
const FRACTURE_START = 0.15;
const FRACTURE_END = 1.0;
// within each symptom's gap: hold, then push to the next notch across the middle
const NOTCH_LO = 0.25;
const NOTCH_HI = 0.75;

/**
 * S3.2 · The Problem — the mark breaking apart as the symptoms are read: the
 * SCATTER driver on the unified liquid field, scroll-scrubbed one notch per
 * symptom (the sticky visual fractures progressively beside the list). Every
 * tier the probe clears gets it live, mobile included; the static fractured
 * mark stays for reduced-motion / "none" / no-WebGL.
 */
export function FracturedMetaball({ ariaLabel = "Zirtuno" }: { ariaLabel?: string }) {
  const reduced = useReducedMotion();
  const [stageRef, inView, seen] = useInView<HTMLDivElement>("250px");
  const [tier, setTier] = useState<FieldTier | null>(null);
  const [ready, setReady] = useState(false);
  // plain mutable holder (not a React ref — the driver reads it per frame)
  const [driver, progress] = useMemo(() => {
    const p = { current: FRACTURE_START };
    return [makeScatterDriver(p), p] as const;
  }, []);

  useEffect(() => {
    setTier(detectFieldTier());
  }, []);

  const enabled = !reduced && (tier === "full" || tier === "lite");

  // Scroll-scrub the fracture: continuous symptom coordinate u ∈ [0, N-1] from
  // the list items' centres against the viewport centre, stepped per symptom.
  useEffect(() => {
    if (!enabled) return;
    const section = stageRef.current?.closest("section");
    if (!section) return;
    const items = Array.from(section.querySelectorAll<HTMLElement>(".symptom"));
    if (items.length < 2) {
      progress.current = 0.9; // no list (unexpected layout): hold broken
      return;
    }

    const update = () => {
      const cy = window.innerHeight * 0.5;
      const centers = items.map((el) => {
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2;
      });
      let u = 0;
      if (cy <= centers[0]) u = 0;
      else if (cy >= centers[centers.length - 1]) u = centers.length - 1;
      else {
        let k = 0;
        while (k < centers.length - 2 && centers[k + 1] <= cy) k++;
        const frac = (cy - centers[k]) / Math.max(centers[k + 1] - centers[k], 1);
        // hold on each symptom; push to the next notch across the middle
        u = k + smooth01((frac - NOTCH_LO) / (NOTCH_HI - NOTCH_LO));
      }
      progress.current =
        FRACTURE_START +
        (FRACTURE_END - FRACTURE_START) * clamp01(u / (items.length - 1));
    };

    gsap.registerPlugin(ScrollTrigger);
    const st = ScrollTrigger.create({
      trigger: section,
      start: "top bottom",
      end: "bottom top",
      onUpdate: update,
    });
    update();
    return () => st.kill();
  }, [enabled, stageRef, progress]);

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
