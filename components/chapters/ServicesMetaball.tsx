"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { detectFieldTier, type FieldTier } from "@/lib/webgl/field-tier";
import { makeScrubMorphDriver } from "@/lib/webgl/field-drivers";
import { LogoMark } from "@/components/hero/LogoMark";
import { PillarIndicator } from "@/components/hero/PillarIndicator";
import { cn } from "@/lib/utils";

// the unified liquid field is client-only (WebGL2) → lazy, no SSR.
const FieldStage = dynamic(() => import("@/components/field/FieldStage"), {
  ssr: false,
});

// Within the gap between two pillar centres, the liquid RESTS on each side and
// melts only across the middle window — the form is locked to the copy.
const MELT_LO = 0.35;
const MELT_HI = 0.65;

/**
 * S5 · Services liquid — the sticky glass that melts pillar→pillar in LOCKSTEP
 * with the copy: the scrub-morph driver on the unified field (R1) replaces the
 * old IntersectionObserver state-swap with PROGRESS-LOCKED §3.3 bridge melts.
 * The continuous pillar coordinate comes from the articles' real positions
 * against the viewport centre, so each form rests while its pillar is read and
 * dissolves into the next exactly across the boundary. Drives the
 * PillarIndicator. The copy stays server-rendered ([data-pillar] articles).
 */
export function ServicesMetaball({ ariaLabel = "Zirtuno" }: { ariaLabel?: string }) {
  const reduced = useReducedMotion();
  const [stageRef, inView, seen] = useInView<HTMLDivElement>("250px");
  const [tier, setTier] = useState<FieldTier | null>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(0); // active pillar index 0-6
  // plain mutable holder (not a React ref): [fromState, toState, m] — the
  // scroll effect writes it; the driver reads it per frame.
  const [driver, pairRef] = useMemo(() => {
    const p = { current: [1, 1, 0] as [number, number, number] };
    return [makeScrubMorphDriver(p), p] as const;
  }, []);

  useEffect(() => {
    setTier(detectFieldTier());
  }, []);

  const enabled = !reduced && (tier === "full" || tier === "lite");

  // Progress-locked melts: u ∈ [0,6] from the pillar articles' centres.
  useEffect(() => {
    if (!enabled) return;
    const section = stageRef.current?.closest("section");
    if (!section) return;
    const items = Array.from(
      section.querySelectorAll<HTMLElement>("[data-pillar]"),
    );
    if (items.length < 2) return;

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
        u = k + (cy - centers[k]) / Math.max(centers[k + 1] - centers[k], 1);
      }
      const i = Math.floor(u);
      const frac = u - i;
      const m =
        frac <= MELT_LO ? 0 : frac >= MELT_HI ? 1 : (frac - MELT_LO) / (MELT_HI - MELT_LO);
      pairRef.current = [i + 1, Math.min(i + 2, 7), m];
      const a = m < 0.5 ? i : Math.min(i + 1, items.length - 1);
      setActive((prev) => (prev === a ? prev : a));
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
  }, [enabled, stageRef, pairRef]);

  const hideFallback = enabled && ready;

  return (
    <div className="services-metaball" ref={stageRef}>
      <div className="services-metaball-stage" role="img" aria-label={ariaLabel}>
        <LogoMark
          className={cn("services-metaball-fallback", hideFallback && "is-hidden")}
        />
        {enabled && seen && (
          <div className="services-metaball-canvas">
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
      <PillarIndicator active={active} />
    </div>
  );
}
