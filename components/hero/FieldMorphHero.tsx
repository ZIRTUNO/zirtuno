"use client";

/**
 * FieldMorphHero — the morphing field hero (metaball-morph-spec Phase 3, §3/§4 +
 * v1.2 §6.1). Two stacked WebGL2 layers inside one breathing/leaning wrapper:
 *
 *   - SDF layer (top): the current form's crisp SVG shaded as liquid glass via its
 *     signed-distance field (LOCKED sdf-glass-shader). Visible at REST.
 *   - FIELD layer (bottom): the 48-ball inverse-square metaball field (LOCKED
 *     field-shader). Visible only during the MORPH — the liquid melt.
 *
 * A transition A→B (spec v1.2 mechanics): the SDF(A) fades out (~200 ms) while the
 * field fades in already melting from A's ball-cloud toward B's; the balls lerp
 * for DURATIONS.morph with min-travel matching (§3.2, greedy nearest-neighbour,
 * cached per transition), regional left-to-right stagger and radius-leads-position
 * (§3.3); on arrival the SDF(B) fades in on top, sharpening the liquid into the
 * crisp form. Both layers share the same content-bbox fit, so endpoints register.
 *
 * State machine (§4): rest (dwell DURATIONS.autocycle) → morph → rest…; pauses
 * off-screen (`play`) and while hovered; `manualState` (keyboard) retargets even
 * mid-morph. The wrapper breathes (CSS, ±2 %) and leans ≤4 % toward the pointer.
 * No rAF at rest — the only continuous animation is the CSS breath.
 *
 * `frozenPair` renders one deterministic mid-morph frame (QA: ?fpair=a-b-m).
 */

import { useEffect, useReducer, useRef } from "react";
import {
  FIELD_VERT,
  FIELD_FRAG,
  FIELD_N,
  FIELD_ISO,
  FIELD_FRAME,
} from "@/lib/webgl/field-shader.mjs";
import {
  SDF_GLASS_VERT,
  SDF_GLASS_FRAG,
  SDF_THICK,
  SDF_RES,
  SDF_DRAW,
  SDF_BLUR,
} from "@/lib/webgl/sdf-glass-shader.mjs";
import { buildSdfAsync } from "@/lib/webgl/sdf";
import { ALL_RAW } from "@/lib/webgl/symbols.data.mjs";
import { STATE_COUNT } from "@/lib/webgl/states";
import { DURATIONS } from "@/lib/animation/durations";
import { EASINGS, EASE_POINTS } from "@/lib/animation/easings";

const N = FIELD_N;
const HOLD = DURATIONS.autocycle; // rest dwell (ms)
const TRANS = DURATIONS.morph; // melt duration (ms)
const FADE = DURATIONS.micro; // layer crossfade (ms)
const STAGGER = 0.25; // fraction of the timeline spent sweeping the stagger
const RADIUS_LEAD = 1.18; // radius finishes ~18% ahead of position (§3.3)
const LEAN = 0.04; // pointer lean, fraction of the stage (§4)

type Ball = readonly [number, number, number];
type Cloud = readonly Ball[];

const CLOUDS: Cloud[] = ALL_RAW.map(
  (s: { balls: number[][] }) => s.balls as unknown as Cloud,
);
const SVG_URLS: string[] = ALL_RAW.map((s: { key: string }) =>
  s.key === "mark" ? "/brand/zirtuno-logo-mark.svg" : `/brand/forms/${s.key}.svg`,
);

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

/** Min-travel droplet matching (§3.2): greedy nearest-neighbour, O(N² log N). */
function matchClouds(A: Cloud, B: Cloud): number[] {
  const pairs: [number, number, number][] = [];
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const dx = A[i][0] - B[j][0], dy = A[i][1] - B[j][1];
      pairs.push([dx * dx + dy * dy, i, j]);
    }
  pairs.sort((a, b) => a[0] - b[0]);
  const perm = new Array<number>(N).fill(-1);
  const used = new Uint8Array(N);
  let done = 0;
  for (const [, i, j] of pairs) {
    if (perm[i] >= 0 || used[j]) continue;
    perm[i] = j;
    used[j] = 1;
    if (++done === N) break;
  }
  return perm;
}

// ── minimal GL plumbing (one fullscreen triangle per layer) ────────────────────
type Layer = {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  U: (n: string) => WebGLUniformLocation | null;
};

