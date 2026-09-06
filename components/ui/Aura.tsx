"use client";

import { useEffect, useRef } from "react";
import { clamp01, smooth01 } from "@/lib/webgl/phys.mjs";
import { startAura } from "@/lib/webgl/aura-gl";
import { detectFieldTier } from "@/lib/webgl/field-tier";
import { prefersReducedMotion } from "@/lib/animation/reduced-motion";

/**
 * The aura (R8) — the page's atmosphere: a lit volume and a drift of suspended
 * vapour over the ink, so the ground reads as depth rather than as an unlit
 * panel. The composition and the amplitudes live with the CSS; see THE AURA in
 * `globals.css`, and `lib/webgl/aura-shaders.mjs` for what the vapour is.
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
 *   rather than one photographed volume. It is also, with the reference's
 *   stack in mind, the layer doing the most work — utopia513.com carries its
 *   whole material quality in grain over a smooth ground.
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

  // ── the vapour ──────────────────────────────────────────────────────────────
  // `data-gl` is set only once a context compiled, linked and produced a
  // complete float target. Without it the CSS ground stands alone, which is a
  // deliberate and complete background rather than a broken one: there is no
  // second texture to fall back to, because the fog-like SVG turbulence that
  // used to sit under this canvas was the very thing the particle field
  // replaced.
  useEffect(() => {
    const canvas = vapour.current;
    const aura = ref.current;
    if (!canvas || !aura) return;
    // The probe, not a GPU-name guess (AGENTS.md §7). It is cached per session,
    // and on the homepage PageStage has usually asked for it already.
    const tier = detectFieldTier();
    if (tier === "none") return;
    const handle = startAura(
      canvas,
      prefersReducedMotion(),
      tier === "lite" ? "lite" : "full",
    );
    if (!handle) return;
    aura.dataset.gl = "1";
    const w = window as unknown as { __aura?: typeof handle.stats };
    w.__aura = handle.stats;
    return () => {
      handle.stop();
      delete aura.dataset.gl;
      if (w.__aura === handle.stats) delete w.__aura;
    };
  }, []);

  // ── the hero gate ───────────────────────────────────────────────────────────
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
