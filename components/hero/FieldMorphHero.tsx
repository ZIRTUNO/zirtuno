"use client";

/**
 * FieldMorphHero — the living EXACT-form hero (morph-spec v1.7). One canvas, one
 * unified liquid field (sdf-glass-shader): the owner's vector forms as glass,
 * with metaball droplets that physically merge with them.
 *
 *   - REST: the exact form, alive — slow domain warp (~3 px wobble), the CSS
 *     breath, and the GOOEY CURSOR (owner amendment): a spring-lagged droplet
 *     chain follows the pointer, necks into and pulls on the form's edge, and
 *     detaches cleanly on leave (radius eases out ≤300 ms — never pops). The
 *     cursor's influence is bounded; the silhouette always recovers. Off on
 *     touch devices. There is NO canvas lean — the cursor IS the hover.
 *   - MELT (v1.2/§3.3 restored): form A's field weight drains while the 48
 *     bridge droplets condense on its footprint, travel with min-travel
 *     matching + left-to-right stagger + radius-leads-position, and fuse into
 *     form B as its weight rises. ONE iso-surface the whole time — droplets
 *     visibly neck off A and reform as B; a crossfade double-exposure cannot
 *     exist. Endpoints are the exact vectors.
 *
 * The §3.3 bridge math + GL plumbing live in lib/webgl/field-drivers and
 * lib/webgl/sdf-gl (R1) — shared with the chapter FieldStage drivers, so the
 * site has exactly ONE melt implementation.
 *
 * State machine (§4): rest (dwell DURATIONS.autocycle) → melt → rest…; pauses
 * off-screen (`play`) and while hovered; `manualState` (keyboard) queues a
 * retarget (applied on arrival — no snaps). FPS watchdog: full → lite (dpr 1)
 * → a zero-warp exact still — it degrades, it never freezes. `frozenPair`
 * renders one deterministic frame (?fpair=a-b-m; ?fstate=N → [N,N,1]), and
 * `frozenCursor` adds a deterministic merged cursor droplet (?fcursor=x,y).
 */

import { useEffect, useReducer, useRef } from "react";
import {
  SDF_GLASS_VERT,
  SDF_GLASS_FRAG,
  SDF_BALL_MAX,
  SDF_THICK,
  SDF_RES,
  SDF_WARP_REST,
  SDF_WARP_MORPH,
  CURSOR_R,
  CURSOR_TRAIL_N,
  CURSOR_SMOOTH,
  CURSOR_INFLUENCE_MARK,
} from "@/lib/webgl/sdf-glass-shader.mjs";
import { makeLayer, makeSdfTexture, loadSdf } from "@/lib/webgl/sdf-gl";
import {
  CLOUDS,
  STAG,
  clamp01,
  packBridge,
  formWeights,
  permFor,
} from "@/lib/webgl/field-drivers";
import { SVG_URLS, STATE_COUNT } from "@/lib/webgl/symbols";
import { DURATIONS } from "@/lib/animation/durations";

const HOLD = DURATIONS.autocycle; // rest dwell (ms)
const TRANS = DURATIONS.morph; // melt duration (ms)

