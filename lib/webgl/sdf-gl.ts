"use client";

/**
 * Shared WebGL2 plumbing for the unified liquid-field renderers — the hero
 * (FormStillRenderer) and the chapter driver stages (FieldStage) build on the same
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
  /** Index of the fragment source that actually linked, for callers that pass
   *  a preference list (0 = the first/most capable). */
  variant: number;
};

export function makeLayer(
  container: HTMLElement,
  vert: string,
  /**
   * One source, or a PREFERENCE LIST tried in order until one links.
   *
   * The velocity-aware field costs ~40 extra uniform vectors on top of iBalls
   * and iBallZ, which lands close to WebGL2's guaranteed 224. Rather than
   * predicting that from MAX_FRAGMENT_UNIFORM_VECTORS — the same kind of proxy
   * the tier probe deliberately refuses — ask the driver the real question by
   * linking the real shader, and fall back to the plain field if it says no.
   * A single string keeps the original all-or-nothing behaviour.
   */
  frag: string | readonly string[],
): Layer | null {
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;";
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    // The page-wide liquid is the single heaviest thing this site draws, and
    // it was the ONE context that never asked for the fast GPU — HeroRibbon,
    // a soft decorative stream rendered at 0.7 CSS px, has requested it since
    // R4. On a hybrid-graphics laptop the default lets the browser answer with
    // the integrated adapter, which is precisely the class of GPU this shader
    // is fill-bound on.
    powerPreference: "high-performance",
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

  const sources = typeof frag === "string" ? [frag] : frag;
  let prog: WebGLProgram | null = null;
  let variant = 0;
  for (let i = 0; i < sources.length; i++) {
    // A rejected candidate must leave nothing behind: the next attempt runs on
    // a context that has already refused one program.
    let vs: WebGLShader | null = null;
    let fs: WebGLShader | null = null;
    const candidate = gl.createProgram()!;
    try {
      vs = sh(gl.VERTEX_SHADER, vert);
      fs = sh(gl.FRAGMENT_SHADER, sources[i]);
      gl.attachShader(candidate, vs);
      gl.attachShader(candidate, fs);
      gl.linkProgram(candidate);
      if (gl.getProgramParameter(candidate, gl.LINK_STATUS)) {
        prog = candidate;
        variant = i;
        break;
      }
    } catch {
      /* compile threw — try the next source */
    } finally {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      if (prog !== candidate) gl.deleteProgram(candidate);
    }
    // the last source is the contract: if even it fails, there is no layer
    if (i === sources.length - 1) return null;
  }
  if (!prog) return null;
  // const, so the uniform accessor closure below keeps the narrowed type
  const program = prog;
  gl.useProgram(program);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  container.appendChild(canvas);
  return {
    canvas,
    gl,
    prog: program,
    U: (n) => gl.getUniformLocation(program, n),
    floatLinear,
    variant,
  };
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

