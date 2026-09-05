"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import {
  AIM_KEYS,
  buildDotSphere,
  HAND_SPIN,
  HAND_TILT,
  SPHERE_FRAG,
  SPHERE_REST,
  SPHERE_STILL,
  SPHERE_TAU,
  SPHERE_VERT,
  type SphereState,
  type SphereTargets,
} from "@/lib/lab/sphere-shader";
import { useReducedMotion } from "@/lib/animation/reduced-motion";

/**
 * THE HERO SPHERE — the renderer, the loop and the handle.
 *
 * The geometry, the material and the driver vocabulary are in
 * lib/lab/sphere-shader.ts. What lives here is everything that touches the
 * browser: the context, the one static upload, the damping, and the surface a
 * future timeline drives the sphere through.
 *
 * ── where it lives, and why it is here ──────────────────────────────────────
 *
 * PARKED, NOT RETIRED. It was built for the Hero and stood there for a day;
 * the Hero is text again, so the object moved to the lab rather than being
 * deleted or left commented out in a production component. `/lab/sphere` is
 * the surface it is worked on — a real route, so Playwright drives the same
 * WebGL stack production would, exactly as `/lab/forms` does for the liquid.
 *
 * Nothing about the component assumes the lab. The export is still
 * `HeroSphere` and the class is still `.lab-sphere`, so re-adopting it into
 * components/hero is an import line and a JSX tag — see LabSphereStage for
 * the entry the Hero used to run.
 *
 * ── it is not the liquid ────────────────────────────────────────────────────
 *
 * AGENTS.md §4.1 says one liquid means one persistent homepage canvas, and
 * this does not touch it: the sphere claims no form slot, holds no conductor
 * state and shares no droplet with the field. It is an additive decorative
 * layer with the same standing the Hero's `HeroRibbon` has. If it ever goes
 * back on the homepage it must sit INSIDE `.journey-content` (z-10), above
 * the field canvas, because that canvas writes alpha 1 and nothing put behind
 * it would ever be seen.
 *
 * ── how you animate it ──────────────────────────────────────────────────────
 *
 * Three ways in, in increasing order of how much you are taking over:
 *
 *   handle.set({ ... })   aim a driver. The loop damps toward it with that
 *                         driver's own tau. This is the normal way: a
 *                         ScrollTrigger onEnter, a hover, a chapter change.
 *
 *   handle.snap({ ... })  put a driver THERE, target and current together.
 *                         For staging a state before it is seen — the entry
 *                         does `snap({ gather: 0 })` then `set({ gather: 1 })`
 *                         so the assembly is a real departure from rest.
 *
 *   handle.drive(fn)      own the frame. `fn(state, dtSeconds, tSeconds)` runs
 *                         AFTER damping and integration and BEFORE upload, so
 *                         it can write any field of `state` absolutely. This
 *                         is the hook for a scrubbed timeline: zero `spinRate`
 *                         and write `spin` from the scrub, and the sphere runs
 *                         backwards with the scroll instead of easing forward
 *                         toward it. Pass null to hand the frame back.
 *
 * The handle is live from the first render and survives a context loss, so
 * calling code never has to ask whether the renderer came up.
 */

/** The default cloud. Small enough to be free, dense enough to read as a body. */
const DOTS = 7800;
/** Phones get a thinner cloud — the sphere is also physically smaller there. */
const DOTS_NARROW = 3600;

/** Dots need resolution in a way the ribbon does not, so this caps at 2. */
const MAX_DPR = 2;

/** Base point size in CSS px, before the per-dot and perspective variation. */
const DOT_PX = 2.3;

/** dt is clamped so a backgrounded tab cannot land one enormous step. */
const MAX_DT = 1 / 20;

export type SphereFrameHook = (
  state: SphereState,
  dt: number,
  t: number,
) => void;

