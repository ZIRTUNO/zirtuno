"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { FIELD, STATE_COUNT, AI_STATE } from "@/lib/webgl/states";
import { buildMetaballGeometry } from "@/lib/webgl/mesh-states";
import { bakeGlassMatcap } from "@/lib/webgl/mesh-matcap";

/* ---------------------------------------------------------------------------
 * Mesh metaball (S2.3, integrated/mobile path). A morph-target mesh shaded with
 * the baked cyan-glass matcap (lib/webgl/mesh-matcap) + a fresnel rim. It morphs
 * by blending GPU morph targets — the SAME autocycle / hover / breathing as the
 * raymarch, driven by morphTargetInfluences instead of SDF uniforms. Light enough
 * that an integrated GPU runs it at 60fps with no per-pixel loop (no TDR freeze).
 * ------------------------------------------------------------------------- */

const BREATH = FIELD.breath;
const OMEGA = (1 / 8) * Math.PI * 2; // ~8s breathing period (matches the raymarch)
const HOLD = 9.0; // seconds a form rests before melting
const TRANS = 1.4; // melt duration
const LEAN = 0.2; // hover lean amount (radians at full pointer)
const VIEW_FIT = 0.46; // ortho zoom = canvas height × this (matches raymarch scale)
const RIM = 0.5; // fresnel rim-glow strength

const STATES = STATE_COUNT;
const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
const breathScale = (t: number) => 1 + BREATH * Math.sin(t * OMEGA);

// quarter-period → peak breath (parity with MetaballScene CAPTURE_TIME.breath)
const BREATH_TIME = Math.PI / 2 / OMEGA;

function applyInfluences(infl: number[], a: number, b: number, m: number) {
  for (let i = 0; i < infl.length; i++) infl[i] = 0;
  if (a === b) infl[a] = 1;
  else {
    infl[a] = 1 - m;
    infl[b] = m;
  }
}

function Blob({
  stateA,
  stateB,
  morph0,
  time0,
  animate,
  manualState,
  onReady,
  onActiveChange,
}: {
  stateA: number;
  stateB: number;
  morph0: number;
  time0: number;
  animate: boolean;
  manualState: number | null;
  onReady: () => void;
  onActiveChange: (i: number) => void;
}) {
  const geometry = useMemo(() => buildMetaballGeometry(4), []);
  const matcap = useMemo(() => bakeGlassMatcap(), []);

  const material = useMemo(() => {
    const m = new THREE.MeshMatcapMaterial({
      matcap: matcap ?? undefined,
      color: matcap ? 0xffffff : 0x00b6cc, // flat cyan fallback if the bake failed
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uRim = { value: RIM };
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uRim;")
        .replace(
          "vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;",
          `vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
           float zrFres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
           outgoingLight += vec3(0.302, 0.925, 1.0) * zrFres * uRim;`,
        );
    };
    return m;
  }, [matcap]);

  const meshRef = useRef<THREE.Mesh>(null);
  const fired = useRef(false);
  const lastActive = useRef(-2);
  // auto/manual state machine (mirrors MetaballScene): cur = settled, nxt = target.
  const cur = useRef(0);
  const nxt = useRef(0);
  const phase = useRef<"hold" | "melt">("hold");
  const clk = useRef(0);
  // pointer spring (eased toward the cursor while hovering, back to centre off)
  const ptr = useRef({ x: 0, y: 0 });
  const hovering = useRef(false);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  // ensure morphTargetInfluences/dictionary exist (geometry carries 8 targets)
  useEffect(() => {
    const mesh = meshRef.current;
    if (mesh && !mesh.morphTargetInfluences) mesh.updateMorphTargets();
  }, []);

  // static modes (capture / preview / pair): set the blend once + re-render (the
  // frameloop is "demand", so we must invalidate after applying the influences —
  // otherwise the first render shows the un-morphed base sphere).
  useEffect(() => {
    if (animate) return;
    const mesh = meshRef.current;
    if (!mesh) return;
    if (!mesh.morphTargetInfluences) mesh.updateMorphTargets();
    const infl = mesh.morphTargetInfluences;
    if (infl) applyInfluences(infl, stateA, stateB, morph0);
    mesh.scale.setScalar(breathScale(time0));
    invalidate();
  }, [animate, stateA, stateB, morph0, time0, invalidate]);

  // hover physics — track the cursor over the canvas, release to centre on leave
  useEffect(() => {
    if (!animate) return;
    const el = gl.domElement;
    const on = () => {
      hovering.current = true;
    };
    const off = () => {
      hovering.current = false;
    };
    el.addEventListener("pointerenter", on);
    el.addEventListener("pointermove", on);
    el.addEventListener("pointerleave", off);
    return () => {
      el.removeEventListener("pointerenter", on);
      el.removeEventListener("pointermove", on);
      el.removeEventListener("pointerleave", off);
    };
  }, [gl, animate]);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (mesh && animate) {
      const infl = mesh.morphTargetInfluences;
      if (infl) {
        // pointer spring → lean
        const tx = hovering.current ? state.pointer.x : 0;
        const ty = hovering.current ? state.pointer.y : 0;
        ptr.current.x += (tx - ptr.current.x) * 0.08;
        ptr.current.y += (ty - ptr.current.y) * 0.08;
        mesh.rotation.y = ptr.current.x * LEAN;
        mesh.rotation.x = -ptr.current.y * LEAN;

        // breathing
        mesh.scale.setScalar(breathScale(state.clock.elapsedTime));

        // advance the cycle (hold uses wall-time, melt stays frame-smoothed)
        clk.current +=
          phase.current === "hold" ? Math.min(delta, 0.5) : Math.min(delta, 0.05);
        let m = 0;
        if (phase.current === "hold") {
          applyInfluences(infl, cur.current, cur.current, 0);
          const target =
            manualState != null ? manualState : (cur.current + 1) % STATES;
          const ready =
            manualState != null ? manualState !== cur.current : clk.current >= HOLD;
          if (ready) {
            nxt.current = target;
            phase.current = "melt";
            clk.current = 0;
          }
        }
        if (phase.current === "melt") {
          m = smoother(Math.min(clk.current / TRANS, 1));
          applyInfluences(infl, cur.current, nxt.current, m);
          if (clk.current >= TRANS) {
            cur.current = nxt.current;
            phase.current = "hold";
            clk.current = 0;
            applyInfluences(infl, cur.current, cur.current, 0);
          }
        }

        const dom = phase.current === "melt" && m >= 0.5 ? nxt.current : cur.current;
        const active = dom === 0 ? -1 : dom - 1;
        if (active !== lastActive.current) {
          lastActive.current = active;
          onActiveChange(active);
        }
      }
    }

    if (!fired.current) {
      fired.current = true;
      onReady();
    }
  });

  useEffect(
    () => () => {
      material.dispose();
      geometry.dispose();
      matcap?.dispose();
    },
    [material, geometry, matcap],
  );

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} frustumCulled={false} />
  );
}

