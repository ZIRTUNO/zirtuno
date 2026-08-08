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
 * continuously. After each mix, the hidden share of each branch is rebased
 * onto the position that was actually shown; a later bind change therefore
 * continues from the visible droplet instead of exposing stale parallel
 * history.
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
  // Curl drift amplitude at bind 0 — the ambient current between transitions.
  //
  // This is a FORCE competing with the goal-seek spring, so what matters is not
  // its own size but its ratio to ω² — and ω = OMEGA_K / TAUP is 6.9…20 rad/s,
  // giving ω² = 48…400. At the original 0.016 the resulting wander was 0.0035 uv
  // on the heaviest droplet and 0.0004 on the lightest: sub-pixel at any real
  // canvas size. The liquid was technically in motion and visually dead, which
  // is why raising it slightly changed nothing.
  //
  // 0.13 puts the heavy droplets at ~0.028 uv of wander and the light ones at
  // ~0.0034. The 8× spread is the point: the body moves through ITSELF instead
  // of translating as a slab, which is what makes it read as one material.
  CURL_V: 0.13,
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
  // Physics-v3 review constants. The v3 path is deliberately opt-in until
  // its signature feel has completed owner capture review; the default path
  // above remains byte-for-byte the signed-off R5-B behavior.
  V3_VISC_RANGE: 1.85, // local velocity matching reach × (ri + rj)
  V3_VISC_A: 2.4, // local viscosity acceleration (1/s)
  V3_ATTR_START: 1.2, // attraction begins after the repulsion shell
  V3_ATTR_RANGE: 2.35, // short cohesive band × (ri + rj)
  V3_ATTR_A: 0.24, // attraction acceleration ceiling (uv/s²)
  V3_SPREAD_A: 0.9, // bounded cluster-footprint correction
  V3_SPREAD_MAX: 0.16, // correction acceleration ceiling (uv/s²)
  OBSTACLE_MARGIN: 0.018, // breathing room around cached type/card bounds
  OBSTACLE_A: 2.1, // soft avoidance acceleration ceiling (uv/s²)
  // ── scroll coupling ────────────────────────────────────────────────────────
  // The conductor damped a scroll velocity and handed it to this core, which
  // never read it: scroll reached the ambient beads and the cadence governor
  // and stopped there. The spring does lag whenever a scene MOVES its targets,
  // but most of the page holds its targets still in viewport space, so between
  // the authored transitions scrolling produced no liquid response at all.
  // These three restore the missing half: the page is a container being dragged
  // past the fluid it carries.
  SCROLL_CLAMP: 2.2, // vh/s ceiling — matches the ambient STIR clamp
  SCROLL_LEAN: 0.85, // inertial body force opposite the travel (uv/s² per vh/s)
  SCROLL_SHEAR: 0.55, // cross-field shear — the body stretches, never slides as a slab
  SCROLL_STIR: 1.15, // scroll drives the ambient curl: flow you can actually see
};

export const FLUID_OBSTACLE_MAX = 12;
export const FLUID_OBSTACLE_STRIDE = 5; // cx, cy, half-width, half-height, weight

const H_S = FLUID.H_MS / 1000;

// the curl field ψ (two slow gyres + one faster octave), v = (∂ψ/∂y, −∂ψ/∂x).
// Analytic, divergence-free, deterministic; phases drift minutes-slow.
const GYRES = [
  {
    fx: 3.1,
    fy: 2.7,
    w: 0.045,
    p1: hash(1, 91) * 6.283,
    p2: hash(2, 91) * 6.283,
    a: 0.55,
  },
  {
    fx: 5.3,
    fy: 4.6,
    w: 0.07,
    p1: hash(3, 91) * 6.283,
    p2: hash(4, 91) * 6.283,
    a: 0.3,
  },
  {
    fx: 9.7,
    fy: 8.9,
    w: 0.11,
    p1: hash(5, 91) * 6.283,
    p2: hash(6, 91) * 6.283,
    a: 0.15,
  },
];

