"use client";

/**
 * FormStillRenderer — the isolated deterministic renderer used only by the
 * no-index `/[locale]/lab/forms` QA route and its capture gates. Keeping it off
 * the homepage preserves the one-canvas contract while retaining byte-stable
 * exact-form evidence:
 *
 *   ?fstate=N   → [N, N, 1]: a zero-warp EXACT rest form
 *   ?fpair=a-b-m → one §3.3 bridge mid-frame (A melts into B at m)
 *   ?fcursor=x,y → adds one merged cursor droplet at full radius
 *
 * Same shader, same bridge math, same constants as the live site fluid — the
 * stills certify exactly what ships.
 */

import { useEffect, useRef } from "react";
import {
  SDF_GLASS_VERT,
  SDF_GLASS_FRAG,
  SDF_BALL_MAX,
  SDF_THICK,
  SDF_RES,
  SDF_WARP_REST,
  SDF_WARP_MORPH,
  CURSOR_R,
  CURSOR_INFLUENCE_MARK,
} from "@/lib/webgl/sdf-glass-shader.mjs";
import { makeLayer, makeSdfTexture, loadSdf } from "@/lib/webgl/sdf-gl";
import {
  CLOUDS,
  STAG,
  clamp01,
  packBridge,
  FORM_SOLIDITY,
  formPhase,
  permFor,
} from "@/lib/webgl/field-drivers";
import { SVG_URLS } from "@/lib/webgl/symbols";

type FormStillRendererProps = {
  frozenPair: [number, number, number]; // [a, b, m] — one deterministic frame
  /** Deterministic merged cursor droplet (?fcursor=x,y; page-style coords:
   *  x right, y DOWN, both 0..1). */
  frozenCursor?: [number, number] | null;
  onReady?: () => void;
  onContextLost?: () => void;
};

export default function FormStillRenderer({
  frozenPair,
  frozenCursor = null,
  onReady = () => {},
  onContextLost = () => {},
}: FormStillRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cb = useRef({ onReady, onContextLost });
  useEffect(() => {
    cb.current = { onReady, onContextLost };
  }, [onReady, onContextLost]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const [a, b, m] = frozenPair;
    const layer = makeLayer(container, SDF_GLASS_VERT, SDF_GLASS_FRAG);
    if (!layer) return; // no WebGL2 → shell's SVG fallback stays
    const gl = layer.gl;

    const onLost = (e: Event) => {
      e.preventDefault();
      cb.current.onContextLost();
    };
    layer.canvas.addEventListener("webglcontextlost", onLost);

    gl.uniform1f(layer.U("iThick"), SDF_THICK);
    gl.uniform2f(layer.U("iTexel"), 1 / SDF_RES, 1 / SDF_RES);
    gl.uniform1i(layer.U("iSDF"), 0);
    gl.uniform1i(layer.U("iSDF2"), 1);
    gl.uniform1f(layer.U("iGlass"), 1);
    // clean brand-cyan material, like the page; set explicitly for exact QA
    gl.uniform1f(layer.U("iGloss"), 0);

    let disposed = false;
    let texA: WebGLTexture | null = null;
    let texB: WebGLTexture | null = null;
    const melt = a !== b;
    const env = Math.sin(Math.PI * m);
    // a rest still (a === b) renders with ZERO warp → the pixel-exact form
    const warp = melt ? SDF_WARP_REST + (SDF_WARP_MORPH - SDF_WARP_REST) * env : 0;
    const { wA, eA, wB, eB } = melt
      ? formPhase(m)
      : { wA: 1, eA: 0, wB: 0, eB: 0 };
    const buf = new Float32Array(SDF_BALL_MAX * 3);
    // iBallDensity has NO safe GLSL default: unset uniform arrays read 0, which
    // multiplies the whole ball field away. Every consumer of the glass shader
    // must upload it, exactly like iGlass. Solid is the identity.
    const dens = new Float32Array(SDF_BALL_MAX).fill(1);
    let count = 0;
    if (frozenCursor) {
      buf[0] = clamp01(frozenCursor[0]);
      buf[1] = 1 - clamp01(frozenCursor[1]); // page y-down → uv y-up
      buf[2] = CURSOR_R * (!melt && a === 0 ? CURSOR_INFLUENCE_MARK : 1);
      count = 1;
    }
    if (melt)
      count = packBridge(buf, count, CLOUDS[a], CLOUDS[b], permFor(a, b), STAG[a], m, dens,
        FORM_SOLIDITY[a], FORM_SOLIDITY[b]);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const draw = () => {
      if (!texA || !texB) return;
      const w = Math.max(1, Math.round((container.clientWidth || 1) * dpr));
      const h = Math.max(1, Math.round((container.clientHeight || 1) * dpr));
      layer.canvas.width = w;
      layer.canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(layer.U("iRes"), w, h);
      gl.uniform1f(layer.U("iTime"), 0);
      gl.uniform1f(layer.U("iFormA"), wA);
      gl.uniform1f(layer.U("iFormB"), wB);
      gl.uniform1f(layer.U("iEroA"), eA);
      gl.uniform1f(layer.U("iEroB"), eB);
      gl.uniform1f(layer.U("iWarp"), warp);
      gl.uniform3fv(layer.U("iBalls"), buf);
      gl.uniform1fv(layer.U("iBallDensity"), dens);
      gl.uniform1i(layer.U("iBallCount"), count);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texA);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, texB);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      cb.current.onReady();
    };

    (async () => {
      try {
        const [da, db] = await Promise.all([
          loadSdf(SVG_URLS[a]),
          loadSdf(SVG_URLS[b]),
        ]);
        if (disposed) return;
        texA = makeSdfTexture(layer, da);
        texB = makeSdfTexture(layer, db);
        draw();
      } catch {
        /* missing form: the fallback logo stays */
      }
    })();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => {
      disposed = true;
      ro.disconnect();
      layer.canvas.removeEventListener("webglcontextlost", onLost);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      layer.canvas.remove();
    };
  }, [frozenPair, frozenCursor]);

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", height: "100%" }}
    />
  );
}
