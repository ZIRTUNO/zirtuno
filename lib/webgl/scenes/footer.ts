/**
 * FOOTER scene (R5-D) — the RELEASE, the journey's coda. Contact holds the
 * gathered resting mark above the form all the way to the page's end (its
 * presence never drains). As the footer bar reveals, ONE droplet — the mark's
 * lowest lobe point, the same lone-drop identity the 404 page carries —
 * detaches and sinks past the footer edge, out of the page. Scroll-scrubbed
 * and symmetric: scrubbing back re-absorbs it.
 *
 * BLEND NOTE: at the page bottom exactly two scenes are active — contact
 * (grip 1, holding every droplet on the mark footprint) and this one — so the
 * conductor's target blend halves whatever this scene asks for. The release
 * targets are therefore authored OVERSHOT (radius ×2, sink ×2.1 past the
 * exit) so the BLENDED droplet reads at true size and truly leaves the stage.
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

// the released identity: the mark's lowest droplet (deterministic — computed
// from the canonical cloud, not hardcoded, so retracing the mark keeps it true)
const base = CLOUDS[0];
let RELEASE_I = 0;
for (let i = 1; i < base.length; i++)
  if (base[i][1] < base[RELEASE_I][1]) RELEASE_I = i;

export function makeFooterScene(): SceneModule {
  // per-frame factors (tick → target/score)
  let p = 0;
  let stOx = 0;
  let stOy = 0;
  let stScale = 0.3;
  let exitOx = 0;
  const scoreOut: Partial<LightScore> = { exposure: 1, vignette: 0 };

  return {
    id: "footer",
    forms: [], // contact's held mark is the visual — this scene claims nothing
    channels: { on: 0, p: 0, stOx: 0, stOy: 0, stScale: 0.3, exitOx: 0 },
    damp: { on: false, stOx: false, stOy: false, stScale: false, exitOx: false },
    anchors: { wrap: ".footer", stage: ".contact-metaball-stage" },

    read(g: SceneGeom, out: SceneChannels) {
      const vh = g.vh;
      const wr = g.rect("wrap");
      if (wr) {
        // BOTH windows read the footer's bottom edge so their order is
        // guaranteed: grip is FULL (0.22 vh ramp) before the detach window
        // opens at p ≈ 0.32 — the released droplet never pops in mid-fall.
        out.on = clamp01((vh * 1.7 - wr.bottom) / (vh * 0.22));
        // the release: completes exactly at the page's absolute bottom
        out.p = clamp01(1 - (wr.bottom - vh) / (vh * 0.7));
      }
      // the mark's stage (contact's box) — the droplet detaches FROM it
      const st = g.rect("stage");
      const md = Math.min(g.vw, vh);
      if (st) {
        out.stOx = (st.left + st.width / 2 - g.vw / 2) / md;
        out.stOy = (vh / 2 - (st.top + st.height / 2)) / md;
        out.stScale = Math.min(st.width, st.height) / md;
      }
      // The fall LEANS to the page's outer margin instead of dropping down the
      // middle. Straight down put a bright droplet across the footer's locale
      // control at narrow widths (Z-AUD-011); the outer margin is empty at every
      // width, and a departure that drifts as it sinks reads better than a plumb
      // line. 14% of the viewport, expressed in the same stage units as stOx.
      out.exitOx = (g.vw * 0.14 - g.vw / 2) / md;
    },

    presence(ctx: SceneCtx) {
      return ctx.ch.on;
    },

    tick(ctx: SceneCtx) {
      p = smooth01(clamp01(ctx.ch.p)); // conductor-damped, then eased
      stOx = ctx.ch.stOx;
      stOy = ctx.ch.stOy;
      stScale = ctx.ch.stScale;
      exitOx = ctx.ch.exitOx;
      // the calm return to black (§5 act V) — light, not a veil
      scoreOut.exposure = 1 - 0.08 * p;
      scoreOut.vignette = 0.12 * p;
    },

    target(i: number, ctx: SceneCtx, out: DropletOut) {
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
      if (i !== RELEASE_I) return;

      // the one that leaves: separates as the footer reveals, wanders a
      // touch, and sinks past the canvas edge. All values overshot ×~2 (see
      // the blend note): contact's half of the blend pins the other side.
      const sep = smooth01((p - 0.32) / 0.25); // detach — after full grip
      const sink = smooth01((p - 0.4) / 0.6); // the long fall
      const exitX = 0.5 + exitOx; // the outer margin, clear of the footer bar
      // 1.6, not the 2.1 the vertical fall uses: the lean only has to clear the
      // footer bar, so it stays on-stage even if the blend is not exactly 50/50
      out.x =
        fx + (exitX - fx) * sink * 1.6 + Math.sin(ctx.t * 0.6 + 2.1) * 0.03 * sink;
      out.y = fy + (-0.14 - fy) * sink * 2.1;
      out.r = 0.027 * sep;
      out.bind = 0.2; // mostly free — the core gives the fall its wobble
      out.z = 0.1; // near — the protagonist of the coda
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
