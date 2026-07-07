"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { detectFieldTier, type FieldTier } from "@/lib/webgl/field-tier";
import {
  makeMethodDriver,
  clamp01,
  type MethodInput,
} from "@/lib/webgl/field-drivers";

// the unified liquid field is client-only (WebGL2) → lazy, no SSR.
const FieldStage = dynamic(() => import("@/components/field/FieldStage"), {
  ssr: false,
});

/**
 * MethodFlow — S6 on the house runway pattern: a sticky liquid stage under
 * five ~viewport copy blocks. The liquid REHEARSES the client's
 * transformation, one phase dominant at a time (fragmented cloud + probe →
 * lattice → three masses → the exact mark → growth), locked to the copy the
 * reader is on via one continuous phase coordinate; the driver damps it and
 * flows every droplet with its own inertia. A vertical thread beside the
 * copy fills with progress (the old drawn connector, reborn). Static tiers /
 * reduced motion collapse the runway to the plain numbered list.
 */
export function MethodFlow({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const [wrapRef, inView, seen] = useInView<HTMLDivElement>("300px");
  const [tier, setTier] = useState<FieldTier | null>(null);

  const [driver, input] = useMemo(() => {
    const inp: MethodInput = { u: 0, ex: 0 };
    return [makeMethodDriver(inp), inp] as const;
  }, []);

  useEffect(() => {
    setTier(detectFieldTier());
  }, []);

  const enabled = !reduced && (tier === "full" || tier === "lite");

  // ── the ONE progress source: the phase coordinate from the copy blocks ──────
  useEffect(() => {
    if (tier === null) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (!enabled) {
      input.u = 0;
      input.ex = 0;
      wrap.style.setProperty("--method-flow", "1"); // static thread reads full
      return;
    }
    const blocks = Array.from(
      wrap.querySelectorAll<HTMLElement>(".method-phase"),
    );
    if (blocks.length < 2) return;

    let raf = 0;
    let lastU = -1;
    const update = () => {
      raf = requestAnimationFrame(update);
      if (!inView) return;
      const cy = window.innerHeight * 0.5;
      const centers = blocks.map((el) => {
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2;
      });
      let u: number;
      if (cy <= centers[0]) u = 0;
      else if (cy >= centers[centers.length - 1]) u = centers.length - 1;
      else {
        let k = 0;
        while (k < centers.length - 2 && centers[k + 1] <= cy) k++;
        u = k + (cy - centers[k]) / Math.max(centers[k + 1] - centers[k], 1);
      }
      input.u = u;
      // the liquid settles away across the last half-viewport of the runway,
      // so the sticky layer never unsticks with visible liquid aboard
      const wr = wrap.getBoundingClientRect();
      input.ex = clamp01(1 - (wr.bottom - window.innerHeight) / (window.innerHeight * 0.45));
      if (Math.abs(u - lastU) > 0.004) {
        lastU = u;
        wrap.style.setProperty(
          "--method-flow",
          clamp01(u / (blocks.length - 1)).toFixed(4),
        );
      }
    };
    update();
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled, tier, inView, input, wrapRef]);

  return (
    <div
      ref={wrapRef}
      className="liquid-journey method-journey"
      data-liquid={enabled ? "live" : "static"}
    >
      <div className="journey-layer">
        {enabled && seen && (
          <div className="journey-canvas" aria-hidden="true">
            <FieldStage
              driver={driver}
              play={inView}
              tier={tier === "lite" ? "lite" : "full"}
            />
          </div>
        )}
      </div>
      <div className="journey-content">{children}</div>
    </div>
  );
}
