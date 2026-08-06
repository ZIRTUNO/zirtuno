/**
 * ORIGIN scene (R5-A) — the faithful port of makeOriginDriver: S8's five
 * scrubbed beats. Two brother-masses enter from opposite sides and drift
 * together → fuse onto the mark's droplet footprint while the EXACT mark
 * grows from its skeleton → the hold (breathing) → half the droplets reborn
 * as the ecosystem echo → everything sinks and drains under the assembling
 * particle wordmark. Entry visibility is positional by construction (the
 * masses park off-stage at p = 0), so no entry envelope is needed.
 */

import { CLOUDS, clamp01, smooth01, hash, PHYS, VARY } from "../phys.mjs";
import { formPresence } from "../field-drivers";
import {
  SDF_WARP_REST,
  SDF_WARP_MORPH,
  SDF_MELT_ERODE,
} from "../sdf-glass-shader.mjs";
import type {
  SceneModule,
  SceneCtx,
  SceneGeom,
  SceneChannels,
  DropletOut,
  FormState,
  LightScore,
} from "./types";

export const ORIGIN_SCALE = 0.5; // the mark's half-extent ≈ 0.2 uv (same as the eco)
export const ORIGIN_OY = 0.06; // slightly above centre — the beat copy reads below

// the three FOUNDING-pillar labels, anchored beside the mark's three lobes
// (stage units around the mark centre, y up — understated, never cyan-styled).
// Consumed by the shell (PageStage) for the floating DOM labels.
// R5-E pushed them a notch further out: at 1280×720 the side anchors landed
// within a few pixels of the beat-3 purpose line's 26rem measure, so label and
// narrative shared one visual field. The shell clamps them into the stage, so
// the wider anchors cannot walk off a narrow one.
export const PILLAR_ANCHORS: { dx: number; dy: number }[] = [
  { dx: -0.38, dy: 0.05 },
  { dx: 0.37, dy: 0.18 },
  { dx: 0.03, dy: -0.35 },
];

type OriginTarget = {
  ex: number; // off-stage entry
  ey: number;
  mx: number; // the meeting (two loose masses, about to touch)
  my: number;
  ox: number; // beat-4 echo orbit
  oy: number;
};

