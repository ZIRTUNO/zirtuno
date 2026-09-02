"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * The floating bar's one piece of state.
 *
 * At rest the bar is thin glass: the liquid reads straight through it, which is
 * the point of parking chrome over a persistent canvas. Once the page moves it
 * densifies and lifts, because from then on there is real copy passing
 * underneath and a 52%-ink plate cannot hold a mono label against a moving cyan
 * field. Both states live in `globals.css` — this only says WHICH, so with no
 * JS the bar stays in the resting state, which is the correct one over the hero.
 *
 * READ THROUGH A SENTINEL, NOT THROUGH `scroll`. Lenis drives this page and
 * rewrites `window.scrollY` from inside a rAF (see LenisProvider's note), and
 * the native `scroll` event does not keep up with it: measured here, a 900px
 * travel emitted TWO events, the last of them reporting a position 896px stale.
 * A velocity heuristic can absorb that — `membrane-runtime`'s tide does — but a
 * boolean cannot, and the bar latched settled while sitting at scrollY 4.
 *
 * An IntersectionObserver on a `SETTLE_AT`-tall box pinned to the top of the
 * document answers the question geometrically instead: it is true whenever that
 * band is off screen, no matter who moved the page or how, with no per-frame
 * work and nothing to fall out of sync. Same instrument the chapter rail uses
 * for the same class of question.
 *
 * The threshold is applied as the sentinel's own height rather than declared in
 * `globals.css`, because the box IS the threshold — split across two files they
 * would drift, and the drift would be invisible until the bar densified at the
 * wrong moment. The stylesheet keeps only the sentinel's placement.
 */
const SETTLE_AT = 24;

export function TopBarShell({ children }: { children: ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [settled, setSettled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setSettled(!entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    let observer: IntersectionObserver | null = null;
    const frame = requestAnimationFrame(() => {
      const footer = document.querySelector<HTMLElement>(".footer");
      if (!footer) {
        root.removeAttribute("data-footer-coda");
        return;
      }

      observer = new IntersectionObserver(
        ([entry]) => {
          root.toggleAttribute(
            "data-footer-coda",
            entry.isIntersecting && entry.intersectionRatio >= 0.24,
          );
        },
        { threshold: [0, 0.24] },
      );
      observer.observe(footer);
    });

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      root.removeAttribute("data-footer-coda");
    };
  }, [pathname]);

  return (
    <>
      <div
        ref={sentinel}
        className="topbar-sentinel"
        style={{ height: SETTLE_AT }}
        aria-hidden="true"
      />
      <header className="topbar" data-settled={settled ? "" : undefined}>
        {children}
      </header>
    </>
  );
}
