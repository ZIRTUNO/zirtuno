"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import {
  detectFieldTier,
  setFieldTier,
  type FieldTier,
} from "@/lib/webgl/field-tier";
import { clamp01, smooth01 } from "@/lib/webgl/field-drivers";
import {
  ECO_ORDER,
  ECO_N,
  ECO_SYSTEMS,
  ARTERY_SLOTS,
  socketPos,
  socketNormal,
  ringPoint,
  arteryPoint,
  nodeTiming,
  arteryTiming,
  edgeTiming,
  pulseDistances,
} from "@/lib/webgl/eco-circuit.mjs";
import { makeConductor } from "@/lib/webgl/conductor.mjs";
import {
  FLUID_OBSTACLE_MAX,
  FLUID_OBSTACLE_STRIDE,
} from "@/lib/webgl/fluid-core.mjs";
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
import { makeWorkScene } from "@/lib/webgl/scenes/work";
import {
  makeOriginScene,
  PILLAR_ANCHORS,
  ORIGIN_OY,
} from "@/lib/webgl/scenes/origin";
import { makeStudioScene } from "@/lib/webgl/scenes/studio";
import { makeContactScene, EXHALE_EVENT } from "@/lib/webgl/scenes/contact";
import { makeFooterScene } from "@/lib/webgl/scenes/footer";
import { CinematicVeils } from "./CinematicVeils";
import { HeroLiquidContext, type HeroLiquid } from "./hero-liquid-context";

// the unified liquid field is client-only (WebGL2) → lazy, no SSR.
const FieldStage = dynamic(() => import("@/components/field/FieldStage"), {
  ssr: false,
});

export type EcoNode = { name: string; tooltip: string };

// The v3 review path lets free liquid acknowledge a deliberately small set of
// business-critical reading surfaces. Bounds are cached outside the frame
// loop; weight controls influence without changing the authored composition.
const FLOW_OBSTACLES = [
  ["#hero .lab-headline", 1],
  ["#hero .lab-sub", 0.72],
  ["#problem .type-section-title", 0.9],
  ["#ecosystem .type-section-title", 0.82],
  ["#services .type-section-title", 0.9],
  ["#method .type-section-title", 0.82],
  ["#work .type-section-title", 0.82],
  ["#name .origin-statement", 0.9],
  ["#name .origin-closing", 0.72],
  ["#studio .type-feature-title", 0.72],
  ["#contact .type-section-title", 0.9],
  ["#contact .contact-form", 1],
] as const;

function makeJourneyRuntime(
  onHeroActive: (active: number) => void,
  search: URLSearchParams | null,
) {
  // journey order: site → método → work → origin → studio → contact →
  // footer — the R5-D scenes fill what were the liquid-dead bands.
  // The Hero stream is rendered by components/hero/HeroRibbon. The page field
  // begins its work as the Hero leaves for The Problem.
  const scenes: SceneModule[] = [
    makeSiteScene({ onHeroActive }),
    makeMethodScene(),
    makeWorkScene(),
    makeOriginScene(),
    makeStudioScene(),
    makeContactScene(),
    makeFooterScene(),
  ];
  // ?fphys=0 routes the legacy low-pass integrator (A/B + escape hatch);
  // ?fphysv3=1 enables the approved force prototype and ?fobstacles=1 adds
  // cached type/form avoidance. Both remain opt-in through visual review.
  // ?fcine=0 keeps the light score neutral (no veils/flash/score grade).
  const physics = search?.get("fphys") !== "0";
  const physicsV3 = physics && search?.get("fphysv3") === "1";
  const obstacleFlow = physicsV3 && search?.get("fobstacles") === "1";
  const cine = search?.get("fcine") !== "0";

  return [
    makeConductor(scenes, {
      physics,
      physicsV3,
      obstacleFlow,
      cine,
    }),
    scenes,
    cine,
    physics ? (physicsV3 ? "v3" : "v2") : "legacy",
    obstacleFlow,
  ] as const;
}

