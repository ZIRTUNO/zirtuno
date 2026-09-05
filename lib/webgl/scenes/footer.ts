/**
 * FOOTER scene (R5-D) — the journey's coda. Contact held the gathered resting
 * mark above the form all the way to the page's end (its presence never
 * drained), and this scene agrees with that resting footprint instead of
 * detaching a lone droplet over the footer.
 *
 * S10 was quarantined on 2026-09-04, so `.contact-metaball-stage` no longer
 * exists: the `stage` rect reads null, the offsets keep their defaults, and
 * since every target parks at radius 0 the coda now contributes ONLY its light
 * score. The anchor stays declared — it is null-safe, and restoring the
 * chapter restores the held mark with no edit here.
 *
 * Light: the calm return to black — exposure eases below neutral and a soft
 * vignette closes as the last pixel of the journey arrives.
 */

import { CLOUDS, clamp01, smooth01 } from "../phys.mjs";
import type {
  SceneModule,
  SceneCtx,
  SceneGeom,
  SceneChannels,
  DropletOut,
  LightScore,
} from "./types";

const base = CLOUDS[0];

export function makeFooterScene(): SceneModule {
  // per-frame factors (tick → target/score)
  let p = 0;
  let stOx = 0;
  let stOy = 0;
  let stScale = 0.3;
  const scoreOut: Partial<LightScore> = { exposure: 1, vignette: 0 };

  return {
    id: "footer",
    forms: [], // contact's held mark is the visual — this scene claims nothing
    channels: { on: 0, p: 0, stOx: 0, stOy: 0, stScale: 0.3 },
    damp: { on: false, stOx: false, stOy: false, stScale: false },
    anchors: { wrap: ".footer", stage: ".contact-metaball-stage" },

    read(g: SceneGeom, out: SceneChannels) {
      const vh = g.vh;
      const wr = g.rect("wrap");
      if (wr) {
        out.on = clamp01((vh * 1.7 - wr.bottom) / (vh * 0.22));
        // the closing light score completes at the page's absolute bottom
        out.p = clamp01(1 - (wr.bottom - vh) / (vh * 0.7));
      }
      // the mark's stage (contact's box) — keep the shared resting footprint
      const st = g.rect("stage");
      const md = Math.min(g.vw, vh);
      if (st) {
        out.stOx = (st.left + st.width / 2 - g.vw / 2) / md;
        out.stOy = (vh / 2 - (st.top + st.height / 2)) / md;
        out.stScale = Math.min(st.width, st.height) / md;
      }
    },

    presence(ctx: SceneCtx) {
      return ctx.ch.on;
    },

    tick(ctx: SceneCtx) {
      p = smooth01(clamp01(ctx.ch.p)); // conductor-damped, then eased
      stOx = ctx.ch.stOx;
      stOy = ctx.ch.stOy;
      stScale = ctx.ch.stScale;
      // the calm return to black (§5 act V) — light, not a veil
      scoreOut.exposure = 1 - 0.08 * p;
      scoreOut.vignette = 0.12 * p;
    },

    target(i: number, _ctx: SceneCtx, out: DropletOut) {
      const b = base[i];
      // everyone parks exactly on the held mark's footprint at radius 0 —
      // agreeing with contact's targets so the 50/50 blend stays a fixpoint
      const fx = 0.5 + stOx + (b[0] - 0.5) * stScale;
      const fy = 0.5 + stOy + (b[1] - 0.5) * stScale;
      out.x = fx;
      out.y = fy;
      out.r = 0;
      out.bind = 1;
      out.cluster = -1;
      out.z = 0;
    },

    form() {
      return null;
    },

    ambient() {
      return 0; // parity with contact — the bottom of the page is still
    },

    activity() {
      return 0; // fully scroll-scrubbed — the conductor's stir covers it
    },

    score() {
      return scoreOut;
    },
  };
}
