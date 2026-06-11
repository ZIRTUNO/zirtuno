"use client";

/**
 * FieldMorphHero — the living metaball hero (morph-spec v1.5 direction). ONE
 * always-visible field layer (the LOCKED 48-ball inverse-square glass shader):
 *
 *   - REST: the field holds the current form's ball-cloud, alive — per-droplet
 *     low-frequency micro-jitter (§4, ≤0.006), the CSS breath (±2 %), and the
 *     pointer lean (≤4 %). It never freezes into a vector — the owner's form
 *     SVGs are the FIDELITY REFERENCE the clouds are generated from
 *     (scripts/generate-morph-endpoints.mjs), not a rest renderer.
 *   - MORPH: the same droplets lerp to the next form (min-travel matching,
 *     left-to-right stagger, radius-leads-position, arrive ease) — and because
 *     melts start from the droplets' LIVE positions, rest → melt → rest is one
 *     continuous liquid with no crossfade and no snap.
 *
 * State machine (§4): rest (dwell DURATIONS.autocycle) → morph → rest…; pauses
 * off-screen (`play`) and while hovered; `manualState` (keyboard) retargets even
 * mid-melt. FPS watchdog: full → lite (flat-cyan, smaller buffer) → stop — it
 * degrades, it never freezes. `frozenPair` renders one deterministic frame
 * (QA: ?fpair=a-b-m; ?fstate=N maps to [N,N,1] in the shell).
 */

import { useEffect, useReducer, useRef } from "react";
import {
  FIELD_VERT,
  FIELD_FRAG,
  FIELD_N,
  FIELD_ISO,
  FIELD_FRAME,
} from "@/lib/webgl/field-shader.mjs";
import { ALL_RAW } from "@/lib/webgl/symbols.data.mjs";
import { STATE_COUNT } from "@/lib/webgl/states";
import { DURATIONS } from "@/lib/animation/durations";
import { EASINGS, EASE_POINTS } from "@/lib/animation/easings";

const N = FIELD_N;
const HOLD = DURATIONS.autocycle; // rest dwell (ms)
const TRANS = DURATIONS.morph; // melt duration (ms)
const STAGGER = 0.25; // fraction of the timeline spent sweeping the stagger
const RADIUS_LEAD = 1.18; // radius finishes ~18% ahead of position (§3.3)
const LEAN = 0.04; // pointer lean, fraction of the stage (§4)
const JITTER = 0.005; // idle per-droplet micro-jitter amplitude (§4, ≤0.006)
const JITTER_RAMP = 1500; // ms to fade the jitter in after arriving at rest

type Ball = readonly [number, number, number];
type Cloud = readonly Ball[];

const CLOUDS: Cloud[] = ALL_RAW.map(
  (s: { balls: number[][] }) => s.balls as unknown as Cloud,
);

