"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { sampleWordmarkGlyphs } from "@/lib/animation/wordmark-targets";
import { setSpellSamples } from "@/lib/webgl/mist-store";

/**
 * S7 · the resolution's wordmark (R7).
 *
 * The name is TYPE — server-rendered, crisp, the thing every path reads. On
 * the live path it is also the last thing THE MIST does: the same vapour that
 * made the mark is drawn onto these letterforms (lib/webgl/mist.mjs, the
 * `spell` regime), and the type fades in over it as the vapour fades out. The
 * two agree because the vapour's targets are sampled from THIS element's
 * rendered glyphs (lib/animation/wordmark-targets.ts) and mapped through its
 * measured box every frame (the origin scene's `word` anchor).
 *
 * The crossfade is the director's (OriginDirector.tsx): the glyphs start
 * hidden only once the chapter's clock is live, so reduced motion, static
 * tiers and no-JS all show the name at once. This component only publishes
 * the samples — after the brand font has landed, and again whenever the box
 * resizes — and withdraws them on unmount. `window.__originSpell` reports the
 * sample count for the browser gate.
 *
 * The Canvas-2D particle assembly this replaced (lib/animation/
 * wordmark-particles.ts) survives for the entry veil; here it was a second
 * particle system of a different material, drawn on a second canvas.
 */
export function OriginWordmark({ text }: { text: string }) {
  const reduced = useReducedMotion();
  const glyphRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduced) {
      setSpellSamples(null);
      return;
    }
    const el = glyphRef.current;
    if (!el) return;
    let alive = true;
    let raf = 0;
    const publish = () => {
      raf = 0;
      if (!alive) return;
      const samples = sampleWordmarkGlyphs(el, text);
      setSpellSamples(samples);
      (window as unknown as { __originSpell?: number }).__originSpell = samples
        ? samples.length >> 1
        : 0;
    };
    const queue = () => {
      if (!alive || raf) return;
      raf = requestAnimationFrame(publish);
    };
    void (document.fonts?.ready ?? Promise.resolve()).then(queue);
    const ro = new ResizeObserver(queue);
    ro.observe(el);
    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      setSpellSamples(null);
    };
  }, [reduced, text]);

  return (
    <div className="origin-wordmark" role="img" aria-label={text}>
      <p className="name-word origin-wordmark-text" aria-hidden="true">
        <span
          ref={glyphRef}
          className="origin-wordmark-glyphs"
          data-origin="wordmark"
        >
          {text}
        </span>
      </p>
    </div>
  );
}