export interface HeroSphereHandle {
  /** Aim one or more drivers. The loop damps toward them. */
  set(next: Partial<SphereTargets>): void;
  /** Put drivers (or a clock) exactly there — target and current together. */
  snap(next: Partial<SphereState>): void;
  /** The live state. Mutable on purpose; the loop reads this object. */
  read(): SphereState;
  /** Own the frame, or pass null to give it back. */
  drive(hook: SphereFrameHook | null): void;
  /** Whether WebGL2 came up. False means the CSS fallback is on screen. */
  live(): boolean;
}

export interface HeroSphereProps {
  className?: string;
  /** Override the cloud size. Omit to let the stage width decide. */
  dots?: number;
  /**
   * Whether the sphere leans to the pointer. The lean is additive on top of
   * whatever the drivers say, so this only decides if the listener exists.
   */
  pointer?: boolean;
}

/** frame-rate independent exponential approach */
const approach = (cur: number, target: number, tau: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-dt / tau));

/** the aimable half of a state, with the clocks left behind */
function pickAimable(from: SphereState): SphereTargets {
  const out = {} as SphereTargets;
  for (const key of AIM_KEYS) out[key] = from[key];
  return out;
}

export const HeroSphere = forwardRef<HeroSphereHandle, HeroSphereProps>(
  function HeroSphere({ className, dots, pointer = true }, ref) {
    const hostRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const reduced = useReducedMotion();

    // ── the state the whole component shares ────────────────────────────────
    // One object, created once and mutated in place. The loop reads it, the
    // handle writes it, and React never re-renders for any of it.
    const stateRef = useRef<SphereState>({ ...SPHERE_REST });
    // The target carries ONLY the aimable half. A clock on it would be walked
    // by the damping loop, which has no tau for one — see AIM_KEYS.
    const targetRef = useRef<SphereTargets>(pickAimable(SPHERE_REST));
    const hookRef = useRef<SphereFrameHook | null>(null);
    const liveRef = useRef(false);
    // the pointer's own damped pair — never written into the state, only added
    // to spin and tilt on the way to the uniforms
    const handRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

    useImperativeHandle(
      ref,
      (): HeroSphereHandle => ({
        set(next) {
          Object.assign(targetRef.current, next);
        },
        snap(next) {
          Object.assign(stateRef.current, next);
          // The target is mirrored so a snap does not immediately get damped
          // back out — but only its aimable half: a clock has no target, and
          // putting one on the target is what NaN'd the whole cloud once.
          for (const key of AIM_KEYS) {
            const v = next[key];
            if (v !== undefined) targetRef.current[key] = v;
          }
        },
        read: () => stateRef.current,
        drive(hook) {
          hookRef.current = hook;
        },
        live: () => liveRef.current,
      }),
      [],
    );

    // The cloud is geometry, not a render input: build it once and never
    // again. useMemo rather than useEffect so the buffers exist before the GL
    // effect runs and the first paint is the real cloud.
    //
    // The breakpoint is read ONCE and deliberately not re-read on resize. A
    // rotation across it would otherwise rebuild and re-upload the cloud
    // mid-animation to change a number nobody can count — a phone turned
    // landscape keeps its thinner cloud, and a desktop window dragged narrow
    // keeps its full one. Both are correct pictures; only the cost differs.
    const cloud = useMemo(() => {
      const n =
        dots ??
        (typeof window !== "undefined" &&
        window.matchMedia("(max-width: 767px)").matches
          ? DOTS_NARROW
          : DOTS);
      return buildDotSphere(n);
    }, [dots]);

    useEffect(() => {
      const host = hostRef.current;
      const canvas = canvasRef.current;
      if (!host || !canvas) return;

      const gl = canvas.getContext("webgl2", {
        // The cloud composites OVER the hero, so it needs its own alpha —
        // unlike the ribbon, which is a full-bleed opaque sheet.
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        // additive blending is order independent: there is nothing to sort,
        // so there is no reason to pay for a depth buffer
        depth: false,
        stencil: false,
        powerPreference: "high-performance",
      });
      if (!gl) {
        host.dataset.sphere = "fallback";
        return;
      }

      const compile = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
          throw new Error(gl.getShaderInfoLog(s) ?? "shader compile failed");
        return s;
      };

      let program: WebGLProgram;
      try {
        program = gl.createProgram()!;
        gl.attachShader(program, compile(gl.VERTEX_SHADER, SPHERE_VERT));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, SPHERE_FRAG));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
          throw new Error(gl.getProgramInfoLog(program) ?? "link failed");
      } catch {
        host.dataset.sphere = "fallback";
        return;
      }
      gl.useProgram(program);
      host.dataset.sphere = "live";
      liveRef.current = true;

      // ── the one upload ────────────────────────────────────────────────────
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);

      const posBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, cloud.pos, gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(program, "aPos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

      const seedBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
      gl.bufferData(gl.ARRAY_BUFFER, cloud.seed, gl.STATIC_DRAW);
      const aSeed = gl.getAttribLocation(program, "aSeed");
      gl.enableVertexAttribArray(aSeed);
      gl.vertexAttribPointer(aSeed, 4, gl.FLOAT, false, 0, 0);

      const u = {
        res: gl.getUniformLocation(program, "uRes"),
        dotPx: gl.getUniformLocation(program, "uDotPx"),
        spin: gl.getUniformLocation(program, "uSpin"),
        flow: gl.getUniformLocation(program, "uFlow"),
        tilt: gl.getUniformLocation(program, "uTilt"),
        radius: gl.getUniformLocation(program, "uRadius"),
        gather: gl.getUniformLocation(program, "uGather"),
        scatter: gl.getUniformLocation(program, "uScatter"),
        swell: gl.getUniformLocation(program, "uSwell"),
        grain: gl.getUniformLocation(program, "uGrain"),
        dot: gl.getUniformLocation(program, "uDot"),
        energy: gl.getUniformLocation(program, "uEnergy"),
        rim: gl.getUniformLocation(program, "uRim"),
      };

      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      // ADDITIVE, premultiplied. The dots are light on ink, so where two
      // overlap the result is brighter — which is exactly what draws the
      // silhouette, because the silhouette is where the cloud is deepest.
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.clearColor(0, 0, 0, 0);

      // ── the stage ─────────────────────────────────────────────────────────
      let width = 0;
      let height = 0;
      let dpr = 1;
      const resize = () => {
        dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        // The CANVAS, not the host: the canvas overruns its layout block by
        // STAGE_OVERRUN, so sizing the buffer to the host renders the cloud at
        // 1/1.5 of the pixels it is then stretched across — a soft sphere on
        // every display, including the ones with no dpr to spare.
        const r = canvas.getBoundingClientRect();
        const w = Math.max(1, Math.round(r.width * dpr));
        const h = Math.max(1, Math.round(r.height * dpr));
        if (w === width && h === height) return;
        width = w;
        height = h;
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      // ── the hand ──────────────────────────────────────────────────────────
      const onPointer = (e: PointerEvent) => {
        const r = host.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        // measured against the sphere's OWN box, not the window: the lean has
        // to answer where the hand is relative to the object it is leaning
        handRef.current.tx = Math.max(
          -1,
          Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1),
        );
        handRef.current.ty = Math.max(
          -1,
          Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1),
        );
      };
      if (pointer && !reduced) {
        window.addEventListener("pointermove", onPointer, { passive: true });
      }

      const draw = () => {
        const s = stateRef.current;
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(u.res, width, height);
        gl.uniform1f(u.dotPx, dpr * DOT_PX);
        gl.uniform1f(u.spin, s.spin + handRef.current.x * HAND_SPIN * s.hand);
        gl.uniform1f(u.flow, s.flow);
        gl.uniform1f(u.tilt, s.tilt + handRef.current.y * HAND_TILT * s.hand);
        gl.uniform1f(u.radius, s.radius);
        gl.uniform1f(u.gather, s.gather);
        gl.uniform1f(u.scatter, s.scatter);
        gl.uniform1f(u.swell, s.swell);
        gl.uniform1f(u.grain, s.grain);
        gl.uniform1f(u.dot, s.dot);
        gl.uniform1f(u.energy, s.energy);
        gl.uniform1f(u.rim, s.rim);
        gl.drawArrays(gl.POINTS, 0, cloud.count);
      };

      // ── reduced motion: the composition, held ─────────────────────────────
      // One settled frame and no loop. Not rest with the clocks at zero — see
      // SPHERE_STILL for why that frame reads as a diagram.
      if (reduced) {
        Object.assign(stateRef.current, SPHERE_STILL);
        Object.assign(targetRef.current, SPHERE_STILL);
        resize();
        draw();
        return () => {
          liveRef.current = false;
          ro.disconnect();
          gl.deleteProgram(program);
          gl.deleteBuffer(posBuf);
          gl.deleteBuffer(seedBuf);
          gl.deleteVertexArray(vao);
        };
      }

      // ── the loop ──────────────────────────────────────────────────────────
      let raf = 0;
      let running = false;
      let last = performance.now();
      const started = last;

      const tick = (now: number) => {
        if (!running) return;
        const dt = Math.min(MAX_DT, Math.max(0, (now - last) / 1000));
        last = now;
        resize();

        const s = stateRef.current;
        const t = targetRef.current;

        // the damped half — every driver chases its target with its own tau.
        // AIM_KEYS, never the target's own keys: a clock that found its way
        // onto the target would be damped against an undefined tau, and the
        // NaN that produces reaches gl_Position and empties the canvas.
        for (const key of AIM_KEYS) {
          s[key] = approach(s[key], t[key], SPHERE_TAU[key], dt);
        }
        // the integrated half — clocks, which is why they are not in the loop
        // above: a clock has no target to be near
        s.spin += s.spinRate * dt;
        s.flow += s.flowRate * dt;

        const hand = handRef.current;
        hand.x = approach(hand.x, hand.tx, 0.42, dt);
        hand.y = approach(hand.y, hand.ty, 0.42, dt);

        // the frame, handed over last — a driving hook sees the settled state
        // and may overwrite any of it before it reaches the uniforms
        hookRef.current?.(s, dt, (now - started) / 1000);

        draw();
        raf = requestAnimationFrame(tick);
      };

      // ── never burn frames nobody can see ──────────────────────────────────
      let onScreen = false;
      let tabVisible = !document.hidden;
      const sync = () => {
        const should = onScreen && tabVisible;
        if (should === running) return;
        running = should;
        if (running) {
          // reset the clock on resume: the gap is not elapsed time for us
          last = performance.now();
          raf = requestAnimationFrame(tick);
        } else {
          cancelAnimationFrame(raf);
        }
      };

      const io = new IntersectionObserver(
        ([entry]) => {
          onScreen = entry.isIntersecting;
          sync();
        },
        { rootMargin: "12% 0px" },
      );
      io.observe(host);

      const onVisibility = () => {
        tabVisible = !document.hidden;
        sync();
      };
      document.addEventListener("visibilitychange", onVisibility);

      // ── context loss ──────────────────────────────────────────────────────
      // preventDefault is what makes the loss recoverable at all; the page
      // falls back to the CSS ring until a remount restores the renderer, so
      // the hero is never a hole.
      const onLost = (e: Event) => {
        e.preventDefault();
        running = false;
        cancelAnimationFrame(raf);
        liveRef.current = false;
        host.dataset.sphere = "fallback";
      };
      canvas.addEventListener("webglcontextlost", onLost);

      return () => {
        running = false;
        liveRef.current = false;
        cancelAnimationFrame(raf);
        io.disconnect();
        ro.disconnect();
        canvas.removeEventListener("webglcontextlost", onLost);
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("pointermove", onPointer);
        gl.deleteProgram(program);
        gl.deleteBuffer(posBuf);
        gl.deleteBuffer(seedBuf);
        gl.deleteVertexArray(vao);
      };
    }, [cloud, reduced, pointer]);

    return (
      <div
        className={className ? `lab-sphere ${className}` : "lab-sphere"}
        ref={hostRef}
        aria-hidden="true"
      >
        <canvas className="lab-sphere-canvas" ref={canvasRef} />
      </div>
    );
  },
);