// deterministic per-droplet jitter parameters (slow, organic, no allocation/frame)
const JIT = Array.from({ length: N }, (_, i) => {
  const h = (n: number) => {
    const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    fx: 0.4 + 0.5 * h(1), // rad/s
    fy: 0.4 + 0.5 * h(2),
    px: h(3) * Math.PI * 2,
    py: h(4) * Math.PI * 2,
  };
});

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
function matchClouds(A: ArrayLike<number>[] | Cloud, B: Cloud): number[] {
  const pairs: [number, number, number][] = [];
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const dx = (A[i] as ArrayLike<number>)[0] - B[j][0];
      const dy = (A[i] as ArrayLike<number>)[1] - B[j][1];
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

// ── minimal GL plumbing (one fullscreen triangle) ──────────────────────────────
type Layer = {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  U: (n: string) => WebGLUniformLocation | null;
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

  // stable rest→target droplet correspondences (jitter is ≪ ball spacing)
  const permCache = useRef(new Map<string, number[]>());

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
    const field = makeLayer(container, FIELD_VERT, FIELD_FRAG);
    if (!field) return; // no WebGL2 → shell's SVG fallback stays

    const onLost = (e: Event) => {
      e.preventDefault(); // allow the context to be restored
      cb.current.onContextLost();
    };
    const onRestored = () => rebuild(); // fresh context; machine restarts at rest
    field.canvas.addEventListener("webglcontextlost", onLost);
    field.canvas.addEventListener("webglcontextrestored", onRestored);

    // ── tier (§7): "full" = glass at dpr ≤2 · "lite" = the locked shader's
    // flat-cyan branch at dpr 1 × 0.75 render scale. The watchdog downshifts at
    // runtime — never freezes.
    let liveTier: "full" | "lite" = tier;
    let stopped = false; // "none" downshift: the liquid holds its last frame

    field.gl.uniform1f(field.U("iFrame"), FIELD_FRAME);
    field.gl.uniform1f(field.U("iIso"), FIELD_ISO);
    const applyShading = () =>
      field.gl.uniform1f(field.U("iGlass"), liveTier === "full" ? 1 : 0);
    applyShading();
    field.gl.uniform1i(field.U("iCount"), N);

    // ── draw ─────────────────────────────────────────────────────────────────
    const maxDpr = Math.min(window.devicePixelRatio || 1, 2);
    const fieldScale = () => (liveTier === "full" ? maxDpr : 0.75); // px per css px
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
    let state = 0; // resting state
    // (cast launders the literal so flow analysis keeps the union inside closures)
    let phase = "rest" as "rest" | "morph";
    let from: number[][] = CLOUDS[0].map((b) => [...b]);
    let target = 0;
    let perm: number[] = [];
    let stagKey: number[] = [];
    let morphT = 0; // elapsed ms within the melt
    let restT = 0; // elapsed ms at rest (ramps the jitter in)
    let lastTick = 0;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let hovering = false;
    let announcedReady = false;
    let wdWarm = 0; // watchdog: frames seen (skip the warm-up)
    let wdSlow = 0; // watchdog: slow frames

    // FPS watchdog (§7) — downshift instead of freezing. full → lite swaps the
    // liquid to the flat-cyan branch at a smaller buffer mid-flight; lite → the
    // loop stops on the current frame (a still liquid, never a blank or a jank).
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
        if (timer) clearTimeout(timer);
        timer = null;
        cb.current.onTierChange("none");
      }
    };

    // rest cloud = the form + slow per-droplet drift (ramped in after arrival)
    const setRestCloud = (nowMs: number) => {
      const C = CLOUDS[state];
      const ramp = clamp01(restT / JITTER_RAMP);
      const amp = JITTER * ramp;
      const t = nowMs / 1000;
      for (let i = 0; i < N; i++) {
        const j = JIT[i];
        ballBuf[i * 3] = C[i][0] + amp * Math.sin(t * j.fx + j.px);
        ballBuf[i * 3 + 1] = C[i][1] + amp * Math.sin(t * j.fy + j.py);
        ballBuf[i * 3 + 2] = C[i][2];
      }
    };

    const setMorphCloud = (p: number) => {
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
        setMorphCloud(p);
        drawField();
        if (p >= 1) {
          // arrival IS the rest — same droplets, same field, no handoff
          state = target;
          phase = "rest";
          restT = 0;
          cb.current.onActiveChange(state - 1);
          scheduleNext();
        }
      } else {
        restT += dt;
        setRestCloud(now);
        drawField();
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
      if (phase === "morph" && s === target) return;
      if (timer) clearTimeout(timer);
      timer = null;
      // melts always start from the droplets' LIVE positions (jittered rest or
      // mid-melt) → one continuous liquid, no snap.
      from = [];
      for (let i = 0; i < N; i++)
        from.push([ballBuf[i * 3], ballBuf[i * 3 + 1], ballBuf[i * 3 + 2]]);
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
      const scale = fieldScale();
      const w = Math.max(1, Math.round((container.clientWidth || 1) * scale));
      const h = Math.max(1, Math.round((container.clientHeight || 1) * scale));
      if (field.canvas.width !== w || field.canvas.height !== h) {
        field.canvas.width = w;
        field.canvas.height = h;
      }
      // repaint immediately so resizes never flash an empty canvas
      if (phase === "morph") setMorphCloud(clamp01(morphT / TRANS));
      else setRestCloud(performance.now());
      drawField();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();
    startLoop();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      container.removeEventListener("pointerenter", onEnter);
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerleave", onLeave);
      field.canvas.removeEventListener("webglcontextlost", onLost);
      field.canvas.removeEventListener("webglcontextrestored", onRestored);
      field.gl.getExtension("WEBGL_lose_context")?.loseContext();
      field.canvas.remove();
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
    const field = makeLayer(container, FIELD_VERT, FIELD_FRAG);
    if (!field) return;
    const gl = field.gl;
    gl.uniform1f(field.U("iFrame"), FIELD_FRAME);
    gl.uniform1f(field.U("iIso"), FIELD_ISO);
    gl.uniform1f(field.U("iGlass"), 1);
    gl.uniform1i(field.U("iCount"), N);

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
