/**
 * Field driver KERNEL (R5-A): the shared vocabulary of the one liquid.
 *
 * Every chapter visual is the SAME unified liquid field (sdf-glass-shader) —
 * since R5, ONE conductor-driven canvas for the whole page (lib/webgl/
 * conductor.mjs + lib/webgl/scenes/* + components/field/PageStage). What
 * lives here is the kernel every scene and harness shares:
 *
 *   - the FieldFrame/FieldDriver contract consumed by FieldStage;
 *   - makeLoneDropDriver — the 404's lone dispersed droplet (the one visual
 *     that is genuinely its own page, not a scene of the homepage conductor).
 *
 * The pure kernels are node-runnable modules, re-exported here so browser-side
 * imports stay stable:
 *   - phys.mjs   — CLOUDS, PHYS, TAUP, the scatter/orbital vocabulary;
 *   - melt.mjs   — the §3.3 melt (packBridge + matchClouds/permFor +
 *                  bridgePresence/formPhase + the measured bridge solidity).
 * The isolated form QA renderer and the scenes both import the melt from
 * here, so it has exactly ONE implementation — and scripts/_melt-sim.mjs, the
 * offline field simulator, runs that same implementation rather than a copy.
 */

import { SDF_WARP_REST } from "./sdf-glass-shader.mjs";

// ── the pure kernel (R5-A): the canonical clouds, the ONE physics table, the
// per-droplet identity tables and the scatter/orbital target vocabulary live
// in phys.mjs (node-runnable — the conductor and the sim harnesses import it
// without a TS toolchain). Re-exported here so every existing browser-side
// import keeps working unchanged. ─────────────────────────────────────────────
import { CLOUDS, N, STAG, clamp01, smooth01, PHYS } from "./phys.mjs";
import type { Ball } from "./phys.mjs";

export { CLOUDS, N, STAG, clamp01, smooth01, PHYS };
export type { Ball };

// ── the §3.3 melt (melt.mjs — same rule, same reason) ─────────────────────────
export {
  STAGGER,
  RADIUS_LEAD,
  BRIDGE,
  BRIDGE_RAMP,
  FORM_SOLIDITY,
  arrive,
  bridgeRadiusEnvelope,
  bridgePresence,
  bridgeDensity,
  bridgeSwell,
  matchClouds,
  permFor,
  meltDroplet,
  packBridge,
  formPresence,
  formPhase,
  morphPhase,
  meltSat,
  SAT_OFF,
} from "./melt.mjs";

