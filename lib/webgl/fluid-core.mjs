/**
 * FLUID CORE (R5-B) — the real physics under the one liquid.
 *
 * Phase A moved every droplet with a first-order low-pass toward analytic
 * targets. This core gives the liquid actual dynamics — velocity state,
 * momentum, interaction — while keeping the signed-off choreography exact:
 *
 *   - GOAL-SEEK: a critically-damped spring toward the scene target, with
 *     stiffness derived from the SAME per-droplet TAUP identity (heavy
 *     droplets lag more — the field stretches under scroll, now with
 *     genuine momentum instead of a filter).
 *   - REPULSION: short-range soft-core between free droplets — loose liquid
 *     reads volumetric, droplets never stack into coincident discs.
 *   - COHESION: droplets sharing a cluster id are drawn toward their
 *     cluster's centroid — fracture chunks hold together like liquid, the
 *     method's three masses ACCRETE by attraction, the origin's brother
 *     masses travel as two coherent bodies.
 *   - CURL DRIFT: a divergence-free analytic flow field (two slow gyres +
 *     one faster octave) replaces "wander" for free droplets — organic,
 *     incompressible-feeling ambient motion.
 *   - CURSOR FIELD: a page-wide radial push + tangential vortex around the
 *     pointer with pointer-velocity injection — the liquid answers the hand
 *     everywhere, not only at the hero.
 *   - PINCH-OFF: when a free droplet's target strains far ahead of its body,
 *     it sheds 1–2 satellite micro-droplets with inherited velocity (TTL,
 *     shrink-out) — the classic real-fluid signature, budgeted to a pool.
 *
 * THE BIND CONTRACT (validated design, correction C2): scenes emit
 * bind ∈ [0,1] per droplet. Environmental forces scale by (1−bind), and the
 * OUTPUT position blends between the physics body and a byte-exact replica
 * of the legacy low-pass at the same PHYS taus:
 *
 *     out = mix(x_physics, x_lowpass, bind)
 *
 * so at bind = 1 (the §3.3 melts, resting footprints, the exact mark) the
 * motion is IDENTICAL to the signed-off Phase-A dynamics, and at bind = 0
 * (pours, scatters, echoes) the liquid is fully alive. Both states run
 * continuously — bind transitions never jump.
 *
 * Pure .mjs (the sdf-core convention): no DOM, deterministic (hash-seeded),
 * node-runnable for the sim harness. The `?fphys=0` escape routes the
 * conductor back to the pure legacy block — this core never runs.
 */

import { N, TAUP, hash, clamp01 } from "./phys.mjs";

// ── tuning table (Phase-B feel constants — owner rounds may retune) ──────────
export const FLUID = {
  H_MS: 8, // fixed substep (ms)
  OMEGA_K: 1.8, // spring rate ω = OMEGA_K / (TAUP[i] in s) — matches the lag feel
  DAMP_Z: 1.15, // slightly super-critical — the V_MAX clamp breaks critical
  // symmetry on hard jumps; ζ > 1 keeps the approach slosh-free
  REP_RANGE: 1.15, // repulsion reach × (ri + rj)
  REP_A: 2.6, // repulsion acceleration ceiling (uv/s²)
  REP_D_MIN: 0.004, // distance floor — droplets have size; no 1/d blow-ups
  COH_A: 0.5, // cluster-centroid pull (uv/s² at 0.1 uv offset → 0.05)
  CURL_V: 0.016, // curl drift velocity amplitude (uv/s) at bind 0
  CURSOR_RADIUS: 0.2, // pointer influence radius (uv)
  CURSOR_PUSH: 1.6, // radial push ceiling (uv/s²)
  CURSOR_SWIRL: 1.1, // tangential vortex ceiling (uv/s²)
  CURSOR_DRAG: 0.35, // pointer-velocity injection factor
  V_MAX: 1.6, // velocity clamp (uv/s) — a flick stirs, never flings
  SAT_POOL: 14, // satellite droplet budget (48+14+3+12+probe ≤ 80)
  SAT_STRAIN: 0.085, // spawn when |target − body| exceeds this (uv)
  SAT_BIND_MAX: 0.4, // never shed from bound liquid (melts stay exact)
  SAT_COOLDOWN: 520, // per-droplet respawn cooldown (ms)
  SAT_TTL_MIN: 650, // satellite lifetime (ms)
  SAT_TTL_VAR: 550,
  SAT_R: 0.34, // satellite radius = parent r × this
};

