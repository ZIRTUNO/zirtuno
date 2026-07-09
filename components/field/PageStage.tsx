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
import type {
  SceneChannels,
  SceneGeom,
  SceneModule,
} from "@/lib/webgl/scenes/types";
import {
  makeSiteScene,
  CONV_END,
  GROW_START,
  GROW_SPAN,
} from "@/lib/webgl/scenes/site";
import { makeMethodScene } from "@/lib/webgl/scenes/method";
import {
  makeOriginScene,
  PILLAR_ANCHORS,
  ORIGIN_OY,
} from "@/lib/webgl/scenes/origin";
import { makeContactScene, EXHALE_EVENT } from "@/lib/webgl/scenes/contact";
import { HeroLiquidContext, type HeroLiquid } from "./hero-liquid-context";

// the unified liquid field is client-only (WebGL2) → lazy, no SSR.
const FieldStage = dynamic(() => import("@/components/field/FieldStage"), {
  ssr: false,
});

export type EcoNode = { name: string; tooltip: string };

/**
 * PageStage (R5-A) — the CONDUCTOR's shell: ONE persistent fluid renderer for
 * the ENTIRE page. One sticky full-viewport canvas under every chapter, one
 * rAF measurement loop, four scenes (site · method · origin · contact) whose
 * 48 droplets are the SAME 48 droplets end to end — the conductor damps every
 * channel, blends per-droplet targets across scene handoffs, arbitrates the
 * two form slots (ownership transfers only through droplet-only states) and
 * packs the one shared field. No per-chapter canvases, no handoffs-as-swaps.
 *
 * DOM choreography also lives here (in the sticky layer): the ecosystem
 * orbital labels, the origin founding-pillar labels, and the method progress
 * thread (--method-flow). Deterministic layering: canvas z-0 (pointer-events
 * none), copy z-10. Reduced-motion / "none" tier / hero QA stills render no
 * canvas and flag the wrapper `data-liquid="static"` so every chapter's
 * static fallback shows instead.
 *
 * QA: ?feco=c freezes the S4 choreography at c ∈ [0,1]; ?fcycle=1 shortens
 * the hero dwell; ?fstate/?fpair/?fcursor/?fflat switch the hero to its
 * deterministic standalone renderers (page canvas off). window.__liquid
 * exposes the site scene's raw channels; window.__scenes exposes all four.
 */
