"use client";

/**
 * Device-tier selection for the FIELD hero (metaball-morph-spec §7, R0) —
 * probe-first, no GPU-name blocklist ("GPU strings are an unreliable proxy"):
 *
 *   - "full" → glass shading, dpr ≤ 2.
 *   - "lite" → flat-cyan melt (the locked shader's iGlass=0 branch), dpr 1,
 *     internal render scale 0.75. The SDF-glass REST stays glass — it is a single
 *     static draw, cheap on any GPU; only the per-frame melt pays the lite cut.
 *   - "none" → no WebGL2 / hopeless frame times → the static SVG mark.
 *
 * The probe renders the ACTUAL field shader (48 balls, glass) at the hero's real
 * buffer size for a few frames with a forced GPU sync, and takes the median —
 * so the measurement is the workload. Runs once per session (sessionStorage);
 * the FPS watchdog (FieldMorphHero) can downshift the cached tier at runtime —
 * downshift, never freeze.
 *
 * QA override: ?ftier=full|lite|none (wins every call; never cached).
 */

import {
  FIELD_VERT,
  FIELD_FRAG,
  FIELD_N,
  FIELD_ISO,
  FIELD_FRAME,
} from "./field-shader.mjs";
import { MARK_RAW } from "./symbols.data.mjs";

export type FieldTier = "full" | "lite" | "none";

const CACHE_KEY = "zr-field-tier-v1";
// median ms/frame at the hero's real resolution → tier. 60 fps needs 16.7 ms;
// full demands headroom, lite tolerates a flat-shaded 0.75-scale workload that
// is ~3–5× cheaper than what was measured.
const FULL_MS = 12;
const LITE_MS = 55;
const PROBE_FRAMES = 6;

function override(): FieldTier | null {
  if (typeof window === "undefined") return null;
  const m = /[?&]ftier=(full|lite|none)/i.exec(window.location.search);
  return m ? (m[1].toLowerCase() as FieldTier) : null;
}

function probe(): FieldTier {
  try {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.min(960, Math.round(480 * dpr)); // ≈ the hero's buffer
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
    });
    if (!gl) return "none";

    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s) || "probe shader failed");
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, FIELD_VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FIELD_FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return "none";
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = (n: string) => gl.getUniformLocation(prog, n);
    const balls = new Float32Array(FIELD_N * 3);
    const cloud = (MARK_RAW as { balls: number[][] }).balls;
    for (let i = 0; i < FIELD_N; i++) {
      const b = cloud[i % cloud.length];
      balls[i * 3] = b[0];
      balls[i * 3 + 1] = b[1];
      balls[i * 3 + 2] = b[2];
    }
    gl.uniform2f(U("iRes"), size, size);
    gl.uniform3fv(U("iBalls"), balls);
    gl.uniform1i(U("iCount"), FIELD_N);
    gl.uniform1f(U("iFrame"), FIELD_FRAME);
    gl.uniform1f(U("iIso"), FIELD_ISO);
    gl.uniform1f(U("iGlass"), 1);
    gl.viewport(0, 0, size, size);

    const px = new Uint8Array(4);
    const times: number[] = [];
    for (let i = 0; i < PROBE_FRAMES; i++) {
      const t0 = performance.now();
      gl.uniform1f(U("iIso"), FIELD_ISO + i * 1e-4); // defeat any redundant-draw elision
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // force sync
      times.push(performance.now() - t0);
    }
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    return median <= FULL_MS ? "full" : median <= LITE_MS ? "lite" : "none";
  } catch {
    return "none";
  }
}

let cached: FieldTier | null = null;

/** The field-hero tier, probed once per session (QA: ?ftier= wins, uncached). */
export function detectFieldTier(): FieldTier {
  if (typeof window === "undefined") return "none";
  const o = override();
  if (o) return o;
  if (cached) return cached;
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(CACHE_KEY);
  } catch {
    /* private mode */
  }
  const tier: FieldTier =
    stored === "full" || stored === "lite" || stored === "none"
      ? (stored as FieldTier)
      : probe();
  cached = tier;
  try {
    sessionStorage.setItem(CACHE_KEY, tier);
  } catch {
    /* ignore */
  }
  return tier;
}

/** Persist a runtime watchdog downshift for the rest of the session. */
export function setFieldTier(tier: FieldTier): void {
  cached = tier;
  try {
    sessionStorage.setItem(CACHE_KEY, tier);
  } catch {
    /* ignore */
  }
}