const H_S = FLUID.H_MS / 1000;

// the curl field ψ (two slow gyres + one faster octave), v = (∂ψ/∂y, −∂ψ/∂x).
// Analytic, divergence-free, deterministic; phases drift minutes-slow.
const GYRES = [
  { fx: 3.1, fy: 2.7, w: 0.045, p1: hash(1, 91) * 6.283, p2: hash(2, 91) * 6.283, a: 0.55 },
  { fx: 5.3, fy: 4.6, w: 0.07, p1: hash(3, 91) * 6.283, p2: hash(4, 91) * 6.283, a: 0.3 },
  { fx: 9.7, fy: 8.9, w: 0.11, p1: hash(5, 91) * 6.283, p2: hash(6, 91) * 6.283, a: 0.15 },
];

export function makeFluidCore() {
  // physics body (PD + forces), legacy shadow (byte-exact low-pass), velocity
  const XP = new Float32Array(N * 2).fill(-1);
  const XL = new Float32Array(N * 2).fill(-1);
  const V = new Float32Array(N * 2);
  // per-cluster accumulation scratch (id ≥ 0; small fixed table)
  const CMAX = 16;
  const csx = new Float32Array(CMAX);
  const csy = new Float32Array(CMAX);
  const cn = new Uint16Array(CMAX);

  // satellites: fixed pool, TTL shrink-out
  const SP = FLUID.SAT_POOL;
  const sx = new Float32Array(SP);
  const sy = new Float32Array(SP);
  const svx = new Float32Array(SP);
  const svy = new Float32Array(SP);
  const sr0 = new Float32Array(SP);
  const sBorn = new Float32Array(SP);
  const sTtl = new Float32Array(SP).fill(0); // 0 = free slot
  const lastSpawn = new Float32Array(N).fill(-1e9);
  let spawnSeq = 0;

  let acc = 0; // substep accumulator (ms)

  /**
   * Advance the fluid and write the OUTPUT positions into P (n*2).
   * T/BIND/CLUS = blended scene targets; R = current radii (read-only, for
   * interaction ranges); env = { px, py, pvx, pvy, pon, vel } (field uv).
   */
  const step = (P, T, BIND, CLUS, R, dtMs, tMs, env) => {
    // ── legacy shadow: the EXACT Phase-A low-pass (frame-rate corrected) ──────
    for (let i = 0; i < N; i++) {
      const kp = 1 - Math.exp(-dtMs / TAUP[i]);
      if (XL[i * 2] < 0) {
        XL[i * 2] = T[i * 2];
        XL[i * 2 + 1] = T[i * 2 + 1];
      } else {
        XL[i * 2] += (T[i * 2] - XL[i * 2]) * kp;
        XL[i * 2 + 1] += (T[i * 2 + 1] - XL[i * 2 + 1]) * kp;
      }
      if (XP[i * 2] < 0) {
        XP[i * 2] = T[i * 2];
        XP[i * 2 + 1] = T[i * 2 + 1];
        V[i * 2] = 0;
        V[i * 2 + 1] = 0;
      }
    }

    // ── physics body: fixed-step substepped semi-implicit Euler ──────────────
    acc += dtMs;
    const maxSteps = 14; // dt is clamped upstream (≤100ms) — safety anyway
    let steps = 0;
    while (acc >= FLUID.H_MS && steps < maxSteps) {
      acc -= FLUID.H_MS;
      steps++;
      const t = (tMs - acc) / 1000;

      // cluster centroids (physics body positions, free-ish droplets only)
      csx.fill(0);
      csy.fill(0);
      cn.fill(0);
      for (let i = 0; i < N; i++) {
        const c = CLUS[i];
        if (c < 0 || c >= CMAX || R[i] < 0.0012) continue;
        csx[c] += XP[i * 2];
        csy[c] += XP[i * 2 + 1];
        cn[c]++;
      }

      for (let i = 0; i < N; i++) {
        const b = clamp01(BIND[i]);
        const free = 1 - b;
        const ix = i * 2;
        const x = XP[ix];
        const y = XP[ix + 1];
        const tau = TAUP[i] / 1000;
        const om = FLUID.OMEGA_K / tau;

        // goal-seek: a near-critically-damped spring toward the scene target
        let ax = om * om * (T[ix] - x) - 2 * FLUID.DAMP_Z * om * V[ix];
        let ay = om * om * (T[ix + 1] - y) - 2 * FLUID.DAMP_Z * om * V[ix + 1];

        if (free > 0.01 && R[i] >= 0.0012) {
          // repulsion (soft-core, free pairs only)
          for (let j = i + 1; j < N; j++) {
            if (R[j] < 0.0012) continue;
            const fj = 1 - clamp01(BIND[j]);
            if (fj < 0.01) continue;
            const dx = x - XP[j * 2];
            const dy = y - XP[j * 2 + 1];
            const reach = FLUID.REP_RANGE * (R[i] + R[j]);
            const d2 = dx * dx + dy * dy;
            if (d2 > reach * reach || d2 < 1e-8) continue;
            const d = Math.max(Math.sqrt(d2), FLUID.REP_D_MIN);
            const push = FLUID.REP_A * (1 - d / reach) * free * fj;
            const inv = push / d;
            ax += dx * inv;
            ay += dy * inv;
            // symmetric kick applied to j when its own loop runs would double
            // count — apply j's share here instead (Newton's third law)
            V[j * 2] -= dx * inv * H_S;
            V[j * 2 + 1] -= dy * inv * H_S;
          }

          // cohesion toward the cluster centroid
          const c = CLUS[i];
          if (c >= 0 && c < CMAX && cn[c] > 1) {
            const mx = csx[c] / cn[c];
            const my = csy[c] / cn[c];
            ax += (mx - x) * FLUID.COH_A * free;
            ay += (my - y) * FLUID.COH_A * free;
          }

          // curl drift — divergence-free ambient flow (velocity target)
          let cx = 0;
          let cy = 0;
          for (const g of GYRES) {
            const sxx = Math.sin(x * g.fx + g.p1 + t * g.w);
            const cxx = Math.cos(x * g.fx + g.p1 + t * g.w);
            const syy = Math.sin(y * g.fy + g.p2 - t * g.w * 0.7);
            const cyy = Math.cos(y * g.fy + g.p2 - t * g.w * 0.7);
            cx += g.a * g.fy * sxx * cyy;
            cy -= g.a * g.fx * cxx * syy;
          }
          // a gentle body force along the flow — a current, not a rail (the
          // spring balances it into a slowly-moving equilibrium drift)
          ax += cx * FLUID.CURL_V * free * 2.2;
          ay += cy * FLUID.CURL_V * free * 2.2;

          // cursor force field: radial push + vortex + pointer-velocity drag
          if (env.pon) {
            const dx = x - env.px;
            const dy = y - env.py;
            const d2 = dx * dx + dy * dy;
            const rr = FLUID.CURSOR_RADIUS;
            if (d2 < rr * rr && d2 > 1e-8) {
              const d = Math.sqrt(d2);
              const fall = 1 - d / rr;
              const w = fall * fall * free;
              const inv = 1 / d;
              ax += dx * inv * FLUID.CURSOR_PUSH * w;
              ay += dy * inv * FLUID.CURSOR_PUSH * w;
              // tangential vortex (right-handed around the pointer)
              ax += -dy * inv * FLUID.CURSOR_SWIRL * w;
              ay += dx * inv * FLUID.CURSOR_SWIRL * w;
              // the hand drags the liquid with it
              ax += env.pvx * FLUID.CURSOR_DRAG * w;
              ay += env.pvy * FLUID.CURSOR_DRAG * w;
            }
          }
        }

        // integrate (semi-implicit)
        V[ix] += ax * H_S;
        V[ix + 1] += ay * H_S;
        // velocity clamp — a flick stirs, never flings
        const sp = Math.hypot(V[ix], V[ix + 1]);
        if (sp > FLUID.V_MAX) {
          const k = FLUID.V_MAX / sp;
          V[ix] *= k;
          V[ix + 1] *= k;
        }
        XP[ix] += V[ix] * H_S;
        XP[ix + 1] += V[ix + 1] * H_S;
      }
    }
    if (steps === maxSteps) acc = 0; // spiral-of-death guard

    // ── output: mix(physics, legacy) by bind; state follows output ──────────
    for (let i = 0; i < N; i++) {
      const b = clamp01(BIND[i]);
      const ix = i * 2;
      const ox = XP[ix] * (1 - b) + XL[ix] * b;
      const oy = XP[ix + 1] * (1 - b) + XL[ix + 1] * b;
      P[ix] = ox;
      P[ix + 1] = oy;
      // keep the physics body glued to what is actually shown while bound, so
      // a bind release never jumps (velocity already ~0 there: forces off)
      if (b > 0.5) {
        XP[ix] += (ox - XP[ix]) * b;
        XP[ix + 1] += (oy - XP[ix + 1]) * b;
        V[ix] *= 1 - b * 0.5;
        V[ix + 1] *= 1 - b * 0.5;
      }

      // pinch-off: a straining free droplet sheds spray
      if (
        b <= FLUID.SAT_BIND_MAX &&
        R[i] > 0.006 &&
        tMs - lastSpawn[i] > FLUID.SAT_COOLDOWN
      ) {
        const dx = T[ix] - XP[ix];
        const dy = T[ix + 1] - XP[ix + 1];
        if (dx * dx + dy * dy > FLUID.SAT_STRAIN * FLUID.SAT_STRAIN) {
          for (let s = 0; s < SP; s++) {
            if (sTtl[s] > 0 && tMs - sBorn[s] < sTtl[s]) continue;
            spawnSeq++;
            lastSpawn[i] = tMs;
            sx[s] = XP[ix] + dx * 0.22;
            sy[s] = XP[ix + 1] + dy * 0.22;
            svx[s] = V[ix] * 0.55 + (hash(spawnSeq, 77) - 0.5) * 0.08;
            svy[s] = V[ix + 1] * 0.55 + (hash(spawnSeq, 78) - 0.5) * 0.08;
            sr0[s] = Math.min(Math.max(R[i] * FLUID.SAT_R, 0.004), 0.011);
            sBorn[s] = tMs;
            sTtl[s] = FLUID.SAT_TTL_MIN + FLUID.SAT_TTL_VAR * hash(spawnSeq, 79);
            break;
          }
        }
      }
    }

    // satellites drift ballistically with mild drag
    const dtS = dtMs / 1000;
    for (let s = 0; s < SP; s++) {
      if (sTtl[s] <= 0) continue;
      const age = tMs - sBorn[s];
      if (age >= sTtl[s]) {
        sTtl[s] = 0;
        continue;
      }
      svx[s] *= 1 - 1.4 * dtS;
      svy[s] *= 1 - 1.4 * dtS;
      sx[s] += svx[s] * dtS;
      sy[s] += svy[s] * dtS;
    }
  };

  /** Pack live satellites into the ball buffer; returns the new count. */
  const packSatellites = (buf, count, ballMax, tMs) => {
    for (let s = 0; s < SP && count < ballMax; s++) {
      if (sTtl[s] <= 0) continue;
      const p = (tMs - sBorn[s]) / sTtl[s];
      if (p >= 1) continue;
      // swell in fast, shrink out — spray, not popping dots
      const r = sr0[s] * Math.min(p / 0.12, 1) * (1 - p) * (1 - p * 0.3);
      if (r < 0.0015) continue;
      buf[count * 3] = sx[s];
      buf[count * 3 + 1] = sy[s];
      buf[count * 3 + 2] = r;
      count++;
    }
    return count;
  };

  return { step, packSatellites };
}
