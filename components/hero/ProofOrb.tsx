"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  MODE_DRAWS,
  resolvePreset,
  type OrbState,
  type OrbSize,
} from "thinking-orbs";
import { useReducedMotion } from "@/lib/animation/reduced-motion";

/**
 * THE ORB, AND THE CHECK IT BECOMES.
 *
 * `thinking-orbs` draws its sphere out of a few hundred dots. This does not put
 * that sphere on screen and then swap it for a tick — the tick IS the sphere.
 * Every frame the engine's dot cloud is RECORDED rather than painted, then
 * repainted at positions interpolated toward a checkmark. Nothing appears and
 * nothing disappears: the same dots that are the sphere travel and become the
 * mark, and running the morph backwards unmakes it.
 *
 * WHY THE DOTS ARE RECORDED. The engine is DOM-free and only issues canvas 2D
 * calls, so a stub answering `arc`/`fill`/`fillStyle` reads its geometry
 * exactly. `resolvePreset` and `MODE_DRAWS` are exported for this — the same
 * pair the package's own native ports are generated from.
 *
 * WHY THE MAPPING IS SPATIAL, NOT BY INDEX. Measured: between two frames a dot
 * at a given index moves ~6.5 units on a 20-unit box, and neighbouring indices
 * are barely closer together than random pairs — the engine re-emits its cloud
 * in a different order every frame. So "dot 7 goes to target 7" would teleport
 * every dot on every frame. Each dot's target is instead a pure function of
 * WHERE IT IS: dots are ranked by x, and the rank picks the arc length along
 * the check. A dot in a given place always goes to the same place whatever
 * order it arrives in — and ranking, rather than mapping x directly, spaces
 * them evenly along the stroke instead of inheriting the sphere's own density.
 */

/** the mark, in a 0..1 box: short arm down-right, long arm up-right, both 45° */
const CHECK: readonly (readonly [number, number])[] = [
  [0.21, 0.495],
  [0.405, 0.69],
  [0.79, 0.305],
];

const SEG = CHECK.slice(1).map((p, i) => {
  const a = CHECK[i];
  return { ax: a[0], ay: a[1], dx: p[0] - a[0], dy: p[1] - a[1] };
});
const SEG_LEN = SEG.map((s) => Math.hypot(s.dx, s.dy));
const TOTAL = SEG_LEN.reduce((a, b) => a + b, 0);

/** which segment normalised arc length `s` falls on, and how far along it */
function locate(s: number): { i: number; f: number } {
  let want = s * TOTAL;
  for (let i = 0; i < SEG.length; i++) {
    if (want <= SEG_LEN[i] || i === SEG.length - 1) {
      return { i, f: SEG_LEN[i] === 0 ? 0 : Math.min(1, Math.max(0, want / SEG_LEN[i])) };
    }
    want -= SEG_LEN[i];
  }
  return { i: SEG.length - 1, f: 1 };
}

const smooth = (t: number) => t * t * (3 - 2 * t);

type Dot = { x: number; y: number; r: number; grey: number; a: number };

/**
 * A stub context that records the engine's dots instead of painting them.
 * Unknown members answer with a no-op, so a future mode cannot throw here.
 */
