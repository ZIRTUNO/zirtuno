"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { DURATIONS } from "@/lib/animation/durations";
import {
  detectFieldTier,
  setFieldTier,
  type FieldTier,
} from "@/lib/webgl/field-tier";
import {
  makeSiteDriver,
  ecoNodePos,
  ecoNodeEnv,
  clamp01,
  smooth01,
  type SiteInput,
} from "@/lib/webgl/field-drivers";

// the unified liquid field is client-only (WebGL2) → lazy, no SSR.
const FieldStage = dynamic(() => import("@/components/field/FieldStage"), {
  ssr: false,
});

export type EcoNode = { name: string; tooltip: string };

/** The hero's liquid is rendered by the SITE canvas. This context lets the
 *  hero shell (MetaballCanvas) hide its static fallback, forward keyboard
 *  retargets and read the active pillar — without owning a canvas. */
export type HeroLiquid = {
  live: boolean; // the site canvas owns the hero visual
  ready: boolean; // the hero form has painted (hide the fallback)
  active: number; // -1 = mark, 0-6 = pillars
  setManual: (n: number | null) => void;
  registerStage: (el: HTMLElement | null) => void;
};
export const HeroLiquidContext = createContext<HeroLiquid | null>(null);

// choreography of the eco runway progress pr ∈ [0,1]:
const CONV_END = 0.5; // converge completes at half the runway
const GROW_START = 0.46;
const GROW_SPAN = 0.38;
// within each service gap: rest, then melt across the middle window
const MELT_LO = 0.35;
const MELT_HI = 0.65;

/**
 * LiquidSite — ONE persistent fluid renderer for the whole Hero → Problem →
 * Ecosystem → Services sequence. A single sticky full-viewport canvas stays
 * mounted under all four chapters, so the liquid has NO interior edge and is
 * never scrolled away as a block; one rAF measurement loop reads the layout
 * (the hero stage box, the symptom shards, the eco runway, the services
 * headline, the pillars) plus the scroll velocity, and writes the site
 * driver's control channels; the driver damps every channel AND every droplet
 * individually. No GSAP pins, no per-chapter canvases, no handoffs — one
 * liquid from the hero's resting mark to the last service melt.
 *
 * The ecosystem labels live HERE (in the sticky layer), anchored to the same
 * ECO_NODES math the tendril beads use, and only enter after the organism has
 * resolved. Deterministic layering: canvas z-0 (pointer-events none), copy
 * z-10. Reduced-motion / "none" tier / hero QA stills render no canvas and
 * flag the wrapper `data-liquid="static"` so the chapters' static fallbacks
 * (and the hero's own QA renderers) show instead.
 *
 * QA: ?feco=c freezes the S4 choreography at c ∈ [0,1]; ?fcycle=1 shortens
 * the hero dwell; ?fstate/?fpair/?fcursor/?fflat switch the hero to its
 * deterministic standalone renderers (site canvas off).
 */
