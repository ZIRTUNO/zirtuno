"use client";

/**
 * FieldMorphHero — the living EXACT-form hero (morph-spec v1.6). One always-
 * visible glass layer fed by the owner's vector forms themselves: each form's
 * signed-distance field (built from `public/brand/forms/*.svg` + the mark) is
 * rendered through the LOCKED glass shading, with the field source animated:
 *
 *   - REST: the exact form, alive — a slow procedural domain warp (≈2 px
 *     wobble), the CSS breath (±2 %), the pointer lean (≤4 %). Silhouette and
 *     holes are the SVG's own; fidelity is exact by construction.
 *   - MORPH: the two distance fields BLEND (iMix, arrive-eased) while the warp
 *     agitates and a mid-melt PINCH shrinks the field so thin connections snap
 *     into droplets and reform on arrival — an organic, gooey melt between two
 *     exact endpoints. No metaball approximation of the forms anywhere.
 *
 * State machine (§4): rest (dwell DURATIONS.autocycle) → morph → rest…; pauses
 * off-screen (`play`) and while hovered; `manualState` (keyboard) queues a
 * retarget (applied on arrival — no snaps). FPS watchdog: full → lite (dpr 1)
 * → still-frame — it degrades, it never freezes. `frozenPair` renders one
 * deterministic frame (?fpair=a-b-m; ?fstate=N maps to [N,N,1] in the shell).
 */

import { useEffect, useReducer, useRef } from "react";
import {
  SDF_GLASS_VERT,
  SDF_GLASS_FRAG,
  SDF_THICK,
  SDF_RES,
  SDF_DRAW,
  SDF_BLUR,
  SDF_WARP_REST,
  SDF_WARP_MORPH,
  SDF_PINCH,
} from "@/lib/webgl/sdf-glass-shader.mjs";
import { buildSdfAsync } from "@/lib/webgl/sdf";
import { METABALL_STATES, STATE_COUNT } from "@/lib/webgl/states";
import { DURATIONS } from "@/lib/animation/durations";
import { EASINGS, EASE_POINTS } from "@/lib/animation/easings";

const HOLD = DURATIONS.autocycle; // rest dwell (ms)
const TRANS = DURATIONS.morph; // melt duration (ms)
const LEAN = 0.04; // pointer lean, fraction of the stage (§4)

const SVG_URLS: string[] = METABALL_STATES.map((s) =>
  s.key === "mark" ? "/brand/zirtuno-logo-mark.svg" : `/brand/forms/${s.key}.svg`,
);

// built SDFs survive remounts and are shared across instances (8 × 1 MB)
const sdfDataCache = new Map<string, Float32Array>();

async function loadSdf(url: string): Promise<Float32Array> {
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

// ── small math helpers ─────────────────────────────────────────────────────────
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Standard cubic-bezier easing evaluator (Newton + bisection fallback). */
function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx;
  const cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
  const X = (t: number) => ((ax * t + bx) * t + cx) * t;
  const Y = (t: number) => ((ay * t + by) * t + cy) * t;
  const DX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 5; i++) {
      const e = X(t) - x;
      if (Math.abs(e) < 1e-5) return Y(t);
      const d = DX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    while (hi - lo > 1e-5) {
      t = (lo + hi) / 2;
      if (X(t) < x) lo = t; else hi = t;
    }
    return Y(t);
  };
}
const arrive = cubicBezier(...(EASE_POINTS.arrive as readonly number[] as [number, number, number, number]));

// ── minimal GL plumbing (one fullscreen triangle) ──────────────────────────────
type Layer = {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  U: (n: string) => WebGLUniformLocation | null;
  floatLinear: boolean;
};

