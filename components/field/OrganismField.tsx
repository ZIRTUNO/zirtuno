"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { detectFieldTier, type FieldTier } from "@/lib/webgl/field-tier";
import {
  makeOrganismDriver,
  ecoNodePos,
  ecoNodeEnv,
  arrive,
  clamp01,
  smooth01,
} from "@/lib/webgl/field-drivers";
import { LogoMark } from "@/components/hero/LogoMark";

// the unified liquid field is client-only (WebGL2) → lazy, no SSR.
const FieldStage = dynamic(() => import("@/components/field/FieldStage"), {
  ssr: false,
});

export type EcoNode = { name: string; tooltip: string };

// choreography map over the section progress c ∈ [0,1]:
//   c 0 → 0.55  the converge (dispersed → the resolved organism)
//   c 0.52 → 0.92  tendrils grow outward; labels arrive with them
const CONV_END = 0.55;
const GROW_START = 0.52;
const GROW_SPAN = 0.4;

/**
 * S4 remake — the ORGANISM: a full-bleed liquid stage. Fragments (S3's
 * vocabulary) converge into the breathing mark at the centre; then the same
 * droplets become liquid TENDRILS growing outward to ten capability labels,
 * pulsing continuously — the organism feeding its capabilities. No SVG
 * spokes, no orbit ring: one material for everything. Desktop pins and
 * scroll-scrubs (~250vh); mobile plays once, timed. Reduced-motion / "none"
 * gets the static mark with the labels resolved.
 *
 * QA: ?feco=c freezes the whole choreography at c ∈ [0,1].
 */
export function OrganismField({
  nodes,
  centerLabel,
  headline,
}: {
  nodes: EcoNode[];
  centerLabel: string;
  headline: string;
}) {
  const reduced = useReducedMotion();
  const [wrapRef, inView, seen] = useInView<HTMLDivElement>("300px");
  const [tier, setTier] = useState<FieldTier | null>(null);
  const [desktop, setDesktop] = useState(false);
  const [fEco, setFEco] = useState<number | null>(null);
  const nodeEls = useRef<(HTMLLIElement | null)[]>([]);
  const centerEl = useRef<HTMLSpanElement>(null);

  const [driver, conv, grow] = useMemo(() => {
    const c = { current: 1 };
    const g = { current: 0 };
    return [makeOrganismDriver(c, g), c, g] as const;
  }, []);

  useEffect(() => {
    setTier(detectFieldTier());
    const fc = new URLSearchParams(window.location.search).get("feco");
    if (fc !== null) {
      const c = Number(fc);
      if (Number.isFinite(c) && c >= 0 && c <= 1) setFEco(c);
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const enabled = !reduced && (tier === "full" || tier === "lite");

  /** Apply section progress c: driver inputs + label/centre reveal (imperative
   *  DOM writes — no React re-render on scroll). */
  const applyC = useCallback(
    (c: number) => {
      conv.current = 1 - clamp01(c / CONV_END);
      grow.current = clamp01((c - GROW_START) / GROW_SPAN);
      const g = grow.current;
      nodeEls.current.forEach((el, i) => {
        if (!el) return;
        const e = ecoNodeEnv(g, i);
        el.style.opacity = String(e);
        el.style.transform = `translate(-50%, -50%) translateY(${((1 - e) * 10).toFixed(1)}px)`;
      });
      if (centerEl.current)
        centerEl.current.style.opacity = String(smooth01((g - 0.1) / 0.35));
    },
    [conv, grow],
  );

  // label geometry: same ECO_NODES math as the canvas beads (uv, y up → CSS)
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const layout = () => {
      const r = wrap.getBoundingClientRect();
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
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [wrapRef, nodes.length]);

  // deterministic QA hold (?feco=c) — supersedes scrub/tween
  useEffect(() => {
    if (fEco === null) return;
    applyC(fEco);
  }, [fEco, applyC]);

  // static paths (reduced motion / "none" tier): everything resolved
  useEffect(() => {
    if (enabled || tier === null) return;
    applyC(1);
  }, [enabled, tier, applyC]);

  // Desktop: pin the stage and scrub the whole choreography (~250vh).
  useEffect(() => {
    if (!enabled || !desktop || fEco !== null) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    gsap.registerPlugin(ScrollTrigger);
    const st = ScrollTrigger.create({
      trigger: wrap,
      start: "top top",
      end: "+=150%",
      pin: true,
      scrub: 0.6,
      onUpdate: (self) => applyC(self.progress),
    });
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 300);
    return () => {
      window.clearTimeout(id);
      st.kill();
    };
  }, [enabled, desktop, fEco, wrapRef, applyC]);

  // Mobile / no-pin: the choreography plays once, timed, when first seen.
  useEffect(() => {
    if (!enabled || desktop || !seen || fEco !== null) return;
    let raf = 0;
    const t0 = performance.now();
    const DUR = 4200;
    const tick = (now: number) => {
      const p = Math.min((now - t0) / DUR, 1);
      applyC(arrive(p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, desktop, seen, fEco, wrapRef, applyC]);

  return (
    <div className="organism" data-organism ref={wrapRef} role="group" aria-label={headline}>
      {enabled && seen ? (
        <div className="organism-stage" aria-hidden="true">
          <FieldStage
            driver={driver}
            play={inView}
            tier={tier === "lite" ? "lite" : "full"}
          />
        </div>
      ) : (
        <div className="organism-fallback">
          <LogoMark ariaLabel={centerLabel} />
        </div>
      )}
      <span className="organism-center" ref={centerEl}>
        {centerLabel}
      </span>
      <ul className="organism-nodes" aria-label={headline}>
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
  );
}
