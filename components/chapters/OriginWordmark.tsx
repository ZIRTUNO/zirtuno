"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { runWordmarkAssembly } from "@/lib/animation/wordmark-particles";
import { cn } from "@/lib/utils";

/**
 * S8 Beat 5 — wordmark convergence: the shared particle assembly
 * (lib/animation/wordmark-particles — also the S1.10 entry veil) settles into
 * the letterforms, then crossfades to the crisp DOM text. One-shot on enter,
 * then idle. Reduced motion (and the perf safety-valve) resolve straight to
 * the static styled text.
 */
export function OriginWordmark({ text }: { text: string }) {
  const reduced = useReducedMotion();
  const [stageRef, , seen] = useInView<HTMLDivElement>("200px");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (reduced || !seen) return;
    const canvas = canvasRef.current;
    const host = stageRef.current;
    const textEl = textRef.current;
    if (!canvas || !host || !textEl) {
      setSettled(true);
      return;
    }
    return runWordmarkAssembly(canvas, host, textEl, text, () =>
      setSettled(true),
    );
  }, [reduced, seen, stageRef, text]);

  const showText = reduced || settled;

  return (
    <div className="origin-wordmark" ref={stageRef} role="img" aria-label={text}>
      {!reduced && seen && (
        <canvas
          ref={canvasRef}
          className={cn("origin-wordmark-canvas", showText && "is-faded")}
          aria-hidden="true"
        />
      )}
      <p
        ref={textRef}
        className={cn("name-word origin-wordmark-text", !showText && "is-hidden")}
        aria-hidden="true"
      >
        {text}
      </p>
    </div>
  );
}