/** Fit the orthographic camera so the blob fills the stage like the raymarch. */
function FitCamera() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    camera.zoom = size.height * VIEW_FIT;
    camera.updateProjectionMatrix();
    invalidate(); // re-render with the fitted projection (frameloop may be "demand")
  }, [camera, size, invalidate]);
  return null;
}

/** Adaptive resolution + live fps/dpr for the ?perf overlay (mesh is cheap; gentle band). */
function AdaptiveDpr({ min, max }: { min: number; max: number }) {
  const setDpr = useThree((s) => s.setDpr);
  const acc = useRef({ frames: 0, t: 0 });
  useFrame((_, delta) => {
    const a = acc.current;
    a.frames += 1;
    a.t += delta;
    if (a.t >= 0.5) {
      (window as unknown as { __zglassFps?: number }).__zglassFps = Math.round(
        a.frames / a.t,
      );
      a.frames = 0;
      a.t = 0;
    }
  });
  return (
    <PerformanceMonitor
      bounds={() => [50, 58]}
      flipflops={4}
      onChange={({ factor }) => {
        const d = Math.round((min + factor * (max - min)) * 20) / 20;
        setDpr(d);
        (window as unknown as { __zglassDpr?: number }).__zglassDpr = d;
      }}
      onFallback={() => {
        setDpr(min);
        (window as unknown as { __zglassDpr?: number }).__zglassDpr = min;
      }}
    />
  );
}

/**
 * Mesh metaball scene (S2.3, integrated/mobile). Same hero prop surface as
 * MetaballScene's live path: `capture` freezes rest / breath / morph / ai;
 * `previewState` freezes a single form; `morphPair` freezes an A→B blend.
 */
export default function MeshMetaballScene({
  onReady = () => {},
  onActiveChange = () => {},
  capture = null,
  previewState = null,
  manualState = null,
  morphPair = null,
  play = true,
}: {
  onReady?: () => void;
  onActiveChange?: (i: number) => void;
  capture?: "rest" | "breath" | "morph" | "ai" | null;
  previewState?: number | null;
  manualState?: number | null;
  morphPair?: [number, number, number] | null;
  play?: boolean;
}) {
  const startDpr = useMemo(
    () => Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 1.75),
    [],
  );
  const [dpr] = useState(startDpr);

  let stateA = 0;
  let stateB = AI_STATE;
  let morph0 = 0;
  let time0 = 0;
  let animate = true;
  if (morphPair != null) {
    stateA = morphPair[0];
    stateB = morphPair[1];
    morph0 = morphPair[2];
    animate = false;
  } else if (previewState != null) {
    stateA = previewState;
    stateB = previewState;
    animate = false;
  } else if (capture !== null) {
    animate = false;
    morph0 = capture === "morph" ? 0.5 : 0;
    stateA = capture === "ai" ? AI_STATE : 0;
    stateB = capture === "morph" ? AI_STATE : stateA;
    time0 = capture === "breath" ? BREATH_TIME : 0;
  }

  return (
    <Canvas
      orthographic
      dpr={dpr}
      frameloop={animate && play ? "always" : "demand"}
      camera={{ position: [0, 0, 3], near: 0.1, far: 10, zoom: 240 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%" }}
    >
      <FitCamera />
      {animate && <AdaptiveDpr min={1} max={Math.max(startDpr, 1.5)} />}
      <Blob
        stateA={stateA}
        stateB={stateB}
        morph0={morph0}
        time0={time0}
        animate={animate}
        manualState={manualState}
        onReady={onReady}
        onActiveChange={onActiveChange}
      />
    </Canvas>
  );
}
