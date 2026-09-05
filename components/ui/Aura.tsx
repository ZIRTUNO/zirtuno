"use client";

import { useEffect, useRef } from "react";
import { clamp01, smooth01 } from "@/lib/webgl/phys.mjs";
import { startAura } from "@/lib/webgl/aura-gl";
import { AURA } from "@/lib/webgl/aura-shaders.mjs";
import { prefersReducedMotion } from "@/lib/animation/reduced-motion";

/**
 * The aura (R8) — the page's atmosphere: a lit cyan volume and a drift of
 * vapour over the ink, so the ground reads as depth rather than as an unlit
 * panel. Adapted from the reference the owner brought (utopia513.com), which
 * solves the same flat-ground problem with a bloom and grain over dark navy.
 *
 * The composition, the amplitude and the reasons this is not a shader all live
 * with the CSS — see THE AURA in `globals.css`.
 *
 * Two things are load-bearing about WHERE this is rendered:
 *
 *   IT IS SITE-WIDE. It mounts in the locale layout, not in a page, because the
 *   flat ground is worst on the routes that have no liquid at all — work,
 *   careers, contact, legal. The homepage is the one route that already had
 *   something in the frame.
 *
 *   IT PRECEDES <BreathLayer />. Both layers sit at z-1, so DOM order is what
 *   orders them, and the film grain has to composite ON TOP of the vapour.
 *   Grain is a property of the camera, not of the air: underneath, it would be
 *   a texture the atmosphere is laid over, which reads as two flat sheets
 *   rather than one photographed volume.
 *
 * ── THE HERO IS BLACK (owner directive) ──────────────────────────────────────
 *
 * The homepage opens on ink and the ribbon, and nothing else: the atmosphere
 * begins BELOW the wave, once the hero has been scrolled off. `--aura-hero`
 * is that gate, and it multiplies the layer's whole gain.
 *
 * WHY THE STARTING STATE IS CSS AND NOT THIS COMPONENT. `globals.css` parks the
 * gate at 0 for the homepage via `body:has(.liquid-journey)`, so the hero is
 * already black in the FIRST PAINTED FRAME — server-rendered, before any of
 * this runs. Opening it here instead would paint the hero lit and then snap it
 * dark at hydration, which is a flash on the one screen that must be still.
 *
 * WHY IT IS SCRUBBED AND NOT FADED. The gate is a pure function of where the
 * hero sits in the viewport — scroll up and it runs exactly backwards. Nothing
 * is on a timer, so there is no reveal to catch, in either direction.
 *
 * WHY IT COSTS NOTHING TO SCROLL PAST. The frame loop is armed by an
 * IntersectionObserver on the hero and parked the moment the hero leaves, so it
 * runs for one screen of the homepage and never again — and never at all on a
 * route with no `#hero`, which is every other route on the site. The observer
 * is deliberately NOT a scroll listener: Lenis owns smooth scrolling here and
 * native scroll events arrive about twice per 900px and hundreds of pixels
 * stale, which would make the gate visibly lag the wave.
 */
export function Aura() {
  const ref = useRef<HTMLDivElement>(null);
  const vapour = useRef<HTMLCanvasElement>(null);

  // ── the live field ──────────────────────────────────────────────────────────
  // The canvas carries the CSS turbulence as its own background-image, so the
  // static vapour is not a separate fallback element that has to be kept in
  // sync — it is simply what is behind the canvas until something paints over
  // it. `data-gl` is set only once a context actually compiled and linked, and
  // the CSS drops the image on that signal. WebGL2 refused, shader rejected,
  // context lost at startup: all land on the same tuned static field.
  useEffect(() => {
    const canvas = vapour.current;
    const aura = ref.current;
    // AURA.LIVE false is the owner choosing the calm ground: the static CSS
    // turbulence under the canvas is then the whole vapour, which is the same
    // path a refused context takes. Nothing else needs to know.
    if (!canvas || !aura || !AURA.LIVE) return;
    const handle = startAura(canvas, prefersReducedMotion());
    if (!handle) return;
    aura.dataset.gl = "1";
    return () => {
      handle.stop();
      delete aura.dataset.gl;
    };
  }, []);

  useEffect(() => {
    const aura = ref.current;
    const hero = document.getElementById("hero");
    // No hero on this route: the CSS default already leaves the gate open.
    if (!aura || !hero) return;

    let raf = 0;
    let last = -1;
    const write = (v: number) => {
      // Only touch the DOM when the value actually moves — this runs per frame.
      const q = Math.round(v * 1000) / 1000;
      if (q === last) return;
      last = q;
      aura.style.setProperty("--aura-hero", String(q));
    };

    const tick = () => {
      const r = hero.getBoundingClientRect();
      // How far the hero has travelled off the top, as a fraction of itself.
      const gone = clamp01(-r.top / Math.max(1, r.height));
      // The ribbon sits at the hero's bottom edge, so the atmosphere has no
      // business arriving until that edge is on its way out: hold at nothing
      // through the first half, then come up over the remainder.
      write(smooth01((gone - 0.5) / 0.5));
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (!raf) raf = requestAnimationFrame(tick);
        } else {
          if (raf) cancelAnimationFrame(raf);
          raf = 0;
          // Past the hero for good — park the gate fully open and stop paying
          // for it. Scrolling back re-arms the observer and resumes the scrub.
          write(1);
        }
      },
      { threshold: 0 },
    );
    io.observe(hero);

    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      aura.style.removeProperty("--aura-hero");
    };
  }, []);

  return (
    <div className="aura" aria-hidden="true" ref={ref}>
      <div className="aura-lights" />
      <canvas className="aura-vapour" ref={vapour} />
    </div>
  );
}