export function makeOriginScene(): SceneModule {
  const base = CLOUDS[0];
  let cachedAspect = -1;
  let T: OriginTarget[] = [];

  // per-frame factors (tick → target/form/score)
  let p = 0;
  let q1 = 0;
  let q2 = 0;
  let q4 = 0;
  let q5 = 0;
  const scoreOut: Partial<LightScore> = {
    key: 0,
    flash: 0,
    vignette: 0,
    exposure: 1,
  };
  const formOut: FormState = {
    a: 0,
    b: 0,
    fa: 0,
    fb: 0,
    ea: 0,
    eb: 0,
    ox: 0,
    oy: ORIGIN_OY,
    scale: ORIGIN_SCALE,
    warp: SDF_WARP_REST,
  };

  return {
    id: "origin",
    forms: [0],
    channels: { p: 0, on: 0 },
    damp: { on: false },
    anchors: { wrap: "#name .origin-journey" },

    read(g: SceneGeom, out: SceneChannels) {
      const vh = g.vh;
      const wr = g.rect("wrap");
      if (wr) {
        out.p = clamp01(-wr.top / Math.max(wr.height - vh, 1));
        out.on =
          clamp01((vh * 1.9 - wr.top) / (vh * 0.5)) *
          clamp01((wr.bottom + vh * 0.3) / (vh * 0.5));
      }
    },

    presence(ctx: SceneCtx) {
      return ctx.ch.on;
    },

    tick(ctx: SceneCtx) {
      const aspect = ctx.aspect;
      if (Math.abs(aspect - cachedAspect) > 0.02) {
        cachedAspect = aspect;
        const halfW = Math.max(aspect, 0.6) / 2;
        const sx = Math.min(Math.max(aspect * 0.8, 1), 1.45);
        T = base.map((_, i) => {
          const side = i % 2 === 0 ? -1 : 1; // brother A / brother B, interleaved
          const ma = hash(i, 54) * Math.PI * 2;
          const md = 0.03 + 0.09 * hash(i, 55);
          const oa = hash(i, 56) * Math.PI * 2;
          const orr = 0.26 + 0.16 * hash(i, 57);
          return {
            ex: 0.5 + side * (halfW + 0.12 + 0.1 * hash(i, 52)),
            ey: 0.36 + 0.38 * hash(i, 53),
            mx: 0.5 + side * 0.105 + Math.cos(ma) * md * 0.9,
            my: 0.5 + ORIGIN_OY + side * 0.02 + Math.sin(ma) * md,
            ox: 0.5 + Math.cos(oa) * orr * sx,
            oy: 0.5 + ORIGIN_OY + Math.sin(oa) * orr,
          };
        });
      }
      p = clamp01(ctx.ch.p); // conductor-damped

      // beat envelopes (windows overlap on purpose — nothing ever swaps)
      q1 = smooth01(p / 0.17); // enter → the meeting
      q2 = smooth01((p - 0.19) / 0.22); // fuse → the mark
      q4 = smooth01((p - 0.62) / 0.19); // multiply outward
      q5 = smooth01((p - 0.84) / 0.12); // resolve under the wordmark

      // the mark: grows from its skeleton under the fused mass (late beat 2),
      // holds through beats 3–4, erodes away at the resolution
      const [wIn, eIn] = formPresence(smooth01((q2 - 0.5) / 0.45));
      const out = smooth01((p - 0.86) / 0.11);
      formOut.fa = wIn * (1 - out);
      formOut.ea = eIn + out * SDF_MELT_ERODE;
      formOut.warp =
        SDF_WARP_REST +
        (SDF_WARP_MORPH - SDF_WARP_REST) * 0.6 * Math.sin(Math.PI * q2);

      // ── act IV light (R5-D): the emotional peak ────────────────────────────
      // The key lifts as the brothers fuse and stays lifted while the mark
      // holds; the vignette closes over the approach (intimacy) and OPENS at
      // the fusion. The flash channel is only the RAW signal — the scene says
      // "the fusion is complete" across a scrub-proof window; the conductor
      // owns the latch, the ≤400 ms envelope, and the afterglow. p is
      // conductor-damped, so a hard scroll cannot tunnel past the window.
      scoreOut.key = 0.55 * q2 * (1 - 0.8 * q5);
      scoreOut.vignette = 0.2 * q1 * (1 - q2);
      scoreOut.exposure = 1 + 0.06 * q2 * (1 - q5);
      scoreOut.flash = p > 0.42 && p < 0.62 ? 1 : 0;
    },

    target(i: number, ctx: SceneCtx, out: DropletOut) {
      const t = ctx.t;
      const b = base[i];
      const s = T[i];
      // entry → the meeting
      let x = s.ex + (s.mx - s.ex) * q1;
      let y = s.ey + (s.my - s.ey) * q1;
      // the meeting → the mark's footprint (staggered — the fusion flows)
      const lt2 = smooth01((q2 - 0.45 * hash(i, 58)) / 0.55);
      const fx = 0.5 + (b[0] - 0.5) * ORIGIN_SCALE;
      const fy = 0.5 + ORIGIN_OY + (b[1] - 0.5) * ORIGIN_SCALE;
      x += (fx - x) * lt2;
      y += (fy - y) * lt2;
      // radius: travelling mass → footprint swell → drained as the form lands
      const drain = 1 - smooth01((q2 - 0.68) / 0.28);
      let r = b[2] * ORIGIN_SCALE * (0.6 + 0.4 * VARY[i]) * drain;
      // beat 4 — half the droplets are REBORN off the mark as the echo
      let loose = 1 - lt2;
      let echo = 0;
      if (i % 2 === 0 && q4 > 0.001) {
        const q4i = smooth01((q4 - 0.5 * hash(i, 59)) / 0.5);
        if (q4i > 0.001) {
          x += (s.ox - x) * q4i;
          y += (s.oy - y) * q4i;
          r = Math.max(r, 0.016 * VARY[i] * q4i);
          loose = Math.max(loose, q4i);
          echo = q4i;
        }
      }
      // resolution: everything sinks and drains
      r *= 1 - q5;
      // The fluid core supplies loose-body curl. Keep the authored wander only
      // on ?fphys=0 so the rollback remains alive without double-driving the
      // normal physics path.
      const wob = (ctx.physics ? 0 : PHYS.DRIFT) * loose * (1 - q5);
      x += wob * Math.sin(t * (0.5 + hash(i, 62)) + i * 1.7);
      y += wob * Math.cos(t * (0.45 + hash(i, 63)) + i * 2.3);

      out.x = x;
      out.y = y;
      out.r = r;
      // physics attributes (R5-B): the two brothers travel as COHERENT liquid
      // bodies (side clusters + low bind), fuse into exactness (bind → 1 with
      // lt2), and the echo breaks free again
      out.bind = clamp01(lt2 * (1 - echo));
      out.cluster = lt2 < 0.7 && echo < 0.3 ? i % 2 : -1;
      out.z = 0;
    },

    form() {
      return formOut;
    },

    ambient() {
      return 0; // the origin stage had no ambient family (parity with pre-R5)
    },

    activity() {
      // fully scroll-scrubbed beats + slow echo drift — 30 Hz-safe at rest
      return 0;
    },

    score() {
      return scoreOut;
    },
  };
}