function makeRecorder(out: Dot[]): CanvasRenderingContext2D {
  let fill = "";
  let pending: { x: number; y: number; r: number } | null = null;
  const base: Record<string, unknown> = {
    lineWidth: 0,
    lineCap: "butt",
    lineJoin: "miter",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    strokeStyle: "",
    get fillStyle() {
      return fill;
    },
    set fillStyle(v: string) {
      fill = v;
    },
    beginPath() {
      pending = null;
    },
    arc(x: number, y: number, r: number) {
      pending = { x, y, r };
    },
    ellipse(x: number, y: number, rx: number, ry: number) {
      pending = { x, y, r: (rx + ry) / 2 };
    },
    fill() {
      if (!pending) return;
      // the engine only ever emits greyscale: rgba(M,M,M,a)
      const m = /^rgba?\((\d+),\s*\d+,\s*\d+(?:,\s*([\d.]+))?\)$/.exec(fill);
      out.push({
        x: pending.x,
        y: pending.y,
        r: pending.r,
        grey: m ? Number(m[1]) / 255 : 1,
        a: m && m[2] !== undefined ? Number(m[2]) : 1,
      });
      pending = null;
    },
  };
  return new Proxy(base, {
    get(t, k) {
      if (k in t) return t[k as string];
      return () => undefined;
    },
    set(t, k, v) {
      t[k as string] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

/** Read a brand token off the live cascade, so the palette stays in one place. */
function readInk(el: Element, token: string): [number, number, number] {
  const raw = getComputedStyle(el).getPropertyValue(token).trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(raw);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /^(?:rgba?|color\()[^\d]*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(raw);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
  return [0, 227, 254]; // --color-cyan, if the token ever fails to resolve
}

export interface ProofOrbHandle {
  /** 0 = sphere, 1 = check. Driven by the row's one clock. */
  setMorph(m: number): void;
}

export interface ProofOrbProps {
  state?: OrbState;
  /** the package ships two TUNED designs, 64 and 20 — not a scale factor */
  size?: OrbSize;
  speed?: number;
  token?: string;
  /**
   * Gamma on the greyscale ramp before it is tinted. A straight multiply is
   * colorimetrically right and perceptually dim, because the brand cyan has no
   * red at all; a gamma below 1 lifts the midtones while pinning 0 and 1, so
   * the depth ORDERING survives and only its distribution moves.
   */
  lift?: number;
  className?: string;
}

export const ProofOrb = forwardRef<ProofOrbHandle, ProofOrbProps>(
  function ProofOrb(
    {
      state = "composing",
      size = 20,
      speed = 1,
      token = "--color-cyan",
      lift = 0.45,
      className,
    },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const morphRef = useRef(0);
    const applyRef = useRef<((m: number) => void) | null>(null);
    const reduced = useReducedMotion();

    useImperativeHandle(
      ref,
      () => ({
        setMorph(m: number) {
          const v = m < 0 ? 0 : m > 1 ? 1 : m;
          morphRef.current = v;
          // reduced motion has no loop to pick this up — repaint on demand
          if (reduced) applyRef.current?.(v);
        },
      }),
      [reduced],
    );

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // dpr capped at 2, as the package does: past that a 20px mark is paying
      // for pixels nobody resolves
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);

      const ink = readInk(canvas, token);
      const { mode, speed: baked, opts } = resolvePreset(state, size);
      const draw = MODE_DRAWS[mode];
      const rate = baked * speed;

      const dots: Dot[] = [];
      const recorder = makeRecorder(dots);
      const order: number[] = [];

      /** the radius the dots swell to, so they fuse into one solid stroke */
      const CHECK_R = size * 0.05;
      /**
       * How much the far end of the stroke lags the near end.
       *
       * Small on purpose. At 0.42 the dots nearest the start had finished and
       * fused into full-width stroke while the dots at the far end had not left
       * the sphere yet, so the middle of the morph was a fat half-check with a
       * ball still stuck to it — two objects again, which is the exact thing
       * this component exists to avoid. Just enough lag to give the gather a
       * direction; not enough to tear the body in half.
       */
      const STAGGER = 0.1;
      const BOW = size * 0.022;

      const paint = (t: number, m: number) => {
        dots.length = 0;
        draw(recorder, size, t, true, opts);
        const n = dots.length;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, size, size);
        if (n === 0) return;

        let cy = 0;
        if (m > 0) {
          // rank by x — a pure function of position, so the engine's per-frame
          // reordering cannot send a dot to a different target
          order.length = n;
          for (let i = 0; i < n; i++) {
            order[i] = i;
            cy += dots[i].y;
          }
          cy /= n;
          order.sort((a, b) => dots[a].x - dots[b].x);
        }

        for (let k = 0; k < n; k++) {
          const d = dots[m > 0 ? order[k] : k];
          let x = d.x;
          let y = d.y;
          let r = d.r;
          let grey = d.grey;
          let alpha = d.a;

          if (m > 0) {
            const s = n === 1 ? 0 : k / (n - 1);
            // a small lag along the stroke, so the gather has a direction
            const local = Math.min(
              1,
              Math.max(0, (m - s * STAGGER) / (1 - STAGGER)),
            );
            /**
             * TWO STAGES, OVERLAPPING — and this is the whole trick.
             *
             * Lerping each dot straight onto the curve makes the middle of the
             * morph the AVERAGE of a sphere and a line, which is neither: a
             * shapeless band. Every intermediate has to be a plausible shape
             * of its own. So the cloud first GATHERS into a check-shaped
             * ribbon that keeps its own thickness, and only then does the
             * ribbon THIN onto the stroke. Every frame is a sphere, a
             * check-shaped cloud, or a check.
             */
            const gather = smooth(Math.min(1, local / 0.62));
            const thin = smooth(Math.max(0, (local - 0.38) / 0.62));
            const { i, f } = locate(s);
            const seg = SEG[i];
            const len = SEG_LEN[i] || 1;
            const nx = -seg.dy / len;
            const ny = seg.dx / len;
            const tx = (seg.ax + seg.dx * f) * size;
            const ty = (seg.ay + seg.dy * f) * size;
            // the dot keeps its own offset from the middle of the cloud as the
            // ribbon's thickness, so the ribbon is made of these dots rather
            // than of an average of them
            const h = (d.y - cy) * 0.5;
            const bow = Math.sin(Math.PI * gather) * BOW * (s < 0.5 ? 1 : -1);
            const rx = tx + nx * h + nx * bow;
            const ry = ty + ny * h + ny * bow;
            x = d.x + (rx - d.x) * gather;
            y = d.y + (ry - d.y) * gather;
            x += (tx - x) * thin;
            y += (ty - y) * thin;
            // Radius lags, hard. Growing it with the journey meant a dot
            // halfway home was already at full stroke width, and the middle of
            // the morph was fat overlapping blobs. Tied to the THIN stage and
            // squared, the dots stay fine right up until they fuse.
            r = d.r + (CHECK_R - d.r) * thin * thin;
            grey = d.grey + (1 - d.grey) * gather;
            alpha = d.a + (1 - d.a) * gather;
          }

          const g = grey ** lift;
          ctx.fillStyle = `rgba(${Math.round(ink[0] * g)},${Math.round(
            ink[1] * g,
          )},${Math.round(ink[2] * g)},${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      applyRef.current = (m) => paint((performance.now() / 1000) * rate, m);

      if (reduced) {
        // one frame, at whatever the row has already decided this mark is
        paint(0.6, morphRef.current);
        return () => {
          applyRef.current = null;
        };
      }

      let raf = 0;
      let running = false;
      let onScreen = true;
      let lastM = -1;
      const tick = () => {
        const m = morphRef.current;
        // Fully resolved, the mark is a function of rank alone — the same
        // pixels every frame. Once drawn, stop drawing it.
        if (!(m >= 1 && lastM >= 1)) {
          paint((performance.now() / 1000) * rate, m);
          lastM = m;
        }
        if (running) raf = requestAnimationFrame(tick);
      };
      const start = () => {
        if (running) return;
        running = true;
        raf = requestAnimationFrame(tick);
      };
      const stop = () => {
        running = false;
        cancelAnimationFrame(raf);
      };

      paint((performance.now() / 1000) * rate, morphRef.current);

      // never burn frames off-screen or on a hidden tab — the same contract
      // the row's own light keeps
      const io = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen && document.visibilityState !== "hidden") start();
        else stop();
      });
      io.observe(canvas);
      const onVisibility = () => {
        if (document.visibilityState === "hidden") stop();
        else if (onScreen) start();
      };
      document.addEventListener("visibilitychange", onVisibility);

      return () => {
        stop();
        applyRef.current = null;
        io.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
      };
    }, [state, size, speed, token, lift, reduced]);

    return (
      <canvas
        ref={canvasRef}
        className={className}
        aria-hidden="true"
        style={{ width: size, height: size, display: "block" }}
      />
    );
  },
);
