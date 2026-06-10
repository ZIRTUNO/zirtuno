"use client";

/**
 * MetaballField — the NEW hero metaball (metaball-morph-spec). A react-bits-style
 * OGL 2D inverse-square field (lib/webgl/field-shader) instead of the retired 3D
 * raymarch (MetaballScene) and the capsule/smin trace. It's cheap enough to run
 * live on Intel UHD: a single full-screen triangle, ~N inverse-square terms +
 * glass shading per pixel, no per-pixel sphere tracing.
 *
 * PHASE 0/1 SCOPE: renders the STATIC `mark` form (lib/webgl/symbols.data.mjs) at
 * iso 2.2 — flat cyan (Phase 0) or liquid glass with no glow (Phase 1). The state
 * machine, the other 7 forms, and the morph come later (spec §12). Wired into
 * MetaballCanvas behind the `?hero=field` flag; MetaballScene stays importable.
 *
 * The same prop surface as MetaballScene so it's a drop-in for the shell, but only
 * `onReady` + `glass` are honoured this phase; the rest are accepted and ignored.
 */

import { useEffect, useReducer, useRef } from "react";
import { Renderer, Program, Mesh, Triangle } from "ogl";
import { MARK_RAW } from "@/lib/webgl/symbols.data.mjs";
import {
  FIELD_VERT,
  FIELD_FRAG,
  FIELD_ISO,
  FIELD_N,
  FIELD_FRAME,
} from "@/lib/webgl/field-shader.mjs";

// The resting form this phase: the mark, authored in symbols.data.mjs (kept as the
// single source of truth). [x,y,r] balls in symbol space.
const MARK = MARK_RAW as { balls: number[][] };

type FieldProps = {
  onReady?: () => void;
  glass?: boolean; // true = liquid glass (Phase 1), false = flat cyan (Phase 0)
  /** Called when the WebGL context is lost (shell should re-show the fallback). */
  onContextLost?: () => void;
  // accepted for drop-in parity with MetaballScene; unused this phase:
  capture?: "rest" | "breath" | "morph" | "ai" | null;
  previewState?: number | null;
  manualState?: number | null;
  morphPair?: [number, number, number] | null;
  play?: boolean;
  onActiveChange?: (i: number) => void;
};

/**
 * Pack a form's [x,y,r] balls into the fixed N×3 uniform array. NOTE: OGL detects
 * array uniforms with `Array.isArray(value)`, which is false for a Float32Array —
 * so the `iBalls[N]` value must be a plain number[] or it silently uploads nothing.
 */
function packBalls(balls: readonly (readonly number[])[]): {
  data: number[];
  count: number;
} {
  const data: number[] = new Array(FIELD_N * 3).fill(0);
  const count = Math.min(balls.length, FIELD_N);
  for (let i = 0; i < count; i++) {
    data[i * 3] = balls[i][0];
    data[i * 3 + 1] = balls[i][1];
    data[i * 3 + 2] = balls[i][2];
  }
  return { data, count };
}

export default function MetaballField({
  onReady = () => {},
  glass = true,
  onContextLost = () => {},
}: FieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(onReady);
  const lostRef = useRef(onContextLost);
  // keep the latest callbacks without re-creating the WebGL context each render
  useEffect(() => {
    readyRef.current = onReady;
    lostRef.current = onContextLost;
  }, [onReady, onContextLost]);
  // bumping the epoch re-runs the GL setup with a fresh context (after a loss)
  const [epoch, rebuild] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: false,
      antialias: false, // edge AA is done in-shader via fwidth(total)
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    const canvas = gl.canvas;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const onLost = (e: Event) => {
      e.preventDefault(); // allow the context to be restored
      lostRef.current();
    };
    const onRestored = () => rebuild();
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    const { data: ballData, count } = packBalls(MARK.balls);

    const program = new Program(gl, {
      vertex: FIELD_VERT,
      fragment: FIELD_FRAG,
      transparent: true,
      uniforms: {
        iRes: { value: new Float32Array([1, 1]) },
        iBalls: { value: ballData },
        iCount: { value: count },
        iFrame: { value: FIELD_FRAME },
        iIso: { value: FIELD_ISO },
        iGlass: { value: glass ? 1 : 0 },
      },
    });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    let announced = false;
    const draw = () => {
      renderer.render({ scene: mesh });
      if (!announced) {
        announced = true;
        readyRef.current();
      }
    };

    // The mark is static this phase → render on mount + whenever the stage
    // resizes (no per-frame loop; the cheapest possible live canvas).
    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h);
      const res = program.uniforms.iRes.value as Float32Array;
      res[0] = gl.canvas.width;
      res[1] = gl.canvas.height;
      draw();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    return () => {
      ro.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [glass, epoch]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
