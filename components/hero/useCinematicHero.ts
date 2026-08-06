"use client";

import { useEffect, useState, type RefObject } from "react";

/** One authored clock drives the headline exchange and the proof sequence. */
export const HERO_CYCLE_MS = 3000;

export function useCinematicCycle(
  count: number,
  reduced: boolean,
  hostRef: RefObject<HTMLElement | null>,
) {
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || reduced || count < 2) return;

    let timer = 0;
    let inView = true;

    const stop = () => window.clearTimeout(timer);
    const schedule = () => {
      stop();
      if (!inView || document.hidden) return;
      timer = window.setTimeout(() => {
        setCycle((current) => current + 1);
        schedule();
      }, HERO_CYCLE_MS);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        schedule();
      },
      { threshold: 0.3 },
    );
    observer.observe(host);

    const onVisibility = () => schedule();
    document.addEventListener("visibilitychange", onVisibility);
    schedule();

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [count, hostRef, reduced]);

  return cycle;
}

/**
 * Frame-rate-independent, demand-driven camera drift. It runs only while the
 * pointer is moving or the plane is settling, then parks at rest.
 */
export function useCinematicCamera(
  hostRef: RefObject<HTMLElement | null>,
  planeRef: RefObject<HTMLElement | null>,
  reduced: boolean,
) {
  useEffect(() => {
    const host = hostRef.current;
    const plane = planeRef.current;
    if (
      !host ||
      !plane ||
      reduced ||
      !window.matchMedia("(pointer: fine)").matches
    )
      return;

    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    let last = 0;

    const write = () => {
      plane.style.setProperty("--tilt-y", `${(x * 1.65).toFixed(3)}deg`);
      plane.style.setProperty("--tilt-x", `${(-y * 0.9).toFixed(3)}deg`);
      plane.style.setProperty("--shift-x", `${(x * -5).toFixed(2)}px`);
      plane.style.setProperty("--shift-y", `${(y * -3).toFixed(2)}px`);
    };

    const tick = (now: number) => {
      const dt = last ? Math.min(now - last, 48) : 16.7;
      last = now;
      const k = 1 - Math.exp(-dt / 115);
      x += (targetX - x) * k;
      y += (targetY - y) * k;
      write();

      if (Math.max(Math.abs(targetX - x), Math.abs(targetY - y)) > 0.0015) {
        raf = requestAnimationFrame(tick);
      } else {
        x = targetX;
        y = targetY;
        write();
        raf = 0;
        last = 0;
      }
    };

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      targetX = Math.max(
        -1,
        Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2),
      );
      targetY = Math.max(
        -1,
        Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2),
      );
      wake();
    };
    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      wake();
    };

    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("pointerleave", onLeave, { passive: true });
    host.addEventListener("pointercancel", onLeave, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointercancel", onLeave);
    };
  }, [hostRef, planeRef, reduced]);
}