export function PageStage({
  nodes,
  centerLabel,
  ecosystemLabel,
  pillars,
  children,
}: {
  nodes: EcoNode[];
  centerLabel: string;
  ecosystemLabel: string;
  pillars: string[];
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
  const pillarEls = useRef<(HTMLLIElement | null)[]>([]);
  const stageEl = useRef<HTMLElement | null>(null);
  const inViewRef = useRef(true);
  useEffect(() => {
    inViewRef.current = inView;
  }, [inView]);

  const [conductor, scenes] = useMemo(() => {
    // setHeroActive is a stable useState setter — safe to close over here
    const scs: SceneModule[] = [
      makeSiteScene({ onHeroActive: setHeroActive }),
      makeMethodScene(),
      makeOriginScene(),
      makeContactScene(),
    ];
    // ?fphys=0 routes the legacy low-pass integrator (A/B + escape hatch)
    const physics =
      typeof window === "undefined" ||
      new URLSearchParams(window.location.search).get("fphys") !== "0";
    return [makeConductor(scs, { physics }), scs] as const;
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

  // QA visibility: the live raw channels (read-only diagnostics)
  useEffect(() => {
    const w = window as unknown as {
      __liquid?: SceneChannels;
      __scenes?: Record<string, SceneChannels>;
    };
    w.__liquid = site;
    w.__scenes = conductor.raw;
  }, [site, conductor]);

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

  // the exhale gesture (ContactForm dispatches on submit) → the contact scene
  useEffect(() => {
    const onExhale = () => {
      conductor.raw.contact.exhaleAt = performance.now();
    };
    window.addEventListener(EXHALE_EVENT, onExhale);
    return () => window.removeEventListener(EXHALE_EVENT, onExhale);
  }, [conductor]);

  // label geometry: eco nodes (ECO_NODES math) + origin founding pillars
  // (fixed anchors beside the mark's lobes), both aspect-corrected
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
      pillarEls.current.forEach((el, i) => {
        if (!el) return;
        const a = PILLAR_ANCHORS[i % PILLAR_ANCHORS.length];
        el.style.left = `${((a.dx / aspect + 0.5) * 100).toFixed(2)}%`;
        el.style.top = `${((1 - (0.5 + ORIGIN_OY + a.dy)) * 100).toFixed(2)}%`;
      });
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(layer);
    return () => ro.disconnect();
  }, [nodes.length, pillars.length]);

  // ── the ONE measurement loop (all scenes' channels + DOM choreography) ─────
  useEffect(() => {
    if (tier === null) return; // wait for the tier probe (static path included)
    const wrap = wrapRef.current;
    if (!wrap) return;

    let lastG = -1;
    let lastS = -1;
    const applyEcoLabels = (grow: number, svcPos: number) => {
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
    let lastP = -1;
    const applyOriginLabels = (p: number) => {
      if (Math.abs(p - lastP) < 0.002) return;
      lastP = p;
      // the three labels arrive staggered as the mark resolves, leave at the end
      const gone = 1 - smooth01((p - 0.84) / 0.1);
      pillarEls.current.forEach((el, i) => {
        if (!el) return;
        const e = smooth01((p - (0.3 + i * 0.04)) / 0.09) * gone;
        el.style.opacity = String(e);
        el.style.transform = `translate(-50%, -50%) translateY(${((1 - e) * 8).toFixed(1)}px)`;
      });
    };
    let lastFlow = -1;
    const applyMethodFlow = (flow: number) => {
      if (Math.abs(flow - lastFlow) < 0.004) return;
      lastFlow = flow;
      wrap.style.setProperty("--method-flow", flow.toFixed(4));
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
      applyEcoLabels(site.grow, 0);
      wrap.style.setProperty("--method-flow", "1"); // static thread reads full
      return;
    }

    // scene-anchor element caches (queried once — the DOM is stable post-
    // hydration; every chapter renders inside this wrapper)
    const geoms = scenes.map((sc) => {
      const anchorEls = new Map<string, HTMLElement | null>();
      for (const [key, sel] of Object.entries(sc.anchors ?? {}))
        anchorEls.set(key, document.querySelector(sel));
      const listEls = new Map<string, HTMLElement[]>();
      for (const [key, sel] of Object.entries(sc.lists ?? {}))
        listEls.set(key, Array.from(wrap.querySelectorAll<HTMLElement>(sel)));
      const g: SceneGeom = {
        vh: 0,
        vw: 0,
        scrollY: 0,
        rect: (key) => anchorEls.get(key)?.getBoundingClientRect() ?? null,
        list: (key) =>
          (listEls.get(key) ?? []).map((el) => el.getBoundingClientRect()),
      };
      return g;
    });
    const methodPhases = Math.max(
      wrap.querySelectorAll("#method .method-phase").length - 1,
      1,
    );

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

    // page-wide pointer → the cursor force field (R5-B; fine pointers only).
    // Field uv + velocity; velocity decays in the rAF loop so a resting hand
    // stops dragging the liquid.
    let lastPT = 0;
    let lastPX = 0.5;
    let lastPY = 0.5;
    const onPageMove = (e: PointerEvent) => {
      const md = Math.min(window.innerWidth, window.innerHeight);
      const px = 0.5 + (e.clientX - window.innerWidth / 2) / md;
      const py = 0.5 - (e.clientY - window.innerHeight / 2) / md;
      const now = performance.now();
      if (lastPT > 0) {
        const dts = Math.min(Math.max((now - lastPT) / 1000, 1e-3), 0.1);
        conductor.input.pvx = (px - lastPX) / dts;
        conductor.input.pvy = (py - lastPY) / dts;
      }
      lastPT = now;
      lastPX = px;
      lastPY = py;
      conductor.input.px = px;
      conductor.input.py = py;
      conductor.input.pon = 1;
    };
    const onPageLeave = () => {
      conductor.input.pon = 0;
    };
    if (canHover) {
      window.addEventListener("pointermove", onPageMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onPageLeave);
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

      // pointer velocity decays between move events (a resting hand lets go)
      conductor.input.pvx *= 0.82;
      conductor.input.pvy *= 0.82;

      // hero staging: the liquid form sits exactly over the stage box and
      // rides with it — while the POUR sheds its droplets into the fixed field
      const st = stageEl.current;
      if (st) {
        const r = st.getBoundingClientRect();
        site.heroOx = (r.left + r.width / 2 - vw / 2) / md;
        site.heroOy = (vh / 2 - (r.top + r.height / 2)) / md;
        site.heroScale = Math.min(r.width, r.height) / md;
      }

      // every scene's geometry → channels (pure math, reads only)
      for (let si = 0; si < scenes.length; si++) {
        const g = geoms[si];
        g.vh = vh;
        g.vw = vw;
        g.scrollY = y;
        scenes[si].read?.(g, conductor.raw[scenes[si].id]);
      }

      // DOM choreography (writes AFTER all reads — no layout thrash)
      applyEcoLabels(site.grow, site.svcPos);
      applyOriginLabels(conductor.raw.origin.p);
      applyMethodFlow(clamp01(conductor.raw.method.u / methodPhases));
    };
    update();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (canHover && heroSec) {
        heroSec.removeEventListener("pointerenter", onEnter);
        heroSec.removeEventListener("pointermove", onMove);
        heroSec.removeEventListener("pointerleave", onLeave);
      }
      if (canHover) {
        window.removeEventListener("pointermove", onPageMove);
        document.documentElement.removeEventListener(
          "pointerleave",
          onPageLeave,
        );
      }
    };
  }, [enabled, tier, fEco, conductor, scenes, site, wrapRef]);

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
          {/* decorative founding-pillar labels (S8 beat 2) — the accessible
              pillar line lives in the beat-2 copy block (static path) */}
          <ul className="origin-pillar-labels" aria-hidden="true">
            {pillars.map((p, i) => (
              <li
                key={p}
                className="origin-pillar-label"
                ref={(el) => {
                  pillarEls.current[i] = el;
                }}
              >
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="journey-content">{children}</div>
      </div>
    </HeroLiquidContext.Provider>
  );
}