function makeLayer(container: HTMLElement, vert: string, frag: string): Layer | null {
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

function makeSdfTexture(layer: Layer, data: Float32Array): WebGLTexture {
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

type HeroProps = {
  play?: boolean;
  manualState?: number | null;
  frozenPair?: [number, number, number] | null; // [a, b, m] — one deterministic frame
  dwellMs?: number; // override the rest dwell (QA fast cycle)
  /** Initial render tier from the probe (§7). Must not change after mount — the
   *  in-component FPS watchdog handles runtime downshifts. */
  tier?: "full" | "lite";
  /** A runtime watchdog downshift happened — persist it (lib/webgl/field-tier). */
  onTierChange?: (tier: "lite" | "none") => void;
  onReady?: () => void;
  onActiveChange?: (i: number) => void; // -1 = mark, 0-6 = pillars (shell convention)
  onContextLost?: () => void;
  // parity with the other scenes; unused:
  capture?: unknown;
  previewState?: number | null;
  morphPair?: unknown;
};

export default function FieldMorphHero({
  play = true,
  manualState = null,
  frozenPair = null,
  dwellMs,
  tier = "full",
  onTierChange = () => {},
  onReady = () => {},
  onActiveChange = () => {},
  onContextLost = () => {},
}: HeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leanRef = useRef<HTMLDivElement>(null);
  const cb = useRef({ onReady, onActiveChange, onContextLost, onTierChange });
  useEffect(() => {
    cb.current = { onReady, onActiveChange, onContextLost, onTierChange };
  }, [onReady, onActiveChange, onContextLost, onTierChange]);

  // external props, readable from inside the machine without re-running the effect
  const playRef = useRef(play);
  const manualRef = useRef(manualState);

  // machine command surface — (re)created each effect run; prop-effects call into it
  const api = useRef<{ morphTo: (s: number) => void; setPlay: (p: boolean) => void } | null>(null);
  // bumping the epoch re-runs the machine with fresh GL contexts (after a loss)
  const [epoch, rebuild] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || frozenPair) return; // frozen mode handled below

    let disposed = false;
    const dwell = dwellMs ?? HOLD;

    // ── the one liquid layer ─────────────────────────────────────────────────
    const layer = makeLayer(container, SDF_GLASS_VERT, SDF_GLASS_FRAG);
    if (!layer) return; // no WebGL2 → shell's SVG fallback stays
    const gl = layer.gl;

    const onLost = (e: Event) => {
      e.preventDefault(); // allow the context to be restored
      cb.current.onContextLost();
    };
    const onRestored = () => rebuild(); // fresh context; machine restarts at rest
    layer.canvas.addEventListener("webglcontextlost", onLost);
    layer.canvas.addEventListener("webglcontextrestored", onRestored);

    // ── tier (§7): the SDF renderer is cheap (a few texture reads + lighting),
    // so lite only lowers resolution. The watchdog downshifts — never freezes.
    let liveTier: "full" | "lite" = tier;
    let stopped = false; // final downshift: hold the exact form as a still

    gl.uniform1f(layer.U("iThick"), SDF_THICK);
    gl.uniform2f(layer.U("iTexel"), 1 / SDF_RES, 1 / SDF_RES);
    gl.uniform1i(layer.U("iSDF"), 0);
    gl.uniform1i(layer.U("iSDF2"), 1);

    const textures: (WebGLTexture | null)[] = new Array(STATE_COUNT).fill(null);
    const bindForms = (a: number, b: number) => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textures[a]);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, textures[b]);
    };

    // ── draw ─────────────────────────────────────────────────────────────────
    const maxDpr = Math.min(window.devicePixelRatio || 1, 2);
    const scaleFor = () => (liveTier === "full" ? maxDpr : 1);
    let sdfReady = false; // never draw before form 0's texture exists
    const draw = (timeSec: number, mixv: number, warp: number, pinch: number) => {
      if (!sdfReady) return;
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(layer.U("iRes"), gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform1f(layer.U("iTime"), timeSec);
      gl.uniform1f(layer.U("iMix"), mixv);
      gl.uniform1f(layer.U("iWarp"), warp);
      gl.uniform1f(layer.U("iPinch"), pinch);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    // ── the machine ──────────────────────────────────────────────────────────
    let state = 0; // resting form
    // (cast launders the literal so flow analysis keeps the union inside closures)
    let phase = "rest" as "rest" | "morph";
    let target = 0;
    let queued = -1; // retarget requested mid-melt / before its SDF is built
    let morphT = 0;
    let lastTick = 0;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let hovering = false;
    let announcedReady = false;
    let wdWarm = 0; // watchdog: frames seen (skip the warm-up)
    let wdSlow = 0; // watchdog: slow frames

    // FPS watchdog (§7) — downshift instead of freezing. full → lite lowers the
    // buffer; lite → the loop stops on the exact resting form (a crisp still,
    // never a blank or a jank).
    const downshift = () => {
      wdSlow = 0;
      wdWarm = 0;
      if (liveTier === "full") {
        liveTier = "lite";
        resize();
        cb.current.onTierChange("lite");
      } else if (!stopped) {
        stopped = true;
        if (timer) clearTimeout(timer);
        timer = null;
        cb.current.onTierChange("none");
      }
    };

    const scheduleNext = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (stopped || !playRef.current || hovering || manualRef.current != null)
        return;
      timer = setTimeout(() => morphTo((state + 1) % STATE_COUNT), dwell);
    };

    const tick = (now: number) => {
      raf = 0;
      if (disposed || stopped || !playRef.current) return;
      const dt = now - lastTick;
      lastTick = now;
      // watchdog sampling (continuous — rest and melt cost the same draw)
      if (++wdWarm > 5 && dt > 25 && ++wdSlow >= 12) downshift();
      if (stopped) return; // downshifted to a still just now
      if (phase === "morph") {
        morphT += dt;
        const p = clamp01(morphT / TRANS);
        const env = Math.sin(Math.PI * p); // 0 at the ends → seamless rest handoff
        draw(
          now / 1000,
          arrive(p),
          SDF_WARP_REST + (SDF_WARP_MORPH - SDF_WARP_REST) * env,
          SDF_PINCH * env,
        );
        if (p >= 1) {
          state = target;
          bindForms(state, state);
          phase = "rest";
          cb.current.onActiveChange(state - 1);
          if (queued >= 0 && queued !== state) {
            const q = queued;
            queued = -1;
            morphTo(q);
          } else {
            queued = -1;
            scheduleNext();
          }
        }
      } else {
        draw(now / 1000, 0, SDF_WARP_REST, 0);
        if (!announcedReady) {
          announcedReady = true;
          cb.current.onReady();
          scheduleNext();
        }
      }
      raf = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (raf || disposed || stopped || !playRef.current) return;
      lastTick = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const morphTo = (s: number) => {
      if (disposed || stopped || s < 0 || s >= STATE_COUNT) return;
      if (phase === "rest" && s === state) return;
      if (phase === "morph") {
        queued = s === target ? -1 : s; // retarget applies on arrival (no snap)
        return;
      }
      if (!textures[s]) {
        queued = s; // SDF still building — the prefetch loop fires it when ready
        return;
      }
      if (timer) clearTimeout(timer);
      timer = null;
      bindForms(state, s);
      target = s;
      morphT = 0;
      wdWarm = 0;
      wdSlow = 0;
      phase = "morph";
      cb.current.onActiveChange(s - 1);
      startLoop();
    };

    api.current = {
      morphTo,
      setPlay: (p: boolean) => {
        if (p) {
          startLoop();
          if (phase === "rest") scheduleNext();
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
    };

    // ── hover: pause the autocycle + lean toward the pointer (§4) ────────────
    const lean = leanRef.current;
    const onEnter = () => {
      hovering = true;
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const onMove = (e: PointerEvent) => {
      if (!lean) return;
      const r = container.getBoundingClientRect();
      const nx = clamp01((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = clamp01((e.clientY - r.top) / r.height) * 2 - 1;
      lean.style.transform = `translate(${nx * LEAN * 100}%, ${ny * LEAN * 100}%)`;
    };
    const onLeave = () => {
      hovering = false;
      if (lean) lean.style.transform = "translate(0,0)";
      if (phase === "rest") scheduleNext();
    };
    container.addEventListener("pointerenter", onEnter);
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerleave", onLeave);

    // ── sizing ───────────────────────────────────────────────────────────────
    const resize = () => {
      const scale = scaleFor();
      const w = Math.max(1, Math.round((container.clientWidth || 1) * scale));
      const h = Math.max(1, Math.round((container.clientHeight || 1) * scale));
      if (layer.canvas.width !== w || layer.canvas.height !== h) {
        layer.canvas.width = w;
        layer.canvas.height = h;
      }
      // repaint immediately so resizes never flash an empty canvas
      if (phase === "morph") {
        const p = clamp01(morphT / TRANS);
        const env = Math.sin(Math.PI * p);
        draw(
          performance.now() / 1000,
          arrive(p),
          SDF_WARP_REST + (SDF_WARP_MORPH - SDF_WARP_REST) * env,
          SDF_PINCH * env,
        );
      } else {
        draw(performance.now() / 1000, 0, SDF_WARP_REST, 0);
      }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();
    startLoop();

    // ── prefetch all 8 form SDFs (worker-built; the mark first → first paint) ─
    (async () => {
      for (let i = 0; i < STATE_COUNT; i++) {
        if (disposed) return;
        let data: Float32Array;
        try {
          data = await loadSdf(SVG_URLS[i]);
        } catch {
          continue; // missing form: it is skipped by the autocycle queue
        }
        if (disposed) return;
        textures[i] = makeSdfTexture(layer, data);
        if (i === 0) {
          bindForms(0, 0);
          sdfReady = true;
        }
        if (queued === i && phase === "rest") {
          const q = queued;
          queued = -1;
          morphTo(q);
        }
      }
    })();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      container.removeEventListener("pointerenter", onEnter);
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerleave", onLeave);
      layer.canvas.removeEventListener("webglcontextlost", onLost);
      layer.canvas.removeEventListener("webglcontextrestored", onRestored);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      layer.canvas.remove();
      api.current = null;
    };
  }, [frozenPair, dwellMs, tier, epoch]);

  // push prop changes into the running machine
  useEffect(() => {
    playRef.current = play;
    api.current?.setPlay(play);
  }, [play]);
  useEffect(() => {
    manualRef.current = manualState;
    if (manualState != null) api.current?.morphTo(manualState);
    else api.current?.setPlay(playRef.current); // blur → resume the autocycle
  }, [manualState]);

  // ── deterministic frozen frame (?fpair=a-b-m · ?fstate=N → [N,N,1]) ────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !frozenPair) return;
    const [a, b, m] = frozenPair;
    const layer = makeLayer(container, SDF_GLASS_VERT, SDF_GLASS_FRAG);
    if (!layer) return;
    const gl = layer.gl;
    gl.uniform1f(layer.U("iThick"), SDF_THICK);
    gl.uniform2f(layer.U("iTexel"), 1 / SDF_RES, 1 / SDF_RES);
    gl.uniform1i(layer.U("iSDF"), 0);
    gl.uniform1i(layer.U("iSDF2"), 1);

    let disposed = false;
    let texA: WebGLTexture | null = null;
    let texB: WebGLTexture | null = null;
    const env = Math.sin(Math.PI * m);
    // a rest still (a === b) renders with ZERO warp → the pixel-exact form
    const warp = a === b ? 0 : SDF_WARP_REST + (SDF_WARP_MORPH - SDF_WARP_REST) * env;
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
      gl.uniform1f(layer.U("iMix"), arrive(m));
      gl.uniform1f(layer.U("iWarp"), warp);
      gl.uniform1f(layer.U("iPinch"), SDF_PINCH * env);
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
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      layer.canvas.remove();
    };
  }, [frozenPair]);

  return (
    <div
      ref={leanRef}
      style={{
        width: "100%",
        height: "100%",
        transition: `transform 400ms ${EASINGS.arrive}`,
      }}
    >
      <div
        ref={containerRef}
        className={frozenPair ? undefined : "sdf-glass-breath"}
        style={{ position: "relative", width: "100%", height: "100%" }}
      />
    </div>
  );
}
