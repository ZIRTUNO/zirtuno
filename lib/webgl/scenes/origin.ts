/**
 * ORIGIN scene (R7) — THE CONVERGENCE.
 *
 * S7 is the site's emotional peak and its thesis in one motion: form given to
 * what was dispersed. The chapter opens with the liquid letting go — the Work
 * current's cells drift apart into a field of small beads across the whole
 * stage, and the liquid BOILS OFF into vapour (THE MIST, lib/webgl/mist.mjs):
 * tens of thousands of micro-droplets, the finest scale of the one material,
 * filling the viewport while the headline names two ideas. Then the field is
 * drawn back in, on the runway's p:
 *
 *   ideas     two poles. Zéfiro (the force) draws vapour on the left, Ventura
 *             (the direction) on the right; the beads gather to each and the
 *             bodies CONDENSE — mass arriving out of the field, not sliding in
 *             from off-stage.
 *   tension   the centre — the point of contact — begins to pull. Everything
 *             falls inward: the two bodies close on the meeting, the vapour
 *             streams past them toward the same point, and what reaches a
 *             body is taken up as its skin.
 *   mark      the two fuse into exactness: bind → 1, the exact mark grows from
 *             its skeleton, and the skin rides the mark's own outline — the
 *             mark, made of what it collected.
 *   purpose   on a wide stage the mark yields the right half to the thesis,
 *             and BREATHES OUT: the skin is released as vapour streaming away
 *             along the current, turning aside from the type — from two ideas
 *             to one ecosystem. A few droplets bud off as seeds.
 *   resolve   the mark erodes and its droplets sink into the vapour, and the
 *             whole field is drawn onto the letters of the name — the same
 *             vapour that made the mark spells ZIRTUNO, then hands the letters
 *             to type. Two ideas, one name.
 *
 * The scene owns none of the vapour's physics. It emits the DIALS (a
 * `MistDials` block through the `mist` hook — pure functions of p from the
 * score, lib/webgl/origin-score.mjs) and the hosts' SKIN radii; the conductor
 * carries the block to the renderer with the hosts' displayed positions and
 * the same hand/strike/scroll the droplets read; FieldStage integrates it on
 * the GPU. Scroll changes the REGIME; the system is alive between scroll
 * events on its own clock — which is the whole reason the drawing's arrows
 * are not tweens.
 *
 * The droplets' choreography keeps the signed-off grammar underneath: side
 * clusters with cohesion, the staggered fusion onto the mark's footprint,
 * bind → 1 at exactness, the erosion-based emergence, the density-based drain.
 * Entry visibility is positional and dimensional (the dispersed beads are
 * small and free), so no entry envelope is needed.
 */

import {
  CLOUDS,
  clamp01,
  smooth01,
  hash,
  PHYS,
  VARY,
  wideScatter,
} from "../phys.mjs";
import { formPresence } from "../field-drivers";
import {
  SDF_WARP_REST,
  SDF_WARP_MORPH,
  SDF_MELT_ERODE,
} from "../sdf-glass-shader.mjs";
import { makeOriginEnvelopes } from "../origin-score.mjs";
import { makeMistDials } from "../mist.mjs";
import type { MistDials } from "../mist.mjs";
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

/** The two ideas' poles: ± this from centre (× the stage's width factor), a
 *  little above the meeting line. Far enough apart to read as two weathers,
 *  near enough that both stay clear of the bleed on a narrow stage. */
const POLE_X = 0.27;
const POLE_Y = 0.05;
/** The meeting: the two loose bodies about to touch (± from centre). */
const MEET_X = 0.105;
/** Dispersed beads are this share of a droplet's full radius. */
const BEAD = 0.42;

type OriginTarget = {
  dx: number; // the dispersed field (the entrance)
  dy: number;
  pox: number; // offset inside the idea's body (pole and meeting alike)
  poy: number;
  ox: number; // the echo's orbit
  oy: number;
};