// ── the driver contract (consumed by components/field/FieldStage) ─────────────
export type FieldFrame = {
  a: number; // form A state index (must be loaded before drawing)
  b: number; // form B state index
  fa: number; // form A field weight
  fb: number; // form B field weight
  ea: number; // form A erosion offset (0 = exact)
  eb: number; // form B erosion offset
  /** The field's saturation ceiling (melt.mjs meltSat), uploaded as iFieldSat.
   *  Absent or 0 = the exact historical plain sum. */
  sat?: number;
  /** DIAGNOSTIC ONLY — melt progress, surfaced on window.__optics so the shape
   *  gate and the capture harnesses can target an exact frame. -1 = not in a
   *  melt. No render path reads it. */
  meltP?: number;
  warp: number;
  mute: number; // 0 = brand cyan … 1 = desaturated (S3)
  count: number; // balls the driver packed into the buffer
  ox?: number; // form-domain offset (uv units; full-bleed staging)
  oy?: number;
  scale?: number; // form-domain scale (default 1)
  expo?: number; // R5-C score-driven exposure DELTA (0 = neutral)
  key?: number; // R5-C score-driven key-light boost (0 = neutral)
  energy?: number; // R5-C cadence-governor energy (absent = always active)
  /** The FORM's share of the interaction, uploaded as iTouch: pointer xy in
   *  field uv, influence radius, displacement gain (0 = exact identity). */
  touch?: Float32Array;
  /** Live strikes as [x, y, front radius, displacement amplitude] × slots,
   *  uploaded as iShock. A spent slot carries amplitude 0. */
  shock?: Float32Array;
  /** True while anything above is non-zero — lets the stage upload the
   *  identity arrays instead, so a stale dent cannot outlive the pointer. */
  touchLive?: boolean;
  /** R6 — packed motes, and the mean bind over the authored droplets. Absent
   *  on drivers with no mote population. */
  motes?: number;
  bindAvg?: number;
};
export type FieldDriver = {
  /** SDF state indices to prefetch; forms[0] gates the first paint. */
  forms: readonly number[];
  /** Called by the stage as each form's SDF texture becomes drawable — drivers
   *  that retarget between forms (the hero autocycle) gate on this. */
  formReady?: (s: number) => void;
  /** aspect = buffer width/height; the uv domain spans x ∈ [½−a/2, ½+a/2].
   *  zBuf (R5-C, optional): parallel per-ball depth (0 near … 1 far) the stage
   *  uploads as iBallZ — drivers that stage depth write every packed slot. */
  frame: (
    tMs: number,
    buf: Float32Array,
    aspect: number,
    zBuf?: Float32Array,
    /** Optional packed identity channel for velocity-aware review renderers.
     *  Canonical droplets use stable non-negative ids; transient families use
     *  -1 and therefore stay circular. */
    idBuf?: Int16Array,
    /** Optional packed field DENSITY (1 = solid) the stage uploads as
     *  iBallDensity. The stage refills it with 1 each frame, so a driver only
     *  writes the slots it actually thins. */
    dBuf?: Float32Array,
  ) => FieldFrame;
  /** R6 — what the driver is simulating, and how much of it is being drawn.
   *  Absent on the single-purpose drivers (the 404's lone droplet), which have
   *  no population to speak of. */
  population?: {
    /** The authored droplet count — what the forms are packed to (N = 48). */
    authored: number;
    /** The simulated count, motes included. */
    simulated: number;
    /** How many of them the last frame packed. */
    readonly active: number;
  };
  /** Draw this many droplets, clamped to [authored, simulated]. A PACKING
   *  budget, not an allocation: the driver keeps simulating everything, so the
   *  renderer's tier ladder can trade population for frame time and give it
   *  back without stranding physics state. Returns what was actually set. */
  setPopulation?: (n: number) => number;
};

/** Callbacks the site scene surfaces to the shell. */
export type SiteCallbacks = {
  /** Hero active state for the pillar indicator / aria: -1 = mark, 0-6. */
  onHeroActive?: (i: number) => void;
};

/**
 * 404 — the lone, dispersed droplet: one droplet that stayed, wandering
 * slowly, and two fragments drifting at the edge of its reach — almost gone.
 * "This page has dispersed." Pure droplets (no form), the same liquid.
 */
export function makeLoneDropDriver(): FieldDriver {
  return {
    forms: [0],
    frame: (tMs, buf) => {
      const t = tMs / 1000;
      // the one that stayed
      buf[0] = 0.5 + 0.045 * Math.sin(t * 0.21) + 0.018 * Math.sin(t * 0.53);
      buf[1] = 0.48 + 0.045 * Math.cos(t * 0.17) + 0.018 * Math.sin(t * 0.61);
      buf[2] = 0.16 + 0.008 * Math.sin(t * 0.6);
      // the two that dispersed — drifting away, barely holding on
      buf[3] = 0.2 + 0.05 * Math.sin(t * 0.13 + 2);
      buf[4] = 0.74 + 0.04 * Math.cos(t * 0.19 + 1);
      buf[5] = 0.042 + 0.005 * Math.sin(t * 0.7 + 3);
      buf[6] = 0.8 + 0.05 * Math.sin(t * 0.11 + 4);
      buf[7] = 0.3 + 0.045 * Math.cos(t * 0.23 + 5);
      buf[8] = 0.055 + 0.006 * Math.cos(t * 0.9);
      return {
        a: 0,
        b: 0,
        fa: 0,
        fb: 0,
        ea: 0,
        eb: 0,
        warp: SDF_WARP_REST,
        mute: 0,
        count: 3,
      };
    },
  };
}
