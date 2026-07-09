/**
 * CONTACT scene (R5-A) — absorbs the S10 contact metaball: the EXACT resting
 * mark, breathing, staged over the `.contact-metaball-stage` box; on submit
 * it "exhales" (the impulse — droplets burst off the mark and sink back over
 * ~1.5 s; additive only, the labeled submit stays canonical). What changed
 * from the standalone canvas: entry now uses the house erosion grammar (the
 * mark grows from its skeleton as the stage approaches) and the 8 s CSS
 * breath (`.sdf-glass-breath`, a canvas-transform we no longer own) becomes
 * form-scale math — same amplitude, same period.
 */

import { CLOUDS, clamp01, smooth01, scatterFor } from "../phys.mjs";
import { formPresence } from "../field-drivers";
import { SDF_WARP_REST } from "../sdf-glass-shader.mjs";
import { DURATIONS } from "../../animation/durations";
import type {
  SceneModule,
  SceneCtx,
  SceneGeom,
  SceneChannels,
  DropletOut,
  FormState,
} from "./types";

/** The exhale trigger event (dispatched by ContactForm on submit). */
export const EXHALE_EVENT = "zirtuno:exhale";

const EXHALE_MS = 1500;

export function makeContactScene(): SceneModule {
  const base = CLOUDS[0];
  const T = scatterFor(0);

  // per-frame factors (tick → target/form)
  let e = 0; // exhale envelope
  let stOx = 0;
  let stOy = 0;
  let stScale = 0.3;
  const formOut: FormState = {
    a: 0,
    b: 0,
    fa: 0,
    fb: 0,
    ea: 0,
    eb: 0,
    ox: 0,
    oy: 0,
    scale: 0.3,
    warp: SDF_WARP_REST,
  };

  return {
    id: "contact",
    forms: [0],
    channels: { on: 0, stOx: 0, stOy: 0, stScale: 0.3, exhaleAt: -1 },
    damp: {
      on: false,
      stOx: false,
      stOy: false,
      stScale: false,
      exhaleAt: false,
    },
    anchors: { stage: ".contact-metaball-stage" },

    read(g: SceneGeom, out: SceneChannels) {
      const vh = g.vh;
      const st = g.rect("stage");
      if (st) {
        const md = Math.min(g.vw, vh);
        out.stOx = (st.left + st.width / 2 - g.vw / 2) / md;
        out.stOy = (vh / 2 - (st.top + st.height / 2)) / md;
        out.stScale = Math.min(st.width, st.height) / md;
        // grip + entry: the mark grows from its skeleton as the stage
        // approaches the viewport (no exit — the page ends here)
        out.on = clamp01((vh * 1.5 - st.top) / (vh * 0.4));
      }
    },

    presence(ctx: SceneCtx) {
      return ctx.ch.on;
    },

    tick(ctx: SceneCtx) {
      const ch = ctx.ch;
      stOx = ch.stOx;
      stOy = ch.stOy;
      stScale = ch.stScale;

      // the exhale: a one-shot pulse (sin π) — additive decoration only
      const at = ch.exhaleAt;
      if (at >= 0 && ctx.tMs >= at && ctx.tMs < at + EXHALE_MS) {
        e = Math.sin(Math.PI * clamp01((ctx.tMs - at) / EXHALE_MS));
      } else {
        e = 0;
      }

      // the 8 s breath (was .sdf-glass-breath: scale 1 → 1.02, ease-in-out)
      const breath =
        1 + 0.01 + 0.01 * Math.sin((ctx.t / (DURATIONS.breath / 1000)) * Math.PI * 2);

      const [w, ero] = formPresence(smooth01(clamp01(ch.on)));
      formOut.fa = w;
      formOut.ea = ero;
      formOut.ox = stOx;
      formOut.oy = stOy;
      formOut.scale = stScale * breath;
      formOut.warp = SDF_WARP_REST + 0.004 * e;
    },

    target(i: number, ctx: SceneCtx, out: DropletOut) {
      // droplets exist only during the exhale — the form is the resting visual
      const b = base[i];
      const s = T[i];
      const lx = b[0] + (s.tx - b[0]) * 0.6 * e;
      const ly = b[1] + (s.ty - b[1]) * 0.6 * e;
      out.x = 0.5 + stOx + (lx - 0.5) * stScale;
      out.y = 0.5 + stOy + (ly - 0.5) * stScale;
      out.r = b[2] * 0.7 * e * stScale;
      out.bind = 0;
      out.cluster = -1;
      out.z = 0;
    },

    form() {
      return formOut;
    },

    ambient() {
      return 0; // the contact stage had no ambient family (parity with pre-R5)
    },
  };
}
