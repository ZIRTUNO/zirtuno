"use client";

/**
 * Device-tier + glass-technique selection for the hero metaball (S2.3).
 *
 * We ship TWO glass techniques, picked by GPU capability:
 *
 *   - "full"  → RAYMARCHED SDF glass (MetaballScene). Per-pixel sphere-tracing —
 *     gorgeous, but a hundreds-of-iterations-per-pixel workload that TDR-freezes
 *     weak GPUs regardless of resolution. Capable/discrete GPUs only (a runtime
 *     perf probe must pass).
 *   - "lite"  → MESH glass (MeshMetaballScene): a morph-target mesh shaded with a
 *     baked cyan-glass MATCAP + fresnel rim + a refraction approximation. The GPU
 *     rasterises a low-poly mesh + runs a trivial fragment shader → 60fps on an
 *     integrated GPU with NO long per-pixel loop, so it CANNOT trip the driver
 *     watchdog. Integrated / mobile / unidentified GPUs get this — fully live,
 *     interactive, hover-responsive, morphing.
 *   - "none"  → SOFTWARE rasteriser / no WebGL: no real GPU at all → static SVG.
 *
 * History: the raymarch was tried at the "lite" tier (low resolution, bounding
 * quad, march early-out) and STILL froze integrated GPUs — the per-pixel cost is
 * intrinsic, not a resolution problem. So "lite" now means the mesh technique,
 * the fundamentally lighter path. See glassTech() for the raymarch↔mesh mapping.
 *
 * The decision is cheap and cached per session (sessionStorage).
 *
 * Overrides:
 *   - `?glass=mesh`              → force the MESH technique (lite) anywhere, incl.
 *                                  capture/state/pair stills (mesh contact sheet).
 *   - `?capture=` / `?state=` /
 *     `?pair=` / `?glass=full`   → force "full" (the raymarch screenshot pipeline).
 *   - `?glass=lite` / `tuned`    → force "lite" (test the mesh path on any GPU).
 *   - `?glass=1` / `on` / `force`→ force-mount glass even if gated off ("none").
 */

export type GpuTier = "full" | "lite" | "none";
export type GlassTech = "raymarch" | "mesh" | "none";

// v5: "lite" now means the MESH technique (was a low-res raymarch that still
// froze). Bumping the key discards any stale tier a prior visit cached, so
// integrated GPUs re-evaluate and pick up the new, safe mesh path on reload.
const CACHE_KEY = "zr-gpu-tier-v5";

// CPU rasterisers — no real GPU at all; even a trivial mesh shader is slow, so
// serve the static SVG.
const SOFTWARE = ["swiftshader", "llvmpipe", "software", "microsoft basic"];
// Integrated / mobile GPUs — too weak for the per-pixel raymarch, but they
// rasterise a mesh + matcap at 60fps easily → the "lite" MESH technique.
const WEAK = [
  "intel(r) hd graphics",
  "intel hd graphics",
  "intel(r) uhd graphics",
  "intel uhd graphics",
  "intel(r) iris",
  "intel iris",
  "mali",
  "adreno",
  "powervr",
  "videocore",
  "apple gpu",
];

function search(): string {
  return typeof window === "undefined" ? "" : window.location.search;
}

/** Force the MESH technique (lite) — incl. deterministic capture/state/pair stills. */
export function meshForced(): boolean {
  return /[?&]glass=mesh/i.test(search());
}

/** Deterministic full-quality RAYMARCH contexts: the capture pipeline + an explicit debug. */
export function captureForced(): boolean {
  return /[?&](?:capture=|state=|pair=|glass=full)/i.test(search());
}

/** Force the "lite" (mesh) tier — for testing the mesh path on any GPU. */
export function liteForced(): boolean {
  return /[?&]glass=(?:lite|tuned|mesh)/i.test(search());
}

/** "Show me glass" opt-in: force-mount the full tier even if gated off. */
export function mountForced(): boolean {
  return /[?&]glass=(?:1|on|force)/i.test(search());
}

/** Back-compat: any override that should bypass the "none" gate. */
export function glassForced(): boolean {
  return captureForced() || mountForced() || meshForced();
}

function getGL(): WebGLRenderingContext | null {
  try {
    const c = document.createElement("canvas");
    return (c.getContext("webgl2") ||
      c.getContext("webgl")) as WebGLRenderingContext | null;
  } catch {
    return null;
  }
}

