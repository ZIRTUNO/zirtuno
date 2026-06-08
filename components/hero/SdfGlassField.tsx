"use client";

/**
 * SdfGlassField — the resting hero (metaball-morph-spec v1.2 §6.1). Renders a crisp
 * form SVG as liquid GLASS by feeding its signed-distance field into the locked
 * glass-shading math (lib/webgl/sdf-glass-shader). Exact silhouette + exact holes
 * from the SVG; material identical to the metaball glass. Cheap: one static draw of
 * a full-screen triangle sampling an R32F SDF texture (built once at mount); subtle
 * breathing is a CSS transform, so there's no per-frame GPU cost. Raw WebGL2 (mirrors
 * scripts/capture-sdf.mjs); the metaball field stays for the Phase-3 morph only.
 */

import { useEffect, useRef } from "react";
import {
  SDF_GLASS_VERT,
  SDF_GLASS_FRAG,
  SDF_THICK,
} from "@/lib/webgl/sdf-glass-shader.mjs";
import { buildSdf } from "@/lib/webgl/sdf";

const RES = 768; // SDF texture resolution
const DRAW = 0.82; // content fills this fraction (margin for the glass rim)
const BLUR = 3; // SDF smoothing radius (px)

type SdfGlassProps = {
  svgUrl: string;
  thick?: number;
  breathing?: boolean;
  onReady?: () => void;
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
}: SdfGlassProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(onReady);
  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

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
    if (!gl) return;
    container.appendChild(canvas);
    gl.getExtension("OES_texture_float_linear");

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
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const U = (n: string) => gl.getUniformLocation(prog, n);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1i(U("iSDF"), 0);
    gl.uniform1f(U("iThick"), thick);
    gl.uniform2f(U("iTexel"), 1 / RES, 1 / RES);

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

    // build the SDF from the SVG, then upload + draw
    const img = new Image();
    img.decoding = "async";
    img.src = svgUrl;
    img
      .decode()
      .then(() => {
        if (disposed) return;
        const data = buildSdf(img, RES, DRAW, BLUR);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, RES, RES, 0, gl.RED, gl.FLOAT, data);
        sdfReady = true;
        draw();
      })
      .catch(() => {});

    return () => {
      disposed = true;
      ro.disconnect();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, [svgUrl, thick]);

  return (
    <div
      ref={containerRef}
      className={breathing ? "sdf-glass-breath" : undefined}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
