"use client";

/**
 * FieldStage — the chapter-visual canvas (improvement-plan R1): ONE unified
 * liquid field (sdf-glass-shader — the same engine, shading and droplet maths
 * as the hero) driven by a pure FieldDriver (lib/webgl/field-drivers): scatter
 * (S3), converge (S4/S8), scrub-morph (S5), impulse exhale (S10).
 *
 * Tiers (lib/webgl/field-tier): "full" = glass at dpr ≤ 2 · "lite" = the flat
 * cyan branch at dpr 1 · "half" = flat at dpr 0.5 (watchdog floor). The FPS
 * watchdog needs SUSTAINED slowness (the counter decays on smooth frames) and
 * only ever lowers resolution — the liquid never freezes: a frozen scroll-
 * choreographed canvas reads as a pasted image being dragged, which is the
 * exact failure this system exists to prevent. Pauses when `play` is false
 * (off-screen). Context loss → onContextLost + rebuild on restore.
 */

import { useEffect, useReducer, useRef } from "react";
import {
  SDF_GLASS_VERT,
  SDF_GLASS_FRAG,
  SDF_BALL_MAX,
  SDF_THICK,
  SDF_RES,
  SDF_GRADE,
} from "@/lib/webgl/sdf-glass-shader.mjs";
import { makeLayer, makeSdfTexture, loadSdf } from "@/lib/webgl/sdf-gl";
import { makePostChain } from "@/lib/webgl/post-chain";
import type { FieldDriver } from "@/lib/webgl/field-drivers";
import { SVG_URLS, STATE_COUNT } from "@/lib/webgl/symbols";

type FieldStageProps = {
  driver: FieldDriver;
  play?: boolean;
  tier?: "full" | "lite";
  onReady?: () => void;
  onContextLost?: () => void;
  /** A runtime watchdog downshift happened (persist it if site-wide). */
  onTierChange?: (tier: "lite" | "none") => void;
};

