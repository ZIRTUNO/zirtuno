/**
 * STREAM scene (R6) — the OVERTURE.
 *
 * The site opens on a horizontal liquid stream running the width of the Hero:
 * the same canonical 48 droplets, laid along a travelling wave and merged by
 * the iso-surface into one continuous flowing band.
 *
 * This scene remains an experimental conductor-native version of the lab
 * stream. Production currently uses HeroRibbon directly.
 */

import { CLOUDS, clamp01, smooth01, hash, VARY } from "../phys.mjs";
import type {
  SceneModule,
  SceneCtx,
  SceneGeom,
  SceneChannels,
  DropletOut,
  LightScore,
} from "./types";

const base = CLOUDS[0];
const N = base.length;

let SEED_I = 0;
for (let i = 1; i < N; i++) if (base[i][1] > base[SEED_I][1]) SEED_I = i;

const BAND_Y = 0.125;
const BAND_AMP = 0.038;
const BAND_R = 0.019;
const BAND_LANE = 0.011;
const RELEASE_AT = 0.16;
const RELEASE_SPAN = 0.3;

export function makeStreamScene(): SceneModule {
  let p = 0;
  let on = 0;
  let vw = 1;
  let markOx = 0;
  let markOy = 0;
  let markScale = 0.5;
  const scoreOut: Partial<LightScore> = { exposure: 1, key: 0 };

  return {
    id: "stream",
    forms: [],
    channels: { on: 1, p: 0, mOx: 0, mOy: 0, mScale: 0.5 },
    damp: { on: false, mOx: false, mOy: false, mScale: false },
    anchors: { hero: "#hero", stage: "#hero .metaball-stage" },

    read(g: SceneGeom, out: SceneChannels) {
      const hr = g.rect("hero");
      if (hr) {
        out.p = clamp01(-hr.top / (hr.height * 0.72));
        out.on = 1 - smooth01(clamp01((out.p - 0.3) / 0.22));
      }
      const st = g.rect("stage");
      if (st) {
        const md = Math.min(g.vw, g.vh);
        out.mOx = (st.left + st.width / 2 - g.vw / 2) / md;
        out.mOy = (g.vh / 2 - (st.top + st.height / 2)) / md;
        out.mScale = Math.min(st.width, st.height) / md;
      }
    },

    presence(ctx: SceneCtx) {
      return ctx.ch.on;
    },

    tick(ctx: SceneCtx) {
      p = clamp01(ctx.ch.p);
      on = ctx.ch.on;
      vw = Math.max(ctx.aspect, 0.5);
      markOx = ctx.ch.mOx;
      markOy = ctx.ch.mOy;
      markScale = ctx.ch.mScale;
      scoreOut.exposure = 1 - 0.05 * on;
      scoreOut.key = 0.18 * (1 - on);
    },

    target(i: number, ctx: SceneCtx, out: DropletOut) {
      const t = ctx.t;
      const b = base[i];
      const u = (i + 0.5) / N;
      const drift = (t * 0.055 + u) % 1;
      const x = 0.5 + (drift - 0.5) * (vw + 0.35);
      const lane = (hash(i, 71) - 0.5) * BAND_LANE;
      const wave =
        Math.sin(drift * 7.4 + t * 0.5) * 0.6 +
        Math.sin(drift * 13.1 - t * 0.35) * 0.4;
      const bandY = BAND_Y + lane + BAND_AMP * wave;
      const bandR = BAND_R * (0.82 + 0.36 * VARY[i]) * (0.55 + 0.45 * on);

      const fx = 0.5 + markOx + (b[0] - 0.5) * markScale;
      const fy = 0.5 + markOy + (b[1] - 0.5) * markScale;
      const g = smooth01((p - 0.16 - 0.14 * u) / 0.26);

      let dx = bandX(x, fx, g);
      let dy = bandY + (fy - bandY) * g;
      let dr = bandR + (b[2] * markScale - bandR) * g;

      if (i === SEED_I) {
        const rel = smooth01((p - RELEASE_AT) / RELEASE_SPAN);
        const detach = smooth01((p - RELEASE_AT) / 0.09);
        const fall = rel * rel;
        const arcX = x + (fx - x) * smooth01((rel - 0.25) / 0.75);
        const arcY = bandY - 0.26 * fall + (fy - (bandY - 0.26)) * rel * rel;
        dx = x + (arcX - x) * detach;
        dy = bandY + (arcY - bandY) * detach;
        dr =
          bandR * (1 - 0.45 * detach) +
          (b[2] * markScale - bandR * 0.55) * smooth01((rel - 0.55) / 0.45);
        out.x = dx;
        out.y = dy;
        out.r = dr;
        out.bind = 0.15;
        out.cluster = -1;
        out.z = 0.05;
        return;
      }

      out.x = dx;
      out.y = dy;
      out.r = dr;
      out.bind = g;
      out.cluster = g < 0.6 ? 0 : -1;
      out.z = 0.35 + 0.4 * hash(i, 72);
    },

    form() {
      return null;
    },

    ambient() {
      return 0.35;
    },

    activity(ctx: SceneCtx) {
      return ctx.ch.on > 0.02 ? 1 : 0;
    },

    score() {
      return scoreOut;
    },
  };
}

function bandX(x: number, fx: number, g: number): number {
  return x + (fx - x) * g;
}
