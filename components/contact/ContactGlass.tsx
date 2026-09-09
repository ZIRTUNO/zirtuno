"use client";

import { useEffect, useId, useRef } from "react";

/** Optical enhancement only. No text, input or hit target is filtered.
 * Real backdrop displacement in supporting browsers; a laminated CSS surface
 * remains complete if URL filters or the optional module are unavailable.
 */
export function ContactGlass() {
  const ref = useRef<HTMLSpanElement>(null);
  const id = `contact-glass-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let stopped = false;
    let cleanup: (() => void) | undefined;
    void Promise.all([
      import("@/lib/forms/glass-map"),
      import("@/lib/motion/membrane-runtime"),
    ]).then(([{ glassMap }, runtime]) => {
      if (stopped) return;
      const map = el.querySelector("feImage");
      const host = el.parentElement!;
      let w = 0, h = 0;
      const measure = () => {
        const nw = host.offsetWidth, nh = host.offsetHeight;
        if (nw < 2 || nh < 2 || (nw === w && nh === h)) return;
        w = nw; h = nh;
        const uri = glassMap(w, h);
        const image = new Image();
        image.src = uri;
        void image.decode().then(() => {
          if (stopped || w !== nw || h !== nh) return;
          // Percentages on feImage resolve against the zero-sized definitions
          // SVG in Chromium. Explicit pixels keep the normal map in the lens's
          // own space rather than sampling an empty (black) image everywhere.
          el.querySelector("filter")?.setAttribute("width", String(w));
          el.querySelector("filter")?.setAttribute("height", String(h));
          map?.setAttribute("width", String(w));
          map?.setAttribute("height", String(h));
          map?.setAttribute("href", uri);
          el.style.setProperty("--glass-filter", `url(#${id})`);
          el.dataset.optical = "";
        }).catch(() => { /* Keep the readable CSS surface if decoding fails. */ });
      };
      const ro = new ResizeObserver(measure);
      ro.observe(host);
      measure();
      let x = 0.35, target = x, last = 0;
      const mem = {
        hand(px: number | null) {
          target = px === null ? 0.35 : Math.max(0, Math.min(1, px / (w || 1)));
        },
        step(t: number) {
          const dt = last ? Math.min(48, t - last) : 16;
          last = t;
          const delta = target - x;
          if (Math.abs(delta) < 0.0005) return false;
          x += delta * (1 - Math.exp(-dt / 135));
          return true;
        },
        get asleep() { return Math.abs(target - x) < 0.0005; },
      };
      const unregister = runtime.membraneMode() === "off" ? () => {} : runtime.registerMembrane({
        el: host, mem, visible: true, rect: null,
        draw() { el.style.setProperty("--glass-light", `${(x * 100).toFixed(2)}%`); },
      });
      cleanup = () => { ro.disconnect(); unregister(); delete el.dataset.optical; };
    }).catch(() => { /* The CSS laminate is the complete fallback. */ });
    return () => { stopped = true; cleanup?.(); };
  }, [id]);

  return (
    <span className="contact-glass" ref={ref} aria-hidden="true">
      <svg className="contact-glass-defs" width="0" height="0" focusable="false">
        <defs>
          <filter id={id} x="0" y="0" width="1" height="1" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feImage result="normals" width="100%" height="100%" preserveAspectRatio="none" />
            <feDisplacementMap in="SourceGraphic" in2="normals" scale="18" xChannelSelector="R" yChannelSelector="G" />
            <feGaussianBlur stdDeviation="0.65" />
          </filter>
        </defs>
      </svg>
      <span className="contact-glass-transmission" />
      <span className="contact-glass-rim" />
    </span>
  );
}
