"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { detectFieldTier, type FieldTier } from "@/lib/webgl/field-tier";
import {
  makeOriginDriver,
  clamp01,
  smooth01,
  type OriginInput,
} from "@/lib/webgl/field-drivers";

// the unified liquid field is client-only (WebGL2) → lazy, no SSR.
const FieldStage = dynamic(() => import("@/components/field/FieldStage"), {
  ssr: false,
});

// the three FOUNDING-pillar labels, anchored beside the mark's three lobes
// (stage units around the mark centre, y up — understated, never cyan-styled)
const PILLAR_ANCHORS: { dx: number; dy: number }[] = [
  { dx: -0.31, dy: 0.05 },
  { dx: 0.3, dy: 0.18 },
  { dx: 0.03, dy: -0.31 },
];
const ORIGIN_OY = 0.06; // keep in sync with the driver's mark staging

/**
 * OriginFlow — S8's five scrubbed beats on the house runway pattern (no pins):
 * a sticky full-viewport liquid stage under a ~550vh runway of beat copy. One
 * rAF progress source writes the driver's single channel; the driver damps it
 * and choreographs: two brothers → the exact mark + three founding-pillar
 * labels → the breathing hold → the ecosystem echo → the drain under the
 * particle wordmark. Reduced motion / "none" tier renders no canvas: the
 * wrapper flags `data-liquid="static"`, the runway collapses to a plain
 * column and the static mark + pillar line (`.journey-static`) show instead.
 */
export function OriginFlow({
  pillars,
  children,
}: {
  pillars: string[];
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const [wrapRef, inView, seen] = useInView<HTMLDivElement>("300px");
  const layerRef = useRef<HTMLDivElement>(null);
  const labelEls = useRef<(HTMLLIElement | null)[]>([]);
  const [tier, setTier] = useState<FieldTier | null>(null);

  const [driver, input] = useMemo(() => {
    const inp: OriginInput = { p: 0 };
    return [makeOriginDriver(inp), inp] as const;
  }, []);

  useEffect(() => {
    setTier(detectFieldTier());
  }, []);

  const enabled = !reduced && (tier === "full" || tier === "lite");

  // label geometry: fixed anchors beside the mark's lobes, aspect-corrected
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const layout = () => {
      const r = layer.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const aspect = r.width / r.height;
      labelEls.current.forEach((el, i) => {
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
  }, [pillars.length]);

  // ── the ONE progress source (runway-anchored, like the site fluid) ──────────
  useEffect(() => {
    if (tier === null) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (!enabled) {
      input.p = 0;
      return;
    }

    let raf = 0;
    let lastP = -1;
    const update = () => {
      raf = requestAnimationFrame(update);
      if (!inView) return; // parked off-screen — nothing to measure
      const vh = window.innerHeight;
      const r = wrap.getBoundingClientRect();
      const p = clamp01(-r.top / Math.max(r.height - vh, 1));
      input.p = p;
      if (Math.abs(p - lastP) < 0.002) return;
      lastP = p;
      // the three labels arrive staggered as the mark resolves, leave at the end
      const gone = 1 - smooth01((p - 0.84) / 0.1);
      labelEls.current.forEach((el, i) => {
        if (!el) return;
        const e = smooth01((p - (0.3 + i * 0.04)) / 0.09) * gone;
        el.style.opacity = String(e);
        el.style.transform = `translate(-50%, -50%) translateY(${((1 - e) * 8).toFixed(1)}px)`;
      });
    };
    update();
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled, tier, inView, input, wrapRef]);

  return (
    <div
      ref={wrapRef}
      className="liquid-journey origin-journey"
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
        {/* decorative floating labels — the accessible pillar line lives in the
            beat-2 copy block (shown on the static path) */}
        <ul className="origin-pillar-labels" aria-hidden="true">
          {pillars.map((p, i) => (
            <li
              key={p}
              className="origin-pillar-label"
              ref={(el) => {
                labelEls.current[i] = el;
              }}
            >
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className="journey-content">{children}</div>
    </div>
  );
}