/**
 * PageStage (R5-A) — the CONDUCTOR's shell: ONE persistent fluid renderer for
 * the ENTIRE page. One sticky full-viewport canvas under every chapter, one
 * rAF measurement loop, seven scenes (site · method · work · origin · studio ·
 * contact · footer) whose 48 droplets are the SAME 48 droplets end to end —
 * the conductor damps every
 * channel, blends per-droplet targets across scene handoffs, arbitrates the
 * two form slots (ownership transfers only through droplet-only states) and
 * packs the one shared field. No per-chapter canvases, no handoffs-as-swaps.
 *
 * DOM choreography also lives here (in the sticky layer): the ecosystem
 * orbital labels, the origin founding-pillar labels, and the method progress
 * thread (--method-flow). Deterministic layering: canvas z-0 (pointer-events
 * none), copy z-10, Ecosystem controls z-12. Reduced-motion / "none" tier /
 * hero QA stills render no
 * canvas and flag the wrapper `data-liquid="static"` so every chapter's
 * static fallback shows instead.
 *
 * QA: ?feco=c freezes the S4 choreography at c ∈ [0,1]; ?fcycle=1 shortens
 * the hero dwell; ?fstate/?fpair/?fcursor/?fflat switch the hero to its
 * deterministic standalone renderers (page canvas off). window.__liquid
 * exposes the site scene's raw channels; window.__scenes exposes all seven.
 */
