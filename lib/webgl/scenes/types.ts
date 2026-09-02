/**
 * The SCENE contract (R5-A) — the unit of the one-continuous-liquid system.
 *
 * A scene is a pure module that translates its measured page geometry into
 * raw control channels (`read`), and its damped channels into per-droplet
 * targets (`target`), a form-slot claim (`form`), ambient/light contributions
 * and optional extra droplets. The CONDUCTOR (lib/webgl/conductor.mjs) owns
 * everything between scenes: channel damping, presence weighting, per-droplet
 * blending across handoffs, the form-slot arbiter (forms NEVER crossfade —
 * ownership transfers only through a droplet-only state), the shared ambient
 * family, integration (legacy low-pass in Phase A; fluid-core in Phase B),
 * packing, and the light-score merge.
 *
 * PURITY: scenes must not touch the DOM outside `read` (which only receives
 * measured rects), must not allocate per frame in `target` (write into `out`),
 * and must write EVERY field of `out` — the conductor does not reset it.
 */

import type { FieldDriver } from "../field-drivers";

/** Raw/damped control channels — every value is a plain number (booleans as
 *  0/1, "null" selections as -1) so damping and simulation stay trivial. */
export type SceneChannels = Record<string, number>;

/** Measured page geometry handed to `read` (browser side only). Keys are the
 *  scene's own `anchors` / `lists` keys. */
export type SceneGeom = {
  vh: number;
  vw: number;
  scrollY: number;
  rect(key: string): DOMRect | null;
  list(key: string): DOMRect[];
};

/** Per-droplet target written by `target` (all fields REQUIRED — no resets):
 *  bind: 1 = analytic-exact follow (melts, resting forms — physics forces off)
 *        0 = free liquid (full physics in Phase B)
 *  cluster: cohesion group id (-1 = none) — Phase B
 *  z: depth band 0 = near … 1 = far — Phase C optics */
export type DropletOut = {
  x: number;
  y: number;
  r: number;
  bind: number;
  cluster: number;
  z: number;
  /** Field DENSITY, 1 = solid liquid. The channel a scene uses to make liquid
   *  LEAVE: scaling `r` toward zero instead pulls droplets out of contact with
   *  each other (they only neck while their gap is under 0.83 x radius) and
   *  leaves fully-solid beads behind, because a metaball's peak field does not
   *  fall with its size. The conductor reseeds this to 1 before every call, so
   *  a scene that never mentions it always renders solid. */
  d: number;
};

/** Per-frame context handed to every scene hook. `ch` is the scene's OWN
 *  damped channel set; `scrollVel` is the conductor-damped global stir. */
export type SceneCtx = {
  tMs: number;
  t: number; // seconds
  dt: number; // ms, clamped [0, 100]
  aspect: number; // drawing-buffer aspect (uv x spans [½−a/2, ½+a/2])
  ch: SceneChannels;
  scrollVel: number; // viewport-heights/s, damped at PHYS.TAU_VEL
  physics: boolean; // false only for the exact ?fphys=0 rollback path
};

/** A form-slot claim: the full form staging for this frame. A scene may only
 *  be GRANTED the slots when the current holder's fa+fb has drained below the
 *  arbiter epsilon — never returned non-null "on spec". */
export type FormState = {
  a: number;
  b: number;
  fa: number;
  fb: number;
  ea: number;
  eb: number;
  ox: number;
  oy: number;
  scale: number;
  warp: number;
  /** The field's saturation ceiling for this frame (melt.mjs meltSat).
   *  0 = the exact historical plain sum, which is what everything outside a
   *  morph uploads. Only a morph in flight raises it. */
  sat?: number;
  /** DIAGNOSTIC ONLY — the melt's progress, so a harness can target an exact
   *  frame by scrolling to it instead of guessing at viewport offsets. Nothing
   *  in the render reads this; -1 means "not in a melt". */
  meltP?: number;
};

