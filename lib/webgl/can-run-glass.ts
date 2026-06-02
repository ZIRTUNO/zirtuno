"use client";

/**
 * Decide whether this device should run the raymarched glass (S2.3) or fall back
 * to the static SVG mark. A fullscreen SDF raymarch hangs weak integrated GPUs
 * (notably Intel HD/UHD) and software rasterizers — on those it can freeze the
 * whole browser — so we serve the (high-fidelity) SVG there. The glass is a
 * progressive enhancement for capable GPUs.
 *
 * `?glass=force` (or `?glass=1`/`on`) overrides the gate; the screenshot pipeline
 * also forces it via the deterministic `?capture=`/`?state=`/`?pair=` params.
 */
export function glassForced(): boolean {
  if (typeof window === "undefined") return false;
  return /[?&](?:glass=(?:1|on|force)|capture=|state=|pair=)/i.test(
    window.location.search,
  );
}

// GPUs / rasterizers that hang on a fullscreen raymarch → keep them on the SVG.
const BLOCKED = [
  "swiftshader",
  "llvmpipe",
  "software",
  "microsoft basic",
  "intel(r) hd graphics",
  "intel hd graphics",
  "intel(r) uhd graphics",
  "intel uhd graphics",
  "mali",
  "adreno",
  "powervr",
  "videocore",
];

export function canRunGlass(): boolean {
  if (typeof window === "undefined") return false;

  let gl: WebGLRenderingContext | null = null;
  try {
    const c = document.createElement("canvas");
    gl = (c.getContext("webgl2") ||
      c.getContext("webgl")) as WebGLRenderingContext | null;
  } catch {
    return false;
  }
  if (!gl) return false;
  if (glassForced()) return true;

  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = (
    dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : ""
  ).toLowerCase();

  // Unknown renderer (masked) → allow; known-weak → SVG.
  return !BLOCKED.some((s) => renderer.includes(s));
}