export function PageStage({
  nodes,
  centerLabel,
  ecosystemLabel,
  systems,
  pillars,
  children,
}: {
  nodes: EcoNode[];
  centerLabel: string;
  ecosystemLabel: string;
  /** the three organ-system names (identity · growth · operation) */
  systems: string[];
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
  const [ecoInteractive, setEcoInteractive] = useState(false);
  const [ecoKeyboardEnabled, setEcoKeyboardEnabled] = useState(false);
  const [openEcoNode, setOpenEcoNode] = useState<number | null>(null);
  const [hovSlot, setHovSlot] = useState(-1);
  const [ecoHost, setEcoHost] = useState<HTMLElement | null>(null);
  const nodeEls = useRef<(HTMLLIElement | null)[]>([]);
  const centerEl = useRef<HTMLSpanElement>(null);
  const veinsEl = useRef<SVGSVGElement | null>(null);
  const arteryEls = useRef<(SVGPathElement | null)[]>([]);
  const ringEls = useRef<(SVGPathElement | null)[]>([]);
  const socketEls = useRef<(SVGGElement | null)[]>([]);
  const hudMeterEl = useRef<HTMLSpanElement | null>(null);
  const pillarEls = useRef<(HTMLLIElement | null)[]>([]);
  const stageEl = useRef<HTMLElement | null>(null);
  const ecoLayerEl = useRef<HTMLDivElement | null>(null);
  const ecoInteractiveRef = useRef(false);
  const heroPointerActive = useRef(false);
  const heroFocusActive = useRef(false);
  const inViewRef = useRef(true);
  useEffect(() => {
    inViewRef.current = inView;
  }, [inView]);

  // Client components are also rendered on the server. Build an SSR-safe
  // default bundle, then replace it from the real browser query before the
  // tier probe can mount the canvas. This keeps hydration deterministic while
  // making review/rollback flags effective in production.
  const [runtime, setRuntime] = useState(() =>
    makeJourneyRuntime(setHeroActive, null),
  );
  const [conductor, scenes, cine, physicsMode, obstacleFlow] = runtime;
  const site = conductor.raw.site;
  const enabled = !reduced && !heroQA && (tier === "full" || tier === "lite");

  useEffect(() => {
    setRuntime(
      makeJourneyRuntime(
        setHeroActive,
        new URLSearchParams(window.location.search),
      ),
    );
  }, []);

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

  // Keep the focusable organism controls in Chapter Ecosystem's DOM order
  // while PageStage retains their shared choreography and geometry.
  useEffect(() => {
    setEcoHost(document.getElementById("ecosystem-interactions-host"));
  }, []);

  // Keep the desktop orbit in the document's keyboard order for the whole
  // live experience. Its visual/pointer envelope may follow the choreography,
  // but focus must never disappear merely because focusing caused a scroll.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const sync = () => setEcoKeyboardEnabled(enabled && desktop.matches);
    sync();
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, [enabled]);

  // QA visibility: the live raw channels + the merged light score (read-only
  // diagnostics; verify-cinematics reads __cine.stats.flashes for the
  // one-flash gate — it exists on EVERY path, including reduced motion,
  // where it must stay at zero because no frame ever runs)
  useEffect(() => {
    const w = window as unknown as {
      __liquid?: SceneChannels;
      __scenes?: Record<string, SceneChannels>;
      __cine?: { score: typeof conductor.score; stats: typeof conductor.stats };
    };
    w.__liquid = site;
    w.__scenes = conductor.raw;
    w.__cine = { score: conductor.score, stats: conductor.stats };
  }, [site, conductor]);

  const setManual = useCallback(
    (n: number | null) => {
      site.heroManual = n === null ? -1 : n;
    },
    [site],
  );
  const syncHeroPause = useCallback(() => {
    site.heroHover =
      heroPointerActive.current || heroFocusActive.current ? 1 : 0;
  }, [site]);
  const setPaused = useCallback(
    (paused: boolean) => {
      heroFocusActive.current = paused;
      syncHeroPause();
    },
    [syncHeroPause],
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
      setPaused,
      registerStage,
    }),
    [enabled, heroReady, heroActive, setManual, setPaused, registerStage],
  );

  // the exhale gesture (ContactForm dispatches on submit) → the contact scene
  useEffect(() => {
    const onExhale = () => {
      conductor.raw.contact.exhaleAt = performance.now();
    };
    window.addEventListener(EXHALE_EVENT, onExhale);
    return () => window.removeEventListener(EXHALE_EVENT, onExhale);
  }, [conductor]);

  // THE CIRCULATION's geometry: sockets, vein paths and labels all evaluate
  // eco-circuit's shared functions in the sticky layer's pixel space — the
  // liquid beads (site scene), the SVG veins and the type can never drift.
  // Origin founding pillars keep their fixed anchors beside the mark's lobes.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const px = (p: { x: number; y: number }, aspect: number, w: number, h: number) => ({
      x: ((p.x - 0.5) / aspect + 0.5) * w,
      y: (1 - p.y) * h,
    });
    const pathFrom = (pts: { x: number; y: number }[]) =>
      pts
        .map((p, k) => `${k === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join("");
    const layout = () => {
      const r = layer.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const w = r.width;
      const h = r.height;
      const aspect = w / h;
      const topbarBottom =
        document.querySelector<HTMLElement>(".topbar")?.getBoundingClientRect()
          .bottom ?? 0;
      if (veinsEl.current)
        veinsEl.current.setAttribute("viewBox", `0 0 ${w} ${h}`);
      // arteries: mark edge → each system's first organ
      arteryEls.current.forEach((el, a) => {
        if (!el) return;
        const pts = [];
        for (let k = 0; k <= 28; k++)
          pts.push(px(arteryPoint(a, k / 28, aspect), aspect, w, h));
        el.setAttribute("d", pathFrom(pts));
        const len = el.getTotalLength();
        const t = arteryTiming(a);
        el.style.setProperty("--len", len.toFixed(1));
        el.style.setProperty("--d", String(t.d));
        el.style.setProperty("--w", String(t.w));
      });
      // the closed loop, one segment per organ pair
      ringEls.current.forEach((el, s) => {
        if (!el) return;
        const pts = [];
        for (let k = 0; k <= 16; k++)
          pts.push(px(ringPoint((s + k / 16) / ECO_N, aspect), aspect, w, h));
        el.setAttribute("d", pathFrom(pts));
        const len = el.getTotalLength();
        const t = edgeTiming(s);
        el.style.setProperty("--len", len.toFixed(1));
        el.style.setProperty("--d", String(t.d));
        el.style.setProperty("--w", String(t.w));
      });
      // sockets + labels sit on the same ring points, labels along the
      // outward normal (the liquid docks AT the socket; type lives outside)
      socketEls.current.forEach((el, s) => {
        if (!el) return;
        const p = px(socketPos(s, aspect), aspect, w, h);
        el.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
        const t = nodeTiming(s);
        el.style.setProperty("--d", String(t.d));
        el.style.setProperty("--w", String(t.w));
      });
      // the right chapter-index rail owns this column — labels stay clear.
      // Measured, not guessed: the rail rests at its numbers-only width, so the
      // circuit's labels get back the column the old always-open label held.
      const railEl = document.querySelector<HTMLElement>(".side-index");
      const railBox = railEl?.getBoundingClientRect();
      const RAIL =
        railBox && railBox.width > 0
          ? Math.ceil(w - (railBox.left - r.left)) + 16
          : 0;
      nodeEls.current.forEach((el, s) => {
        if (!el) return;
        const p = px(socketPos(s, aspect), aspect, w, h);
        const n = socketNormal(s);
        const off = 24;
        let x = p.x + n.x * off;
        let y = p.y - n.y * off;
        let side: string;
        if (n.x > 0.4) side = "right";
        else if (n.x < -0.4) side = "left";
        else side = n.y > 0 ? "top" : "bottom";
        // measured-width edge safety: a side label that would leave the
        // stage (or enter the rail) drops below its socket instead
        const w0 = el.offsetWidth || 120;
        if (side === "right" && x + w0 > w - RAIL) {
          side = "bottom";
          x = p.x;
          y = p.y + off;
        } else if (side === "left" && x - w0 < 10) {
          side = "bottom";
          x = p.x;
          y = p.y + off;
        }
        if (side === "top" || side === "bottom")
          x = Math.min(Math.max(x, w0 / 2 + 10), w - RAIL - w0 / 2);
        const minY = Math.max(0, topbarBottom - r.top) + 22;
        y = Math.min(Math.max(y, minY), h - 26);
        el.dataset.side = side;
        el.style.left = `${x.toFixed(1)}px`;
        el.style.top = `${y.toFixed(1)}px`;
        const t = nodeTiming(s);
        el.style.setProperty("--d", String(t.d));
        el.style.setProperty("--w", String(t.w));
      });
      // the founding-pillar labels ride the mark's lobes, clamped into the
      // stage exactly like the circuit's labels — the un-clamped percentages
      // walked clean off a portrait viewport, so the beat lost them entirely
      pillarEls.current.forEach((el, i) => {
        if (!el) return;
        const a = PILLAR_ANCHORS[i % PILLAR_ANCHORS.length];
        const halfW = (el.offsetWidth || 90) / 2;
        const x = (a.dx / aspect + 0.5) * w;
        const y = (1 - (0.5 + ORIGIN_OY + a.dy)) * h;
        const minX = halfW + 12;
        const maxX = Math.max(minX, w - RAIL - halfW - 12);
        el.style.left = `${Math.min(Math.max(x, minX), maxX).toFixed(1)}px`;
        el.style.top = `${Math.min(Math.max(y, 26), h - 26).toFixed(1)}px`;
      });
    };
    layout();
    // label widths shift when the mono face lands — re-run the edge safety
    let alive = true;
    document.fonts?.ready.then(() => alive && layout());
    const ro = new ResizeObserver(layout);
    ro.observe(layer);
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, [nodes.length, pillars.length, ecoHost, enabled]);

  // the system response: touching one organ pulses the WHOLE circuit. BFS hop
  // distances become per-element transition delays, so the brightening
  // visibly travels the veins outward from the touched organ; the liquid
  // answers through the scene's hov channel (dock swell + quickened beads).
  const activeSlot = hovSlot >= 0 ? hovSlot : (openEcoNode ?? -1);
  useEffect(() => {
    site.hov = activeSlot;
    const root = ecoLayerEl.current;
    if (!root) return;
    if (activeSlot < 0) {
      root.removeAttribute("data-pulse");
      return;
    }
    const dist = pulseDistances(activeSlot);
    const HOP = 110; // ms per graph hop — a readable travel, not a blink
    ringEls.current.forEach((el, s) => {
      if (!el) return;
      const d = Math.min(dist[s], dist[(s + 1) % ECO_N]);
      el.style.setProperty("--pd", `${d * HOP}ms`);
    });
    arteryEls.current.forEach((el, a) => {
      if (!el) return;
      const d = Math.min(dist[ARTERY_SLOTS[a]], dist[ECO_N]);
      el.style.setProperty("--pd", `${d * HOP}ms`);
    });
    socketEls.current.forEach((el, s) => {
      if (!el) return;
      el.style.setProperty("--pd", `${dist[s] * HOP}ms`);
    });
    nodeEls.current.forEach((el, s) => {
      if (!el) return;
      el.style.setProperty("--pd", `${dist[s] * HOP}ms`);
    });
    root.setAttribute("data-pulse", "true");
  }, [activeSlot, site]);

  // ── the ONE measurement loop (all scenes' channels + DOM choreography) ─────
  useEffect(() => {
    if (tier === null) return; // wait for the tier probe (static path included)
    const wrap = wrapRef.current;
    if (!wrap) return;

    const ecoDesktop = window.matchMedia("(min-width: 1024px)");
    let lastG = -1;
    let lastS = -1;
    let lastEcoDesktop = ecoDesktop.matches;
    let lastEcoInteractive = ecoInteractiveRef.current;
    const applyEcoLabels = (grow: number, svcPos: number) => {
      const desktop = ecoDesktop.matches;
      if (
        Math.abs(grow - lastG) < 0.002 &&
        Math.abs(svcPos - lastS) < 0.002 &&
        desktop === lastEcoDesktop
      )
        return;
      lastG = grow;
      lastS = svcPos;
      lastEcoDesktop = desktop;
      const fade = 1 - smooth01(svcPos);
      // The circuit becomes keyboard-operable only once the loop has closed.
      // Before/after that beat it leaves the tab order; the semantic stack
      // remains available on mobile and every static path.
      const interactive = enabled && desktop && grow >= 0.88 && fade >= 0.55;
      if (interactive !== lastEcoInteractive) {
        lastEcoInteractive = interactive;
        ecoInteractiveRef.current = interactive;
        if (
          !interactive &&
          !ecoLayerEl.current?.contains(document.activeElement)
        )
          setOpenEcoNode(null);
        setEcoInteractive(interactive);
      }
      // TWO vars drive the whole assembly — every vein, socket and label
      // derives its own envelope from --eco-grow via its inline --d/--w
      // (single write point; the same eco-circuit timing the beads use)
      const root = ecoLayerEl.current;
      if (root) {
        root.style.setProperty("--eco-grow", grow.toFixed(4));
        root.style.setProperty("--eco-fade", fade.toFixed(3));
      }
      if (centerEl.current)
        centerEl.current.style.opacity = String(
          smooth01((grow - 0.1) / 0.35) * fade,
        );
      if (hudMeterEl.current) {
        let lit = 0;
        for (let s = 0; s < ECO_N; s++) {
          const t = nodeTiming(s);
          if (grow >= t.d + t.w * 0.6) lit++;
        }
        const meter = `${String(lit).padStart(2, "0")} / ${ECO_N}`;
        if (hudMeterEl.current.textContent !== meter)
          hudMeterEl.current.textContent = meter;
      }
    };
    let lastP = -1;
    const applyOriginLabels = (p: number) => {
      if (Math.abs(p - lastP) < 0.002) return;
      lastP = p;
      // The three labels arrive staggered as the mark fuses and clear BEFORE the
      // echo beat (q4 opens at p 0.62). They used to hold until p 0.84, which
      // put them underneath the evolution paragraph and the wordmark beat — the
      // collisions the audit captured. Their window is now beat 2 + the purpose
      // hold: exactly the passage they annotate.
      const gone = 1 - smooth01((p - 0.56) / 0.08);
      pillarEls.current.forEach((el, i) => {
        if (!el) return;
        const e = smooth01((p - (0.24 + i * 0.035)) / 0.08) * gone;
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
    // R5-D: the merged light score → the veil CSS vars, once per frame (the
    // conductor mutates `score` inside driver.frame from the render loop;
    // reading it here is at most one frame behind — invisible at veil speeds)
    let lastVeil = -1;
    let lastVig = -1;
    let lastFlash = -1;
    const applyScore = () => {
      const s = conductor.score;
      if (Math.abs(s.veil - lastVeil) > 0.002) {
        lastVeil = s.veil;
        wrap.style.setProperty("--cine-veil", s.veil.toFixed(3));
      }
      if (Math.abs(s.vignette - lastVig) > 0.002) {
        lastVig = s.vignette;
        wrap.style.setProperty("--cine-vig", s.vignette.toFixed(3));
      }
      if (Math.abs(s.flash - lastFlash) > 0.002) {
        lastFlash = s.flash;
        wrap.style.setProperty("--cine-flash", s.flash.toFixed(3));
      }
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
      const listRects = new Map<string, DOMRect[]>();
      for (const [key, sel] of Object.entries(sc.lists ?? {})) {
        const els = Array.from(wrap.querySelectorAll<HTMLElement>(sel));
        listEls.set(key, els);
        listRects.set(key, new Array<DOMRect>(els.length));
      }
      const g: SceneGeom = {
        vh: 0,
        vw: 0,
        scrollY: 0,
        rect: (key) => anchorEls.get(key)?.getBoundingClientRect() ?? null,
        list: (key) => {
          const els = listEls.get(key) ?? [];
          const rects = listRects.get(key) ?? [];
          for (let i = 0; i < els.length; i++)
            rects[i] = els[i].getBoundingClientRect();
          return rects;
        },
      };
      return g;
    });
    const methodPhases = Math.max(
      wrap.querySelectorAll("#method .method-phase").length - 1,
      1,
    );

    // Physics-v3 obstacle source geometry is document-relative and refreshed
    // only when layout can change. The rAF path merely translates cached
    // bounds into the fixed field, avoiding getBoundingClientRect/layout work.
    const obstacleDoc = new Float32Array(
      FLUID_OBSTACLE_MAX * FLUID_OBSTACLE_STRIDE,
    );
    const obstacleSources = obstacleFlow
      ? FLOW_OBSTACLES.map(([selector, weight]) => ({
          el: wrap.querySelector<HTMLElement>(selector),
          weight,
        }))
      : [];
    let obstacleDocCount = 0;
    const cacheObstacleGeometry = () => {
      obstacleDocCount = 0;
      if (!obstacleFlow) return;
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      for (let i = 0; i < obstacleSources.length; i++) {
        const source = obstacleSources[i];
        if (!source.el || obstacleDocCount >= FLUID_OBSTACLE_MAX) continue;
        const rect = source.el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        const off = obstacleDocCount * FLUID_OBSTACLE_STRIDE;
        obstacleDoc[off] = rect.left + scrollX;
        obstacleDoc[off + 1] = rect.top + scrollY;
        obstacleDoc[off + 2] = rect.width;
        obstacleDoc[off + 3] = rect.height;
        obstacleDoc[off + 4] = source.weight;
        obstacleDocCount++;
      }
    };
    cacheObstacleGeometry();
    let obstacleRefresh = 0;
    let obstacleDisposed = false;
    const queueObstacleGeometry = () => {
      if (!obstacleFlow || obstacleDisposed || obstacleRefresh) return;
      obstacleRefresh = window.requestAnimationFrame(() => {
        obstacleRefresh = 0;
        cacheObstacleGeometry();
      });
    };
    const obstacleResize = obstacleFlow
      ? new ResizeObserver(queueObstacleGeometry)
      : null;
    for (const source of obstacleSources)
      if (source.el) obstacleResize?.observe(source.el);
    if (obstacleFlow)
      window.addEventListener("resize", queueObstacleGeometry, {
        passive: true,
      });
    let obstacleWarmup = 0;
    if (obstacleFlow) {
      obstacleWarmup = window.setTimeout(cacheObstacleGeometry, 1400);
      void document.fonts?.ready.then(queueObstacleGeometry);
    }

    const applyObstacleFlow = (
      vh: number,
      vw: number,
      md: number,
      y: number,
    ) => {
      if (!obstacleFlow) {
        conductor.input.obstacleCount = 0;
        return;
      }
      const out = conductor.input.obstacles;
      const scrollX = window.scrollX;
      const overscan = Math.min(vh * 0.14, 120);
      const padding = Math.min(Math.max(md * 0.018, 12), 24);
      let count = 0;
      for (let i = 0; i < obstacleDocCount && count < FLUID_OBSTACLE_MAX; i++) {
        const src = i * FLUID_OBSTACLE_STRIDE;
        const left = obstacleDoc[src] - scrollX;
        const top = obstacleDoc[src + 1] - y;
        const width = obstacleDoc[src + 2];
        const height = obstacleDoc[src + 3];
        if (top + height < -overscan || top > vh + overscan) continue;
        const dst = count * FLUID_OBSTACLE_STRIDE;
        out[dst] = 0.5 + (left + width * 0.5 - vw * 0.5) / md;
        out[dst + 1] = 0.5 - (top + height * 0.5 - vh * 0.5) / md;
        out[dst + 2] = (width * 0.5 + padding) / md;
        out[dst + 3] = (height * 0.5 + padding) / md;
        out[dst + 4] = obstacleDoc[src + 4];
        count++;
      }
      conductor.input.obstacleCount = count;
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
      heroPointerActive.current = true;
      syncHeroPause();
      toFieldUv(e);
      site.heroCursorOn = 1;
    };
    const onMove = (e: PointerEvent) => {
      toFieldUv(e);
      site.heroCursorOn = 1;
    };
    const onLeave = () => {
      heroPointerActive.current = false;
      syncHeroPause();
      site.heroCursorOn = 0;
    };
    if (canHover && heroSec) {
      heroSec.addEventListener("pointerenter", onEnter);
      heroSec.addEventListener("pointermove", onMove);
      heroSec.addEventListener("pointerleave", onLeave);
    }

    // the work meniscus (R5-D): delegated hover over the project cards → the
    // work scene's raw `hov` channel (index into its measured card list —
    // both sides query the same selector, so the order matches)
    const workSec = document.getElementById("work");
    const workCards = workSec
      ? Array.from(workSec.querySelectorAll<HTMLElement>(".project-card"))
      : [];
    const workCardFrom = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLElement>(".project-card")
        : null;
    const setWorkCard = (card: HTMLElement | null) => {
      conductor.raw.work.hov = card ? workCards.indexOf(card) : -1;
    };
    let workHoverCard: HTMLElement | null = null;
    let workFocusCard: HTMLElement | null = null;
    let workTouchCard: HTMLElement | null = null;
    const syncWorkCard = () => {
      setWorkCard(workFocusCard ?? workTouchCard ?? workHoverCard);
    };
    const onWorkOver = (e: PointerEvent) => {
      workHoverCard = workCardFrom(e.target);
      syncWorkCard();
    };
    const onWorkOut = () => {
      workHoverCard = null;
      syncWorkCard();
    };
    const onWorkFocusIn = (e: FocusEvent) => {
      workFocusCard = workCardFrom(e.target);
      syncWorkCard();
    };
    const onWorkFocusOut = (e: FocusEvent) => {
      workFocusCard = workCardFrom(e.relatedTarget);
      syncWorkCard();
    };
    let workTouchRelease = 0;
    const onWorkPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
      if (workTouchRelease) window.clearTimeout(workTouchRelease);
      workTouchCard = workCardFrom(e.target);
      syncWorkCard();
    };
    const releaseWorkTouch = (e: PointerEvent) => {
      if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
      if (workTouchRelease) window.clearTimeout(workTouchRelease);
      workTouchRelease = window.setTimeout(() => {
        workTouchCard = null;
        syncWorkCard();
      }, 420);
    };
    if (canHover && workSec && workCards.length > 0) {
      workSec.addEventListener("pointerover", onWorkOver, { passive: true });
      workSec.addEventListener("pointerleave", onWorkOut);
    }
    if (workSec && workCards.length > 0) {
      workSec.addEventListener("focusin", onWorkFocusIn);
      workSec.addEventListener("focusout", onWorkFocusOut);
      workSec.addEventListener("pointerdown", onWorkPointerDown, {
        passive: true,
      });
      workSec.addEventListener("pointerup", releaseWorkTouch, {
        passive: true,
      });
      workSec.addEventListener("pointercancel", releaseWorkTouch, {
        passive: true,
      });
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
      applyObstacleFlow(vh, vw, md, y);

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
      applyScore();
    };
    update();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      obstacleDisposed = true;
      conductor.input.obstacleCount = 0;
      obstacleResize?.disconnect();
      if (obstacleRefresh) cancelAnimationFrame(obstacleRefresh);
      if (obstacleWarmup) window.clearTimeout(obstacleWarmup);
      if (obstacleFlow)
        window.removeEventListener("resize", queueObstacleGeometry);
      if (canHover && heroSec) {
        heroSec.removeEventListener("pointerenter", onEnter);
        heroSec.removeEventListener("pointermove", onMove);
        heroSec.removeEventListener("pointerleave", onLeave);
      }
      heroPointerActive.current = false;
      syncHeroPause();
      if (canHover && workSec && workCards.length > 0) {
        workSec.removeEventListener("pointerover", onWorkOver);
        workSec.removeEventListener("pointerleave", onWorkOut);
      }
      if (workSec && workCards.length > 0) {
        workSec.removeEventListener("focusin", onWorkFocusIn);
        workSec.removeEventListener("focusout", onWorkFocusOut);
        workSec.removeEventListener("pointerdown", onWorkPointerDown);
        workSec.removeEventListener("pointerup", releaseWorkTouch);
        workSec.removeEventListener("pointercancel", releaseWorkTouch);
      }
      if (workTouchRelease) window.clearTimeout(workTouchRelease);
      setWorkCard(null);
      if (canHover) {
        window.removeEventListener("pointermove", onPageMove);
        document.documentElement.removeEventListener(
          "pointerleave",
          onPageLeave,
        );
      }
    };
  }, [
    enabled,
    tier,
    fEco,
    conductor,
    scenes,
    site,
    obstacleFlow,
    syncHeroPause,
    wrapRef,
  ]);

  return (
    <HeroLiquidContext.Provider value={heroCtx}>
      <div
        ref={wrapRef}
        className="liquid-journey"
        data-liquid={enabled ? "live" : "static"}
        data-field-ready={heroReady ? "true" : "false"}
        data-hero-qa={heroQA ? "true" : "false"}
        data-fluid-physics={physicsMode}
        data-fluid-obstacles={obstacleFlow ? "true" : "false"}
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
        {/* R5-D: the cinematic layer — a SIBLING of the sticky layer (which
            is its own stacking context at z-0; nesting the fixed veils there
            would trap them under the z-10 copy). Live path only: never under
            reduced motion, static tiers, deterministic QA holds, or
            ?fcine=0. */}
        {/* THE CIRCULATION's controls sit above chapter copy while the canvas
            stays below it. Only visible controls opt back into hit testing.
            Live path only — static tiers read the semantic eco-stack. */}
        {ecoHost &&
          enabled &&
          createPortal(
            <div
              className="journey-interactions"
              ref={ecoLayerEl}
              data-interactive={ecoInteractive ? "true" : "false"}
              aria-hidden={!ecoKeyboardEnabled}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node))
                  setOpenEcoNode(null);
              }}
            >
              {/* the veins — arteries, the closed loop, the organ sockets.
                  Same eco-circuit geometry as the liquid beads (layout()). */}
              <svg className="eco-veins" ref={veinsEl} aria-hidden="true">
                {Array.from({ length: ECO_N }, (_, s) => (
                  <path
                    key={`ring-${s}`}
                    className="eco-vein eco-vein-ring"
                    ref={(el) => {
                      ringEls.current[s] = el;
                    }}
                  />
                ))}
                {ARTERY_SLOTS.map((slot, a) => (
                  <path
                    key={`artery-${slot}`}
                    className="eco-vein eco-vein-artery"
                    ref={(el) => {
                      arteryEls.current[a] = el;
                    }}
                  />
                ))}
                {Array.from({ length: ECO_N }, (_, s) => (
                  <g
                    key={`socket-${s}`}
                    className="eco-socket"
                    ref={(el) => {
                      socketEls.current[s] = el;
                    }}
                  >
                    <circle className="eco-socket-halo" r="9" />
                    <circle className="eco-socket-core" r="3" />
                  </g>
                ))}
              </svg>
              <span className="organism-center" ref={centerEl}>
                {centerLabel}
              </span>
              <ul className="organism-nodes" aria-label={ecosystemLabel}>
                {ECO_ORDER.map((nodeIdx, slot) => {
                  const n = nodes[nodeIdx];
                  if (!n) return null;
                  const descriptionId = `ecosystem-node-${slot}-description`;
                  const open = openEcoNode === slot;
                  return (
                    <li
                      key={n.name}
                      className="organism-node"
                      data-open={open ? "true" : "false"}
                      ref={(el) => {
                        nodeEls.current[slot] = el;
                      }}
                    >
                      <button
                        type="button"
                        className="organism-node-trigger"
                        tabIndex={ecoKeyboardEnabled ? 0 : -1}
                        aria-expanded={open}
                        aria-controls={descriptionId}
                        aria-describedby={descriptionId}
                        onClick={() => setOpenEcoNode(open ? null : slot)}
                        onPointerEnter={() => setHovSlot(slot)}
                        onPointerLeave={() => setHovSlot(-1)}
                        onFocus={() => setHovSlot(slot)}
                        onBlur={() => setHovSlot(-1)}
                      >
                        <span className="organism-node-index">
                          {String(slot + 1).padStart(2, "0")}
                        </span>
                        <span className="organism-node-name">{n.name}</span>
                      </button>
                      {/* read by AT via aria-describedby; sighted users read
                          the same line in the HUD readout */}
                      <span id={descriptionId} className="organism-node-cap">
                        {n.tooltip}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {/* the readout — mission-control line for the touched organ */}
              <div className="eco-hud" aria-hidden="true">
                <span className="eco-hud-meter" ref={hudMeterEl} />
                {activeSlot >= 0 && nodes[ECO_ORDER[activeSlot]] ? (
                  <>
                    <span className="eco-hud-line">
                      <b>{String(activeSlot + 1).padStart(2, "0")}</b>
                      {" · "}
                      {nodes[ECO_ORDER[activeSlot]].name}
                      <i>
                        {" — "}
                        {
                          systems[
                            ECO_SYSTEMS.findIndex((sys) =>
                              sys.slots.includes(activeSlot),
                            )
                          ]
                        }
                      </i>
                    </span>
                    <span className="eco-hud-cap">
                      {nodes[ECO_ORDER[activeSlot]].tooltip}
                    </span>
                  </>
                ) : (
                  <span className="eco-hud-line">{centerLabel}</span>
                )}
              </div>
            </div>,
            ecoHost,
          )}
        {/* Score-driven light stays above both story layers and below chrome. */}
        {enabled && cine && fEco === null && <CinematicVeils />}
        <div className="journey-content">{children}</div>
      </div>
    </HeroLiquidContext.Provider>
  );
}
