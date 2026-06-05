"use client";

import { useCallback, useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { glassTech, type GlassTech } from "@/lib/webgl/gpu-tier";
import { STATE_COUNT } from "@/lib/webgl/states";
import { LogoMark } from "./LogoMark";
import { PillarIndicator } from "./PillarIndicator";
import { PerfOverlay } from "./PerfOverlay";

// three.js is client-only and heavy → load both scenes lazily, no SSR.
const MetaballScene = dynamic(() => import("./MetaballScene"), { ssr: false });
const MeshMetaballScene = dynamic(() => import("./MeshMetaballScene"), { ssr: false });

const STATES = STATE_COUNT; // 0 = mark, 1-7 = the service pillars (lib/webgl/states)

/**
 * Hero metaball (S2.3). Two glass techniques, chosen per GPU (lib/webgl/gpu-tier):
 * capable/discrete GPUs get the RAYMARCHED glass (MetaballScene); integrated /
 * mobile GPUs get the lighter morph-target MESH glass (MeshMetaballScene), which
 * rasterises a mesh + a matcap lookup at 60fps with no per-pixel loop (so it can't
 * TDR-freeze a weak GPU); software / no-WebGL keeps the static SVG mark. Both live
 * paths breathe, auto-cycle the seven pillar states, lean toward the pointer, and
 * honour arrow-key stepping (auto-cycle pauses, change announced; the
 * PillarIndicator tracks the active state). `?capture=` / `?state=N` / `?pair=`
 * freeze phases for the screenshot pipeline; `?glass=mesh` forces the mesh tech.
 */
export function MetaballCanvas({ pillarNames }: { pillarNames: string[] }) {
  const reduced = useReducedMotion();
  const [stageRef, heroInView] = useInView<HTMLDivElement>("150px"); // pause off-screen
  const [enabled, setEnabled] = useState(false);
  const [tech, setTech] = useState<GlassTech>("none");
  const [desktop, setDesktop] = useState(false);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(-1); // pillar index: -1 = mark, 0-6 = pillars
  const [capture, setCapture] = useState<"rest" | "breath" | "morph" | "ai" | null>(
    null,
  );
  const [preview, setPreview] = useState<number | null>(null);
  const [pair, setPair] = useState<[number, number, number] | null>(null); // QA still: A→B at morph m
  const [manual, setManual] = useState<number | null>(null); // state index 0-7, or null = auto

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const c = sp.get("capture");
    setCapture(
      c === "rest" || c === "breath" || c === "morph" || c === "ai" ? c : null,
    );
    const s = sp.get("state"); // ?state=N → preview a single static form
    setPreview(s !== null && /^[0-7]$/.test(s) ? Number(s) : null);
    const pr = sp.get("pair"); // ?pair=a-b-m → freeze the A→B morph at m (QA)
    if (pr && /^[0-7]-[0-7]-(0(\.\d+)?|1(\.0+)?)$/.test(pr)) {
      const [a, b, m] = pr.split("-").map(Number);
      setPair([a, b, m]);
    }
    setTech(glassTech()); // raymarch (capable) · mesh (integrated/mobile) · none (software)
  }, []);

  // Track the desktop breakpoint reactively, so the glass upgrades if the viewport
  // crosses 768px / gains a fine pointer after mount (never latch a mount-time value).
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px) and (pointer: fine)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    // Deterministic stills force the scene on. Live: the raymarch is desktop-only
    // (heavy); the mesh is light enough to also run on mobile. Never on a "none"
    // tier (software / no WebGL → static SVG) or under reduced-motion.
    const forced = !!capture || preview !== null || pair !== null;
    const live = !reduced && (desktop || tech === "mesh");
    setEnabled((forced || live) && tech !== "none");
  }, [reduced, desktop, capture, preview, pair, tech]);

  // keyboard control is live-only (off during deterministic captures/previews)
  const interactive =
    enabled && capture === null && preview === null && pair === null;

  const step = useCallback(
    (delta: number) =>
      setManual((m) => {
        const base = m != null ? m : active >= 0 ? active + 1 : 0;
        return (base + delta + STATES) % STATES;
      }),
    [active],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          step(1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          step(-1);
          break;
        case "Home":
          e.preventDefault();
          setManual(0);
          break;
        case "End":
          e.preventDefault();
          setManual(STATES - 1);
          break;
        default:
          break;
      }
    },
    [step],
  );

  const hideFallback =
    enabled && (ready || !!capture || preview !== null || pair !== null);

  // announced only while the user is stepping manually (auto-cycle stays quiet)
  const liveText =
    manual == null ? "" : manual === 0 ? "Zirtuno" : (pillarNames[manual - 1] ?? "");

  const play = heroInView || capture !== null || preview !== null || pair !== null;
  const sceneProps = {
    capture,
    previewState: preview,
    manualState: manual,
    morphPair: pair,
    play,
    onReady: () => setReady(true),
    onActiveChange: setActive,
  };

  return (
    <>
      <div
        ref={stageRef}
        className="metaball-stage"
        data-hero-metaball
        role="img"
        aria-label="Zirtuno"
        tabIndex={interactive ? 0 : undefined}
        aria-keyshortcuts={interactive ? "ArrowRight ArrowLeft Home End" : undefined}
        onKeyDown={interactive ? onKeyDown : undefined}
        onBlur={interactive ? () => setManual(null) : undefined}
      >
        <LogoMark
          className="metaball-fallback"
          style={{ opacity: hideFallback ? 0 : 1 }}
        />
        {enabled && (
          <div className="metaball-canvas" data-glass-tech={tech}>
            {tech === "mesh" ? (
              <MeshMetaballScene {...sceneProps} />
            ) : (
              <MetaballScene {...sceneProps} />
            )}
          </div>
        )}
      </div>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {liveText}
      </span>
      <PillarIndicator active={active} />
      <PerfOverlay />
    </>
  );
}
