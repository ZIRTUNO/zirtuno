/** S7 — a field of force becomes direction, then identity.
 * GSAP scores p in PageStage. The conductor owns every body's state. */
import { clamp01, smooth01 } from "../phys.mjs";
import { fbm1 } from "../noise.mjs";
import { formPresence } from "../melt.mjs";
import { makeOriginField, ORIGIN_SCALE, ORIGIN_OY } from "../origin-field.mjs";
import { SDF_WARP_REST, SDF_MELT_ERODE } from "../sdf-glass-shader.mjs";
import type { SceneModule, FormState, LightScore } from "./types";

export function makeOriginScene(force = true): SceneModule {
  const field = makeOriginField();
  const f = field.state;
  const form: FormState = {
    a: 0, b: 0, fa: 0, fb: 0, ea: 0, eb: 0,
    ox: 0, oy: ORIGIN_OY, scale: ORIGIN_SCALE, warp: SDF_WARP_REST,
  };
  const score: Partial<LightScore> = { key: 0, vignette: 0, exposure: 1 };
  return {
    id: "origin", forms: [0],
    channels: { p: 0, on: 0, scored: 0, gather: 0, seal: 0, release: 0, focus: 0, capture: 0, ignite: 0 },
    damp: { p: false, on: false, scored: false, gather: false, seal: false, release: false, focus: false, capture: false, ignite: false },
    anchors: { wrap: "#name .origin-journey" },
    read(g, out) {
      const r = g.rect("wrap");
      if (!r) return;
      // Geometry remains usable in diagnostics. GSAP replaces p on the live
      // path, after the shared read phase, before either consumer sees it.
      out.p = clamp01(-r.top / Math.max(r.height - g.vh, 1));
      out.on = clamp01((g.vh * 1.5 - r.top) / (g.vh * 0.7)) *
        clamp01((r.bottom + g.vh * 0.65) / (g.vh * 0.8));
    },
    presence: (ctx) => ctx.ch.on,
    tick(ctx) {
      field.tick(ctx.ch.p, ctx.aspect, ctx.t, ctx.ch.scored ? ctx.ch : null);
      if (!force) f.gain = 0;
      const appear = smooth01((f.p - 0.54) / 0.10);
      const [weight, erosion] = formPresence(appear);
      const leave = smooth01((f.p - 0.82) / 0.16);
      form.fa = weight * (1 - leave);
      form.ea = erosion + leave * SDF_MELT_ERODE;
      form.ox = f.shift;
      form.oy = ORIGIN_OY * f.viewH;
      form.scale = f.scale;
      score.key = 0.28 * f.gather * (1 - 0.65 * f.release);
      score.vignette = 0.08 * f.gather * (1 - f.seal);
      score.exposure = 1 + 0.025 * f.seal * (1 - f.release);
    },
    target(i, ctx, out) {
      field.target(i, ctx.t, out);
      if (!ctx.physics) {
        const free = 1 - out.bind;
        out.x += fbm1(ctx.t * 0.4, i * 2) * 0.012 * free;
        out.y += fbm1(ctx.t * 0.4, i * 2 + 1) * 0.012 * free;
      }
    },
    population(i, ctx, out) { field.target(i, ctx.t, out); },
    dynamics() { return f; },
    form: () => form,
    ambient: () => 0,
    activity: () => 0.15 + 0.17 * (1 - f.seal),
    score: () => score,
  };
}
