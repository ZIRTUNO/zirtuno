"use client";

import { useCallback, useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { canRunGlass } from "@/lib/webgl/can-run-glass";
import { STATE_COUNT } from "@/lib/webgl/states";
import { LogoMark } from "./LogoMark";
import { PillarIndicator } from "./PillarIndicator";
import { PerfOverlay } from "./PerfOverlay";

// three.js is client-only and heavy → load the scene lazily, no SSR.
const MetaballScene = dynamic(() => import("./MetaballScene"), { ssr: false });

const STATES = STATE_COUNT; // 0 = mark, 1-7 = the service pillars (lib/webgl/states)

// WebGL + GPU-capability gate — weak GPUs (Intel HD/UHD, software) fall back to
// the static mark to avoid hanging the browser; see lib/webgl/can-run-glass.
function supportsWebGL(): boolean {
  return canRunGlass();
}

/**
 * Hero metaball (S2.3). Raymarched glass mark that breathes, auto-cycles the
 * seven pillar states, and leans toward the pointer (hover physics). The static
 * SVG mark is the base layer (ships server-side, stays for reduced-motion /
 * no-WebGL, crossfades out once the glass paints). When focused, arrow keys step
 * the pillars (auto-cycle pauses) and the change is announced politely; the
 * PillarIndicator tracks the active state. `?capture=` / `?state=N` freeze a
 * phase for the screenshot pipeline.
 */
export function MetaballCanvas({ pillarNames }: { pillarNames: string[] }) {
  const reduced = useReducedMotion();
  const [stageRef, heroInView] = useInView<HTMLDivElement>("150px"); // pause off-screen
  const [enabled, setEnabled] = useState(false);
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
    // Glass is desktop-only — too heavy for low-end/mobile, which keep the static
    // SVG mark. Capture / preview / pair force it on for deterministic stills.
    setEnabled(
      (!!capture || preview !== null || pair !== null || (!reduced && desktop)) &&
        supportsWebGL(),
    );
  }, [reduced, desktop, capture, preview, pair]);

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
          <div className="metaball-canvas">
            <MetaballScene
              capture={capture}
              previewState={preview}
              manualState={manual}
              morphPair={pair}
              play={heroInView || capture !== null || preview !== null || pair !== null}
              onReady={() => setReady(true)}
              onActiveChange={setActive}
            />
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