/** The cinematic/material score channels (R5-D; merged by the conductor:
 *  veil/vignette/key/mute = max, exposure = product). Exposure, key and mute
 *  drive the in-shader material; veil/vignette drive the CinematicVeils DOM
 *  layer via PageStage's CSS vars. */
export type LightScore = {
  exposure: number; // 1 = neutral
  veil: number; // 0..1 black exposure veil (the two act-boundary fades)
  vignette: number; // 0..1
  key: number; // 0..1 additive key-light boost (the key never re-aims)
  mute: number; // 0..1 controlled cyan desaturation (Problem only)
};

export type SceneModule = {
  id: string;
  /** SDF form indices this scene needs prefetched. */
  forms: readonly number[];
  /** Initial raw channel values — the conductor seeds `raw[id]` from this, so
   *  no channel is ever undefined/NaN at boot. */
  channels: SceneChannels;
  /** Single-element anchor selectors, measured by the shell per frame. */
  anchors?: Record<string, string>;
  /** Multi-element anchor selectors (e.g. the symptom shards, the pillars). */
  lists?: Record<string, string>;
  /** Per-channel damping override: tau in ms, or false = raw passthrough
   *  (stage boxes, pointer, snap-managed channels). Default PHYS.TAU_CHANNEL. */
  damp?: Record<string, number | false>;
  /** Compute raw channels from measured geometry (browser side; pure math —
   *  write into `out`). Optional: shells/sims may write channels directly. */
  read?(g: SceneGeom, out: SceneChannels): void;
  /** Advance internal machines (the hero autocycle, snap-or-damp melts). */
  tick?(ctx: SceneCtx): void;
  /** The scene's grip on the liquid, 0..1. The conductor normalises presences
   *  into blend weights; adjacent scenes overlap only in handoff windows. */
  presence(ctx: SceneCtx): number;
  /** Write droplet i's target into `out` (all fields, no allocation). */
  target(i: number, ctx: SceneCtx, out: DropletOut): void;
  /** Claim the form slots (or null). See FormState for the arbiter contract. */
  form(ctx: SceneCtx): FormState | null;
  /** Multiplier on the conductor's ambient lava-lamp family (default 1). */
  ambient?(ctx: SceneCtx): number;
  /** Activity hint for the energy governor (default 1 while present). */
  activity?(ctx: SceneCtx): number;
  /** Extra droplets beyond the canonical 48 (cursor chain, probe, spray). */
  extras?(
    ctx: SceneCtx,
    push: (x: number, y: number, r: number, z?: number) => void,
  ): void;
  /** Cinematic contribution (Phase D). */
  score?(ctx: SceneCtx): Partial<LightScore>;
  /** Form SDF texture became drawable (the hero autocycle gates on this). */
  formReady?(s: number): void;
};

/** What makeConductor returns: the FieldStage-compatible driver plus the
 *  shell/sim-facing surfaces. */
export type Conductor = {
  driver: FieldDriver;
  /** Raw channel storage, keyed by scene id — the shell writes here. */
  raw: Record<string, SceneChannels>;
  /** Global raw inputs: scroll velocity (damped internally) + the page-wide
   *  pointer in field uv (the Phase-B cursor force field; pon = 0/1). */
  input: {
    vel: number;
    px: number;
    py: number;
    pvx: number;
    pvy: number;
    pon: number;
    /** 0/1 — the pointer is held down. Damped internally into the field gain. */
    press: number;
    /** Fixed-stride field-space avoidance bounds for the opt-in v3 review. */
    obstacles: Float32Array;
    obstacleCount: number;
  };
  /** Queue a click/tap at (x, y) in field uv; `strength` scales the blow.
   *  Applied on the conductor's next frame, on the conductor's clock. */
  strike(x: number, y: number, strength?: number): void;
  /** The merged light score after each frame (stable object, mutated). */
  score: LightScore;
  /** Diagnostics: arbiter violations, current holder, energy, and active count. */
  stats: {
    violations: number;
    holderId: string | null;
    energy: number;
    active: number;
  };
};
