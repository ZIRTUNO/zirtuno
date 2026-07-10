/**
 * WORK scene (R5-D) — the CURRENT. Método's evolution satellites (the same
 * i % 3 === 0 identities) become a quiet gyre that swims BEHIND the honest
 * work grid: slow, varied elliptical drift at sub-surface depth, fully alive
 * under the fluid core (low bind — curl and repulsion do the swimming). The
 * liquid is a presenter here, never a replacement for the cards (§4.9).
 *
 * The meniscus: hovering a project card docks five fixed current droplets
 * along the card's bottom edge — a surface-tension line that climbs at the
 * corners — then releases them back into the gyre. The shell (PageStage)
 * writes the hovered card index into the raw `hov` channel; geometry comes
 * from the measured card rects, and the damped `mOn`/`hx/hy/hw` channels make
 * dock, undock and card-to-card glides continuous.
 *
 * Light: this scene owns act boundary III — the first fade-to-black beat,
 * scrubbed across the Método → Work seam (`bp`), capped at 0.4 so body copy
 * under the transient peak keeps ≥ 4:1 contrast.
 */

import { clamp01, smooth01, hash } from "../phys.mjs";
import type {
  SceneModule,
  SceneCtx,
  SceneGeom,
  SceneChannels,
  DropletOut,
  LightScore,
} from "./types";

/** Act-boundary veil ceiling (AA-audited — see the contrast note above). */
export const VEIL_ACT = 0.4;
/** Sub-surface depth of the current (the ambient family sits at 0.62). */
const CURRENT_Z = 0.55;
/** The five meniscus identities: the first five of the current family. */
const MENISCUS_N = 5;

export function makeWorkScene(): SceneModule {
  // per-frame factors (tick → target/score)
  let rInW = 0;
  let bp = 0;
  let mOn = 0;
  let hx = 0.5;
  let hy = 0.5;
  let hw = 0.1;
  const scoreOut: Partial<LightScore> = { veil: 0 };

  return {
    id: "work",
    forms: [], // the current claims no form — droplet-only scene
    channels: {
      on: 0,
      rIn: 0,
      bp: 0,
      hov: -1,
      mOn: 0,
      hx: 0.5,
      hy: 0.42,
      hw: 0.1,
    },
    // scroll envelopes and the shell-written selection are raw; the meniscus
    // geometry + gate ride the default tau so dock/undock/card-glide flow
    damp: { on: false, rIn: false, bp: false, hov: false },
    anchors: { wrap: "#work" },
    lists: { cards: "#work .project-card" },

    read(g: SceneGeom, out: SceneChannels) {
      const vh = g.vh;
      const wr = g.rect("wrap");
      if (wr) {
        // grip: rises before the section enters, releases after it leaves
        // (the house window — same shape as método/origin)
        out.on =
          clamp01((vh * 1.9 - wr.top) / (vh * 0.5)) *
          clamp01((wr.bottom + vh * 0.3) / (vh * 0.5));
        // entry: the current materialises as the grid approaches the fold
        out.rIn = clamp01((vh * 1.15 - wr.top) / (vh * 0.35));
        // act boundary III (Método → Work): sin(π·bp) peaks while the seam
        // gap is centred — método's stage has already drained, the grid
        // headline is only entering — and fully releases as the grid settles
        out.bp = clamp01((vh * 1.35 - wr.top) / (vh * 1.1));
      }
      // the meniscus: hovered card geometry in field uv (bottom edge). `hov`
      // is written by the shell's delegated pointer handlers; -1 keeps the
      // last geometry so the release glides instead of snapping.
      const cards = g.list("cards");
      const hi = out.hov | 0;
      out.mOn = hi >= 0 && hi < cards.length ? 1 : 0;
      if (hi >= 0 && hi < cards.length) {
        const r = cards[hi];
        const md = Math.min(g.vw, vh);
        out.hx = 0.5 + (r.left + r.width / 2 - g.vw / 2) / md;
        out.hy = 0.5 - (r.bottom - vh / 2) / md;
        out.hw = Math.min((r.width * 0.5) / md, 0.17);
      }
    },

    presence(ctx: SceneCtx) {
      return ctx.ch.on;
    },

    tick(ctx: SceneCtx) {
      rInW = smooth01(clamp01(ctx.ch.rIn));
      bp = clamp01(ctx.ch.bp);
      mOn = smooth01(clamp01(ctx.ch.mOn));
      hx = ctx.ch.hx;
      hy = ctx.ch.hy;
      hw = ctx.ch.hw;
      scoreOut.veil = VEIL_ACT * Math.sin(Math.PI * bp);
    },

    target(i: number, ctx: SceneCtx, out: DropletOut) {
      const t = ctx.t;
      const aspect = ctx.aspect;
      // the gyre: one shared slow rotation, but every droplet on its own
      // ellipse (radius, flatness, speed, phase) — shear between the lanes
      // is what reads as a current instead of a carousel
      const spanX = Math.max(aspect - 0.25, 0.55) * 0.5;
      const ax = (0.3 + 0.55 * hash(i, 90)) * spanX;
      const ay = 0.055 + 0.075 * hash(i, 91);
      const om = 0.045 + 0.05 * hash(i, 92);
      const ph = hash(i, 93) * Math.PI * 2;
      const cy = 0.4 + 0.1 * hash(i, 96);
      let x = 0.5 + Math.cos(t * om + ph) * ax;
      let y = cy + Math.sin(t * om + ph) * ay + 0.02 * Math.sin(t * 0.21 + i);
      const inCurrent = i % 3 === 0;
      let r = inCurrent
        ? (0.011 + 0.008 * hash(i, 95)) * rInW
        : 0; // the rest of the family rides the paths invisibly (handoff mass)
      let bind = 0.12; // free liquid — the fluid core swims it
      let z = CURRENT_Z;

      // the meniscus: five fixed identities dock along the hovered card's
      // bottom edge — centre fuller, corners climbing (surface tension)
      const k = i / 3;
      if (inCurrent && k < MENISCUS_N && mOn > 0.003) {
        const off = (k - (MENISCUS_N - 1) / 2) / ((MENISCUS_N - 1) / 2); // -1..1
        const mx = hx + off * hw * 0.85;
        const my = hy + 0.01 * Math.abs(off) - 0.003;
        const mr = 0.0105 + 0.0035 * (1 - Math.abs(off));
        x += (mx - x) * mOn;
        y += (my - y) * mOn;
        r = r * (1 - mOn) + mr * mOn * rInW;
        bind += (0.4 - bind) * mOn; // held enough to hold the line, still liquid
        z += (0.2 - z) * mOn; // the docked liquid comes toward the surface
      }

      out.x = x;
      out.y = y;
      out.r = r;
      out.bind = bind;
      out.cluster = -1;
      out.z = z;
    },

    form() {
      return null; // droplet-only — the arbiter never grants slots here
    },

    ambient() {
      // a whisper of atmosphere behind the grid; the current is the show
      return 0.25;
    },

    activity() {
      // the gyre is slow and the meniscus rides input events (which already
      // hold the governor awake) — 30 Hz-safe at rest
      return 0;
    },

    score() {
      return scoreOut;
    },
  };
}
