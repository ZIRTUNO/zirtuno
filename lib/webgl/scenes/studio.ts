/**
 * STUDIO scene (R5-D) — the ECHO. Origin's beat-4 echo family (i % 2 === 0)
 * does not simply vanish under the resolution: a thinned subset (i % 6 === 0,
 * eight droplets) survives as slow wide orbits BEHIND the roles grid — the
 * fusion still resonating while the studio explains itself. Deep sub-surface,
 * nearly free (the fluid core breathes them), no form claim, and no exit
 * drain: whatever is still orbiting when Contact grips gets GATHERED into the
 * resting mark by the handoff blend — Act V begins with the echoes coming
 * home.
 *
 * Light: this scene owns act boundary IV — the second (and last) fade beat,
 * scrubbed across the Origin → Studio seam, plus the afterglow settling:
 * a touch of vignette and a barely-below-neutral exposure.
 */

import { clamp01, smooth01, hash } from "../phys.mjs";
import { VEIL_ACT } from "./work";
import type {
  SceneModule,
  SceneCtx,
  SceneGeom,
  SceneChannels,
  DropletOut,
  LightScore,
} from "./types";

/** Sub-surface depth of the echoes — just behind the work current (0.55). */
const ECHO_Z = 0.6;

export function makeStudioScene(): SceneModule {
  // per-frame factors (tick → target/score)
  let rInW = 0;
  let onW = 0;
  let bp = 0;
  let divX = 0.5;
  let bodyY = 0.5;
  let bodyH = 0.32;
  let edgeL = 0.2;
  let edgeR = 0.8;
  const scoreOut: Partial<LightScore> = { veil: 0, vignette: 0, exposure: 1 };

  return {
    id: "studio",
    forms: [], // droplet-only scene — never claims the slots
    channels: {
      on: 0,
      rIn: 0,
      bp: 0,
      divX: 0.5,
      bodyY: 0.5,
      bodyH: 0.32,
      edgeL: 0.2,
      edgeR: 0.8,
    },
    damp: { on: false, rIn: false, bp: false },
    anchors: { wrap: "#studio" },

    read(g: SceneGeom, out: SceneChannels) {
      const vh = g.vh;
      const wr = g.rect("wrap");
      if (wr) {
        out.on =
          clamp01((vh * 1.9 - wr.top) / (vh * 0.5)) *
          // Release over the final Studio-to-Contact overlap. Contact's loose
          // basin is already live here, so the echoes can genuinely travel
          // home before the exact mark reaches rest.
          clamp01((wr.bottom + vh * 0.05) / (vh * 0.35));
        out.rIn = clamp01((vh * 1.15 - wr.top) / (vh * 0.35));
        // act boundary IV (Origin → Studio): the fade beat after the soul
        // peak — peaks over the seam gap, releases as the grid settles
        out.bp = clamp01((vh * 1.35 - wr.top) / (vh * 1.1));
        // Project the section's 0.9/1.1 column split and outer gutters into
        // field space. Echoes now reinforce the Where/Who composition.
        const md = Math.min(g.vw, vh);
        out.divX = 0.5 + (wr.left + wr.width * 0.45 - g.vw * 0.5) / md;
        out.edgeL = 0.5 + (wr.left + wr.width * 0.04 - g.vw * 0.5) / md;
        out.edgeR = 0.5 + (wr.right - wr.width * 0.04 - g.vw * 0.5) / md;
        const top = Math.max(wr.top, -vh * 0.08);
        const bottom = Math.min(wr.bottom, vh * 1.08);
        if (bottom > top) {
          out.bodyY = 0.5 - ((top + bottom) * 0.5 - vh * 0.5) / md;
          out.bodyH = Math.max(
            0.16,
            Math.min(((bottom - top) * 0.5) / md, 0.42),
          );
        }
      }
    },

    presence(ctx: SceneCtx) {
      return ctx.ch.on;
    },

    tick(ctx: SceneCtx) {
      onW = clamp01(ctx.ch.on);
      rInW = smooth01(clamp01(ctx.ch.rIn));
      bp = clamp01(ctx.ch.bp);
      divX = ctx.ch.divX;
      bodyY = ctx.ch.bodyY;
      bodyH = ctx.ch.bodyH;
      edgeL = ctx.ch.edgeL;
      edgeR = ctx.ch.edgeR;
      scoreOut.veil = VEIL_ACT * Math.sin(Math.PI * bp);
      // the afterglow settles: quiet frame, a breath under neutral
      scoreOut.vignette = 0.14 * onW;
      scoreOut.exposure = 1 - 0.02 * onW;
    },

    target(i: number, ctx: SceneCtx, out: DropletOut) {
      const t = ctx.t;
      // Slow vertical echoes reinforce the measured column spine and outer
      // gutters. Hidden identities follow the same lanes for a clean handoff.
      const om = (0.028 + 0.03 * hash(i, 85)) * (hash(i, 86) > 0.5 ? 1 : -1);
      const ph = hash(i, 87) * Math.PI * 2;
      const k = (i / 6) | 0;
      const lane = k & 3;
      const a = t * om + ph;
      const onSpine = lane < 2;
      const cx = onSpine
        ? divX + (lane === 0 ? -0.022 : 0.022)
        : lane === 2
          ? edgeL
          : edgeR;
      const ax = onSpine
        ? 0.015 + 0.012 * hash(i, 84)
        : 0.025 + 0.018 * hash(i, 84);
      const ay = bodyH * (onSpine ? 0.55 : 0.34) * (0.75 + 0.25 * hash(i, 89));
      out.x = cx + Math.cos(a) * ax;
      out.y = bodyY + Math.sin(a) * ay;
      out.r = i % 6 === 0 ? (0.0095 + 0.006 * hash(i, 88)) * rInW : 0;
      out.bind = 0.08; // nearly free — the core lets the echoes breathe
      out.cluster = -1;
      out.z = ECHO_Z + 0.14 * hash(i, 90);
    },

    form() {
      return null;
    },

    ambient() {
      return 0.08; // measured echoes stay primary behind the role grid
    },

    activity() {
      return 0; // slow orbits — 30 Hz-safe
    },

    score() {
      return scoreOut;
    },
  };
}
