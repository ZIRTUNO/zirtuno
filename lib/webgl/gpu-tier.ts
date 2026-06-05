"use client";

/**
 * Device-tier selection for the raymarched glass (S2.3).
 *
 * The glass is now OPTIMIZED to stay LIVE on weak GPUs (MetaballScene renders it
 * inside a bounding quad at a low, adaptive resolution — drei PerformanceMonitor
 * walks the resolution to fps). So every real GPU gets the live, interactive,
 * morphing glass; the tier only decides the starting resolution / adaptive band:
 *
 *   - "full" → capable/discrete GPU (passes a runtime perf probe): same shader at
 *     a high (capped ~1.5×) resolution.
 *   - "lite" → integrated / mobile / unidentified GPU: the SAME shader/effect at a
 *     low, conservative starting resolution (so the first frame can never trip the
 *     driver watchdog) that adapts up/down. Softer, never less alive.
 *   - "none" → SOFTWARE rasterizer / no WebGL only: no real GPU, so keep the
 *     static SVG mark.
 *
 * The decision is cheap and cached per session (sessionStorage).
 *
 * Overrides:
 *   - `?capture=` / `?state=` / `?pair=` / `?glass=full` → force "full" (the
 *     screenshot pipeline + "show me full quality").
 *   - `?glass=lite` / `tuned` → force "lite" (test the optimized weak path).
 *   - `?glass=1` / `on` / `force` → force-mount glass even if gated off.
 */

export type GpuTier = "full" | "lite" | "none";

// v2: the policy changed (no more "lite" raymarch on integrated GPUs). Bumping
// the key discards any stale "lite" cached by a prior visit, which would
// otherwise re-mount the freezing glass on reload.
// v4: the optimized "lite" raymarch STILL froze integrated GPUs, so it's gated
// back off (integrated → SVG). Bumping the key discards a prior visit's cached
// "lite", which would otherwise re-mount the freezing glass on reload.
const CACHE_KEY = "zr-gpu-tier-v4";

// CPU rasterizers — no real GPU, real-time raymarch is not viable; serve the SVG.
const SOFTWARE = ["swiftshader", "llvmpipe", "software", "microsoft basic"];
// Integrated / mobile GPUs — run the optimized glass at the conservative "lite" tier.
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

/** Deterministic full-quality contexts: the capture pipeline + an explicit debug. */
export function captureForced(): boolean {
  return /[?&](?:capture=|state=|pair=|glass=full)/i.test(search());
}

/** Force the "lite" (tuned, low-res) tier — for testing the optimized weak path. */
export function liteForced(): boolean {
  return /[?&]glass=(?:lite|tuned)/i.test(search());
}

/** "Show me glass" opt-in: force-mount the full tier even if gated off. */
export function mountForced(): boolean {
  return /[?&]glass=(?:1|on|force)/i.test(search());
}

/** Back-compat: any override that should bypass the "none" gate. */
export function glassForced(): boolean {
  return captureForced() || mountForced();
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
 * large number on failure (→ treated as slow).
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
  if (captureForced()) return "full";
  if (liteForced()) return "lite";

  const gl = getGL();
  if (!gl) return "none";

  // HARD REALITY: a per-pixel SDF raymarch is too heavy for integrated GPUs even
  // at low resolution — the per-pixel cost (≈80 SDF evals/pixel for march +
  // normals + thickness) trips the driver timeout (TDR) and freezes the whole
  // machine regardless of pixel count. Resolution-only optimization could NOT
  // stop it. So the raymarch stays a capable/discrete-GPU enhancement; integrated/
  // mobile/software/unidentified keep the static SVG until the mesh-based metaball
  // (morph-target mesh + matcap glass — a fundamentally lighter technique) lands.
  const r = rendererString(gl);
  if (r && SOFTWARE.some((s) => r.includes(s))) return "none"; // CPU raster → SVG
  if (!r) return "none"; // masked / unidentified → SVG (cannot risk a freeze)
  if (WEAK.some((s) => r.includes(s))) return "none"; // integrated / mobile → SVG
  return probeFrameMs(gl) < 2.5 ? "full" : "none"; // capable + fast → glass, else SVG
}

let cached: GpuTier | null = null;

/**
 * Runtime safety net: the FPS watchdog calls this when the live glass stays janky,
 * pinning the whole session to the SVG so we never sit in a frozen/janky state and
 * other sections don't re-attempt the heavy shader. Survives reloads (sessionStorage).
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
