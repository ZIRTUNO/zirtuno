"use client";

/**
 * FieldStage — the chapter-visual canvas (improvement-plan R1): ONE unified
 * liquid field (sdf-glass-shader — the same engine, shading and droplet maths
 * as the hero) driven by a pure FieldDriver (lib/webgl/field-drivers): scatter
 * (S3), converge (S4/S8), scrub-morph (S5), impulse exhale (S10).
 *
 * Tiers (lib/webgl/field-tier): "full" = glass at dpr ≤ 2 · "lite" = the flat
 * cyan branch at dpr 1. An FPS watchdog downshifts full → lite → stop (holds
 * the last frame) — locally only; a janky scroll on one chapter must not nuke
 * the whole site's tier. Pauses when `play` is false (off-screen). Context
 * loss → onContextLost (shell re-shows its fallback) + rebuild on restore.
 */

import { useEffect, useReducer, useRef } from "react";
import {
  SDF_GLASS_VERT,
  SDF_GLASS_FRAG,
  SDF_BALL_MAX,
  SDF_THICK,
  SDF_RES,
} from "@/lib/webgl/sdf-glass-shader.mjs";
import { makeLayer, makeSdfTexture, loadSdf } from "@/lib/webgl/sdf-gl";
import type { FieldDriver } from "@/lib/webgl/field-drivers";
import { SVG_URLS, STATE_COUNT } from "@/lib/webgl/symbols";

type FieldStageProps = {
  driver: FieldDriver;
  play?: boolean;
  tier?: "full" | "lite";
  onReady?: () => void;
  onContextLost?: () => void;
};

export default function FieldStage({
  driver,
  play = true,
  tier = "full",
  onReady = () => {},
  onContextLost = () => {},
}: FieldStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cb = useRef({ onReady, onContextLost });
  useEffect(() => {
    cb.current = { onReady, onContextLost };
  }, [onReady, onContextLost]);

  const driverRef = useRef(driver);
  useEffect(() => {
    driverRef.current = driver;
  }, [driver]);

  const playRef = useRef(play);
  const api = useRef<{ setPlay: (p: boolean) => void } | null>(null);
  // bumping the epoch re-runs the setup with a fresh GL context (after a loss)
  const [epoch, rebuild] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    const layer = makeLayer(container, SDF_GLASS_VERT, SDF_GLASS_FRAG);
    if (!layer) return; // no WebGL2 → shell's SVG fallback stays
    const gl = layer.gl;

    const onLost = (e: Event) => {
      e.preventDefault();
      cb.current.onContextLost();
    };
    const onRestored = () => rebuild();
    layer.canvas.addEventListener("webglcontextlost", onLost);
    layer.canvas.addEventListener("webglcontextrestored", onRestored);

    let liveTier: "full" | "lite" = tier;
    let stopped = false;

    gl.uniform1f(layer.U("iThick"), SDF_THICK);
    gl.uniform2f(layer.U("iTexel"), 1 / SDF_RES, 1 / SDF_RES);
    gl.uniform1i(layer.U("iSDF"), 0);
    gl.uniform1i(layer.U("iSDF2"), 1);

    const textures: (WebGLTexture | null)[] = new Array(STATE_COUNT).fill(null);
    const ballBuf = new Float32Array(SDF_BALL_MAX * 3);
    let announced = false;

    const maxDpr = Math.min(window.devicePixelRatio || 1, 2);
    const scaleFor = () => (liveTier === "full" ? maxDpr : 1);

    const drawFrame = (tMs: number) => {
      const f = driverRef.current.frame(tMs, ballBuf);
      const ta = textures[f.a];
      if (!ta) return; // the driver's form isn't built yet — fallback stays
      const tb = textures[f.b] ?? ta;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, ta);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tb);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(layer.U("iRes"), gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform1f(layer.U("iTime"), tMs / 1000);
      gl.uniform1f(layer.U("iFormA"), f.fa);
      gl.uniform1f(layer.U("iFormB"), textures[f.b] ? f.fb : 0);
      gl.uniform1f(layer.U("iWarp"), f.warp);
      gl.uniform1f(layer.U("iMute"), f.mute);
      gl.uniform1f(layer.U("iGlass"), liveTier === "full" ? 1 : 0);
      gl.uniform3fv(layer.U("iBalls"), ballBuf);
      gl.uniform1i(layer.U("iBallCount"), f.count);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!announced) {
        announced = true;
        cb.current.onReady();
      }
    };

    // FPS watchdog — chapter-local downshifts (never persisted globally: scroll
    // jank on one section must not demote the whole site).
    let lastTick = 0;
    let raf = 0;
    let wdWarm = 0;
    let wdSlow = 0;
    const downshift = () => {
      wdWarm = 0;
      wdSlow = 0;
      if (liveTier === "full") {
        liveTier = "lite";
        resize();
      } else {
        stopped = true; // hold the last frame; the chapter stays composed
      }
    };

    const tick = (now: number) => {
      raf = 0;
      if (disposed || stopped || !playRef.current) return;
      const dt = now - lastTick;
      lastTick = now;
      if (++wdWarm > 5 && dt > 25 && ++wdSlow >= 12) downshift();
      if (stopped) return;
      drawFrame(now);
      raf = requestAnimationFrame(tick);
    };
    const startLoop = () => {
      if (raf || disposed || stopped || !playRef.current) return;
      lastTick = performance.now();
      raf = requestAnimationFrame(tick);
    };
    api.current = {
      setPlay: (p: boolean) => {
        if (p) startLoop();
      },
    };

    const resize = () => {
      const scale = scaleFor();
      const w = Math.max(1, Math.round((container.clientWidth || 1) * scale));
      const h = Math.max(1, Math.round((container.clientHeight || 1) * scale));
      if (layer.canvas.width !== w || layer.canvas.height !== h) {
        layer.canvas.width = w;
        layer.canvas.height = h;
      }
      drawFrame(performance.now()); // never flash an empty canvas on resize
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();
    startLoop();

    // prefetch the driver's forms (forms[0] gates the first paint)
    (async () => {
      for (const s of driverRef.current.forms) {
        if (disposed) return;
        try {
          const data = await loadSdf(SVG_URLS[s]);
          if (disposed) return;
          textures[s] = makeSdfTexture(layer, data);
          drawFrame(performance.now()); // paint as soon as the form exists
        } catch {
          /* missing form: the fallback stays for frames that need it */
        }
      }
    })();

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      layer.canvas.removeEventListener("webglcontextlost", onLost);
      layer.canvas.removeEventListener("webglcontextrestored", onRestored);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      layer.canvas.remove();
      api.current = null;
    };
  }, [tier, epoch]);

  useEffect(() => {
    playRef.current = play;
    api.current?.setPlay(play);
  }, [play]);

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", height: "100%" }}
    />
  );
}
