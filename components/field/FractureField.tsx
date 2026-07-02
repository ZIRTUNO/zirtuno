"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { detectFieldTier, type FieldTier } from "@/lib/webgl/field-tier";
import {
  makeFractureFieldDriver,
  clamp01,
  smooth01,
} from "@/lib/webgl/field-drivers";
import { LogoMark } from "@/components/hero/LogoMark";

// the unified liquid field is client-only (WebGL2) → lazy, no SSR.
const FieldStage = dynamic(() => import("@/components/field/FieldStage"), {
  ssr: false,
});

// The fracture arc across the seven symptoms: the mark enters barely cracked
// and each symptom pushes the fragments one notch further out; the chapter
// EXITS fully dispersed — the state S4's converge begins from (P2 continuity).
const FRACTURE_START = 0.08;
const FRACTURE_END = 1.0;
// within each symptom's gap: hold, then push to the next notch across the middle
const NOTCH_LO = 0.25;
const NOTCH_HI = 0.75;

/**
 * S3 remake — the FRACTURE FIELD: a full-viewport sticky liquid layer behind
 * the whole chapter (the liquid is the page, not a box). The mark sits large,
 * right of centre; as each symptom shard crosses the viewport centre it breaks
 * one notch further, its desaturated fragments drifting across the entire
 * field around the copy. Decorative (aria-hidden); reduced-motion / "none"
 * gets a dim static fractured mark instead.
 */
export function FractureField() {
  const reduced = useReducedMotion();
  const [layerRef, inView, seen] = useInView<HTMLDivElement>("300px");
  const [tier, setTier] = useState<FieldTier | null>(null);
  const driver = useMemo(() => {
    const p = { current: FRACTURE_START };
    const d = makeFractureFieldDriver(p);
    return Object.assign(d, { progress: p });
  }, []);

  useEffect(() => {
    setTier(detectFieldTier());
  }, []);

  const enabled = !reduced && (tier === "full" || tier === "lite");

  // Scroll-scrub the fracture from the symptom shards' centres.
  useEffect(() => {
    if (!enabled) return;
    const section = layerRef.current?.closest("section");
    if (!section) return;
    const items = Array.from(section.querySelectorAll<HTMLElement>(".symptom"));
    if (items.length < 2) {
      driver.progress.current = 0.9;
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
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
        u = k + smooth01((frac - NOTCH_LO) / (NOTCH_HI - NOTCH_LO));
      }
      driver.progress.current =
        FRACTURE_START +
        (FRACTURE_END - FRACTURE_START) * clamp01(u / (items.length - 1));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [enabled, layerRef, driver]);

  return (
    <div className="fracture-layer" aria-hidden="true" data-fracture-field ref={layerRef}>
      {enabled && seen ? (
        <FieldStage
          driver={driver}
          play={inView}
          tier={tier === "lite" ? "lite" : "full"}
        />
      ) : (
        // reduced-motion / "none" / no-WebGL: a dim static fractured mark
        <div className="fracture-fallback">
          <LogoMark variant="fractured" />
        </div>
      )}
    </div>
  );
}
