/**
 * MÉTODO scene (R5-A) — the faithful port of makeMethodDriver: the liquid
 * REHEARSES the client's transformation. Five phase states of the same 48
 * droplets (fragmented cloud + probe → jittered lattice → three accreting
 * masses → the EXACT mark → growth + orbiting satellites), one per method
 * phase, rest plateaus with melts across each gap. Damping and inertia are
 * conductor-owned now; the entry envelope (rIn) keeps the droplets invisible
 * until the runway actually enters — under the page-wide canvas the stage is
 * always on, so invisibility must be authored, not implied by mounting.
 */

import {
  CLOUDS,
  N,
  clamp01,
  smooth01,
  hash,
  PHYS,
  VARY,
  wideScatter,
  ORGANISM_SCALE,
} from "../phys.mjs";
import { formPresence } from "../field-drivers";
import {
  SDF_WARP_REST,
  SDF_WARP_MORPH,
  SDF_MELT_ERODE,
} from "../sdf-glass-shader.mjs";
import type {
  SceneModule,
  SceneCtx,
  SceneGeom,
  SceneChannels,
  DropletOut,
  FormState,
} from "./types";
import { centersMid, coordAt } from "./geom";

const M_STATES = 5;

export function makeMethodScene(): SceneModule {
  const base = CLOUDS[0];
  let cachedAspect = -1;
  let ST = new Float32Array(M_STATES * N * 3); // per-state droplet targets
  let stageCx = 0.5;
  let stageCy = 0.5;
  let mOx = 0;
  let mOy = 0;
  let mScale = ORGANISM_SCALE;
  // per-state wander activity (fragmented = restless … integrated = still)
  const ACT = [1, 0.3, 0.5, 0.12, 0.35];
  // per-state physics bind (R5-B): the cloud is FREE liquid, the lattice is
  // mostly held (order taking hold), the masses stay loose enough to ACCRETE
  // by cohesion, the mark is exact, the orbits drift a little
  const BINDS = [0, 0.7, 0.3, 1, 0.5];

  const put = (s: number, i: number, x: number, y: number, r: number) => {
    const j = (s * N + i) * 3;
    ST[j] = x;
    ST[j + 1] = y;
    ST[j + 2] = r;
  };

  // per-frame factors (tick → target/form/extras)
  let k0 = 0;
  let k1 = 0;
  let fw = 0;
  let sEff = 0;
  let EXW = 1;
  let rInW = 0;
  let probeW = 0;
  let probeX = 0;
  let probeY = 0;
  const formOut: FormState = {
    a: 0,
    b: 0,
    fa: 0,
    fb: 0,
    ea: 0,
    eb: 0,
    ox: 0,
    oy: 0,
    scale: ORGANISM_SCALE,
    warp: SDF_WARP_REST,
  };

  return {
    id: "method",
    forms: [0],
    channels: { u: 0, ex: 0, on: 0, rIn: 0 },
    damp: { on: false, rIn: false }, // scroll-continuous envelopes, applied raw
    anchors: { wrap: "#method .method-journey" },
    lists: { phases: "#method .method-phase" },

    read(g: SceneGeom, out: SceneChannels) {
      const vh = g.vh;
      const wr = g.rect("wrap");
      if (wr) {
        // grip: rises before the runway enters, releases after it leaves —
        // both entirely off-screen (the drain/entry envelopes own visibility)
        out.on =
          clamp01((vh * 1.9 - wr.top) / (vh * 0.5)) *
          clamp01((wr.bottom + vh * 0.3) / (vh * 0.5));
        // entry: radii swell only once the runway approaches the fold
        out.rIn = clamp01((vh * 1.15 - wr.top) / (vh * 0.35));
        // exit: the liquid settles away BEFORE the runway leaves
        out.ex = clamp01(1 - (wr.bottom - vh) / (vh * 0.45));
      }
      const phases = g.list("phases");
      if (phases.length >= 2) out.u = coordAt(vh * 0.5, centersMid(phases));
    },

    presence(ctx: SceneCtx) {
      return ctx.ch.on;
    },

    tick(ctx: SceneCtx) {
      const aspect = ctx.aspect;
      if (Math.abs(aspect - cachedAspect) > 0.02) {
        cachedAspect = aspect;
        // stage left of the copy column on wide stages; below it on narrow
        const wide = aspect >= 1.4;
        mOx = wide ? -Math.min(0.15 * aspect, aspect / 2 - 0.32) : 0;
        mOy = wide ? 0 : -0.22;
        mScale = wide ? ORGANISM_SCALE : 0.38;
        stageCx = 0.5 + mOx;
        stageCy = 0.5 + mOy;
        const sz = mScale / ORGANISM_SCALE; // local size factor
        ST = new Float32Array(M_STATES * N * 3);
        // 0 — the fragmented cloud (Diagnosis): SEPARATED droplets — small
        // enough that their falloff tails never fuse into a dark film — and
        // compressed into the stage column so the copy stays clear
        const dis = wideScatter(aspect, stageCx, stageCy, 0.62);
        const clampD = (v: number, c: number, lim: number) =>
          c + Math.max(-lim, Math.min(lim, (v - c) * 0.9));
        // 1 — the lattice (Structure): 8 × 6 = exactly the 48 droplets
        const COLS = 8;
        const ROWS = 6;
        const spanX = 0.54 * sz;
        const spanY = 0.42 * sz;
        // 2 — three accreting masses (Construction)
        const CORE_R = 0.155 * sz;
        for (let i = 0; i < N; i++) {
          const b = base[i];
          put(
            0,
            i,
            clampD(dis[i].tx, stageCx, 0.33),
            clampD(dis[i].ty, stageCy, 0.33),
            b[2] * mScale * (0.24 + 0.24 * VARY[i]),
          );
          const col = i % COLS;
          const row = (i / COLS) | 0;
          put(
            1,
            i,
            stageCx -
              spanX / 2 +
              (spanX / (COLS - 1)) * col +
              (row % 2 ? spanX / (COLS - 1) / 2 : 0) +
              (hash(i, 72) - 0.5) * 0.014,
            stageCy -
              spanY / 2 +
              (spanY / (ROWS - 1)) * row +
              (hash(i, 73) - 0.5) * 0.014,
            0.012 * sz * (0.92 + 0.16 * hash(i, 74)),
          );
          const core = i % 3;
          const ca = ((core * 120 + 90) * Math.PI) / 180;
          const cx = stageCx + Math.cos(ca) * CORE_R;
          const cy = stageCy + Math.sin(ca) * CORE_R;
          const od = (0.012 + 0.062 * Math.pow(hash(i, 75), 1.4)) * sz;
          const oa = hash(i, 76) * Math.PI * 2;
          put(
            2,
            i,
            cx + Math.cos(oa) * od,
            cy + Math.sin(oa) * od,
            (0.036 - 0.26 * od) * sz,
          );
          // 3 — the mark's footprint (the form swallows the fused mass)
          const fx = 0.5 + mOx + (b[0] - 0.5) * mScale;
          const fy = 0.5 + mOy + (b[1] - 0.5) * mScale;
          put(3, i, fx, fy, b[2] * mScale * 0.5);
          // 4 — evolution: a third of the droplets shed into slow orbits
          if (i % 3 === 0) {
            const sa = hash(i, 77) * Math.PI * 2;
            const so = (0.29 + 0.15 * hash(i, 78)) * sz;
            put(
              4,
              i,
              stageCx +
                Math.cos(sa) * so * Math.min(Math.max(aspect * 0.8, 1), 1.4),
              stageCy + Math.sin(sa) * so,
              0.014 * sz,
            );
          } else {
            put(4, i, fx, fy, 0.002);
          }
        }
      }

      const t = ctx.t;
      const du = Math.min(Math.max(ctx.ch.u, 0), 4); // conductor-damped

      // rest plateau on each phase, melt across the middle of each gap
      k0 = Math.min(Math.floor(du), 3);
      const f = du - k0;
      fw = f <= 0.35 ? 0 : f >= 0.65 ? 1 : (f - 0.35) / 0.3;
      sEff = k0 + fw;
      k1 = Math.min(k0 + 1, M_STATES - 1);

      // exit: the liquid settles away BEFORE the runway leaves; entry: it
      // swells only once the runway approaches
      const exE = smooth01(clamp01(ctx.ch.ex));
      EXW = 1 - exE;
      rInW = smooth01(clamp01(ctx.ch.rIn));

      // the mark: converges across the 2 → 3 melt, holds, erodes back below
      const formT = clamp01((sEff - 2.45) / 0.5);
      const [fa0, ea0] = formPresence(formT);
      formOut.fa = fa0 * EXW;
      formOut.ea = ea0 + exE * SDF_MELT_ERODE;
      const grow = smooth01((sEff - 3.35) / 0.55); // Evolution: it grows
      formOut.scale = mScale * (1 + 0.06 * grow);
      formOut.ox = mOx;
      formOut.oy = mOy;
      formOut.warp =
        SDF_WARP_REST +
        (SDF_WARP_MORPH - SDF_WARP_REST) * 0.5 * Math.sin(Math.PI * fw);

      // the probe (Diagnosis only): a slow horizontal sweep, examining
      probeW = 1 - smooth01((sEff - 0.45) / 0.35);
      if (probeW > 0.01) {
        const tri = (t * 0.07) % 1;
        const sw = tri < 0.5 ? tri * 2 : 2 - tri * 2;
        probeX = stageCx - 0.26 + 0.52 * smooth01(sw);
        probeY = stageCy + 0.1 * Math.sin(t * 0.31);
      }
    },

    target(i: number, ctx: SceneCtx, out: DropletOut) {
      const t = ctx.t;
      const ja = (k0 * N + i) * 3;
      const jb = (k1 * N + i) * 3;
      // staggered flow: each droplet crosses the melt on its own window
      const fi = smooth01((fw - 0.4 * hash(i, 71)) / 0.6);
      let x = ST[ja] + (ST[jb] - ST[ja]) * fi;
      let y = ST[ja + 1] + (ST[jb + 1] - ST[ja + 1]) * fi;
      let r = ST[ja + 2] + (ST[jb + 2] - ST[ja + 2]) * fi;
      // orbiting satellites actually ORBIT (Evolution)
      if (i % 3 === 0 && sEff > 3.05) {
        const rot = t * (0.03 + 0.03 * hash(i, 79)) * smooth01(sEff - 3.05);
        const dx = x - stageCx;
        const dy = y - stageCy;
        const cs = Math.cos(rot);
        const sn = Math.sin(rot);
        x = stageCx + dx * cs - dy * sn;
        y = stageCy + dx * sn + dy * cs;
      }
      // the probe's examination: droplets swell as it passes over them
      if (probeW > 0.01) {
        const d = x - probeX;
        r *= 1 + 0.34 * probeW * Math.exp(-(d * d) / 0.006);
      }
      // life: restless while fragmented, stiller as order takes hold
      const act = ACT[k0] + (ACT[k1] - ACT[k0]) * fi;
      const bind = BINDS[k0] + (BINDS[k1] - BINDS[k0]) * fi;
      // Curl supplies life to free droplets. Bound choreography retains only
      // the authored share that physics intentionally suppresses; the legacy
      // rollback keeps the original target motion in full.
      const authored = ctx.physics ? bind : 1;
      const wob = PHYS.DRIFT * act * authored;
      x += wob * Math.sin(t * (0.5 + hash(i, 80)) + i * 1.7);
      y += wob * Math.cos(t * (0.44 + hash(i, 81)) + i * 2.3);
      r *= EXW * rInW; // exit drain · entry swell

      out.x = x;
      out.y = y;
      out.r = r;
      // physics attributes (R5-B): per-state bind; Construction's three
      // masses share cluster ids so cohesion makes the accretion REAL
      out.bind = bind;
      const st = fi > 0.5 ? k1 : k0;
      out.cluster = st === 2 ? i % 3 : -1;
      out.z = 0;
    },

    form() {
      return formOut;
    },

    ambient() {
      return 0; // the method stage had no ambient family (parity with pre-R5)
    },

    activity() {
      // everything here is scroll-scrubbed (the conductor's velocity term
      // covers motion) or slow (probe sweep, evolution orbits) — 30 Hz-safe
      return 0;
    },

    extras(ctx: SceneCtx, push) {
      if (probeW > 0.01 && EXW > 0.02 && rInW > 0.02)
        push(probeX, probeY, 0.02 * probeW * EXW * rInW);
    },
  };
}
