"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/animation/reduced-motion";

/**
 * Two-layer cyan cursor (S1.5): an exact-tracking dot + a lagging ring that
 * grows over interactive / [data-cursor="hover"] elements. Disabled on
 * coarse pointers (touch) and under reduced motion — native cursor restored.
 */
export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: fine)").matches;

    if (!fine || reduced) {
      setEnabled(false);
      document.body.classList.remove("cursor-none");
      return;
    }

    setEnabled(true);
    document.body.classList.add("cursor-none");

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;

    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      }
    };

    const onOver = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const hovering = !!target?.closest(
        '[data-cursor="hover"], a, button, input, textarea, [role="button"]',
      );
      document.documentElement.classList.toggle("cursor-hovering", hovering);
    };

    let raf = 0;
    const tick = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerover", onOver);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      document.body.classList.remove("cursor-none");
      document.documentElement.classList.remove("cursor-hovering");
    };
  }, [reduced]);

  if (!enabled) return null;

  return (
    <>
      <div ref={ringRef} className="cursor-ring" aria-hidden="true" />
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
    </>
  );
}
