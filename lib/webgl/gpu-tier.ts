"use client";

/**
 * Device-tier selection for the raymarched glass (S2.3 · backlog 5.0).
 *
 * The glass is a HIGH-END ENHANCEMENT, not a baseline. A fullscreen SDF raymarch
 * hard-freezes integrated GPUs (Intel HD/UHD/Iris, mobile) and software — it
 * trips the GPU driver's timeout (TDR) and hangs the whole machine, which no JS
 * watchdog can recover. A reduced raymarch trips it too. So the policy is
 * deliberately conservative — when in doubt, serve the (high-fidelity) static
 * SVG mark with zero WebGL:
 *
 *   - "full" → a recognized capable/discrete GPU that ALSO clears a runtime perf
 *     probe: the full-quality raymarch (STEPS=56, thickness loop, dpr up to 2,
 *     HDRI env).
 *   - "none" → everything else (integrated, mobile, software, or any GPU we can't
 *     positively identify): the static SVG mark, no WebGL, never a freeze.
 *
 * ("lite" remains in the type for compatibility but is no longer selected — a
 * lighter raymarch still froze integrated GPUs, so there is no middle tier.)
 *
 * The decision is cheap and cached per session (sessionStorage). A live FPS
 * watchdog (in MetaballScene) is a secondary net for capable GPUs that turn out
 * janky: sustained jank pins the session to the SVG.
 *
 * Overrides:
 *   - `?capture=` / `?state=` / `?pair=` / `?glass=full` → force "full" (the
 *     deterministic screenshot pipeline + a debug "show me full quality").
 *   - `?glass=1` / `on` / `force` → force-mount full glass even if gated off — an
 *     explicit debug opt-in (may freeze a weak GPU; normal visitors never hit it).
 */

export type GpuTier = "full" | "lite" | "none";

// v2: the policy changed (no more "lite" raymarch on integrated GPUs). Bumping
// the key discards any stale "lite" cached by a prior visit, which would
// otherwise re-mount the freezing glass on reload.
const CACHE_KEY = "zr-gpu-tier-v2";

// CPU rasterizers — real-time raymarch is not viable; serve the SVG.
const SOFTWARE = ["swiftshader", "llvmpipe", "software", "microsoft basic"];
// Integrated / mobile GPUs — a fullscreen raymarch freezes these; serve the SVG.
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

/** "Show me glass" opt-in: mount at the honest tier (floored at lite, never none). */
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

  const gl = getGL();
  if (!gl) return "none";

  // The raymarched glass is a HIGH-END ENHANCEMENT, not a baseline. A fullscreen
  // SDF raymarch hard-freezes integrated GPUs (Intel HD/UHD/Iris, mobile) and
  // software rasterizers — it trips the GPU driver's timeout (TDR) and hangs the
  // whole machine, which no JS watchdog can catch. A *reduced* raymarch trips it
  // too. So anything we can't positively identify as a capable, non-integrated
  // GPU gets the static SVG mark (zero WebGL). Glass is only for a recognized
  // discrete/capable GPU that ALSO clears a runtime perf probe.
  const r = rendererString(gl);
  if (!r) return "none"; // masked / unidentifiable → SVG (cannot risk a freeze)
  if (SOFTWARE.some((s) => r.includes(s))) return "none"; // CPU raster → SVG
  if (WEAK.some((s) => r.includes(s))) return "none"; // integrated / mobile → SVG
  return probeFrameMs(gl) < 2.2 ? "full" : "none"; // capable + fast → glass
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
  if (cached) return mountForced() && cached === "none" ? "full" : cached;

  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(CACHE_KEY);
  } catch {
    /* private mode */
  }
  // Only "full"/"none" are valid now; a stale "lite" (or anything else) re-decides.
  const tier: GpuTier =
    stored === "full" || stored === "none" ? (stored as GpuTier) : decide();

  cached = tier;
  try {
    sessionStorage.setItem(CACHE_KEY, tier);
  } catch {
    /* ignore */
  }
  return mountForced() && tier === "none" ? "full" : tier;
}