function rendererString(gl: WebGLRenderingContext): string {
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  return (
    dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : ""
  ).toLowerCase();
}

/**
 * Time a deliberately heavy fragment quad with a forced GPU sync (readPixels), so
 * we measure GPU throughput, not just CPU submit. Returns median ms/frame, or a
 * large number on failure (→ treated as slow). Only capable GPUs clear the bar to
 * earn the raymarch; everyone else gets the (always-safe) mesh.
 */
function probeFrameMs(gl: WebGLRenderingContext): number {
  const SIZE = 192;
  const FRAMES = 6;
  try {
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.width = SIZE;
    canvas.height = SIZE;
    gl.viewport(0, 0, SIZE, SIZE);

    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}");
    gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(
      fs,
      // ~64-iteration trig churn per pixel — a stand-in for the raymarch cost.
      "precision highp float;uniform float k;void main(){float a=k;for(int i=0;i<64;i++){a=fract(sin(a*12.9898+float(i))*43758.5453);a=sin(a)*cos(a)+a*0.5;}gl_FragColor=vec4(vec3(a*0.0001),1.0);}",
    );
    gl.compileShader(fs);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return 1e9;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const kLoc = gl.getUniformLocation(prog, "k");

    const px = new Uint8Array(4);
    const times: number[] = [];
    for (let i = 0; i < FRAMES; i++) {
      const t0 = performance.now();
      gl.uniform1f(kLoc, 0.1 + i * 0.01);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // force sync
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    return times[Math.floor(times.length / 2)]; // median (drop warm-up/outliers)
  } catch {
    return 1e9;
  }
}

function decide(): GpuTier {
  if (typeof window === "undefined") return "none";
  if (meshForced()) return "lite";
  if (captureForced()) return "full";
  if (liteForced()) return "lite";

  const gl = getGL();
  if (!gl) return "none";

  // CPU rasteriser → SVG (no GPU). Everything else has a real GPU: capable ones
  // that clear the perf probe get the raymarch ("full"); integrated / mobile /
  // unidentified get the always-safe MESH ("lite").
  const r = rendererString(gl);
  if (r && SOFTWARE.some((s) => r.includes(s))) return "none";
  if (!r) return "lite"; // masked / unidentified → mesh (safe; never risk a freeze)
  if (WEAK.some((s) => r.includes(s))) return "lite"; // integrated / mobile → mesh
  return probeFrameMs(gl) < 2.5 ? "full" : "lite"; // capable+fast → raymarch, else mesh
}

let cached: GpuTier | null = null;

/**
 * Runtime safety net: pin the whole session to the SVG (used only if a path is
 * found unrecoverable). Survives reloads (sessionStorage).
 */
export function demoteToSvg(): void {
  cached = "none";
  try {
    sessionStorage.setItem(CACHE_KEY, "none");
  } catch {
    /* ignore */
  }
}

/** The device tier, computed once per session (probe is cached in sessionStorage). */
export function detectGpuTier(): GpuTier {
  if (typeof window === "undefined") return "none";
  // Overrides must win every call (querystring can change between mounts).
  if (meshForced()) return "lite";
  if (captureForced()) return "full";
  if (liteForced()) return "lite";
  if (cached) return mountForced() && cached === "none" ? "full" : cached;

  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(CACHE_KEY);
  } catch {
    /* private mode */
  }
  const tier: GpuTier =
    stored === "full" || stored === "lite" || stored === "none"
      ? (stored as GpuTier)
      : decide();

  cached = tier;
  try {
    sessionStorage.setItem(CACHE_KEY, tier);
  } catch {
    /* ignore */
  }
  return mountForced() && tier === "none" ? "full" : tier;
}

/**
 * Which glass technique to mount: "raymarch" (capable/discrete), "mesh"
 * (integrated/mobile — the safe morph-target path) or "none" (software → SVG).
 */
export function glassTech(): GlassTech {
  const t = detectGpuTier();
  return t === "full" ? "raymarch" : t === "lite" ? "mesh" : "none";
}

/** True only on GPUs cleared for the per-pixel raymarch (the freeze risk). */
export function canRaymarch(): boolean {
  return detectGpuTier() === "full";
}
