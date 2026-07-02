"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { detectFieldTier, type FieldTier } from "@/lib/webgl/field-tier";
import {
  makeJourneyDriver,
  ecoNodePos,
  ecoNodeEnv,
  clamp01,
  smooth01,
  type JourneyInput,
} from "@/lib/webgl/field-drivers";

// the unified liquid field is client-only (WebGL2) → lazy, no SSR.
const FieldStage = dynamic(() => import("@/components/field/FieldStage"), {
  ssr: false,
});

export type EcoNode = { name: string; tooltip: string };

// choreography of the eco runway progress pr ∈ [0,1]:
const CONV_END = 0.5; // converge completes at half the runway
const GROW_START = 0.46;
const GROW_SPAN = 0.38;
// within each service gap: rest, then melt across the middle window
const MELT_LO = 0.35;
const MELT_HI = 0.65;

/**
 * LiquidChapters — ONE persistent fluid renderer for the whole Problem →
 * Ecosystem → Services sequence (the transition-system fix). A single sticky
 * full-viewport canvas stays mounted under all three chapters; a single
 * rAF-throttled scroll source measures the copy (symptom shards, the eco
 * runway, the service pillars) and writes the journey's control channels; the
 * journey driver damps and interpolates everything. No GSAP pins, no per-
 * chapter canvases, no handoffs — the 48 droplets keep their identity from
 * the first fracture to the last service melt.
 *
 * The ecosystem labels live HERE (in the sticky layer), anchored to the same
 * ECO_NODES math the tendril beads use, and only enter after the organism has
 * resolved. Deterministic layering: canvas z-0 (pointer-events none), copy
 * z-10. Reduced-motion / "none" tier renders no canvas and flags the wrapper
 * `data-liquid="static"` so the chapters' static fallbacks show instead.
 *
 * QA: ?feco=c freezes the S4 choreography at c ∈ [0,1].
 */
export function LiquidChapters({
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
  const nodeEls = useRef<(HTMLLIElement | null)[]>([]);
  const centerEl = useRef<HTMLSpanElement>(null);

  const [driver, input] = useMemo(() => {
    const inp: JourneyInput = {
      fracture: 0,
      travel: 0,
      converge: 0,
      grow: 0,
      svcPos: 0,
      pair: [0, 0, 0],
    };
    return [makeJourneyDriver(inp), inp] as const;
  }, []);

  useEffect(() => {
    setTier(detectFieldTier());
    const fc = new URLSearchParams(window.location.search).get("feco");
    if (fc !== null) {
      const c = Number(fc);
      if (Number.isFinite(c) && c >= 0 && c <= 1) setFEco(c);
    }
  }, []);

  // QA visibility: the journey's live channel values (read-only diagnostics)
  useEffect(() => {
    (window as unknown as { __journey?: JourneyInput }).__journey = input;
  }, [input]);

  const enabled = !reduced && (tier === "full" || tier === "lite");

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

  // ── the ONE scroll-progress source ─────────────────────────────────────────
  useEffect(() => {
    if (tier === null) return; // wait for the tier probe (static path included)
    const wrap = wrapRef.current;
    if (!wrap) return;

    const applyLabels = (grow: number, svcPos: number) => {
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
      input.fracture = 1;
      input.travel = 1;
      input.converge = clamp01(c / CONV_END);
      input.grow = clamp01((c - GROW_START) / GROW_SPAN);
      input.svcPos = 0;
      input.pair = [0, 0, 0];
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

    const symptoms = Array.from(
      wrap.querySelectorAll<HTMLElement>("#problem .symptom"),
    );
    const runway = wrap.querySelector<HTMLElement>("[data-organism]");
    const pillars = Array.from(
      wrap.querySelectorAll<HTMLElement>("#services .pillar"),
    );
    const layer = layerRef.current;

    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const cy = vh * 0.5;

      // S3 — the fracture, one notch per symptom shard
      if (symptoms.length >= 2) {
        const u = coordAt(cy, centersOf(symptoms));
        const kk = Math.floor(u);
        const frac = u - kk;
        const stepped =
          kk + smooth01((frac - 0.25) / 0.5); // hold on each shard, push between
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

      // S4 → S5 handoff + the service melts
      if (pillars.length >= 2) {
        const first = pillars[0].getBoundingClientRect();
        input.svcPos = clamp01((vh * 0.95 - first.top) / (vh * 0.75));
        if (input.svcPos > 0.02) {
          // virtual pre-pillar centre gives the organism → pillar-1 melt a runway
          const centers = centersOf(pillars);
          const virtual = centers[0] - vh * 0.85;
          const uu = coordAt(cy, [virtual, ...centers]) - 1; // ∈ [-1, n-1]
          const idx = Math.floor(uu);
          const frac = uu - idx;
          const m =
            frac <= MELT_LO ? 0 : frac >= MELT_HI ? 1 : (frac - MELT_LO) / (MELT_HI - MELT_LO);
          const A = Math.max(idx + 1, 0);
          const B = Math.min(idx + 2, 7);
          input.pair = [A, B, m];
        } else {
          input.pair = [0, 0, 0];
        }
      }

      applyLabels(input.grow, input.svcPos);

      // narrow stages: the liquid dims to pure atmosphere behind dense copy
      if (layer) {
        const narrow = layer.clientWidth < 1024;
        const busy =
          input.converge < 0.15 || input.svcPos > 0.4 || input.grow > 0.75;
        layer.style.opacity = narrow && busy ? "0.4" : "1";
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [enabled, tier, fEco, input, wrapRef]);

  return (
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
  );
}