export default function FieldStage({
  driver,
  play = true,
  tier = "full",
  onReady = () => {},
  onContextLost = () => {},
  onTierChange = () => {},
}: FieldStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cb = useRef({ onReady, onContextLost, onTierChange });
  useEffect(() => {
    cb.current = { onReady, onContextLost, onTierChange };
  }, [onReady, onContextLost, onTierChange]);

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

    // §12.5: on loss the loop PARKS (no zombie GL, no fake frame counts, no
    // battery burn) while the conductor keeps its state warm in PageStage;
    // restore bumps the epoch, which rebuilds this whole instance fresh.
    let ctxLost = false;
    const onLost = (e: Event) => {
      e.preventDefault();
      ctxLost = true;
      cb.current.onContextLost();
    };
    const onRestored = () => rebuild();
    layer.canvas.addEventListener("webglcontextlost", onLost);
    layer.canvas.addEventListener("webglcontextrestored", onRestored);

    // full = glass + post at dpr ≤ 2 · full-nofx = glass, post chain off (the
    // R5-C watchdog rung) · lite = flat cyan at dpr 1 · half = flat at dpr
    // 0.5. There is NO stop state: freezing a scroll-choreographed liquid
    // reads as a pasted image being dragged — a blurrier LIVING liquid always
    // beats a crisp dead one.
    let liveTier: "full" | "fullnofx" | "lite" | "half" = tier;
    // ?fgrade=0 — the R5-C exact optics bypass (spec §14.1): no post chain,
    // every grade uniform at its 0 identity → pre-C pixels.
    const gradeOn = !/[?&]fgrade=0/.test(window.location.search);
    // the R5-C post chain (bloom/dither/grain) — full tier only; null means
    // the direct path (= full-nofx rendering) for lite starts, bypass, or
    // contexts without a renderable offscreen format
    const post = gradeOn && tier === "full" ? makePostChain(gl) : null;

    gl.uniform1f(layer.U("iThick"), SDF_THICK);
    gl.uniform2f(layer.U("iTexel"), 1 / SDF_RES, 1 / SDF_RES);
    gl.uniform1i(layer.U("iSDF"), 0);
    gl.uniform1i(layer.U("iSDF2"), 1);

    const textures: (WebGLTexture | null)[] = new Array(STATE_COUNT).fill(null);
    const ballBuf = new Float32Array(SDF_BALL_MAX * 3);
    const zBuf = new Float32Array(SDF_BALL_MAX); // per-ball depth (iBallZ)
    let announced = false;

    // R5-C optics diagnostics (QA surface for verify-postfx): post/fmt/tier
    // track the live pipeline, frames counts REAL draws (the governor gate
    // measures cadence on it), demote() drives the watchdog rung in drills.
    const diag = {
      post: 0,
      fmt: (post?.fmt ?? "none") as string,
      tier: liveTier as string,
      frames: 0,
      gov: 0,
      demote: () => {},
    };
    (window as unknown as { __optics?: typeof diag }).__optics = diag;

    const maxDpr = Math.min(window.devicePixelRatio || 1, 2);
    const scaleFor = () =>
      liveTier === "full" || liveTier === "fullnofx"
        ? maxDpr
        : liveTier === "lite"
          ? 1
          : 0.5;

    const drawFrame = (tMs: number) => {
      if (ctxLost) return null; // parked — every caller tolerates a skip
      const aspect =
        gl.drawingBufferHeight > 0
          ? gl.drawingBufferWidth / gl.drawingBufferHeight
          : 1;
      const f = driverRef.current.frame(tMs, ballBuf, aspect, zBuf);
      const ta = textures[f.a];
      if (!ta) return f; // the driver's form isn't built yet — fallback stays
      const tb = textures[f.b] ?? ta;
      const glass = liveTier === "full" || liveTier === "fullnofx";
      const usePost = !!post && liveTier === "full";
      diag.post = usePost ? 1 : 0;
      diag.tier = liveTier;
      if (usePost) {
        post.begin(gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.disable(gl.BLEND); // store exact straight alpha in the target
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      gl.useProgram(layer.prog); // post passes (R5-C) leave their own program
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, ta);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tb);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(layer.U("iRes"), gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform1f(layer.U("iTime"), tMs / 1000);
      gl.uniform1f(layer.U("iFormA"), f.fa);
      gl.uniform1f(layer.U("iFormB"), textures[f.b] ? f.fb : 0);
      gl.uniform1f(layer.U("iEroA"), f.ea);
      gl.uniform1f(layer.U("iEroB"), f.eb);
      gl.uniform2f(layer.U("iFormOff"), f.ox ?? 0, f.oy ?? 0);
      gl.uniform1f(layer.U("iFormScale"), f.scale ?? 1);
      gl.uniform1f(layer.U("iWarp"), f.warp);
      gl.uniform1f(layer.U("iMute"), f.mute);
      gl.uniform1f(layer.U("iGlass"), glass ? 1 : 0);
      gl.uniform3fv(layer.U("iBalls"), ballBuf);
      gl.uniform1i(layer.U("iBallCount"), f.count);
      // R5-C grade: score-driven light + stage absorption/depth. All exact
      // identity at 0 — ?fgrade=0 and the flat tiers render pre-C pixels.
      const grade = gradeOn && glass;
      gl.uniform1f(layer.U("iExpo"), grade ? (f.expo ?? 0) : 0);
      gl.uniform1f(layer.U("iKey"), grade ? (f.key ?? 0) : 0);
      gl.uniform1f(layer.U("iAbsorb"), grade ? SDF_GRADE.ABSORB : 0);
      gl.uniform1f(layer.U("iDepthFx"), grade ? SDF_GRADE.DEPTH : 0);
      gl.uniform1fv(layer.U("iBallZ"), zBuf);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (usePost) {
        post.end(tMs / 1000); // bright → blur → opaque composite
        gl.enable(gl.BLEND); // the direct path composites over the page
      }
      diag.frames++;
      if (!announced) {
        announced = true;
        cb.current.onReady();
      }
      return f;
    };

    // FPS watchdog — requires SUSTAINED slowness (the counter decays on good
    // frames), so scroll flicks, tab stalls or capture harnesses can never
    // demote a healthy canvas. Downshifts lower resolution only; the liquid
    // NEVER freezes.
    let lastTick = 0;
    let raf = 0;
    let wdWarm = 0;
    let wdSlow = 0;

    // R5-C energy governor (§12.3): a truly idle liquid draws every OTHER
    // vsync (≈30 Hz — a floor, never a freeze). Entry needs SUSTAINED low
    // conductor energy AND no recent human input; any scene activity, scroll,
    // pointer or spray wakes it within one frame. ?fgov=0 disables (QA).
    const govOn = !/[?&]fgov=0/.test(window.location.search);
    const GOV_LOW = 0.1; // conductor energy below this counts as idle
    const GOV_SUSTAIN = 45; // ~0.75 s of consecutive idle draws to enter
    const GOV_INPUT_MS = 1200; // any input holds active cadence this long
    const GOV_FRAME_MS = 30; // idle floor ≈ 30 Hz on ANY display refresh rate
    let govLow = 0;
    let lastDraw = 0;
    let lastInput = performance.now();
    const markInput = () => {
      lastInput = performance.now();
    };
    const INPUT_EVENTS = ["pointermove", "pointerdown", "wheel", "touchmove", "keydown", "scroll"] as const;
    for (const ev of INPUT_EVENTS)
      window.addEventListener(ev, markInput, { passive: true });
    const downshift = () => {
      wdWarm = 0;
      wdSlow = 0;
      if (liveTier === "full") {
        // R5-C rung: shed the post chain first — glass survives (§12.3).
        // Runtime-only (not persisted): a fresh session retries full.
        liveTier = "fullnofx";
        resize();
      } else if (liveTier === "fullnofx") {
        liveTier = "lite";
        resize();
        cb.current.onTierChange("lite");
      } else if (liveTier === "lite") {
        liveTier = "half";
        resize();
      }
    };
    diag.demote = downshift;

    const tick = (now: number) => {
      raf = 0;
      if (disposed || !playRef.current) return;
      const governed =
        govOn && govLow >= GOV_SUSTAIN && now - lastInput > GOV_INPUT_MS;
      diag.gov = governed ? 1 : 0;
      if (governed && now - lastDraw < GOV_FRAME_MS) {
        // idle: hold the ~30 Hz floor (time-based — display-rate agnostic);
        // the loop never stops, so the wake is always one vsync away
        raf = requestAnimationFrame(tick);
        return;
      }
      lastDraw = now;
      const dt = now - lastTick;
      lastTick = now;
      if (++wdWarm > 5 && !governed) {
        // missing 2+ vsyncs counts up; smooth frames pay it back down
        // (governed frames are INTENTIONALLY ~33 ms — never counted)
        if (dt > 34) {
          if (++wdSlow >= 30) downshift();
        } else {
          wdSlow = Math.max(0, wdSlow - 2);
        }
      }
      const f = drawFrame(now);
      const e = f?.energy ?? 1;
      if (e < GOV_LOW) {
        if (govLow <= GOV_SUSTAIN) govLow++;
      } else {
        govLow = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    const startLoop = () => {
      if (raf || disposed || !playRef.current) return;
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
          driverRef.current.formReady?.(s); // retargeting drivers gate on this
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
      for (const ev of INPUT_EVENTS) window.removeEventListener(ev, markInput);
      post?.dispose();
      const w = window as unknown as { __optics?: typeof diag };
      if (w.__optics === diag) delete w.__optics;
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