export function makeOriginScene(): SceneModule {
  const base = CLOUDS[0];
  let cachedAspect = -1;
  let T: OriginTarget[] = [];
  const E = makeOriginEnvelopes();
  const dials: MistDials = makeMistDials();

  // per-frame factors (tick → target/form/score/mist)
  let p = 0;
  let purposeShift = 0;
  let sx = 1;
  let poleAx = 0.5 - POLE_X;
  let poleAy = 0.5 + ORIGIN_OY + POLE_Y;
  let poleBx = 0.5 + POLE_X;
  let poleBy = poleAy;
  let formOn = 0;
  const scoreOut: Partial<LightScore> = {
    key: 0,
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
    channels: {
      p: 0,
      on: 0,
      lead: 0,
      floor: 0,
      wx: 0.5,
      wy: 0.5,
      ww: 0.1,
      wh: 0.03,
      wOn: 0,
    },
    // The wordmark's box moves with the page every frame; damping it would
    // leave the letters chasing their own type. The band's floor is a rect
    // edge too, but it moves in steps as bands pin and unpin, so it takes the
    // default tau and the wall glides rather than jumps.
    damp: { on: false, lead: false, wx: false, wy: false, ww: false, wh: false, wOn: false },
    anchors: {
      wrap: "#name .origin-journey",
      word: "#name .origin-wordmark-glyphs",
    },
    lists: { copy: "#name .origin-copy" },

    read(g: SceneGeom, out: SceneChannels) {
      const vh = g.vh;
      const md = Math.min(g.vw, vh);
      const wr = g.rect("wrap");
      if (wr) {
        out.p = clamp01(-wr.top / Math.max(wr.height - vh, 1));
        // THE HANDOFF (R7-B). Origin's grip used to be full at wr.top = 1.4vh
        // — the house window, which assumes the previous chapter has already
        // gone. Work's has not: it drains as ITS runway's foot leaves, and the
        // opening block holds that foot a fixed 1.0vh above this rect, so Work
        // was still at 1.000 when this reached 1.000 and the two scenes stood
        // at full presence together (scripts/probe/origin-approach.mjs). The
        // conductor weights droplet POSITIONS, so a summed weight of two is
        // not a crossfade — it is both chapters' material averaged on one
        // stage, which is exactly what made S7 arrive rather than begin.
        //
        // This now rises across Work's drain, one clock, one constant apart —
        // the same argument work.ts makes about método, one chapter along.
        out.on =
          clamp01((vh * 1.35 - wr.top) / (vh * 0.6)) *
          clamp01((wr.bottom + vh * 0.3) / (vh * 0.5));
        // THE APPROACH — the chapter's opening block scrolls by BEFORE the
        // runway's p starts, and the liquid boils off across it. Nearly twice
        // the travel it had (1.55vh against 0.85), and it now finishes just
        // INSIDE the runway rather than a full viewport before it, so the
        // field is still arriving when the first band pins.
        //
        // It opens a little ahead of the grip on purpose: `dials.on` gates the
        // vapour on `on` as well, so nothing is drawn until the scene has
        // presence, and the two then rise together instead of the boil having
        // to catch up from zero the moment the stage is handed over.
        out.lead = clamp01((vh * 1.45 - wr.top) / (vh * 1.55));
      }
      // The type band's top, as the vapour's floor: the highest edge of any
      // copy block on screen. Bands pin one at a time at the viewport foot, so
      // this is the top of the pinned band (or of the one arriving). A block
      // narrower than half the stage — the purpose statement, set to one side
      // on a wide stage — is a surface the vapour flows AROUND (it is an
      // obstacle, read live by PageStage), not a floor the whole field must
      // stay above.
      const copies = g.list("copy");
      let top = vh * 2;
      for (let i = 0; i < copies.length; i++) {
        const r = copies[i];
        if (r.height < 2 || r.top > vh * 1.02 || r.bottom < 0) continue;
        if (r.width < g.vw * 0.5) continue;
        if (r.top < top) top = r.top;
      }
      out.floor = top < vh * 1.5 ? 0.5 - (top - vh / 2) / md : -1;
      // The wordmark's glyph box, for the spelling.
      const w = g.rect("word");
      if (w && w.width > 2 && w.height > 2) {
        out.wx = 0.5 + (w.left + w.width / 2 - g.vw / 2) / md;
        out.wy = 0.5 - (w.top + w.height / 2 - vh / 2) / md;
        out.ww = w.width / 2 / md;
        out.wh = w.height / 2 / md;
        out.wOn = 1;
      } else {
        out.wOn = 0;
      }
    },

    presence(ctx: SceneCtx) {
      return ctx.ch.on;
    },

    tick(ctx: SceneCtx) {
      const aspect = ctx.aspect;
      if (Math.abs(aspect - cachedAspect) > 0.02) {
        cachedAspect = aspect;
        sx = Math.min(Math.max(aspect * 0.8, 1), 1.45);
        // The dispersed field: the shared scatter vocabulary (the Problem's
        // fracture used it first — the rhyme is deliberate: what the Problem
        // showed dispersed, the Origin gives form). Wide, centred, full bleed.
        const disp = wideScatter(aspect, 0.5, 0.5 + ORIGIN_OY, 1.0);
        T = base.map((_, i) => {
          const ma = hash(i, 54) * Math.PI * 2;
          const md = 0.03 + 0.09 * hash(i, 55);
          const oa = hash(i, 56) * Math.PI * 2;
          const orr = 0.22 + 0.11 * hash(i, 57);
          return {
            dx: disp[i].tx,
            dy: disp[i].ty,
            pox: Math.cos(ma) * md * 0.9,
            poy: Math.sin(ma) * md,
            ox: 0.5 + Math.cos(oa) * orr * sx,
            oy: 0.5 + ORIGIN_OY + Math.sin(oa) * orr,
          };
        });
      }
      p = clamp01(ctx.ch.p); // conductor-damped
      const wideStage = smooth01((aspect - 1.03) / 0.32);
      E.update(p, ctx.ch.lead, wideStage);

      // Once the exact mark has held long enough to be read, it yields the
      // right half of a wide stage to the purpose line. Staging, not a second
      // visual treatment: the form, every bound droplet and the vapour's
      // centre receive the same offset, return before the drain, and never
      // move on a portrait stage where the copy stacks below them.
      purposeShift = -0.29 * E.purpose;

      // THE POLES close on the meeting over q1, and the meeting closes on the
      // centre over q2 — one track, read by the bodies and by the vapour.
      const q1 = E.q1;
      const q2 = E.q2;
      const ax0 = 0.5 - POLE_X * sx;
      const bx0 = 0.5 + POLE_X * sx;
      const ay0 = 0.5 + ORIGIN_OY + POLE_Y;
      const mAx = 0.5 - MEET_X;
      const mBx = 0.5 + MEET_X;
      const mAy = 0.5 + ORIGIN_OY - 0.02;
      const mBy = 0.5 + ORIGIN_OY + 0.02;
      const cx = 0.5 + purposeShift;
      const cy = 0.5 + ORIGIN_OY;
      poleAx = ax0 + (mAx - ax0) * q1;
      poleAy = ay0 + (mAy - ay0) * q1;
      poleBx = bx0 + (mBx - bx0) * q1;
      poleBy = ay0 + (mBy - ay0) * q1;
      poleAx += (cx - poleAx) * q2;
      poleAy += (cy - poleAy) * q2;
      poleBx += (cx - poleBx) * q2;
      poleBy += (cy - poleBy) * q2;

      // the mark: grows from its skeleton under the fused mass (late beat 2),
      // holds through beats 3–4, erodes away at the resolution
      const [wIn, eIn] = formPresence(E.formIn);
      formOut.fa = wIn * (1 - E.formOut);
      formOut.ea = eIn + E.formOut * SDF_MELT_ERODE;
      formOut.ox = purposeShift;
      formOut.warp =
        SDF_WARP_REST +
        (SDF_WARP_MORPH - SDF_WARP_REST) * 0.6 * Math.sin(Math.PI * q2);
      formOn = formOut.fa;

      // ── act IV light (R5-D) ────────────────────────────────────────────────
      scoreOut.key = E.key;
      scoreOut.vignette = E.vignette;
      scoreOut.exposure = E.exposure;

      // ── THE MIST's dials ───────────────────────────────────────────────────
      // Alive from the first speck of the boil-off to the last letter, and
      // skipped entirely (on = 0) everywhere else on the page.
      const on = clamp01(ctx.ch.on);
      // The master opens ACROSS the approach rather than at the first hint of
      // it. At lead/0.05 the gain was full a twentieth of the way in, so the
      // vapour's brightness switched on and only its population grew after —
      // the two together are what an appearance is.
      dials.on = on * smooth01(ctx.ch.lead / 0.18 + p * 20);
      dials.evap = E.evap;
      dials.pull = E.pull;
      dials.poles = E.poles;
      dials.condense = E.condense;
      dials.recirc = E.recirc;
      dials.release = E.release;
      dials.spellOn = ctx.ch.wOn > 0.5 ? 1 : 0;
      dials.spell = E.spell * dials.spellOn;
      dials.fade = E.fade;
      dials.curl = E.curl;
      dials.floorOn = ctx.ch.floor > -0.5 ? E.floorOn : 0;
      dials.floor = ctx.ch.floor;
      dials.cx = cx;
      dials.cy = cy;
      dials.ax = poleAx;
      dials.ay = poleAy;
      dials.bx = poleBx;
      dials.by = poleBy;
      dials.wx = ctx.ch.wx;
      dials.wy = ctx.ch.wy;
      dials.ww = ctx.ch.ww;
      dials.wh = ctx.ch.wh;
    },

    target(i: number, ctx: SceneCtx, out: DropletOut) {
      const t = ctx.t;
      const b = base[i];
      const s = T[i];
      const side = i % 2 === 0 ? -1 : 1;
      // the dispersed field → the idea's body, condensing at its pole
      const grow = E.grow;
      const px = (side < 0 ? poleAx : poleBx) + s.pox;
      const py = (side < 0 ? poleAy : poleBy) + s.poy;
      let x = s.dx + (px - s.dx) * grow;
      let y = s.dy + (py - s.dy) * grow;
      // the meeting → the mark's footprint (staggered — the fusion flows)
      const lt2 = smooth01((E.q2 - 0.45 * hash(i, 58)) / 0.55);
      const fx = 0.5 + purposeShift + (b[0] - 0.5) * ORIGIN_SCALE;
      const fy = 0.5 + ORIGIN_OY + (b[1] - 0.5) * ORIGIN_SCALE;
      x += (fx - x) * lt2;
      y += (fy - y) * lt2;
      // radius: small dispersed beads → the condensed body → drained as the
      // exact form lands under it
      const rFull = b[2] * ORIGIN_SCALE * (0.6 + 0.4 * VARY[i]);
      const drain = 1 - smooth01((E.q2 - 0.68) / 0.28);
      let r = rFull * (BEAD + (1 - BEAD) * grow) * drain;
      // the echo — a few droplets bud off the held mark as seeds of the
      // ecosystem; the vapour's release carries the rest of that beat
      let loose = 1 - lt2;
      let echo = 0;
      if (i % 6 === 0 && E.q4 > 0.001) {
        const q4i = smooth01((E.q4 - 0.5 * hash(i, 59)) / 0.5);
        if (q4i > 0.001) {
          x += (s.ox + purposeShift - x) * q4i;
          y += (s.oy - y) * q4i;
          r = Math.max(r, 0.013 * VARY[i] * q4i);
          loose = Math.max(loose, q4i);
          echo = q4i;
        }
      }
      // the resolution: everything sinks and thins into the vapour. Density
      // is the honest exit (site.ts's argument): a shrinking metaball breaks
      // into solid beads, a thinning one recedes from within.
      const q5 = E.q5;
      r *= 1 - 0.55 * q5;
      out.d = 1 - q5;
      // The fluid core supplies loose-body curl. Keep the authored wander only
      // on ?fphys=0 so the rollback remains alive without double-driving the
      // normal physics path.
      const wob = (ctx.physics ? 0 : PHYS.DRIFT) * loose * (1 - q5);
      x += wob * Math.sin(t * (0.5 + hash(i, 62)) + i * 1.7);
      y += wob * Math.cos(t * (0.45 + hash(i, 63)) + i * 2.3);

      out.x = x;
      out.y = y;
      out.r = r;
      // physics attributes (R5-B): dispersed beads are FREE liquid on the
      // current; the two ideas travel as COHERENT bodies (side clusters, low
      // bind); they fuse into exactness (bind → 1 with lt2); the echo and the
      // drain let go again
      out.bind = (0.1 + 0.9 * lt2) * (1 - echo) * (1 - q5) + 0.08 * q5;
      out.cluster =
        grow > 0.2 && lt2 < 0.7 && echo < 0.3 && q5 < 0.5 ? i % 2 : -1;
      // the dispersed field sits a little under the surface and comes forward
      // as it condenses; the drain sinks it again
      out.z = 0.3 * (1 - grow) + 0.5 * q5;
      // THE SKIN's radius: the body's own while it has one, the mark's
      // footprint once the droplets have drained into the exact form, and
      // nothing at the drain — so the vapour is released to spell.
      dials.hostR[i] = Math.max(r, rFull * formOn) * (1 - q5);
    },

    form() {
      return formOut;
    },

    ambient() {
      return 0; // the origin stage has no ambient family — the vapour is its air
    },

    activity() {
      // the vapour is a live system on its own clock: full cadence while it
      // breathes, 30 Hz-safe when it is not on the stage at all
      return dials.on > 0.01 ? 1 : 0;
    },

    score() {
      return scoreOut;
    },

    mist() {
      return dials;
    },
  };
}
