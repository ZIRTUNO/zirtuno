/**
 * The CONDUCTOR (R5-A) — one brain for the one continuous liquid.
 *
 * Owns everything BETWEEN scenes (lib/webgl/scenes/*): per-channel damping,
 * presence weighting, per-droplet target blending across handoffs, the
 * form-slot ARBITER, the shared ambient lava-lamp family, integration
 * (Phase A: the legacy per-droplet low-pass on PHYS/TAUP — fluid-core replaces
 * this in Phase B), droplet packing, the light-score merge and the energy
 * hint. Implements the FieldDriver contract, so FieldStage needs no changes.
 *
 * THE ARBITER INVARIANT (validated design, correction C1): the shader has
 * exactly two form slots; forms NEVER crossfade between scenes. A scene is
 * granted the slots only when the current holder's total form weight has
 * drained below EPS_FORM — ownership transfers only through a droplet-only
 * state. A non-holder returning a non-null claim while the holder still
 * renders is counted in stats.violations (and ignored); the sim harness
 * (scripts/verify-conductor.mjs) asserts zero across scripted traversals.
 *
 * Pure .mjs (the sdf-core.mjs convention): no DOM, no timers — node-runnable
 * for simulation. Types: conductor.d.mts + lib/webgl/scenes/types.ts.
 */

import { PHYS, TAUP, N, AMB, clamp01 } from "./phys.mjs";
import { SDF_WARP_REST, SDF_BALL_MAX } from "./sdf-glass-shader.mjs";
import { makeFluidCore } from "./fluid-core.mjs";

export const EPS_PRESENCE = 0.002;
export const EPS_FORM = 0.002;

// The ONE white moment (R5-D, §10.3): the flash envelope the conductor owns.
// A scene only RAISES the raw flash channel; the first rising edge latches
// here — for the whole conductor lifetime — and plays a fixed ≤400 ms
// attack/decay. Re-scrubbing the fusion can never re-fire it, which makes
// "exactly one flash per traversal" a construction, not a convention.
export const FLASH_ATTACK_MS = 70;
export const FLASH_DECAY_MS = 310; // total 380 ms < the 400 ms WCAG budget
export const FLASH_GLOW_MS = 900; // afterglow: exposure settles behind it

