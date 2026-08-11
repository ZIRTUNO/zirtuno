"use client";

/**
 * SdfGlassField — the resting hero (metaball-morph-spec v1.2 §6.1). Renders a crisp
 * form SVG as liquid GLASS by feeding its signed-distance field into the locked
 * glass-shading math (lib/webgl/sdf-glass-shader). Exact silhouette + exact holes
 * from the SVG; material identical to the metaball glass. Cheap: one static draw of
 * a full-screen triangle sampling an R32F SDF texture (built once per SVG and
 * cached); subtle breathing is a CSS transform, so there's no per-frame GPU cost.
 * Raw WebGL2 (mirrors scripts/capture-sdf.mjs — same shared constants + sdf-core
 * math, so the sign-off sheet is exactly what ships). The metaball field stays for
 * the Phase-3 morph only.
 *
 * Hardening:
 *  - R32F + LINEAR needs OES_texture_float_linear; without it (some mobile GPUs)
 *    an incomplete texture samples as 0 → a half-fill wash. Falls back to NEAREST.
 *  - On webglcontextlost we notify the shell (fallback logo fades back in) and
 *    rebuild on webglcontextrestored, reusing the cached SDF (no EDT re-run).
 */

import { useEffect, useReducer, useRef } from "react";
import {
  SDF_GLASS_VERT,
  SDF_GLASS_FRAG,
  SDF_THICK,
  SDF_RES,
  SDF_DRAW,
  SDF_BLUR,
} from "@/lib/webgl/sdf-glass-shader.mjs";
import { buildSdfAsync } from "@/lib/webgl/sdf";

type SdfGlassProps = {
  svgUrl: string;
  thick?: number;
  breathing?: boolean;
  onReady?: () => void;
  /** Called when the WebGL context is lost (shell should re-show the fallback). */
  onContextLost?: () => void;
  // accepted for drop-in parity with the other scenes; unused here:
  capture?: unknown;
  previewState?: number | null;
  manualState?: number | null;
  morphPair?: unknown;
  play?: boolean;
  onActiveChange?: (i: number) => void;
};

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) || "shader compile failed");
  return s;
}

export default function SdfGlassField({
  svgUrl,
  thick = SDF_THICK,
  breathing = true,
  onReady = () => {},
  onContextLost = () => {},
}: SdfGlassProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(onReady);
  const lostRef = useRef(onContextLost);
  useEffect(() => {
    readyRef.current = onReady;
    lostRef.current = onContextLost;
  }, [onReady, onContextLost]);

  // cache the built SDF per URL so a context restore skips the EDT (~100ms)
  const sdfCache = useRef<{ url: string; data: Float32Array } | null>(null);
  // bumping the epoch re-runs the GL setup with a fresh context (after a loss)
  const [epoch, rebuild] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
    });
    if (!gl) return; // no WebGL2 → the shell's SVG fallback stays visible
    container.appendChild(canvas);

    const onLost = (e: Event) => {
      e.preventDefault(); // allow the context to be restored
      lostRef.current();
    };
    const onRestored = () => rebuild();
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    // LINEAR on float textures requires this extension; NEAREST still renders
    // correctly (the shader samples at ~1-texel offsets), just slightly less smooth.
    const floatLinear = !!gl.getExtension("OES_texture_float_linear");
    const filter = floatLinear ? gl.LINEAR : gl.NEAREST;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, SDF_GLASS_VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, SDF_GLASS_FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const U = (n: string) => gl.getUniformLocation(prog, n);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1i(U("iSDF"), 0);
    gl.uniform1f(U("iThick"), thick);
    gl.uniform2f(U("iTexel"), 1 / SDF_RES, 1 / SDF_RES);
    // v1.7 unified-field shader: weight form A fully, glass shading on (form B /
    // droplet / warp uniforms default to 0) → the exact static rest render.
    gl.uniform1f(U("iFormA"), 1);
    gl.uniform1f(U("iGlass"), 1);
    gl.uniform1f(U("iGloss"), 0); // clean brand-cyan material — see FieldStage

    let sdfReady = false;
    let announced = false;
    const draw = () => {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(U("iRes"), gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (sdfReady) gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (sdfReady && !announced) {
        announced = true;
        readyRef.current();
      }
    };

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const w = Math.max(1, Math.round((container.clientWidth || 1) * dpr));
      const h = Math.max(1, Math.round((container.clientHeight || 1) * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      draw();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const applySdf = (data: Float32Array) => {
      if (disposed) return;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, SDF_RES, SDF_RES, 0, gl.RED, gl.FLOAT, data);
      sdfReady = true;
      draw();
    };

    if (sdfCache.current?.url === svgUrl) {
      applySdf(sdfCache.current.data);
    } else {
      const img = new Image();
      img.decoding = "async";
      img.src = svgUrl;
      img
        .decode()
        // EDT+blur run in a worker (lib/webgl/sdf) → no main-thread jank at mount
        .then(() => buildSdfAsync(img, SDF_RES, SDF_DRAW, SDF_BLUR))
        .then((data) => {
          if (disposed) return;
          sdfCache.current = { url: svgUrl, data };
          applySdf(data);
        })
        .catch((err) => {
          if (process.env.NODE_ENV !== "production")
            console.warn("SdfGlassField: failed to build form SDF", svgUrl, err);
        });
    }

    return () => {
      disposed = true;
      ro.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [svgUrl, thick, epoch]);

  return (
    <div
      ref={containerRef}
      className={breathing ? "sdf-glass-breath" : undefined}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
