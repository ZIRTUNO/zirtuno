"use client";

import { useEffect, useState } from "react";
import { detectFieldTier } from "@/lib/webgl/field-tier";

/**
 * Debug HUD for measuring the glass on real devices — append `?perf=1`. Shows
 * the probed field tier (lib/webgl/field-tier) and the actual internal render
 * resolution of the hero canvas. Off by default, zero cost when not requested.
 */
export function PerfOverlay() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!/[?&]perf=1\b/i.test(window.location.search)) return;
    let tier = "?";
    try {
      tier = detectFieldTier();
    } catch {
      /* ignore */
    }
    let last = 0;
    let raf = 0;
    const tick = (now: number) => {
      if (now - last > 250) {
        last = now;
        const w = window as unknown as { __zglassFps?: number; __zglassDpr?: number };
        const c = document.querySelector(
          "[data-hero-metaball] canvas",
        ) as HTMLCanvasElement | null;
        const res = c ? `${c.width}×${c.height}` : "SVG";
        setText(
          `tier ${tier} · ${w.__zglassFps ?? "–"} fps · dpr ${
            w.__zglassDpr ?? "–"
          } · ${res}`,
        );
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (text === null) return null;
  return (
    <div className="perf-overlay" role="status" aria-live="off">
      {text}
    </div>
  );
}
