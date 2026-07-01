"use client";

/**
 * Shared WebGL2 plumbing for the unified liquid-field renderers — the hero
 * (FieldMorphHero) and the chapter driver stages (FieldStage) build on the same
 * layer/texture/loader trio, extracted in R1 so they cannot drift apart:
 *
 *   - makeLayer:      one fullscreen-triangle WebGL2 layer (straight alpha,
 *                     OES_texture_float_linear detection).
 *   - makeSdfTexture: an R32F signed-distance texture (LINEAR, NEAREST fallback).
 *   - loadSdf:        SVG url → worker-built SDF Float32Array, cached per url
 *                     for the whole session (8 forms × 1 MB, shared across
 *                     every canvas on the page).
 */

import { SDF_RES, SDF_DRAW, SDF_BLUR } from "./sdf-glass-shader.mjs";
import { buildSdfAsync } from "./sdf";

export type Layer = {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  U: (n: string) => WebGLUniformLocation | null;
  floatLinear: boolean;
};

export function makeLayer(
  container: HTMLElement,
  vert: string,
  frag: string,
): Layer | null {
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;";
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
  });
  if (!gl) return null;
  const floatLinear = !!gl.getExtension("OES_texture_float_linear");
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(s) || "shader compile failed");
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vert));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "position");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  container.appendChild(canvas);
  return { canvas, gl, prog, U: (n) => gl.getUniformLocation(prog, n), floatLinear };
}

export function makeSdfTexture(layer: Layer, data: Float32Array): WebGLTexture {
  const gl = layer.gl;
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  const f = layer.floatLinear ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, SDF_RES, SDF_RES, 0, gl.RED, gl.FLOAT, data);
  return t;
}

// built SDFs survive remounts and are shared across instances (8 × 1 MB)
const sdfDataCache = new Map<string, Float32Array>();

export async function loadSdf(url: string): Promise<Float32Array> {
  const hit = sdfDataCache.get(url);
  if (hit) return hit;
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  const data = await buildSdfAsync(img, SDF_RES, SDF_DRAW, SDF_BLUR);
  sdfDataCache.set(url, data);
  return data;
}
