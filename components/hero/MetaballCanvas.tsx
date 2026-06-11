"use client";

import { useCallback, useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { detectFieldTier, setFieldTier, type FieldTier } from "@/lib/webgl/field-tier";
import { STATE_COUNT } from "@/lib/webgl/states";
import { LogoMark } from "./LogoMark";
import { PillarIndicator } from "./PillarIndicator";
import { PerfOverlay } from "./PerfOverlay";

// The FIELD hero (metaball-morph-spec v1.2–v1.4, default since R0):
//   FieldMorphHero  = the live hero — SDF-glass rest + metaball melt morphs,
//                     autocycle / hover / keyboard.
//   SdfGlassField   = a single static SDF-glass form (reduced-motion rest +
//                     ?fstate=N stills).
//   MetaballField   = the bare metaball layer (?fflat=1 debug).
// All client-only (WebGL2) → lazy, no SSR. The legacy raymarch/mesh scenes no
// longer mount here (other chapters still use them until R1 deletes them).
const FieldMorphHero = dynamic(() => import("./FieldMorphHero"), { ssr: false });
const SdfGlassField = dynamic(() => import("./SdfGlassField"), { ssr: false });
const MetaballField = dynamic(() => import("./MetaballField"), { ssr: false });

const STATES = STATE_COUNT; // 0 = mark, 1-7 = the service pillars (lib/webgl/states)

/**
 * Hero metaball (S2.3) — the field system, tiered by a runtime probe
 * (lib/webgl/field-tier, morph-spec §7): "full" = liquid glass, "lite" =
 * flat-cyan melts at a smaller buffer, "none" = the static SVG mark. An FPS
 * watchdog inside FieldMorphHero downshifts at runtime instead of freezing.
 *
 * Reduced motion rests on the static SDF-glass mark (no autocycle). Keyboard
 * (←/→/Home/End) steps the pillars with aria-live announcements; the
 * PillarIndicator tracks the active state; the autocycle pauses off-screen.
 *
 * QA params: ?fstate=N (one rest form) · ?fpair=a-b-m (one frozen melt frame) ·
 * ?fcycle=1 (short dwell) · ?fflat=1 (bare flat field) · ?ftier=full|lite|none.
 */
export function MetaballCanvas({ pillarNames }: { pillarNames: string[] }) {
  const reduced = useReducedMotion();
  const [stageRef, heroInView] = useInView<HTMLDivElement>("150px"); // pause off-screen
  const [tier, setTier] = useState<FieldTier | null>(null); // null until probed
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(-1); // pillar index: -1 = mark, 0-6 = pillars
  const [manual, setManual] = useState<number | null>(null); // state index 0-7, or null = auto
  const [fState, setFState] = useState<number | null>(null); // ?fstate=N → static SDF-glass still
  const [fPair, setFPair] = useState<[number, number, number] | null>(null); // ?fpair=a-b-m
  const [fastCycle, setFastCycle] = useState(false); // ?fcycle=1 → short dwell (QA)
  const [fFlat, setFFlat] = useState(false); // ?fflat=1 → bare flat field (QA)

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const fs = sp.get("fstate"); // a single static SDF-glass form
    setFState(fs !== null && /^[0-7]$/.test(fs) ? Number(fs) : null);
    const fp = sp.get("fpair"); // freeze the A→B melt at m (QA)
    if (fp && /^[0-7]-[0-7]-(0(\.\d+)?|1(\.0+)?)$/.test(fp)) {
      const [a, b, m] = fp.split("-").map(Number);
      setFPair([a, b, m]);
    }
    setFastCycle(sp.get("fcycle") === "1");
    setFFlat(sp.get("fflat") === "1");
    // probe-first tier selection (once per session; ?ftier= overrides)
    setTier(detectFieldTier());
  }, []);

  // Deterministic QA stills force a mount; otherwise the probe decides. "none"
  // (no WebGL2 / hopeless frame times) keeps the static SVG mark — never mounts
  // a per-frame canvas it can't afford.
  const deterministic = fState !== null || fPair !== null || fFlat;
  const enabled = deterministic || tier === "full" || tier === "lite";

  // The LIVE morphing hero (vs. a still / debug layer / reduced-motion rest).
  const live = enabled && !deterministic && !reduced;

  // keyboard control only when the live hero can respond to it — never
  // advertise inert shortcuts to assistive tech.
  const interactive = live;

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

  const hideFallback = enabled && ready;

  // announced only while the user is stepping manually (auto-cycle stays quiet)
  const liveText =
    manual == null ? "" : manual === 0 ? "Zirtuno" : (pillarNames[manual - 1] ?? "");

  const play = heroInView || deterministic;
  const sharedProps = {
    onReady: () => setReady(true),
    onContextLost: () => setReady(false),
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
          <div className="metaball-canvas" data-glass-tech={tier ?? "none"}>
            {fFlat ? (
              <MetaballField {...sharedProps} glass={false} />
            ) : fPair !== null || fState !== null ? (
              // deterministic stills: a frozen melt frame (?fpair) or a frozen
              // REST form (?fstate=N → the metaball cloud at rest, m=1) — the
              // fidelity-iteration tool against the reference SVGs
              <FieldMorphHero
                {...sharedProps}
                frozenPair={fPair ?? [fState!, fState!, 1]}
              />
            ) : reduced ? (
              // reduced motion: a static crisp mark (AGENTS rule 7) — the only
              // place the SVG-glass renderer remains in the hero
              <SdfGlassField
                {...sharedProps}
                svgUrl="/brand/zirtuno-logo-mark.svg"
                breathing={false}
              />
            ) : (
              <FieldMorphHero
                {...sharedProps}
                play={play}
                manualState={manual}
                tier={tier === "lite" ? "lite" : "full"}
                onTierChange={setFieldTier}
                dwellMs={fastCycle ? 2000 : undefined}
                onActiveChange={setActive}
              />
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
