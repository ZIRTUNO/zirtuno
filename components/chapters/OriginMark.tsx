"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { LogoMark } from "@/components/hero/LogoMark";
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
 * S8 Beat 2 — "the mark forms." Reuses the existing fracture→converge metaball
 * (NO new raymarcher): the shards crystallise into the Zirtuno mark when the beat
 * enters view. Lazy-mounted + paused off-screen (strict GPU budget); the static
 * SVG mark is the reduced-motion / mobile / no-WebGL fallback.
 */
export function OriginMark() {
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
    <div className="origin-mark-stage" ref={stageRef} role="img" aria-label="Zirtuno">
      <div
        className={cn("origin-mark-fallback", hideFallback && "is-hidden")}
        aria-hidden="true"
      >
        <LogoMark />
      </div>
      {enabled && seen && (
        <div className="origin-mark-canvas">
          <MetaballScene
            fracture={1}
            converge={inView}
            play={inView}
            onReady={() => setReady(true)}
          />
        </div>
      )}
    </div>
  );
}