export function makeConductor(scenes, opts = {}) {
  const ballMax = opts.ballMax ?? SDF_BALL_MAX;
  // Phase B: the fluid physics core is the default integrator; `?fphys=0`
  // (opts.physics === false) routes the pure legacy low-pass instead.
  const physicsOn = opts.physics !== false;
  const fluid = physicsOn ? makeFluidCore() : null;
  // Phase D: `?fcine=0` (opts.cine === false) keeps the merged score at its
  // neutral defaults — no veils, no flash, no score-driven grade — for
  // deterministic optics comparison and as the cinematic escape hatch.
  const cineOn = opts.cine !== false;

  // forms union, first-appearance order (scene 0's forms[0] gates first paint)
  const forms = [];
  for (const s of scenes)
    for (const f of s.forms) if (!forms.includes(f)) forms.push(f);

  // raw + damped channel stores, seeded from each scene's declared defaults
  const raw = {};
  const dmp = {};
  for (const s of scenes) {
    raw[s.id] = { ...s.channels };
    dmp[s.id] = { ...s.channels };
  }

  // vel = scroll velocity (vh/s); px/py/pvx/pvy/pon = the page-wide pointer
  // in field uv (the cursor force field — Phase B)
  const input = { vel: 0, px: 0.5, py: 0.5, pvx: 0, pvy: 0, pon: 0 };
  const score = { exposure: 1, veil: 0, flash: 0, vignette: 0, key: 0 };
  const stats = { violations: 0, holderId: null, energy: 0, active: 0, flashes: 0 };
  let flashT0 = -1; // latched start of the one flash (-1 = never fired)
  const env = { px: 0.5, py: 0.5, pvx: 0, pvy: 0, pon: false, vel: 0 };

  // per-scene frame context (stable objects — no per-frame allocation)
  const ctxs = scenes.map((s) => ({
    tMs: 0,
    t: 0,
    dt: 16.7,
    aspect: 1,
    ch: dmp[s.id],
    scrollVel: 0,
  }));

  // droplet state (position/radius live HERE, continuous across ALL scenes)
  const P = new Float32Array(N * 2);
  const R = new Float32Array(N).fill(-1);
  // blended per-frame targets + physics attributes
  const TGT = new Float32Array(N * 2);
  const TR = new Float32Array(N);
  const BIND = new Float32Array(N);
  const CLUS = new Int16Array(N).fill(-1);
  const Z = new Float32Array(N);

  // scratch target (scenes write EVERY field — no reset needed)
  const tmp = { x: 0, y: 0, r: 0, bind: 0, cluster: -1, z: 0 };

  // presence/weight state — sticky across dead gaps (the last active scene
  // keeps steering its own drained droplets; nothing ever snaps to zero)
  const pres = new Float32Array(scenes.length);
  const W = new Float32Array(scenes.length);
  let haveW = false;

  // form-slot arbiter state
  let holder = -1; // scene index
  const lastForm = {
    a: forms[0] ?? 0,
    b: forms[0] ?? 0,
    fa: 0,
    fb: 0,
    ea: 0,
    eb: 0,
    ox: 0,
    oy: 0,
    scale: 1,
    warp: SDF_WARP_REST,
  };
  const claims = new Array(scenes.length).fill(null);

  let lastT = -1;
  let dmpVel = 0;
  let seeded = false;
  let legacySeeded = false;

  // zBuf (optional, R5-C): a parallel per-ball depth array (0 near … 1 far)
  // the stage uploads as iBallZ. Written for EVERY packed slot each frame —
  // slot indices shift as counts vary, so stale values are never left behind.
  const frame = (tMs, buf, aspect, zBuf) => {
    const dt = lastT < 0 ? 16.7 : Math.min(Math.max(tMs - lastT, 0), 100);
    lastT = tMs;
    const t = tMs / 1000;

    // first frame: seed the damped state from the live raw values (the shell
    // measures before the stage draws), so mounts and deep-links render the
    // real scroll position instantly — never a ramp-in from defaults
    if (!seeded) {
      seeded = true;
      for (const s of scenes) {
        const rw = raw[s.id];
        const dm = dmp[s.id];
        for (const key in rw) dm[key] = rw[key];
      }
    }

    // ── channel damping (per-scene policy: tau ms | false = raw) ─────────────
    const kDef = 1 - Math.exp(-dt / PHYS.TAU_CHANNEL);
    for (let si = 0; si < scenes.length; si++) {
      const s = scenes[si];
      const rw = raw[s.id];
      const dm = dmp[s.id];
      for (const key in rw) {
        const v = rw[key];
        const pol = s.damp ? s.damp[key] : undefined;
        if (pol === false) {
          dm[key] = v;
        } else {
          const cur = dm[key];
          if (cur === undefined || cur !== cur) dm[key] = v;
          else {
            const k = pol === undefined ? kDef : 1 - Math.exp(-dt / pol);
            dm[key] = cur + (v - cur) * k;
          }
        }
      }
      const c = ctxs[si];
      c.tMs = tMs;
      c.t = t;
      c.dt = dt;
      c.aspect = aspect;
    }
    dmpVel += (input.vel - dmpVel) * (1 - Math.exp(-dt / PHYS.TAU_VEL));
    for (const c of ctxs) c.scrollVel = dmpVel;

    // ── machines, presences, weights ─────────────────────────────────────────
    for (let si = 0; si < scenes.length; si++)
      if (scenes[si].tick) scenes[si].tick(ctxs[si]);

    let sum = 0;
    let active = 0;
    for (let si = 0; si < scenes.length; si++) {
      const p = clamp01(scenes[si].presence(ctxs[si]));
      pres[si] = p > EPS_PRESENCE ? p : 0;
      if (pres[si] > 0) active++;
      sum += pres[si];
    }
    stats.active = active;
    if (sum > EPS_PRESENCE) {
      for (let si = 0; si < scenes.length; si++) W[si] = pres[si] / sum;
      haveW = true;
    }
    // else: keep last weights (sticky) — the last scene's targets drain freely

    // ── the 48 droplets: blend targets across active scenes, integrate ──────
    if (haveW) {
      for (let i = 0; i < N; i++) {
        let ax = 0,
          ay = 0,
          ar = 0,
          ab = 0,
          az = 0,
          wMax = 0,
          clus = -1;
        for (let si = 0; si < scenes.length; si++) {
          const w = W[si];
          if (w < 1e-4) continue;
          scenes[si].target(i, ctxs[si], tmp);
          ax += tmp.x * w;
          ay += tmp.y * w;
          ar += tmp.r * w;
          ab += tmp.bind * w;
          az += tmp.z * w;
          if (w > wMax) {
            wMax = w;
            clus = tmp.cluster;
          }
        }
        TGT[i * 2] = ax;
        TGT[i * 2 + 1] = ay;
        TR[i] = ar;
        BIND[i] = ab;
        CLUS[i] = clus;
        Z[i] = az;
        // radius: ONE path in both modes — the kr low-pass (radius pops are a
        // shader hazard, never a physics feature)
        const kr = 1 - Math.exp(-dt / PHYS.TAU_RADIUS);
        if (R[i] < 0) R[i] = ar;
        else R[i] += (ar - R[i]) * kr;
      }

      if (fluid) {
        // Phase B: the physics core (velocity, repulsion, cohesion, curl,
        // cursor field, pinch-off) — bind blends toward the byte-exact
        // legacy shadow, so melts and resting forms move as signed off
        env.px = input.px;
        env.py = input.py;
        env.pvx = input.pvx;
        env.pvy = input.pvy;
        env.pon = input.pon > 0.5;
        env.vel = dmpVel;
        fluid.step(P, TGT, BIND, CLUS, R, dt, tMs, env);
      } else {
        // legacy integrator (?fphys=0) — the Phase-A low-pass, verbatim
        for (let i = 0; i < N; i++) {
          const kp = 1 - Math.exp(-dt / TAUP[i]);
          if (!legacySeeded) {
            P[i * 2] = TGT[i * 2];
            P[i * 2 + 1] = TGT[i * 2 + 1];
          } else {
            P[i * 2] += (TGT[i * 2] - P[i * 2]) * kp;
            P[i * 2 + 1] += (TGT[i * 2 + 1] - P[i * 2 + 1]) * kp;
          }
        }
        legacySeeded = true;
      }
    }

    // ── pack: visible droplets + ambient + scene extras — one shared field ──
    let count = 0;
    for (let i = 0; i < N; i++) {
      if (R[i] < 0.0012) continue;
      buf[count * 3] = P[i * 2];
      buf[count * 3 + 1] = P[i * 2 + 1];
      buf[count * 3 + 2] = R[i];
      if (zBuf) zBuf[count] = Z[i];
      count++;
    }

    // pinch-off spray (physics mode) — the same liquid family, budgeted.
    // Satellites are near liquid (spray off visible bodies): depth 0.
    let satOn = false;
    if (fluid) {
      const c0 = count;
      count = fluid.packSatellites(buf, count, ballMax, tMs);
      satOn = count > c0;
      if (zBuf) zBuf.fill(0, c0, count);
    }

    // ambient lava lamp — conductor-owned, site-wide; scenes contribute a
    // calm multiplier (Σ w·ambient) so compositions can quiet their stage
    let ambMul = 0;
    for (let si = 0; si < scenes.length; si++) {
      if (W[si] < 1e-4) continue;
      const s = scenes[si];
      ambMul += W[si] * (s.ambient ? s.ambient(ctxs[si]) : 1);
    }
    const stirY = Math.max(-2.2, Math.min(2.2, dmpVel)) * PHYS.STIR;
    if (ambMul > 0.02) {
      const spanX = Math.max(aspect - 0.1, 0.5);
      for (let j = 0; j < PHYS.AMBIENT_N && count < ballMax; j++) {
        const m = AMB[j];
        const x = 0.5 + (m.fx - 0.5) * spanX + 0.05 * Math.sin(t * m.f1 + m.p1);
        const y =
          m.ay +
          0.09 * Math.sin(t * m.f2 + m.p2) +
          0.045 * Math.sin(t * m.f3 + m.p3) +
          stirY * m.stir;
        const r = m.r * ambMul * (0.86 + 0.14 * Math.sin(t * m.f4 + m.p1));
        if (r < 0.0012) continue;
        buf[count * 3] = x;
        buf[count * 3 + 1] = Math.min(Math.max(y, 0.04), 0.96);
        buf[count * 3 + 2] = r;
        if (zBuf) zBuf[count] = PHYS.AMBIENT_Z; // the atmosphere sits behind
        count++;
      }
    }

    // scene extras (cursor chain, probe, spray) — budget-enforced, near depth
    const push = (x, y, r) => {
      if (count >= ballMax) return;
      buf[count * 3] = x;
      buf[count * 3 + 1] = y;
      buf[count * 3 + 2] = r;
      if (zBuf) zBuf[count] = 0;
      count++;
    };
    for (let si = 0; si < scenes.length; si++) {
      if (W[si] < 1e-4 || !scenes[si].extras) continue;
      scenes[si].extras(ctxs[si], push);
    }

    // ── the form-slot ARBITER (invariant C1: droplet-only handoffs) ──────────
    for (let si = 0; si < scenes.length; si++)
      claims[si] = W[si] >= 1e-4 ? scenes[si].form(ctxs[si]) : null;

    let hf = holder >= 0 ? claims[holder] : null;
    if (!hf || hf.fa + hf.fb < EPS_FORM) {
      // holder drained (or never existed) → grant the strongest RENDERING
      // claimant; else the strongest staging-only claim (keeps a/b continuity)
      let best = -1;
      let bw = -1;
      for (let si = 0; si < scenes.length; si++) {
        if (!claims[si] || claims[si].fa + claims[si].fb < EPS_FORM) continue;
        if (W[si] > bw) {
          bw = W[si];
          best = si;
        }
      }
      if (best < 0)
        for (let si = 0; si < scenes.length; si++) {
          if (!claims[si]) continue;
          if (W[si] > bw) {
            bw = W[si];
            best = si;
          }
        }
      holder = best;
      hf = best >= 0 ? claims[best] : null;
    } else {
      // holder still renders — any other claim is a violation (ignored)
      for (let si = 0; si < scenes.length; si++) {
        if (si === holder || !claims[si]) continue;
        if (claims[si].fa + claims[si].fb >= EPS_FORM) stats.violations++;
      }
    }
    stats.holderId = holder >= 0 ? scenes[holder].id : null;

    if (hf) {
      lastForm.a = hf.a;
      lastForm.b = hf.b;
      lastForm.fa = hf.fa;
      lastForm.fb = hf.fb;
      lastForm.ea = hf.ea;
      lastForm.eb = hf.eb;
      lastForm.ox = hf.ox;
      lastForm.oy = hf.oy;
      lastForm.scale = hf.scale;
      lastForm.warp = hf.warp;
    } else {
      // dead gap: keep the last staging (valid texture indices for the stage
      // gate) with the weights fully drained — nothing renders
      lastForm.fa = 0;
      lastForm.fb = 0;
      lastForm.warp = SDF_WARP_REST;
    }

    // ── light score (R5-D): merge scene channels, then own the ONE flash ────
    score.exposure = 1;
    score.veil = 0;
    score.flash = 0;
    score.vignette = 0;
    score.key = 0;
    if (cineOn) {
      for (let si = 0; si < scenes.length; si++) {
        const s = scenes[si];
        if (W[si] < 1e-4 || !s.score) continue;
        const sc = s.score(ctxs[si]);
        if (sc.exposure !== undefined) score.exposure *= sc.exposure;
        if (sc.veil !== undefined && sc.veil > score.veil) score.veil = sc.veil;
        if (sc.flash !== undefined && sc.flash > score.flash)
          score.flash = sc.flash;
        if (sc.vignette !== undefined && sc.vignette > score.vignette)
          score.vignette = sc.vignette;
        if (sc.key !== undefined && sc.key > score.key) score.key = sc.key;
      }
      // the flash LATCH: scenes only raise the raw channel; the first rising
      // edge starts the fixed envelope and no later edge can ever re-arm it.
      // The output flash is ALWAYS the envelope — a scene stuck at raw 1
      // still produces one ≤400 ms moment, then black.
      if (flashT0 < 0 && score.flash > 0.5) {
        flashT0 = tMs;
        stats.flashes++;
      }
      if (flashT0 >= 0) {
        const fe = tMs - flashT0;
        score.flash =
          fe < FLASH_ATTACK_MS
            ? fe / FLASH_ATTACK_MS
            : Math.max(0, 1 - (fe - FLASH_ATTACK_MS) / FLASH_DECAY_MS);
        // afterglow: the fused mark holds a settling exposure lift behind the
        // flash (time-based — the moment breathes even if the scroll stops)
        if (fe < FLASH_GLOW_MS)
          score.exposure *= 1 + 0.12 * (1 - clamp01(fe / FLASH_GLOW_MS));
      } else {
        score.flash = 0;
      }
    }
    score.exposure = Math.min(Math.max(score.exposure, 0), 1.5);
    score.key = Math.min(Math.max(score.key, 0), 1);
    score.veil = clamp01(score.veil);
    score.flash = clamp01(score.flash);
    score.vignette = clamp01(score.vignette);

    // energy for the R5-C cadence governor (§12.3): scene activity + scroll
    // + pointer speed + live spray. Anything moving fast keeps 60 Hz; a truly
    // idle page may drop to the 30 Hz floor (never below — never frozen).
    let act = 0;
    for (let si = 0; si < scenes.length; si++) {
      if (W[si] < 1e-4) continue;
      const s = scenes[si];
      const a = W[si] * (s.activity ? s.activity(ctxs[si]) : 1);
      if (a > act) act = a;
    }
    const pv =
      input.pon > 0.5
        ? Math.min(Math.hypot(input.pvx, input.pvy) * 0.8, 0.6)
        : 0;
    stats.energy = clamp01(
      act +
        Math.min(Math.abs(dmpVel) * 0.4, 0.4) +
        pv +
        (satOn ? 0.3 : 0),
    );

    return {
      a: lastForm.a,
      b: lastForm.b,
      fa: lastForm.fa,
      fb: lastForm.fb,
      ea: lastForm.ea,
      eb: lastForm.eb,
      ox: lastForm.ox,
      oy: lastForm.oy,
      scale: lastForm.scale,
      warp: lastForm.warp,
      mute: 0,
      count,
      // R5-C: score-driven in-shader light (neutral until Phase D scenes
      // score) + the cadence-governor energy
      expo: score.exposure - 1,
      key: score.key,
      energy: stats.energy,
    };
  };

  return {
    driver: {
      forms,
      formReady: (s) => {
        for (const sc of scenes) if (sc.formReady) sc.formReady(s);
      },
      frame,
    },
    raw,
    input,
    score,
    stats,
  };
}