export function LiquidSite({
  nodes,
  centerLabel,
  ecosystemLabel,
  children,
}: {
  nodes: EcoNode[];
  centerLabel: string;
  ecosystemLabel: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const [wrapRef, inView, seen] = useInView<HTMLDivElement>("400px");
  const layerRef = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState<FieldTier | null>(null);
  const [fEco, setFEco] = useState<number | null>(null);
  const [heroQA, setHeroQA] = useState(false);
  const [heroReady, setHeroReady] = useState(false);
  const [heroActive, setHeroActive] = useState(-1);
  const nodeEls = useRef<(HTMLLIElement | null)[]>([]);
  const centerEl = useRef<HTMLSpanElement>(null);
  const stageEl = useRef<HTMLElement | null>(null);
  const inViewRef = useRef(true);
  useEffect(() => {
    inViewRef.current = inView;
  }, [inView]);

  const [driver, input] = useMemo(() => {
    const inp: SiteInput = {
      heroPhase: 0,
      vel: 0,
      fracture: 0,
      travel: 0,
      converge: 0,
      grow: 0,
      svcPos: 0,
      pair: [0, 0, 0],
      exit: 0,
      hero: {
        play: true,
        hover: false,
        manual: null,
        dwellMs: DURATIONS.autocycle,
        px: 0.5,
        py: 0.5,
        cursorOn: false,
        ox: 0,
        oy: 0,
        scale: 0.5,
      },
    };
    // setHeroActive is a stable useState setter — safe to close over here
    return [makeSiteDriver(inp, { onHeroActive: setHeroActive }), inp] as const;
  }, []);

  useEffect(() => {
    setTier(detectFieldTier());
    const sp = new URLSearchParams(window.location.search);
    const fc = sp.get("feco");
    if (fc !== null) {
      const c = Number(fc);
      if (Number.isFinite(c) && c >= 0 && c <= 1) setFEco(c);
    }
    if (sp.get("fcycle") === "1") input.hero.dwellMs = 2000;
    // hero QA stills mount their own deterministic renderers — the site canvas
    // must not double-render the hero underneath them
    setHeroQA(
      ["fstate", "fpair", "fcursor", "fflat"].some((k) => sp.get(k) !== null),
    );
  }, [input]);

  // QA visibility: the site fluid's live channel values (read-only diagnostics)
  useEffect(() => {
    (window as unknown as { __liquid?: SiteInput }).__liquid = input;
  }, [input]);

  const enabled =
    !reduced && !heroQA && (tier === "full" || tier === "lite");

  const setManual = useCallback(
    (n: number | null) => {
      input.hero.manual = n;
    },
    [input],
  );
  const registerStage = useCallback((el: HTMLElement | null) => {
    stageEl.current = el;
  }, []);
  const heroCtx = useMemo<HeroLiquid>(
    () => ({
      live: enabled,
      ready: heroReady,
      active: heroActive,
      setManual,
      registerStage,
    }),
    [enabled, heroReady, heroActive, setManual, registerStage],
  );

  // label geometry: the same ECO_NODES math as the tendril beads
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const layout = () => {
      const r = layer.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const aspect = r.width / r.height;
      nodeEls.current.forEach((el, i) => {
        if (!el) return;
        const p = ecoNodePos(i, aspect);
        el.style.left = `${(((p.x - 0.5) / aspect + 0.5) * 100).toFixed(2)}%`;
        el.style.top = `${((1 - p.y) * 100).toFixed(2)}%`;
      });
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(layer);
    return () => ro.disconnect();
  }, [nodes.length]);

  // ── the ONE measurement loop (channels + labels + hero staging + velocity) ──
  useEffect(() => {
    if (tier === null) return; // wait for the tier probe (static path included)
    const wrap = wrapRef.current;
    if (!wrap) return;

    let lastG = -1;
    let lastS = -1;
    const applyLabels = (grow: number, svcPos: number) => {
      if (Math.abs(grow - lastG) < 0.002 && Math.abs(svcPos - lastS) < 0.002)
        return;
      lastG = grow;
      lastS = svcPos;
      const fade = 1 - smooth01(svcPos);
      nodeEls.current.forEach((el, i) => {
        if (!el) return;
        const e = ecoNodeEnv(grow, i) * fade;
        el.style.opacity = String(e);
        el.style.transform = `translate(-50%, -50%) translateY(${((1 - e) * 10).toFixed(1)}px)`;
      });
      if (centerEl.current)
        centerEl.current.style.opacity = String(
          smooth01((grow - 0.1) / 0.35) * fade,
        );
    };

    // static paths / deterministic QA hold
    if (!enabled || fEco !== null) {
      const c = fEco ?? 1;
      input.heroPhase = 1;
      input.vel = 0;
      input.fracture = 1;
      input.travel = 1;
      input.converge = clamp01(c / CONV_END);
      input.grow = clamp01((c - GROW_START) / GROW_SPAN);
      input.svcPos = 0;
      input.pair = [0, 0, 0];
      input.exit = 0;
      applyLabels(input.grow, 0);
      return;
    }

    const centersOf = (els: HTMLElement[]) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2;
      });
    const coordAt = (cy: number, centers: number[]) => {
      if (centers.length < 2) return 0;
      if (cy <= centers[0]) return 0;
      if (cy >= centers[centers.length - 1]) return centers.length - 1;
      let k = 0;
      while (k < centers.length - 2 && centers[k + 1] <= cy) k++;
      return k + (cy - centers[k]) / Math.max(centers[k + 1] - centers[k], 1);
    };

    const heroSec = document.getElementById("hero");
    const symptoms = Array.from(
      wrap.querySelectorAll<HTMLElement>("#problem .symptom"),
    );
    const runway = wrap.querySelector<HTMLElement>("[data-organism]");
    const services = wrap.querySelector<HTMLElement>("#services");
    const pillars = Array.from(
      wrap.querySelectorAll<HTMLElement>("#services .pillar"),
    );

    // gooey cursor + autocycle hover-pause: the WHOLE hero section is the
    // pointer surface now (the liquid has no interior edge to clip against)
    const canHover =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const toFieldUv = (e: PointerEvent) => {
      const md = Math.min(window.innerWidth, window.innerHeight);
      input.hero.px = 0.5 + (e.clientX - window.innerWidth / 2) / md;
      input.hero.py = 0.5 - (e.clientY - window.innerHeight / 2) / md;
    };
    const onEnter = (e: PointerEvent) => {
      input.hero.hover = true;
      toFieldUv(e);
      input.hero.cursorOn = true;
    };
    const onMove = (e: PointerEvent) => {
      toFieldUv(e);
      input.hero.cursorOn = true;
    };
    const onLeave = () => {
      input.hero.hover = false;
      input.hero.cursorOn = false;
    };
    if (canHover && heroSec) {
      heroSec.addEventListener("pointerenter", onEnter);
      heroSec.addEventListener("pointermove", onMove);
      heroSec.addEventListener("pointerleave", onLeave);
    }

    let raf = 0;
    let lastY = window.scrollY;
    let lastNow = performance.now();
    const update = () => {
      raf = requestAnimationFrame(update);
      const now = performance.now();
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const md = Math.min(vw, vh);
      const cy = vh * 0.5;

      // scroll velocity (viewport-heights/s) — the stir
      const dts = Math.max((now - lastNow) / 1000, 1e-3);
      const y = window.scrollY;
      input.vel = dts > 0.25 ? 0 : (y - lastY) / dts / vh; // long gaps = idle
      lastY = y;
      lastNow = now;

      input.hero.play = inViewRef.current;

      // hero staging: the liquid form sits exactly over the stage box and
      // rides with it — while the POUR sheds its droplets into the fixed field
      const st = stageEl.current;
      if (st) {
        const r = st.getBoundingClientRect();
        input.hero.ox = (r.left + r.width / 2 - vw / 2) / md;
        input.hero.oy = (vh / 2 - (r.top + r.height / 2)) / md;
        input.hero.scale = Math.min(r.width, r.height) / md;
      }
      if (heroSec) {
        const hr = heroSec.getBoundingClientRect();
        input.heroPhase = clamp01(-hr.top / (hr.height * 0.72));
      }

      // S3 — the fracture, one notch per symptom shard
      if (symptoms.length >= 2) {
        const u = coordAt(cy, centersOf(symptoms));
        const kk = Math.floor(u);
        const frac = u - kk;
        const stepped = kk + smooth01((frac - 0.25) / 0.5); // hold on each shard
        input.fracture = clamp01(stepped / (symptoms.length - 1));
      }

      // S3 → S4 travel + the eco runway (converge → tendrils)
      if (runway) {
        const r = runway.getBoundingClientRect();
        input.travel = clamp01((vh - r.top) / (vh * 0.9));
        const pr = clamp01(-r.top / Math.max(r.height - vh, 1));
        input.converge = clamp01(pr / CONV_END);
        input.grow = clamp01((pr - GROW_START) / GROW_SPAN);
      }

      // S4 → S5: the organism clears the services HEADLINE (drift + scale
      // start as the section approaches, not when the first pillar arrives)
      if (services) {
        const sr = services.getBoundingClientRect();
        input.svcPos = clamp01((vh * 0.92 - sr.top) / (vh * 0.85));
      }
      if (pillars.length >= 2 && input.svcPos > 0.02) {
        // virtual pre-pillar centre gives the organism → pillar-1 melt a runway
        const centers = centersOf(pillars);
        const virtual = centers[0] - vh * 0.85;
        const uu = coordAt(cy, [virtual, ...centers]) - 1; // ∈ [-1, n-1]
        const idx = Math.floor(uu);
        const frac = uu - idx;
        const m =
          frac <= MELT_LO
            ? 0
            : frac >= MELT_HI
              ? 1
              : (frac - MELT_LO) / (MELT_HI - MELT_LO);
        const A = Math.max(idx + 1, 0);
        const B = Math.min(idx + 2, 7);
        input.pair = [A, B, m];
      } else {
        input.pair = [0, 0, 0];
      }

      // S5 → S6: the liquid settles away BEFORE the sticky layer unsticks, so
      // the unstick never drags visible liquid off-screen. The window is the
      // services CTA zone only — the last pillar keeps its liquid while read.
      const wr = wrap.getBoundingClientRect();
      input.exit = clamp01(1 - (wr.bottom - vh) / (vh * 0.35));

      applyLabels(input.grow, input.svcPos);
    };
    update();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (canHover && heroSec) {
        heroSec.removeEventListener("pointerenter", onEnter);
        heroSec.removeEventListener("pointermove", onMove);
        heroSec.removeEventListener("pointerleave", onLeave);
      }
    };
  }, [enabled, tier, fEco, input, wrapRef]);

  return (
    <HeroLiquidContext.Provider value={heroCtx}>
      <div
        ref={wrapRef}
        className="liquid-journey"
        data-liquid={enabled ? "live" : "static"}
      >
        <div className="journey-layer" ref={layerRef}>
          {enabled && seen && (
            <div className="journey-canvas" aria-hidden="true">
              <FieldStage
                driver={driver}
                play={inView}
                tier={tier === "lite" ? "lite" : "full"}
                onReady={() => setHeroReady(true)}
                onContextLost={() => setHeroReady(false)}
                onTierChange={setFieldTier}
              />
            </div>
          )}
          <span className="organism-center" ref={centerEl}>
            {centerLabel}
          </span>
          <ul className="organism-nodes" aria-label={ecosystemLabel}>
            {nodes.map((n, i) => (
              <li
                key={n.name}
                className="organism-node"
                ref={(el) => {
                  nodeEls.current[i] = el;
                }}
              >
                <span className="organism-node-name">{n.name}</span>
                <span className="organism-node-cap">{n.tooltip}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="journey-content">{children}</div>
      </div>
    </HeroLiquidContext.Provider>
  );
}
