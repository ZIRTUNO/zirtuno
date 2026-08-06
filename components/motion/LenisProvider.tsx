"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { getLenis, setLenis } from "@/lib/animation/lenis-store";
import { takeHashLanding } from "@/lib/animation/hash-landing";

/**
 * Smooth scroll (S1.6). Lenis drives scroll; ScrollTrigger reads it.
 * Integration rule (references.md): sync lenis.raf to gsap.ticker and push
 * lenis 'scroll' into ScrollTrigger.update. Disabled under reduced motion.
 */
export default function LenisProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const pathname = usePathname();

  useEffect(() => {
    if (reduced) return;

    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      lerp: 0.09, // calm, tuned inertia
      wheelMultiplier: 0.9,
      smoothWheel: true,
    });

    lenis.on("scroll", ScrollTrigger.update);
    setLenis(lenis); // imperative scrolls (same-page CTA path) go through this

    const onTick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(onTick);
      setLenis(null);
      lenis.destroy();
    };
  }, [reduced]);

  // Land on the requested chapter after a real navigation — a locale switch
  // carrying `#contact`, or any deep link. Two things defeat the browser's
  // native hash jump on this page: Lenis rewrites window.scrollY every frame,
  // and the homepage keeps GROWING for a second or so as chapters stream in and
  // the liquid stage measures itself, which walks the anchor out from under a
  // one-shot jump. So the landing is HELD: re-pin every frame until the target
  // stops moving, with a hard ceiling — and abandon it the moment the visitor
  // touches the scroll themselves.
  useEffect(() => {
    const target = takeHashLanding() ?? window.location.hash;
    if (!target || target === "#") return;
    const id = decodeURIComponent(target.slice(1));

    let raf = 0;
    let frames = 0;
    let stable = 0;
    let lastTop = Number.NaN;
    let lastHeight = -1;
    let released = false;

    const release = () => {
      released = true;
      cancelAnimationFrame(raf);
    };
    const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    events.forEach((type) =>
      window.addEventListener(type, release, { once: true, passive: true }),
    );

    const step = () => {
      if (released) return;
      const el = document.getElementById(id);
      if (el) {
        // Honour the anchor's own scroll-margin so the chapter clears the fixed
        // TopBar exactly as a native hash jump would. The destination is
        // resolved to an ABSOLUTE offset here rather than handed to Lenis as an
        // element: Lenis measures elements against its own animated scroll
        // position, which lags the real one mid-settle and left the landing a
        // topbar's height short.
        const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        const to = Math.max(
          0,
          Math.round(el.getBoundingClientRect().top + window.scrollY - margin),
        );
        const lenis = getLenis();
        if (lenis) lenis.scrollTo(to, { immediate: true, force: true });
        else window.scrollTo(0, to);
        // Released only when the anchor AND the document have both stopped
        // moving: the chapters stream in and the sticky liquid stage remeasures,
        // so a momentarily steady anchor is not yet a settled page.
        const top = Math.round(el.getBoundingClientRect().top);
        const height = document.documentElement.scrollHeight;
        stable =
          Math.abs(top - lastTop) <= 1 && height === lastHeight ? stable + 1 : 0;
        lastTop = top;
        lastHeight = height;
        if (frames > 40 && stable >= 12) return release();
      }
      if (frames++ < 300) raf = requestAnimationFrame(step); // ~5 s ceiling
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      events.forEach((type) => window.removeEventListener(type, release));
    };
  }, [pathname, reduced]);

  return <>{children}</>;
}
