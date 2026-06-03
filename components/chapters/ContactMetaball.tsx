"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { canRunGlass } from "@/lib/webgl/can-run-glass";
import { LogoMark } from "@/components/hero/LogoMark";
import { cn } from "@/lib/utils";

// three.js is client-only and heavy → load the scene lazily, no SSR.
const MetaballScene = dynamic(() => import("@/components/hero/MetaballScene"), {
  ssr: false,
});

export const EXHALE_EVENT = "zirtuno:exhale";

function supportsWebGL(): boolean {
  return canRunGlass();
}

/**
 * S10 — the contact metaball: the resting connected mark, breathing. Additive
 * only — the labeled submit is the canonical action. On submit it "exhales":
 * the form briefly disperses (uFracture pulses 0 → ~0.45 → 0) and reforms,
 * triggered by the `zirtuno:exhale` window event the form dispatches. Desktop-
 * only; the unified CSS placeholder is the reduced-motion / mobile / no-WebGL
 * fallback. Pauses off-screen.
 */
export function ContactMetaball() {
  const reduced = useReducedMotion();
  const [stageRef, inView, seen] = useInView<HTMLDivElement>("250px");
  const [enabled, setEnabled] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [ready, setReady] = useState(false);
  const fractureRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px) and (pointer: fine)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setEnabled(!reduced && desktop && supportsWebGL());
  }, [reduced, desktop]);

  // the exhale gesture — a one-shot fracture pulse on submit
  useEffect(() => {
    const onExhale = () => {
      const start = performance.now();
      const dur = 1500;
      const tick = (now: number) => {
        const p = Math.min((now - start) / dur, 1);
        fractureRef.current = Math.sin(p * Math.PI) * 0.45; // 0 → peak → 0
        if (p < 1) requestAnimationFrame(tick);
        else fractureRef.current = 0;
      };
      requestAnimationFrame(tick);
    };
    window.addEventListener(EXHALE_EVENT, onExhale);
    return () => window.removeEventListener(EXHALE_EVENT, onExhale);
  }, []);

  const hideFallback = enabled && ready;

  return (
    <div className="contact-metaball-stage" ref={stageRef} role="img" aria-label="Zirtuno">
      <LogoMark
        className={cn("contact-metaball-fallback", hideFallback && "is-hidden")}
      />
      {enabled && seen && (
        <div className="contact-metaball-canvas">
          <MetaballScene
            fracture={0}
            fractureRef={fractureRef}
            play={inView}
            onReady={() => setReady(true)}
          />
        </div>
      )}
    </div>
  );
}
