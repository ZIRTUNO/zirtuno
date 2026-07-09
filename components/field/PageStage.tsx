"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import {
  detectFieldTier,
  setFieldTier,
  type FieldTier,
} from "@/lib/webgl/field-tier";
import {
  ecoNodePos,
  ecoNodeEnv,
  clamp01,
  smooth01,
} from "@/lib/webgl/field-drivers";
import { makeConductor } from "@/lib/webgl/conductor.mjs";
import type { SceneChannels, SceneGeom } from "@/lib/webgl/scenes/types";
import {
  makeSiteScene,
  CONV_END,
  GROW_START,
  GROW_SPAN,
} from "@/lib/webgl/scenes/site";
import { HeroLiquidContext, type HeroLiquid } from "./hero-liquid-context";

// the unified liquid field is client-only (WebGL2) → lazy, no SSR.
const FieldStage = dynamic(() => import("@/components/field/FieldStage"), {
  ssr: false,
});

export type EcoNode = { name: string; tooltip: string };

/**
 * PageStage (R5-A) — the CONDUCTOR's shell: ONE persistent fluid renderer, one
 * sticky full-viewport canvas, one rAF measurement loop for the whole page.
 * Scenes (lib/webgl/scenes/*) translate measured geometry into channels; the
 * conductor damps them, blends per-droplet targets across scene handoffs,
 * arbitrates the two form slots and packs the one shared field. No GSAP pins,
 * no per-chapter canvases, no handoffs-as-swaps — one liquid, one identity.
 *
 * Phase A wraps Hero → Problem → Ecosystem → Services (the LiquidSite span);
 * A3 extends the wrap to every chapter + the footer edge.
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
 * deterministic standalone renderers (page canvas off). window.__liquid
 * exposes the site scene's raw channels.
 */
export function PageStage({
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

  const [conductor, scene] = useMemo(() => {
    // setHeroActive is a stable useState setter — safe to close over here
    const sc = makeSiteScene({ onHeroActive: setHeroActive });
    return [makeConductor([sc]), sc] as const;
  }, []);
  const site = conductor.raw.site;

  useEffect(() => {
    setTier(detectFieldTier());
    const sp = new URLSearchParams(window.location.search);
    const fc = sp.get("feco");
    if (fc !== null) {
      const c = Number(fc);
      if (Number.isFinite(c) && c >= 0 && c <= 1) setFEco(c);
    }
    if (sp.get("fcycle") === "1") site.heroDwellMs = 2000;
    // hero QA stills mount their own deterministic renderers — the page canvas
    // must not double-render the hero underneath them
    setHeroQA(
      ["fstate", "fpair", "fcursor", "fflat"].some((k) => sp.get(k) !== null),
    );
  }, [site]);

  // QA visibility: the site scene's live raw channels (read-only diagnostics)
  useEffect(() => {
    (window as unknown as { __liquid?: SceneChannels }).__liquid = site;
  }, [site]);

  const enabled = !reduced && !heroQA && (tier === "full" || tier === "lite");

  const setManual = useCallback(
    (n: number | null) => {
      site.heroManual = n === null ? -1 : n;
    },
    [site],
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
      site.heroPhase = 1;
      site.fracture = 1;
      site.travel = 1;
      site.converge = clamp01(c / CONV_END);
      site.grow = clamp01((c - GROW_START) / GROW_SPAN);
      site.svcPos = 0;
      site.pairA = 0;
      site.pairB = 0;
      site.pairM = 0;
      site.exit = 0;
      conductor.input.vel = 0;
      applyLabels(site.grow, 0);
      return;
    }

    // scene-anchor element caches (queried once — the DOM is stable post-
    // hydration, exactly like LiquidSite before this)
    const anchorEls = new Map<string, HTMLElement | null>();
    for (const [key, sel] of Object.entries(scene.anchors ?? {}))
      anchorEls.set(key, sel === "@wrap" ? wrap : document.querySelector(sel));
    const listEls = new Map<string, HTMLElement[]>();
    for (const [key, sel] of Object.entries(scene.lists ?? {}))
      listEls.set(key, Array.from(wrap.querySelectorAll<HTMLElement>(sel)));
    const geom: SceneGeom = {
      vh: 0,
      vw: 0,
      scrollY: 0,
      rect: (key) => anchorEls.get(key)?.getBoundingClientRect() ?? null,
      list: (key) => (listEls.get(key) ?? []).map((el) => el.getBoundingClientRect()),
    };

    // gooey cursor + autocycle hover-pause: the WHOLE hero section is the
    // pointer surface (the liquid has no interior edge to clip against)
    const heroSec = document.getElementById("hero");
    const canHover =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const toFieldUv = (e: PointerEvent) => {
      const md = Math.min(window.innerWidth, window.innerHeight);
      site.heroPx = 0.5 + (e.clientX - window.innerWidth / 2) / md;
      site.heroPy = 0.5 - (e.clientY - window.innerHeight / 2) / md;
    };
    const onEnter = (e: PointerEvent) => {
      site.heroHover = 1;
      toFieldUv(e);
      site.heroCursorOn = 1;
    };
    const onMove = (e: PointerEvent) => {
      toFieldUv(e);
      site.heroCursorOn = 1;
    };
    const onLeave = () => {
      site.heroHover = 0;
      site.heroCursorOn = 0;
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

      // scroll velocity (viewport-heights/s) — the stir
      const dts = Math.max((now - lastNow) / 1000, 1e-3);
      const y = window.scrollY;
      conductor.input.vel = dts > 0.25 ? 0 : (y - lastY) / dts / vh; // long gaps = idle
      lastY = y;
      lastNow = now;

      site.heroPlay = inViewRef.current ? 1 : 0;

      // hero staging: the liquid form sits exactly over the stage box and
      // rides with it — while the POUR sheds its droplets into the fixed field
      const st = stageEl.current;
      if (st) {
        const r = st.getBoundingClientRect();
        site.heroOx = (r.left + r.width / 2 - vw / 2) / md;
        site.heroOy = (vh / 2 - (r.top + r.height / 2)) / md;
        site.heroScale = Math.min(r.width, r.height) / md;
      }

      // the scene's own geometry → channels (pure math, reads only)
      geom.vh = vh;
      geom.vw = vw;
      geom.scrollY = y;
      scene.read?.(geom, site);

      applyLabels(site.grow, site.svcPos);
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
  }, [enabled, tier, fEco, conductor, scene, site, wrapRef]);

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
                driver={conductor.driver}
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
