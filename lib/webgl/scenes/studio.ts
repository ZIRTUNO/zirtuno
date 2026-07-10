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
  const scoreOut: Partial<LightScore> = { veil: 0, vignette: 0, exposure: 1 };

  return {
    id: "studio",
    forms: [], // droplet-only scene — never claims the slots
    channels: { on: 0, rIn: 0, bp: 0 },
    damp: { on: false, rIn: false, bp: false },
    anchors: { wrap: "#studio" },

    read(g: SceneGeom, out: SceneChannels) {
      const vh = g.vh;
      const wr = g.rect("wrap");
      if (wr) {
        out.on =
          clamp01((vh * 1.9 - wr.top) / (vh * 0.5)) *
          clamp01((wr.bottom + vh * 0.3) / (vh * 0.5));
        out.rIn = clamp01((vh * 1.15 - wr.top) / (vh * 0.35));
        // act boundary IV (Origin → Studio): the fade beat after the soul
        // peak — peaks over the seam gap, releases as the grid settles
        out.bp = clamp01((vh * 1.35 - wr.top) / (vh * 1.1));
      }
    },

    presence(ctx: SceneCtx) {
      return ctx.ch.on;
    },

    tick(ctx: SceneCtx) {
      onW = clamp01(ctx.ch.on);
      rInW = smooth01(clamp01(ctx.ch.rIn));
      bp = clamp01(ctx.ch.bp);
      scoreOut.veil = VEIL_ACT * Math.sin(Math.PI * bp);
      // the afterglow settles: quiet frame, a breath under neutral
      scoreOut.vignette = 0.14 * onW;
      scoreOut.exposure = 1 - 0.02 * onW;
    },

    target(i: number, ctx: SceneCtx, out: DropletOut) {
      const t = ctx.t;
      const aspect = ctx.aspect;
      const sx = Math.min(Math.max(aspect * 0.8, 1), 1.45);
      // wide, slow, individual orbits around the stage — the echo family
      // (i % 6 === 0) carries the visible mass; everyone else rides the same
      // paths invisibly so the next handoff starts from coherent positions
      const orr = 0.2 + 0.19 * hash(i, 84);
      const om = (0.028 + 0.03 * hash(i, 85)) * (hash(i, 86) > 0.5 ? 1 : -1);
      const ph = hash(i, 87) * Math.PI * 2;
      out.x = 0.5 + Math.cos(t * om + ph) * orr * sx;
      out.y = 0.52 + Math.sin(t * om + ph) * orr * 0.72;
      out.r = i % 6 === 0 ? (0.0095 + 0.006 * hash(i, 88)) * rInW : 0;
      out.bind = 0.08; // nearly free — the core lets the echoes breathe
      out.cluster = -1;
      out.z = ECHO_Z;
    },

    form() {
      return null;
    },

    ambient() {
      return 0.3; // quiet atmosphere returns behind the roles grid
    },

    activity() {
      return 0; // slow orbits — 30 Hz-safe
    },

    score() {
      return scoreOut;
    },
  };
}
