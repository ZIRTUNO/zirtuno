"use client";

import { useCallback, useContext, useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { detectFieldTier, type FieldTier } from "@/lib/webgl/field-tier";
import { STATE_COUNT } from "@/lib/webgl/symbols";
import { HeroLiquidContext } from "@/components/field/hero-liquid-context";
import { LogoMark } from "./LogoMark";
import { PillarIndicator } from "./PillarIndicator";
import { PerfOverlay } from "./PerfOverlay";

// The live hero is rendered by the PAGE fluid (components/field/PageStage —
// one persistent conductor canvas, so the liquid has no interior edge and
// never scrolls away as a block). What remains here:
//   FieldMorphHero  = the deterministic frozen QA stills (?fstate/?fpair/?fcursor).
//   SdfGlassField   = the reduced-motion static glass mark.
//   MetaballField   = the bare metaball layer (?fflat=1 debug).
// All client-only (WebGL2) → lazy, no SSR.
const FieldMorphHero = dynamic(() => import("./FieldMorphHero"), { ssr: false });
const SdfGlassField = dynamic(() => import("./SdfGlassField"), { ssr: false });
const MetaballField = dynamic(() => import("./MetaballField"), { ssr: false });

const STATES = STATE_COUNT; // 0 = mark, 1-7 = the service pillars (lib/webgl/symbols)

/**
 * Hero metaball shell (S2.3) — the STAGE: layout box, static fallback, a11y
 * (keyboard steps + aria-live), pillar indicator and the QA still renderers.
 * The living liquid itself is the hero segment of the page fluid; this shell
 * registers its box with PageStage (the form is staged exactly over it) and
 * forwards keyboard retargets through HeroLiquidContext.
 *
 * QA params: ?fstate=N (one rest form) · ?fpair=a-b-m (one frozen bridge frame)
 * · ?fcursor=x,y (a merged cursor droplet on the still) · ?fflat=1 (bare flat
 * field) · ?fcycle=1 (short dwell — handled by PageStage) · ?ftier=….
 */
export function MetaballCanvas({ pillarNames }: { pillarNames: string[] }) {
  const reduced = useReducedMotion();
  const hero = useContext(HeroLiquidContext);
  const [tier, setTier] = useState<FieldTier | null>(null); // null until probed
  const [ready, setReady] = useState(false); // QA-still readiness
  const [manual, setManual] = useState<number | null>(null); // 0-7, null = auto
  const [fState, setFState] = useState<number | null>(null); // ?fstate=N
  const [fPair, setFPair] = useState<[number, number, number] | null>(null); // ?fpair=a-b-m
  const [fCursor, setFCursor] = useState<[number, number] | null>(null); // ?fcursor=x,y
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
    // ?fcursor=x,y — freeze a merged cursor droplet at (x, y), page coords 0..1
    const fc = sp.get("fcursor")?.match(/^(\d*\.?\d+),(\d*\.?\d+)$/);
    if (fc) {
      const x = Number(fc[1]), y = Number(fc[2]);
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) setFCursor([x, y]);
    }
    setFFlat(sp.get("fflat") === "1");
    setTier(detectFieldTier());
  }, []);

  const deterministic =
    fState !== null || fPair !== null || fCursor !== null || fFlat;

  // the site fluid renders the live hero; this shell only mounts a canvas for
  // the deterministic QA stills and the reduced-motion static glass
  const siteLive = !!hero?.live && !deterministic;
  const ownCanvas =
    !siteLive && (deterministic || (reduced && (tier === "full" || tier === "lite")));

  const active = hero?.active ?? -1;

  // keyboard control only when the live hero can respond to it — never
  // advertise inert shortcuts to assistive tech.
  const interactive = siteLive && !reduced;

  const retarget = useCallback(
    (n: number | null) => {
      setManual(n);
      hero?.setManual(n);
    },
    [hero],
  );
  const step = useCallback(
    (delta: number) =>
      setManual((m) => {
        const base = m != null ? m : active >= 0 ? active + 1 : 0;
        const next = (base + delta + STATES) % STATES;
        hero?.setManual(next);
        return next;
      }),
    [active, hero],
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
          retarget(0);
          break;
        case "End":
          e.preventDefault();
          retarget(STATES - 1);
          break;
        default:
          break;
      }
    },
    [step, retarget],
  );

  const hideFallback = siteLive ? !!hero?.ready : ownCanvas && ready;

  // announced only while the user is stepping manually (auto-cycle stays quiet)
  const liveText =
    manual == null ? "" : manual === 0 ? "Zirtuno" : (pillarNames[manual - 1] ?? "");

  const sharedProps = {
    onReady: () => setReady(true),
    onContextLost: () => setReady(false),
  };

  return (
    <>
      <div
        ref={(el) => hero?.registerStage(el)}
        className="metaball-stage"
        data-hero-metaball
        role="img"
        aria-label="Zirtuno"
        tabIndex={interactive ? 0 : undefined}
        aria-keyshortcuts={interactive ? "ArrowRight ArrowLeft Home End" : undefined}
        onKeyDown={interactive ? onKeyDown : undefined}
        onBlur={interactive ? () => retarget(null) : undefined}
      >
        <LogoMark
          className="metaball-fallback"
          style={{ opacity: hideFallback ? 0 : 1 }}
        />
        {ownCanvas && (
          <div className="metaball-canvas" data-glass-tech={tier ?? "none"}>
            {fFlat ? (
              <MetaballField {...sharedProps} glass={false} />
            ) : deterministic ? (
              // deterministic stills: a frozen bridge frame (?fpair), a frozen
              // zero-warp EXACT rest form (?fstate=N), and/or a merged cursor
              // droplet (?fcursor=x,y) — the QA tools for fidelity + the goo
              <FieldMorphHero
                {...sharedProps}
                frozenPair={fPair ?? [fState ?? 0, fState ?? 0, 1]}
                frozenCursor={fCursor}
              />
            ) : (
              // reduced motion: a static crisp mark (AGENTS rule 7)
              <SdfGlassField
                {...sharedProps}
                svgUrl="/brand/zirtuno-logo-mark.svg"
                breathing={false}
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
