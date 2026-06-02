"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { WebglPlaceholder } from "@/components/ui/WebglPlaceholder";
import { cn } from "@/lib/utils";

// three.js is client-only and heavy → load the scene lazily, no SSR.
const MetaballScene = dynamic(() => import("@/components/hero/MetaballScene"), {
  ssr: false,
});

function supportsWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl2") || c.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

/**
 * S4 · Ecosystem core — the SCROLL-SCRUBBED converge. Reuses the hero glass
 * (MetaballScene): the S3 shards (fracture = 1) reassemble into the connected
 * organism (uFracture → 0) tied to scroll progress through the pinned diagram —
 * the visitor earns "ecossistemas, não peças soltas" by scrolling. Desktop-only;
 * the unified CSS placeholder is the reduced-motion / mobile / no-WebGL fallback.
 */
export function EcosystemCore({ ariaLabel = "Zirtuno" }: { ariaLabel?: string }) {
  const reduced = useReducedMotion();
  const [stageRef, inView, seen] = useInView<HTMLDivElement>("250px");
  const [enabled, setEnabled] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [ready, setReady] = useState(false);
  const fractureRef = useRef(1); // live uFracture, driven by scroll progress

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

  // Pin the diagram and scrub the converge to scroll progress (1 → 0).
  useEffect(() => {
    if (!enabled) return;
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
        fractureRef.current = 1 - self.progress;
      },
      onLeave: () => {
        fractureRef.current = 0;
      },
      onLeaveBack: () => {
        fractureRef.current = 1;
      },
    });
    // recompute pin offsets once layout/fonts have settled
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 300);
    return () => {
      window.clearTimeout(id);
      st.kill();
    };
  }, [enabled, stageRef]);

  const hideFallback = enabled && ready;

  return (
    <div className="eco-core-stage" data-ecosystem-core ref={stageRef}>
      <WebglPlaceholder
        variant="unified"
        ariaLabel={ariaLabel}
        className={cn("eco-core-fallback", hideFallback && "is-hidden")}
      />
      {enabled && seen && (
        <div className="eco-core-canvas">
          <MetaballScene
            fracture={1}
            fractureRef={fractureRef}
            play={inView}
            onReady={() => setReady(true)}
          />
        </div>
      )}
    </div>
  );
}