export function makeFluidCore(opts = {}) {
  const v3 = opts.v3 === true;
  const obstacleFlow = v3 && opts.obstacles === true;
  // physics body (PD + forces), previous fixed-step body (render interpolation),
  // legacy shadow (byte-exact low-pass), velocity
  const XP = new Float32Array(N * 2);
  const X0 = new Float32Array(N * 2);
  const XL = new Float32Array(N * 2);
  const V = new Float32Array(N * 2);
  // Field x legitimately extends below zero on wide canvases. Initialization
  // must therefore be explicit; using XP/XL x < 0 as a sentinel resets any
  // left-side droplet directly to its target on the following frame.
  let seeded = false;
  // per-cluster accumulation scratch (id ≥ 0; small fixed table)
  const CMAX = 16;
  const csx = new Float32Array(CMAX);
  const csy = new Float32Array(CMAX);
  const cn = new Uint16Array(CMAX);
  // Physics-v3 uses droplet area as mass and preserves each authored
  // cluster's footprint instead of pulling every family toward a point.
  // These arrays are fixed scratch: no per-step allocation.
  const csm = new Float32Array(CMAX);
  const ctx = new Float32Array(CMAX);
  const cty = new Float32Array(CMAX);
  const csr = new Float32Array(CMAX);
  const ctr = new Float32Array(CMAX);

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
    const first = !seeded;
    for (let i = 0; i < N; i++) {
      const kp = 1 - Math.exp(-dtMs / TAUP[i]);
      if (first) {
        XL[i * 2] = T[i * 2];
        XL[i * 2 + 1] = T[i * 2 + 1];
      } else {
        XL[i * 2] += (T[i * 2] - XL[i * 2]) * kp;
        XL[i * 2 + 1] += (T[i * 2 + 1] - XL[i * 2 + 1]) * kp;
      }
      if (first) {
        XP[i * 2] = T[i * 2];
        XP[i * 2 + 1] = T[i * 2 + 1];
        X0[i * 2] = T[i * 2];
        X0[i * 2 + 1] = T[i * 2 + 1];
        V[i * 2] = 0;
        V[i * 2 + 1] = 0;
      }
    }
    if (first) seeded = true;

    // ── physics body: fixed-step substepped semi-implicit Euler ──────────────
    acc += dtMs;
    const maxSteps = 14; // dt is clamped upstream (≤100ms) — safety anyway
    let steps = 0;
    while (acc >= FLUID.H_MS && steps < maxSteps) {
      acc -= FLUID.H_MS;
      steps++;
      const t = (tMs - acc) / 1000;

      // Scroll, resolved once per substep. Positive = scrolling down, which
      // drags the content (and every target pinned to it) UP the viewport, so
      // the fluid's own mass answers downward.
      const scroll = Math.max(
        -FLUID.SCROLL_CLAMP,
        Math.min(FLUID.SCROLL_CLAMP, env.vel || 0),
      );
      // The ambient current runs faster while the page moves and settles back
      // when it stops — the curl stays divergence-free either way, so this
      // reads as the whole body flowing rather than droplets being pushed.
      const curlGain =
        FLUID.CURL_V *
        (1 + FLUID.SCROLL_STIR * (Math.abs(scroll) / FLUID.SCROLL_CLAMP));

      // Preserve the preceding fixed-step state. Rendering interpolates X0→XP
      // with the accumulator remainder, so 144/165 Hz displays never repeat a
      // stale body on zero-substep frames and catch up on the next frame.
      X0.set(XP);

      // cluster centroids (physics body positions, free-ish droplets only)
      csx.fill(0);
      csy.fill(0);
      cn.fill(0);
      if (v3) {
        csm.fill(0);
        ctx.fill(0);
        cty.fill(0);
        csr.fill(0);
        ctr.fill(0);
      }
      for (let i = 0; i < N; i++) {
        const c = CLUS[i];
        if (c < 0 || c >= CMAX || R[i] < 0.0012) continue;
        const mass = v3 ? Math.max(R[i] * R[i], 1e-6) : 1;
        csx[c] += XP[i * 2] * mass;
        csy[c] += XP[i * 2 + 1] * mass;
        if (v3) {
          csm[c] += mass;
          ctx[c] += T[i * 2] * mass;
          cty[c] += T[i * 2 + 1] * mass;
        }
        cn[c]++;
      }
      if (v3) {
        for (let i = 0; i < N; i++) {
          const c = CLUS[i];
          if (c < 0 || c >= CMAX || cn[c] < 2 || R[i] < 0.0012) continue;
          const mass = Math.max(R[i] * R[i], 1e-6);
          const mx = csx[c] / csm[c];
          const my = csy[c] / csm[c];
          const tx = ctx[c] / csm[c];
          const ty = cty[c] / csm[c];
          csr[c] += Math.hypot(XP[i * 2] - mx, XP[i * 2 + 1] - my) * mass;
          ctr[c] += Math.hypot(T[i * 2] - tx, T[i * 2 + 1] - ty) * mass;
        }
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
          // Pair forces. The signed-off v2 branch stays verbatim. Physics v3
          // adds area-weighted momentum, a short cohesive band, and local
          // viscosity so separated beads reconnect as one material.
          for (let j = i + 1; j < N; j++) {
            if (R[j] < 0.0012) continue;
            const fj = 1 - clamp01(BIND[j]);
            if (fj < 0.01) continue;
            const dx = x - XP[j * 2];
            const dy = y - XP[j * 2 + 1];
            const d2 = dx * dx + dy * dy;
            if (d2 < 1e-8) continue;
            const radii = R[i] + R[j];
            const reach = FLUID.REP_RANGE * radii;
            const d = Math.max(Math.sqrt(d2), FLUID.REP_D_MIN);
            if (!v3) {
              if (d2 > reach * reach) continue;
              const push = FLUID.REP_A * (1 - d / reach) * free * fj;
              const inv = push / d;
              ax += dx * inv;
              ay += dy * inv;
              // Symmetric kick applied here; j's own loop starts after i.
              V[j * 2] -= dx * inv * H_S;
              V[j * 2 + 1] -= dy * inv * H_S;
              continue;
            }

            const mi = Math.max(R[i] * R[i], 1e-6);
            const mj = Math.max(R[j] * R[j], 1e-6);
            const invMass = 1 / (mi + mj);
            // Equal sizes retain the v2 force. Smaller beads yield more to a
            // larger body, matching area-weighted liquid mass.
            const wi = 2 * mj * invMass;
            const wj = 2 * mi * invMass;
            const nx = dx / d;
            const ny = dy / d;

            if (d < reach) {
              const push = FLUID.REP_A * (1 - d / reach) * free * fj;
              ax += nx * push * wi;
              ay += ny * push * wi;
              V[j * 2] -= nx * push * wj * H_S;
              V[j * 2 + 1] -= ny * push * wj * H_S;
            } else {
              const attrStart = FLUID.V3_ATTR_START * radii;
              const attrReach = FLUID.V3_ATTR_RANGE * radii;
              if (CLUS[i] === CLUS[j] && d > attrStart && d < attrReach) {
                const u =
                  (d - attrStart) / Math.max(attrReach - attrStart, 1e-5);
                const pull =
                  Math.sin(Math.PI * u) * FLUID.V3_ATTR_A * free * fj;
                ax -= nx * pull * wi;
                ay -= ny * pull * wi;
                V[j * 2] += nx * pull * wj * H_S;
                V[j * 2 + 1] += ny * pull * wj * H_S;
              }
            }

            const viscReach = FLUID.V3_VISC_RANGE * radii;
            if (d < viscReach) {
              const fall = 1 - d / viscReach;
              const visc = FLUID.V3_VISC_A * fall * fall * free * fj;
              const dvx = V[j * 2] - V[ix];
              const dvy = V[j * 2 + 1] - V[ix + 1];
              ax += dvx * visc * wi;
              ay += dvy * visc * wi;
              V[j * 2] -= dvx * visc * wj * H_S;
              V[j * 2 + 1] -= dvy * visc * wj * H_S;
            }
          }

          // cohesion toward the cluster centroid
          const c = CLUS[i];
          if (c >= 0 && c < CMAX && cn[c] > 1) {
            const mass = v3 ? csm[c] : cn[c];
            const mx = csx[c] / mass;
            const my = csy[c] / mass;
            ax += (mx - x) * FLUID.COH_A * free;
            ay += (my - y) * FLUID.COH_A * free;
            if (v3) {
              const dx = x - mx;
              const dy = y - my;
              const d = Math.hypot(dx, dy);
              const correction = Math.max(
                -FLUID.V3_SPREAD_MAX,
                Math.min(
                  FLUID.V3_SPREAD_MAX,
                  (ctr[c] / mass - csr[c] / mass) * FLUID.V3_SPREAD_A,
                ),
              );
              if (d > 1e-5) {
                ax += (dx / d) * correction * free;
                ay += (dy / d) * correction * free;
              }
            }
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
          ax += cx * curlGain * free * 2.2;
          ay += cy * curlGain * free * 2.2;

          // The scroll body force. Both terms scale by `free`, so bound liquid
          // — the §3.3 melts, resting footprints, the exact mark — never feels
          // them and the bind contract is untouched. The lean is differential
          // by construction: equilibrium offset is a/ω² and ω comes from each
          // droplet's own TAUP, so heavy droplets sag further than light ones
          // and the body stretches internally instead of translating.
          if (scroll !== 0) {
            ay -= scroll * FLUID.SCROLL_LEAN * free;
            ax += (x - 0.5) * scroll * FLUID.SCROLL_SHEAR * free;
          }

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

          // Typography-aware flow is a v3-only review layer. PageStage feeds
          // a small, cached set of field-space rectangles; only free liquid
          // sees them, so form endpoints and the bind=1 bridge remain exact.
          if (obstacleFlow && env.obstacleCount > 0 && env.obstacles) {
            const obstacleCount = Math.min(
              env.obstacleCount,
              FLUID_OBSTACLE_MAX,
            );
            const margin = FLUID.OBSTACLE_MARGIN + R[i] * 0.65;
            for (let oi = 0; oi < obstacleCount; oi++) {
              const off = oi * FLUID_OBSTACLE_STRIDE;
              const ocx = env.obstacles[off];
              const ocy = env.obstacles[off + 1];
              const ohx = env.obstacles[off + 2];
              const ohy = env.obstacles[off + 3];
              const weight = env.obstacles[off + 4];
              if (weight <= 0 || ohx <= 0 || ohy <= 0) continue;

              const dx = x - ocx;
              const dy = y - ocy;
              const qx = Math.abs(dx) - ohx;
              const qy = Math.abs(dy) - ohy;
              let nx = 0;
              let ny = 0;
              let fall = 0;

              if (qx > 0 || qy > 0) {
                const ex = Math.max(qx, 0) * (dx < 0 ? -1 : 1);
                const ey = Math.max(qy, 0) * (dy < 0 ? -1 : 1);
                const d = Math.hypot(ex, ey);
                if (d >= margin || d < 1e-7) continue;
                nx = ex / d;
                ny = ey / d;
                fall = 1 - d / margin;
              } else {
                // Inside a rectangle, leave through the nearest edge. Use the
                // authored target as the deterministic tie-break at center.
                const edgeX = ohx - Math.abs(dx);
                const edgeY = ohy - Math.abs(dy);
                if (edgeX < edgeY)
                  nx = dx === 0 ? (T[ix] < ocx ? -1 : 1) : dx < 0 ? -1 : 1;
                else
                  ny = dy === 0 ? (T[ix + 1] < ocy ? -1 : 1) : dy < 0 ? -1 : 1;
                fall = 1;
              }

              const push = FLUID.OBSTACLE_A * fall * fall * weight * free;
              ax += nx * push;
              ay += ny * push;
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

    // Standard fixed-step render interpolation. This intentionally renders
    // one H_MS slice behind the simulation; the 8 ms latency is imperceptible,
    // while every display cadence receives a continuously moving body.
    const alpha = Math.min(Math.max(acc / FLUID.H_MS, 0), 1);

    // ── output: mix(interpolated physics, legacy); BOTH states follow output
    for (let i = 0; i < N; i++) {
      const b = clamp01(BIND[i]);
      const ix = i * 2;
      const xPhys = X0[ix] + (XP[ix] - X0[ix]) * alpha;
      const yPhys = X0[ix + 1] + (XP[ix + 1] - X0[ix + 1]) * alpha;
      const ox = xPhys * (1 - b) + XL[ix] * b;
      const oy = yPhys * (1 - b) + XL[ix + 1] * b;
      P[ix] = ox;
      P[ix + 1] = oy;

      // Keep each hidden branch rooted in the droplet that was actually
      // rendered. At bind=0 the legacy shadow is fully hidden, so it inherits
      // P exactly; at bind=1 the physics body does the same. Intermediate bind
      // rebases both in proportion to their hidden share. This prevents a bind
      // rise from revealing a stale XL position (the cross-page teleport) and
      // prevents a bind release from revealing a stale XP position, while the
      // two sacred endpoints remain unchanged: bind=0 is the physics body and
      // bind=1 is the byte-exact legacy low-pass.
      XP[ix] += (ox - XP[ix]) * b;
      XP[ix + 1] += (oy - XP[ix + 1]) * b;
      X0[ix] += (ox - X0[ix]) * b;
      X0[ix + 1] += (oy - X0[ix + 1]) * b;
      XL[ix] += (ox - XL[ix]) * (1 - b);
      XL[ix + 1] += (oy - XL[ix + 1]) * (1 - b);

      // Bound motion carries no free-liquid momentum. Preserve the signed-off
      // damping threshold while the positional handoff above stays continuous
      // for every intermediate bind value.
      if (b > 0.5) {
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
            sTtl[s] =
              FLUID.SAT_TTL_MIN + FLUID.SAT_TTL_VAR * hash(spawnSeq, 79);
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
