/**
 * WORK scene (R5-D) — the CURRENT. The cells Método's circuit puts out at
 * Evolution (the same i % 3 === 0 identities) become a quiet gyre that swims BEHIND the honest
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
  let gx = 0.5;
  let gy = 0.46;
  let gw = 0.42;
  let gh = 0.26;
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
      gx: 0.5,
      gy: 0.46,
      gw: 0.42,
      gh: 0.26,
    },
    // scroll envelopes and the shell-written selection are raw; the meniscus
    // geometry + gate ride the default tau so dock/undock/card-glide flow
    damp: { on: false, rIn: false, bp: false, hov: false },
    anchors: { wrap: "#work" },
    lists: { cards: "#work .zw-card" },

    read(g: SceneGeom, out: SceneChannels) {
      const vh = g.vh;
      const wr = g.rect("wrap");
      if (wr) {
        // GRIP — and, like método's, it is not free. The house window (1.9vh)
        // assumes a section whose predecessor has already gone; Método's does
        // not go. Its runway still hangs 0.9vh below the fold when Evolution
        // is centred, so a grip that was full by then put the two scenes at
        // half weight each over Método's closing phase — and the conductor
        // averages droplet POSITIONS by weight, so Evolution's ring was being
        // pulled half-way onto the work lanes before it had been seen.
        //
        // So this rises where Método's material actually leaves. #work's top
        // trails the runway's bottom by a fixed ~0.2vh, which makes this the
        // same clock as método's drain, one constant apart: the two describe
        // ONE handoff and their weights only ever sum to about one.
        out.on =
          clamp01((vh * 0.95 - wr.top) / (vh * 0.5)) *
          clamp01((wr.bottom + vh * 0.3) / (vh * 0.5));
        // entry: the current materialises with the grip that carries it
        out.rIn = clamp01((vh * 0.85 - wr.top) / (vh * 0.35));
        // act boundary III (Método → Work): sin(π·bp) peaks while the seam
        // gap is centred — método's stage has drained, the grid headline is
        // only entering — and fully releases as the grid settles. It used to
        // peak at wr.top ~ 0.8vh, which is INSIDE Método's last phase: a ~26%
        // black wash sat over "Evolução" while it was the subject, on top of
        // the drained stage. The band now opens after Evolution is read.
        // The span is the gap itself, not a viewport-and-a-bit: a 1.2vh window
        // from 0.9 still had 16% of veil standing at the "mid-work grid"
        // reading rest, because an EMPTY portfolio makes #work short and that
        // rest lands only 0.14vh above the section's own top.
        out.bp = clamp01((vh * 0.9 - wr.top) / (vh * 0.9));
      }
      // the meniscus: hovered card geometry in field uv (bottom edge). `hov`
      // is written by the shell's delegated pointer handlers; -1 keeps the
      // last geometry so the release glides instead of snapping.
      const cards = g.list("cards");
      // Fit the current to the visible card grid. Its lanes then occupy the
      // grid gutters instead of orbiting an unrelated stage centre.
      let minL = g.vw;
      let maxR = 0;
      let minT = vh;
      let maxB = 0;
      let visible = 0;
      for (let i = 0; i < cards.length; i++) {
        const r = cards[i];
        if (r.bottom < -vh * 0.08 || r.top > vh * 1.08) continue;
        minL = Math.min(minL, Math.max(r.left, 0));
        maxR = Math.max(maxR, Math.min(r.right, g.vw));
        minT = Math.min(minT, Math.max(r.top, -vh * 0.08));
        maxB = Math.max(maxB, Math.min(r.bottom, vh * 1.08));
        visible++;
      }
      if (visible > 0) {
        const md = Math.min(g.vw, vh);
        out.gx = 0.5 + ((minL + maxR) * 0.5 - g.vw * 0.5) / md;
        out.gy = 0.5 - ((minT + maxB) * 0.5 - vh * 0.5) / md;
        out.gw = Math.max(0.12, Math.min(((maxR - minL) * 0.5) / md, 0.72));
        out.gh = Math.max(0.1, Math.min(((maxB - minT) * 0.5) / md, 0.34));
      } else {
        // The truthful empty state is copy-led. Keep its current in the open
        // right field on wide screens; mobile retains a centered live trace.
        const wide = g.vw / vh >= 1.2;
        out.gx = wide ? 0.87 : 0.5;
        out.gy = 0.45;
        out.gw = wide ? 0.18 : 0.2;
        out.gh = 0.25;
      }
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
      gx = ctx.ch.gx;
      gy = ctx.ch.gy;
      gw = ctx.ch.gw;
      gh = ctx.ch.gh;
      scoreOut.veil = VEIL_ACT * Math.sin(Math.PI * bp);
    },

    target(i: number, ctx: SceneCtx, out: DropletOut) {
      const t = ctx.t;
      const om = 0.045 + 0.05 * hash(i, 92);
      const ph = hash(i, 93) * Math.PI * 2;
      const inCurrent = i % 3 === 0;
      const k = (i / 3) | 0;
      const lane = k & 3;
      const a = t * om + ph;
      const lanePad = 0.014 + 0.008 * hash(i, 94);
      let x: number;
      let y: number;
      // Four lanes trace the measured grid perimeter. The fluid core supplies
      // the organic micro-motion; the scene supplies architectural direction.
      if (lane < 2) {
        const side = lane === 0 ? -1 : 1;
        x = gx + side * (gw + lanePad);
        y = gy + Math.sin(a) * gh * (0.72 + 0.28 * hash(i, 96));
      } else {
        const side = lane === 2 ? -1 : 1;
        x = gx + Math.cos(a) * gw * (0.76 + 0.24 * hash(i, 96));
        y = gy + side * (gh + lanePad);
      }
      let r = inCurrent ? (0.011 + 0.008 * hash(i, 95)) * rInW : 0; // the rest of the family rides the paths invisibly (handoff mass)
      let bind = 0.12; // free liquid — the fluid core swims it
      let z = CURRENT_Z + 0.12 * hash(i, 97);

      // the meniscus: five fixed identities dock along the hovered card's
      // bottom edge — centre fuller, corners climbing (surface tension)
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
      // Keep the conductor atmosphere subordinate to the measured lanes.
      return 0.08;
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
