"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { glassTech, type GlassTech } from "@/lib/webgl/gpu-tier";
import { LogoMark } from "@/components/hero/LogoMark";
import { PillarIndicator } from "@/components/hero/PillarIndicator";
import { cn } from "@/lib/utils";

// three.js is client-only and heavy → load the scene lazily, no SSR.
const MetaballScene = dynamic(() => import("@/components/hero/MetaballScene"), {
  ssr: false,
});
const MeshMetaballScene = dynamic(
  () => import("@/components/hero/MeshMetaballScene"),
  { ssr: false },
);

/**
 * S5 · Services metaball — the sticky glass that morphs to each pillar's locked
 * form as that pillar scrolls through the viewport centre (reuses MetaballScene's
 * `manualState` → connected liquid morph). Drives the PillarIndicator. Reads the
 * RSC pillar articles via their `data-pillar` index (copy stays server-rendered).
 * Desktop-only; the unified CSS placeholder is the reduced-motion / mobile / no-
 * WebGL fallback. Pauses off-screen.
 */
export function ServicesMetaball({ ariaLabel = "Zirtuno" }: { ariaLabel?: string }) {
  const reduced = useReducedMotion();
  const [stageRef, inView, seen] = useInView<HTMLDivElement>("250px");
  const [enabled, setEnabled] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [tech, setTech] = useState<GlassTech>("none");
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(0); // active pillar index 0-6

  useEffect(() => {
    setTech(glassTech());
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px) and (pointer: fine)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setEnabled(!reduced && desktop && tech !== "none");
  }, [reduced, desktop, tech]);

  // Active pillar = whichever article is crossing the viewport centre band.
  useEffect(() => {
    if (!enabled) return;
    const section = stageRef.current?.closest("section");
    if (!section) return;
    const items = section.querySelectorAll<HTMLElement>("[data-pillar]");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const i = Number(e.target.getAttribute("data-pillar"));
            if (!Number.isNaN(i)) setActive(i);
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    items.forEach((it) => io.observe(it));
    return () => io.disconnect();
  }, [enabled, stageRef]);

  const hideFallback = enabled && ready;

  return (
    <div className="services-metaball" ref={stageRef}>
      <div className="services-metaball-stage" role="img" aria-label={ariaLabel}>
        <LogoMark
          className={cn("services-metaball-fallback", hideFallback && "is-hidden")}
        />
        {enabled && seen && (
          <div className="services-metaball-canvas">
            {tech === "mesh" ? (
              <MeshMetaballScene
                manualState={active + 1}
                play={inView}
                onReady={() => setReady(true)}
              />
            ) : (
              <MetaballScene
                manualState={active + 1}
                play={inView}
                onReady={() => setReady(true)}
              />
            )}
          </div>
        )}
      </div>
      <PillarIndicator active={active} />
    </div>
  );
}