function makeLayer(container: HTMLElement, vert: string, frag: string): Layer | null {
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;" +
    `opacity:0;transition:opacity ${FADE}ms ${EASINGS.calm};`;
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
  });
  if (!gl) return null;
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
  return { canvas, gl, prog, U: (n) => gl.getUniformLocation(prog, n) };
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

  // survives context-loss rebuilds and re-mounts of the effect:
  const sdfDataCache = useRef<(Float32Array | null)[]>(new Array(STATE_COUNT).fill(null));
  const permCache = useRef(new Map<string, number[]>());

  // external props, readable from inside the machine without re-running the effect
  const playRef = useRef(play);
  const manualRef = useRef(manualState);

  // machine command surface — (re)created each effect run; prop-effects call into it
  const api = useRef<{ morphTo: (s: number) => void; setPlay: (p: boolean) => void } | null>(null);
  // bumping the epoch re-runs the machine with fresh GL contexts (after a loss);
  // the SDF data cache survives, so the rebuild skips the expensive EDT work
  const [epoch, rebuild] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || frozenPair) return; // frozen mode handled below

    let disposed = false;
    const dwell = dwellMs ?? HOLD;

    // ── layers ──────────────────────────────────────────────────────────────
    const field = makeLayer(container, FIELD_VERT, FIELD_FRAG);
    const sdf = makeLayer(container, SDF_GLASS_VERT, SDF_GLASS_FRAG);
    if (!field || !sdf) return; // no WebGL2 → shell's SVG fallback stays
    sdf.canvas.style.zIndex = "1";

    const onLost = (e: Event) => {
      e.preventDefault(); // allow the context to be restored
      cb.current.onContextLost();
    };
    const onRestored = () => rebuild(); // fresh contexts; machine restarts at rest
    for (const l of [field, sdf]) {
      l.canvas.addEventListener("webglcontextlost", onLost);
      l.canvas.addEventListener("webglcontextrestored", onRestored);
    }

    // ── tier (§7): "full" = glass melt at dpr ≤2 · "lite" = the locked shader's
    // flat-cyan branch at dpr 1 × 0.75 render scale. Only the per-frame FIELD
    // layer pays the lite cut; the SDF rest is a single static draw and stays
    // glass on both. The watchdog below downshifts at runtime — never freezes.
    let liveTier: "full" | "lite" = tier;
    let stopped = false; // "none" downshift: melts stop; the crisp rest remains

    // static uniforms
    field.gl.useProgram(field.prog);
    field.gl.uniform1f(field.U("iFrame"), FIELD_FRAME);
    field.gl.uniform1f(field.U("iIso"), FIELD_ISO);
    const applyShading = () =>
      field.gl.uniform1f(field.U("iGlass"), liveTier === "full" ? 1 : 0);
    applyShading();
    field.gl.uniform1i(field.U("iCount"), N);
    sdf.gl.useProgram(sdf.prog);
    const sdfFloatLinear = !!sdf.gl.getExtension("OES_texture_float_linear");
    sdf.gl.uniform1i(sdf.U("iSDF"), 0);
    sdf.gl.uniform1f(sdf.U("iThick"), SDF_THICK);
    sdf.gl.uniform2f(sdf.U("iTexel"), 1 / SDF_RES, 1 / SDF_RES);

    // ── SDF textures (one per form, uploaded from the persistent data cache) ──
    const textures: (WebGLTexture | null)[] = new Array(STATE_COUNT).fill(null);
    const uploadSdf = (i: number, data: Float32Array) => {
      const gl = sdf.gl;
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      const f = sdfFloatLinear ? gl.LINEAR : gl.NEAREST;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, SDF_RES, SDF_RES, 0, gl.RED, gl.FLOAT, data);
      textures[i] = t;
    };

    // ── draws ────────────────────────────────────────────────────────────────
    const sdfDpr = Math.min(window.devicePixelRatio || 1, 2);
    const fieldScale = () => (liveTier === "full" ? sdfDpr : 0.75); // px per css px
    const drawSdf = (state: number) => {
      const gl = sdf.gl;
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(sdf.U("iRes"), gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const t = textures[state];
      if (t) {
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    };
    const ballBuf = new Float32Array(N * 3);
    const drawField = () => {
      const gl = field.gl;
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(field.U("iRes"), gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform3fv(field.U("iBalls"), ballBuf);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    // ── the machine ──────────────────────────────────────────────────────────
    // current = the state whose cloud the field currently holds / is leaving;
    // during a morph, `from` is a snapshot (supports mid-morph retargeting).
    let state = 0; // resting state
    // (cast launders the literal so flow analysis keeps the union inside closures)
    let phase = "rest" as "rest" | "morph";
    let from: Ball[] = CLOUDS[0].map((b) => [...b] as unknown as Ball);
    let target = 0;
    let perm: number[] = [];
    let stagKey: number[] = [];
    let morphT = 0; // elapsed ms within the melt
    let lastTick = 0;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pendingSharpen = -1; // arrived, waiting for the target's SDF texture
    let hovering = false;
    let announcedReady = false;
    let wdWarm = 0; // watchdog: frames seen this melt (skip the warm-up)
    let wdSlow = 0; // watchdog: slow frames this melt

    // FPS watchdog (§7) — downshift instead of freezing. full → lite swaps the
    // melt to the flat-cyan branch at a smaller buffer mid-flight; lite → "none"
    // lets the current melt finish, then stops the autocycle for the session
    // (the crisp SDF rest remains — the hero never goes blank, never janks).
    const downshift = () => {
      wdSlow = 0;
      wdWarm = 0;
      if (liveTier === "full") {
        liveTier = "lite";
        applyShading();
        resize();
        cb.current.onTierChange("lite");
      } else if (!stopped) {
        stopped = true;
        cb.current.onTierChange("none");
      }
    };

    const setCloud = (p: number) => {
      // §3.3 — per-droplet stagger (left-to-right) + arrive ease + radius-leads
      const B = CLOUDS[target];
      for (let i = 0; i < N; i++) {
        const lt = clamp01(p * (1 + STAGGER) - STAGGER * stagKey[i]);
        const tp = arrive(lt);
        const tr = arrive(clamp01(lt * RADIUS_LEAD));
        const b = B[perm[i]];
        ballBuf[i * 3] = from[i][0] + (b[0] - from[i][0]) * tp;
        ballBuf[i * 3 + 1] = from[i][1] + (b[1] - from[i][1]) * tp;
        ballBuf[i * 3 + 2] = from[i][2] + (b[2] - from[i][2]) * tr;
      }
    };

    const scheduleNext = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (stopped || !playRef.current || hovering || manualRef.current != null)
        return;
      timer = setTimeout(() => morphTo((state + 1) % STATE_COUNT), dwell);
    };

    const sharpen = () => {
      // arrival: the SDF of the target fades in on top, the field fades out
      state = target;
      phase = "rest";
      drawSdf(state);
      sdf.canvas.style.opacity = "1";
      field.canvas.style.opacity = "0";
      scheduleNext();
    };

    const tick = (now: number) => {
      raf = 0;
      if (disposed || phase !== "morph") return;
      if (!playRef.current) return; // paused mid-morph; resumed by setPlay
      const dt = now - lastTick;
      morphT += dt;
      lastTick = now;
      // watchdog sampling: only mid-melt, after a short warm-up
      if (++wdWarm > 5 && dt > 25 && ++wdSlow >= 12) downshift();
      const p = clamp01(morphT / TRANS);
      setCloud(p);
      drawField();
      if (p >= 1) {
        if (textures[target]) sharpen();
        else pendingSharpen = target; // SDF still building → hold the melt at B
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const morphTo = (s: number) => {
      if (disposed || s === target || s < 0 || s >= STATE_COUNT) return;
      if (timer) clearTimeout(timer);
      timer = null;
      pendingSharpen = -1;
      if (phase === "morph") {
        // retarget mid-melt: continue from the droplets' CURRENT positions
        from = [];
        for (let i = 0; i < N; i++)
          from.push([ballBuf[i * 3], ballBuf[i * 3 + 1], ballBuf[i * 3 + 2]] as unknown as Ball);
      } else {
        from = CLOUDS[state].map((b) => [...b] as unknown as Ball);
      }
      // rest→target correspondences are stable → cache them (§3.2); a mid-melt
      // retarget starts from live positions, so it's matched fresh every time.
      const fromRest = phase === "rest";
      const cacheKey = `${state}->${s}`;
      let p = fromRest ? permCache.current.get(cacheKey) : undefined;
      if (!p) {
        p = matchClouds(from, CLOUDS[s]);
        if (fromRest) permCache.current.set(cacheKey, p);
      }
      target = s;
      perm = p;
      stagKey = from.map((b) => clamp01(b[0] + 0.5));
      morphT = 0;
      wdWarm = 0;
      wdSlow = 0;
      phase = "morph";
      cb.current.onActiveChange(s - 1);
      // melt out: field appears already moving; the crisp SDF dissolves
      setCloud(0);
      drawField();
      field.canvas.style.opacity = "1";
      sdf.canvas.style.opacity = "0";
      lastTick = performance.now();
      raf = requestAnimationFrame(tick);
    };

    api.current = {
      morphTo,
      setPlay: (p: boolean) => {
        if (p) {
          if (phase === "morph" && !raf) {
            lastTick = performance.now();
            raf = requestAnimationFrame(tick);
          } else if (phase === "rest") scheduleNext();
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
    const sizeCanvas = (l: Layer, scale: number) => {
      const w = Math.max(1, Math.round((container.clientWidth || 1) * scale));
      const h = Math.max(1, Math.round((container.clientHeight || 1) * scale));
      if (l.canvas.width !== w || l.canvas.height !== h) {
        l.canvas.width = w;
        l.canvas.height = h;
      }
    };
    const resize = () => {
      sizeCanvas(sdf, sdfDpr);
      sizeCanvas(field, fieldScale());
      if (textures[state]) drawSdf(state);
      if (phase === "morph") drawField();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // ── prefetch all 8 SDFs (worker-built; mark first → first paint) ─────────
    (async () => {
      for (let i = 0; i < STATE_COUNT; i++) {
        if (disposed) return;
        let data = sdfDataCache.current[i];
        if (!data) {
          try {
            const img = new Image();
            img.decoding = "async";
            img.src = SVG_URLS[i];
            await img.decode();
            data = await buildSdfAsync(img, SDF_RES, SDF_DRAW, SDF_BLUR);
            sdfDataCache.current[i] = data;
          } catch {
            continue; // missing form: melts still run; sharpen waits are skipped
          }
        }
        if (disposed) return;
        uploadSdf(i, data);
        if (i === state && phase === "rest") {
          drawSdf(state);
          sdf.canvas.style.opacity = "1";
          if (!announcedReady) {
            announcedReady = true;
            cb.current.onReady();
            scheduleNext();
          }
        }
        if (pendingSharpen === i && phase === "morph") {
          pendingSharpen = -1;
          sharpen();
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
      for (const l of [field, sdf]) {
        l.canvas.removeEventListener("webglcontextlost", onLost);
        l.canvas.removeEventListener("webglcontextrestored", onRestored);
        l.gl.getExtension("WEBGL_lose_context")?.loseContext();
        l.canvas.remove();
      }
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

  // ── deterministic frozen mid-morph frame (?fpair=a-b-m) ────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !frozenPair) return;
    const [a, b, m] = frozenPair;
    const field = makeLayer(container, FIELD_VERT, FIELD_FRAG);
    if (!field) return;
    const gl = field.gl;
    gl.uniform1f(field.U("iFrame"), FIELD_FRAME);
    gl.uniform1f(field.U("iIso"), FIELD_ISO);
    gl.uniform1f(field.U("iGlass"), 1);
    gl.uniform1i(field.U("iCount"), N);
    field.canvas.style.transition = "none";
    field.canvas.style.opacity = "1";

    const A = CLOUDS[a], B = CLOUDS[b];
    const perm = matchClouds(A, B);
    const buf = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const w = clamp01(A[i][0] + 0.5);
      const lt = clamp01(m * (1 + STAGGER) - STAGGER * w);
      const tp = arrive(lt);
      const tr = arrive(clamp01(lt * RADIUS_LEAD));
      const t = B[perm[i]];
      buf[i * 3] = A[i][0] + (t[0] - A[i][0]) * tp;
      buf[i * 3 + 1] = A[i][1] + (t[1] - A[i][1]) * tp;
      buf[i * 3 + 2] = A[i][2] + (t[2] - A[i][2]) * tr;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const draw = () => {
      const w = Math.max(1, Math.round((container.clientWidth || 1) * dpr));
      const h = Math.max(1, Math.round((container.clientHeight || 1) * dpr));
      field.canvas.width = w;
      field.canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(field.U("iRes"), w, h);
      gl.uniform3fv(field.U("iBalls"), buf);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      cb.current.onReady();
    };
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    draw();
    return () => {
      ro.disconnect();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      field.canvas.remove();
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
