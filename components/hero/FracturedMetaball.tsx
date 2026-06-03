"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { canRunGlass } from "@/lib/webgl/can-run-glass";
import { LogoMark } from "@/components/hero/LogoMark";
import { cn } from "@/lib/utils";

// three.js is client-only and heavy → load the scene lazily, no SSR.
const MetaballScene = dynamic(() => import("./MetaballScene"), { ssr: false });

function supportsWebGL(): boolean {
  return canRunGlass();
}

/**
 * S3.2 · The Problem — the mark fractured into disconnected glass shards (reuses
 * the hero glass via MetaballScene's `fracture`). Desktop-only; the static CSS
 * placeholder is the base layer and the reduced-motion / no-WebGL / mobile
 * fallback (it stays for the accessible name, fading out once the glass paints).
 * S4 will animate the same field from dispersed → connected (the converge).
 */
export function FracturedMetaball({ ariaLabel = "Zirtuno" }: { ariaLabel?: string }) {
  const reduced = useReducedMotion();
  const [stageRef, inView, seen] = useInView<HTMLDivElement>("250px");
  const [enabled, setEnabled] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [ready, setReady] = useState(false);

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
          <MetaballScene
            fracture={0.9}
            play={inView}
            onReady={() => setReady(true)}
          />
        </div>
      )}
    </div>
  );
}
