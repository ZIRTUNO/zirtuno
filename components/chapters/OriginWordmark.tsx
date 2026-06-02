"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import { cn } from "@/lib/utils";

/**
 * S8 Beat 5 — wordmark convergence. CPU Canvas-2D particles (NO WebGL — strict
 * GPU budget) drift in and settle into the letterforms of the wordmark, then
 * crossfade to the crisp DOM text. One-shot on enter, then idle. Reduced motion
 * (and the perf safety-valve) resolve straight to the static styled text.
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
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setSettled(true);
      return;
    }

    let raf = 0;
    let running = true;

    const run = () => {
      if (!running) return;
      const W = Math.min(host.clientWidth || 360, 520);
      const H = Math.round(W * 0.26);
      canvas.width = W;
      canvas.height = H;

      // sample target points from the wordmark, in the real (loaded) font
      const off = document.createElement("canvas");
      off.width = W;
      off.height = H;
      const octx = off.getContext("2d");
      if (!octx) {
        setSettled(true);
        return;
      }
      const cs = getComputedStyle(textEl);
      const family = cs.fontFamily || "serif";
      const fstyle = cs.fontStyle || "normal";
      const fweight = cs.fontWeight || "400";
      let fontSize = Math.floor(H * 0.62);
      const setFont = () => (octx.font = `${fstyle} ${fweight} ${fontSize}px ${family}`);
      setFont();
      while (octx.measureText(text).width > W * 0.9 && fontSize > 8) {
        fontSize -= 2;
        setFont();
      }
      octx.fillStyle = "#fff";
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.fillText(text, W / 2, H / 2);
      const data = octx.getImageData(0, 0, W, H).data;

      const targets: number[] = [];
      const step = 4;
      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          if (data[(y * W + x) * 4 + 3] > 128) targets.push(x, y);
        }
      }
      const MAX = 850;
      const total = targets.length / 2;
      const skip = total > MAX ? Math.ceil(total / MAX) : 1;
      const parts: number[] = []; // x,y,tx,ty flat
      for (let i = 0; i < total; i += skip) {
        parts.push(Math.random() * W, Math.random() * H, targets[i * 2], targets[i * 2 + 1]);
      }

      let frames = 0;
      const draw = () => {
        if (!running) return;
        frames++;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = "#4DECFF";
        let maxd = 0;
        for (let i = 0; i < parts.length; i += 4) {
          parts[i] += (parts[i + 2] - parts[i]) * 0.12;
          parts[i + 1] += (parts[i + 3] - parts[i + 1]) * 0.12;
          const d = Math.abs(parts[i + 2] - parts[i]) + Math.abs(parts[i + 3] - parts[i + 1]);
          if (d > maxd) maxd = d;
          ctx.fillRect(parts[i], parts[i + 1], 1.7, 1.7);
        }
        if (maxd < 0.7 && frames > 24) {
          setSettled(true); // crossfade to crisp text, stop animating
          return;
        }
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
    };

    // ensure the brand font is ready so particles match the crisp text
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (running) run();
    });

    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
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
