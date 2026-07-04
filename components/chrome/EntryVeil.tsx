"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { runWordmarkAssembly } from "@/lib/animation/wordmark-particles";
import { cn } from "@/lib/utils";

/**
 * S1.10 — the loading moment: the FIRST brand touch is the brand assembling.
 * A full-screen ink veil plays the wordmark particle convergence (~1.5 s
 * total: assemble → crisp text beat → fade), then removes itself.
 *
 * Skipped with NO flash for: return visits in the same session (an inline
 * pre-paint script in the layout sets `html[data-zveil="seen"]` from
 * sessionStorage before the veil can paint), reduced motion (CSS media query
 * + JS), and it can never strand the page — a hard cap always releases it.
 * The route-segment loading state (app/[locale]/loading.tsx) still covers
 * in-app navigations.
 */
export function EntryVeil({ label }: { label: string }) {
  const reduced = useReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [settled, setSettled] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    // QA / capture contexts (?ftier, ?fstate, ?feco, …) must render the page
    // itself deterministically — the veil never plays under any f* param.
    const qa = [...new URLSearchParams(window.location.search).keys()].some(
      (k) => /^f/.test(k),
    );
    if (document.documentElement.dataset.zveil === "seen" || reduced || qa) {
      setGone(true);
      return;
    }
    // mark seen NOW: same-session reloads (script) and SPA remounts (attr) skip
    try {
      sessionStorage.setItem("zveil", "1");
    } catch {
      /* storage may be blocked — the veil simply plays again */
    }
    document.documentElement.dataset.zveil = "seen";

    const canvas = canvasRef.current;
    const host = hostRef.current;
    const textEl = textRef.current;
    const timers: number[] = [];
    const finish = () => {
      setLeaving(true);
      timers.push(window.setTimeout(() => setGone(true), 700));
    };
    let cancel: (() => void) | undefined;
    if (canvas && host && textEl) {
      cancel = runWordmarkAssembly(canvas, host, textEl, "Zirtuno", () => {
        setSettled(true); // the crisp wordmark takes over
        timers.push(window.setTimeout(finish, 400));
      });
    }
    // hard cap — the veil must NEVER strand the page (slow font, hidden tab…)
    timers.push(window.setTimeout(finish, 2600));
    return () => {
      cancel?.();
      timers.forEach(clearTimeout);
    };
  }, [reduced]);

  if (gone) return null;

  return (
    <div
      className={cn("entry-veil", leaving && "is-leaving")}
      role="status"
      aria-label={label}
    >
      <div className="entry-veil-stage" ref={hostRef}>
        <canvas
          ref={canvasRef}
          className={cn("entry-veil-canvas", settled && "is-faded")}
          aria-hidden="true"
        />
        <p
          ref={textRef}
          className={cn("name-word entry-veil-text", !settled && "is-hidden")}
          aria-hidden="true"
        >
          Zirtuno
        </p>
      </div>
    </div>
  );
}