type HeroProps = {
  play?: boolean;
  manualState?: number | null;
  frozenPair?: [number, number, number] | null; // [a, b, m] — one deterministic frame
  /** Deterministic merged cursor droplet for the frozen frame (?fcursor=x,y;
   *  page-style coords: x right, y DOWN, both 0..1). */
  frozenCursor?: [number, number] | null;
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
  frozenCursor = null,
  dwellMs,
  tier = "full",
  onTierChange = () => {},
  onReady = () => {},
  onActiveChange = () => {},
  onContextLost = () => {},
}: HeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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

    // ── tier (§7): lite only lowers resolution (dpr 1) — the hero keeps glass.
    // The watchdog downshifts — it never freezes; the final stop holds a
    // zero-warp exact still.
    let liveTier: "full" | "lite" = tier;
    let stopped = false;

    gl.uniform1f(layer.U("iThick"), SDF_THICK);
    gl.uniform2f(layer.U("iTexel"), 1 / SDF_RES, 1 / SDF_RES);
    gl.uniform1i(layer.U("iSDF"), 0);
    gl.uniform1i(layer.U("iSDF2"), 1);
    gl.uniform1f(layer.U("iGlass"), 1);

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
    const ballBuf = new Float32Array(SDF_BALL_MAX * 3);
    let sdfReady = false; // never draw before form 0's texture exists
    const draw = (
      timeSec: number,
      formA: number,
      formB: number,
      warp: number,
      ballCount: number,
    ) => {
      if (!sdfReady) return;
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(layer.U("iRes"), gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform1f(layer.U("iTime"), timeSec);
      gl.uniform1f(layer.U("iFormA"), formA);
      gl.uniform1f(layer.U("iFormB"), formB);
      gl.uniform1f(layer.U("iWarp"), warp);
      gl.uniform3fv(layer.U("iBalls"), ballBuf);
      gl.uniform1i(layer.U("iBallCount"), ballCount);
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
    let perm: number[] = [];
    let stag: number[] = [];
    let morphT = 0;
    let lastTick = 0;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let hovering = false;
    let announcedReady = false;
    let wdWarm = 0; // watchdog: frames seen (skip the warm-up)
    let wdSlow = 0; // watchdog: slow frames

    // ── the gooey cursor (owner amendment — react-bits hover) ────────────────
    // A spring-lagged droplet chain in the SAME field as the form: it necks into
    // the edge, pulls liquid toward the pointer, and merges. Radius eases in/out
    // (never pops); influence is shader-bounded; off on touch devices.
    const canHover =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const DROPS = 1 + CURSOR_TRAIL_N;
    const drops = Array.from({ length: DROPS }, () => ({ x: 0.5, y: 0.5 }));
    let tx = 0.5, ty = 0.5; // pointer target (uv, +y up)
    let cursorGoal = 0; // 1 while the pointer is over the stage
    let cursorOn = 0; // eased presence → radius envelope
    let markMul = 1; // eased: the logo deforms least (CURSOR_INFLUENCE_MARK)

    const updateCursor = (dt: number) => {
      if (!canHover || (cursorOn === 0 && cursorGoal === 0)) return;
      const goalMul = phase === "rest" && state === 0 ? CURSOR_INFLUENCE_MARK : 1;
      markMul += (goalMul - markMul) * (1 - Math.exp(-dt / 160));
      // presence: bloom in gently, drain out fast (silhouette recovers ≤300 ms)
      cursorOn += (cursorGoal - cursorOn) * (1 - Math.exp(-dt / (cursorGoal ? 110 : 60)));
      if (cursorOn < 0.003 && !cursorGoal) {
        cursorOn = 0;
        return;
      }
      // frame-rate-independent spring chain (react-bits hoverSmoothness)
      const k = 1 - Math.pow(1 - CURSOR_SMOOTH, dt / 16.7);
      const kt = 1 - Math.pow(1 - CURSOR_SMOOTH * 0.7, dt / 16.7);
      drops[0].x += (tx - drops[0].x) * k;
      drops[0].y += (ty - drops[0].y) * k;
      for (let i = 1; i < DROPS; i++) {
        drops[i].x += (drops[i - 1].x - drops[i].x) * kt;
        drops[i].y += (drops[i - 1].y - drops[i].y) * kt;
      }
    };

    const packCursor = (): number => {
      if (cursorOn <= 0) return 0;
      let count = 0;
      for (let i = 0; i < DROPS; i++) {
        const r = CURSOR_R * Math.pow(0.58, i) * cursorOn * markMul;
        if (r < 0.002) continue;
        ballBuf[count * 3] = drops[i].x;
        ballBuf[count * 3 + 1] = drops[i].y;
        ballBuf[count * 3 + 2] = r;
        count++;
      }
      return count;
    };

    // ── render one frame from the machine state ──────────────────────────────
    const render = (now: number) => {
      const t = now / 1000;
      let count = packCursor();
      if (phase === "morph") {
        const p = clamp01(morphT / TRANS);
        const env = Math.sin(Math.PI * p); // 0 at the ends → seamless handoff
        count = packBridge(ballBuf, count, CLOUDS[state], CLOUDS[target], perm, stag, p);
        const [fa, fb] = formWeights(p);
        draw(t, fa, fb, SDF_WARP_REST + (SDF_WARP_MORPH - SDF_WARP_REST) * env, count);
      } else {
        draw(t, 1, 0, SDF_WARP_REST, count);
      }
    };

    // FPS watchdog (§7) — downshift instead of freezing. full → lite lowers the
    // buffer; lite → the loop stops on a zero-warp EXACT still (no cursor, no
    // wobble — a crisp form, never a blank or a jank).
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
        if (phase === "morph") {
          // land the in-flight melt on its target, then hold
          state = target;
          phase = "rest";
        }
        bindForms(state, state);
        draw(0, 1, 0, 0, 0);
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
      // watchdog sampling (continuous — rest and melt draw every frame)
      if (++wdWarm > 5 && dt > 25 && ++wdSlow >= 12) downshift();
      if (stopped) return; // downshifted to a still just now
      updateCursor(dt);
      if (phase === "morph") {
        morphT += dt;
        const p = clamp01(morphT / TRANS);
        render(now);
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
        render(now);
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
      // §3.3 driver inputs: melt from the resting cloud of `state` toward `s`
      perm = permFor(state, s);
      stag = STAG[state];
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

    // ── hover: pause the autocycle; the cursor droplets do the rest (§4 v1.7) ─
    const onEnter = () => {
      hovering = true;
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const onMove = (e: PointerEvent) => {
      if (!canHover) return;
      const r = container.getBoundingClientRect();
      const nx = clamp01((e.clientX - r.left) / r.width);
      const ny = 1 - clamp01((e.clientY - r.top) / r.height); // uv +y up
      if (cursorOn < 0.01 && cursorGoal === 0)
        for (const d of drops) {
          d.x = nx;
          d.y = ny;
        } // materialise AT the pointer (no fly-in)
      tx = nx;
      ty = ny;
      cursorGoal = 1;
    };
    const onLeave = () => {
      hovering = false;
      cursorGoal = 0; // radius eases to 0 — detaches cleanly, never pops
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
      render(performance.now());
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

  // ── deterministic frozen frame ─────────────────────────────────────────────
  // ?fpair=a-b-m (bridge mid-frame) · ?fstate=N → [N,N,1] (zero-warp exact rest)
  // · ?fcursor=x,y adds one merged cursor droplet at full radius.
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
    gl.uniform1f(layer.U("iGlass"), 1);

    let disposed = false;
    let texA: WebGLTexture | null = null;
    let texB: WebGLTexture | null = null;
    const melt = a !== b;
    const env = Math.sin(Math.PI * m);
    // a rest still (a === b) renders with ZERO warp → the pixel-exact form
    const warp = melt ? SDF_WARP_REST + (SDF_WARP_MORPH - SDF_WARP_REST) * env : 0;
    const [fa, fb] = melt ? formWeights(m) : [1, 0];
    const buf = new Float32Array(SDF_BALL_MAX * 3);
    let count = 0;
    if (frozenCursor) {
      buf[0] = clamp01(frozenCursor[0]);
      buf[1] = 1 - clamp01(frozenCursor[1]); // page y-down → uv y-up
      buf[2] = CURSOR_R * (!melt && a === 0 ? CURSOR_INFLUENCE_MARK : 1);
      count = 1;
    }
    if (melt)
      count = packBridge(buf, count, CLOUDS[a], CLOUDS[b], permFor(a, b), STAG[a], m);
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
      gl.uniform1f(layer.U("iFormA"), fa);
      gl.uniform1f(layer.U("iFormB"), fb);
      gl.uniform1f(layer.U("iWarp"), warp);
      gl.uniform3fv(layer.U("iBalls"), buf);
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
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      layer.canvas.remove();
    };
  }, [frozenPair, frozenCursor]);

  return (
    <div
      ref={containerRef}
      className={frozenPair ? undefined : "sdf-glass-breath"}
      style={{ position: "relative", width: "100%", height: "100%" }}
    />
  );
}
