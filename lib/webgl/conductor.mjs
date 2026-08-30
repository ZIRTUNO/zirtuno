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
import {
  FLUID,
  FLUID_OBSTACLE_MAX,
  FLUID_OBSTACLE_STRIDE,
  makeFluidCore,
} from "./fluid-core.mjs";

export const EPS_PRESENCE = 0.002;
export const EPS_FORM = 0.002;

export function makeConductor(scenes, opts = {}) {
  const ballMax = opts.ballMax ?? SDF_BALL_MAX;
  // Phase B: the fluid physics core is the default integrator; `?fphys=0`
  // (opts.physics === false) routes the pure legacy low-pass instead.
  const physicsOn = opts.physics !== false;
  // Physics v3 and text-aware flow are opt-in visual-review paths. Keeping
  // their switches separate makes force tuning independently reversible,
  // while the default and `?fphys=0` contracts remain untouched.
  const physicsV3 = physicsOn && opts.physicsV3 === true;
  const obstacleFlow = physicsV3 && opts.obstacleFlow === true;
  // The strike (click/tap) and its press gain are one rollback unit: ?fstrike=0
  // keeps the hand and removes the blow. Physics off removes both.
  const strikeOn = physicsOn && opts.strike !== false;
  const fluid = physicsOn
    ? makeFluidCore({
        v3: physicsV3,
        obstacles: obstacleFlow,
        formGain: opts.formGain,
      })
    : null;
  // Phase D: `?fcine=0` (opts.cine === false) keeps the merged score at its
  // neutral defaults — no veils or score-driven grade — for
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
  const input = {
    vel: 0,
    px: 0.5,
    py: 0.5,
    pvx: 0,
    pvy: 0,
    pon: 0,
    // 0/1 raw, damped into env.press — the hand pressing INTO the liquid
    press: 0,
    obstacles: new Float32Array(FLUID_OBSTACLE_MAX * FLUID_OBSTACLE_STRIDE),
    obstacleCount: 0,
  };

  // The strike queue. A click arrives on a DOM event, which has no relationship
  // to the render clock, so the shell enqueues in field uv and the conductor
  // drains on its next frame with its own tMs. That keeps one clock in the
  // physics and spares every caller from having to share it.
  const STRIKE_QUEUE = 6;
  const strikeBuf = new Float32Array(STRIKE_QUEUE * 3); // x, y, strength
  let strikeCount = 0;
  const score = {
    exposure: 1,
    veil: 0,
    vignette: 0,
    key: 0,
    mute: 0,
  };
  const stats = {
    violations: 0,
    holderId: null,
    energy: 0,
    active: 0,
  };
  const env = {
    px: 0.5,
    py: 0.5,
    pvx: 0,
    pvy: 0,
    pon: false,
    press: 0,
    vel: 0,
    obstacles: input.obstacles,
    obstacleCount: 0,
  };

  // per-scene frame context (stable objects — no per-frame allocation)
  const ctxs = scenes.map((s) => ({
    tMs: 0,
    t: 0,
    dt: 16.7,
    aspect: 1,
    ch: dmp[s.id],
    scrollVel: 0,
    physics: physicsOn,
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
  // per-droplet field density (1 = solid). Seeded solid so the first frame of a
  // fresh mount is the resting material, never a fade-in from nothing.
  const D = new Float32Array(N).fill(1);
  // Mean authored depth for each active scene. This lets scene extras and
  // short-lived spray inherit the layer they came from instead of flattening
  // every secondary droplet onto the near plane.
  const SCENE_Z = new Float32Array(scenes.length);

  // scratch target (scenes write EVERY field — no reset needed)
  const tmp = { x: 0, y: 0, r: 0, bind: 0, cluster: -1, z: 0, d: 1 };

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

  // ── the atmosphere's body ───────────────────────────────────────────────
  // The ambient lava-lamp beads are ANALYTIC: their anchors ride fixed loops,
  // so there was nothing for the hand or a strike to push, and the one family
  // that fills the empty parts of the page was also the one family that never
  // answered a pointer. Give each bead a small damped displacement around its
  // anchor, driven by the same interaction field the droplets feel (through
  // fluid.probe). The lava-lamp choreography is untouched — the beads dodge and
  // rock around it, then settle back.
  const AMBX = new Float32Array(PHYS.AMBIENT_N);
  const AMBY = new Float32Array(PHYS.AMBIENT_N);
  const AMBD = new Float32Array(PHYS.AMBIENT_N * 2);
  const AMBV = new Float32Array(PHYS.AMBIENT_N * 2);
  const ambA = new Float32Array(2);

  // What the FORM shader reads. Stable arrays, rewritten each frame — the
  // stage uploads them straight to iTouch / iShock, and they stay all-zero
  // (the shader's exact-identity case) whenever nothing is touching.
  const touchU = new Float32Array(4);
  const shockU = new Float32Array(FLUID.SHOCK_SLOTS * 4);
  const formD = new Float32Array(2);
  let touchLive = false;

  let lastT = -1;
  let dmpVel = 0;
  let dmpPress = 0;
  let seeded = false;
  let legacySeeded = false;

  // zBuf (optional, R5-C): a parallel per-ball depth array (0 near … 1 far)
  // the stage uploads as iBallZ. Written for EVERY packed slot each frame —
  // slot indices shift as counts vary, so stale values are never left behind.
  const frame = (tMs, buf, aspect, zBuf, idBuf, dBuf) => {
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
    dmpPress +=
      (clamp01(strikeOn ? input.press : 0) - dmpPress) *
      (1 - Math.exp(-dt / FLUID.PRESS_TAU));

    // Drain the strike queue onto the conductor's clock. Unconditionally, even
    // on ?fphys=0 where there is no core to receive them — a queue that only
    // empties when physics is on would fill once and then swallow every strike
    // for the rest of the session.
    // The interaction environment, resolved once and read by both the droplet
    // step and the form uniforms. It used to be assembled inside the droplet
    // branch, which is fine while droplets are the only consumer and wrong the
    // moment the forms became one: on a frame with no scene weight the forms
    // would have answered a stale pointer.
    env.px = input.px;
    env.py = input.py;
    env.pvx = input.pvx;
    env.pvy = input.pvy;
    env.pon = input.pon > 0.5;
    env.press = dmpPress;
    env.vel = dmpVel;
    env.obstacleCount = obstacleFlow ? input.obstacleCount : 0;

    if (strikeCount > 0) {
      if (fluid && strikeOn)
        for (let k = 0; k < strikeCount; k++)
          fluid.strike(
            strikeBuf[k * 3],
            strikeBuf[k * 3 + 1],
            tMs,
            strikeBuf[k * 3 + 2],
          );
      strikeCount = 0;
    }

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
      SCENE_Z.fill(0);
      for (let i = 0; i < N; i++) {
        let ax = 0,
          ay = 0,
          ar = 0,
          ab = 0,
          az = 0,
          ad = 0,
          currentClusW = 0,
          candidateW = 0,
          candidateClus = -1;
        const currentClus = CLUS[i];
        for (let si = 0; si < scenes.length; si++) {
          const w = W[si];
          if (w < 1e-4) continue;
          // Density is the ONE field a scene may leave unwritten: solid is the
          // overwhelming default, and `tmp` is deliberately not reset between
          // scenes, so an unset d would silently inherit the previous scene's
          // dissolve. Seed the identity before every call.
          tmp.d = 1;
          scenes[si].target(i, ctxs[si], tmp);
          ax += tmp.x * w;
          ay += tmp.y * w;
          ar += tmp.r * w;
          ab += tmp.bind * w;
          az += tmp.z * w;
          ad += tmp.d * w;
          SCENE_Z[si] += tmp.z / N;
          if (tmp.cluster === currentClus) currentClusW += w;
          if (tmp.cluster >= 0 && w > candidateW) {
            candidateW = w;
            candidateClus = tmp.cluster;
          }
        }
        TGT[i * 2] = ax;
        TGT[i * 2 + 1] = ay;
        TR[i] = ar;
        BIND[i] = ab;
        // Cluster ids are categorical in fluid-core v2, so use confidence
        // hysteresis at scene seams: retain a supported group, pass through a
        // neutral band, then admit a new group only after it clearly owns the
        // droplet. Bind still fades the cohesion force continuously.
        CLUS[i] =
          currentClus >= 0 && currentClusW >= 0.36
            ? currentClus
            : candidateW >= 0.72
              ? candidateClus
              : -1;
        Z[i] = az;
        // radius: ONE path in both modes — the kr low-pass (radius pops are a
        // shader hazard, never a physics feature)
        const kr = 1 - Math.exp(-dt / PHYS.TAU_RADIUS);
        if (R[i] < 0) R[i] = ar;
        else R[i] += (ar - R[i]) * kr;
        // density rides the same low-pass, for the same reason: a dissolve that
        // steps is a pop wearing a different name.
        D[i] += (ad - D[i]) * kr;
      }

      if (fluid) {
        // Phase B: the physics core (velocity, repulsion, cohesion, curl,
        // cursor field, pinch-off) — bind blends toward the byte-exact
        // legacy shadow, so melts and resting forms move as signed off
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

    // The forms answer the same hand and the same waves the droplets do — as a
    // domain displacement in the shader, since a form is an SDF and has no body
    // to push. Resolved BEFORE packing because the bound droplets below read the
    // very same numbers, and every frame — including frames with no scene weight
    // — so a form left rendering through a gap still responds.
    touchLive = fluid ? fluid.formUniforms(tMs, env, touchU, shockU) : false;

    // ── pack: visible droplets + ambient + scene extras — one shared field ──
    let count = 0;
    let depthMass = 0;
    let radiusMass = 0;
    for (let i = 0; i < N; i++) {
      // A droplet leaves the buffer once it is either too small to see OR too
      // thin to register. Dropping on density is what makes the exit graceful:
      // by the time it is culled the surface has already receded to nothing, so
      // there is no solid dot to pop out of existence.
      if (R[i] < 0.0012 || D[i] < 0.004) continue;
      // BOUND liquid takes the form's displacement, at render time only.
      //
      // At bind = 1 — the §3.3 melts, resting footprints, the exact mark — every
      // environmental force is switched off by contract. That is right for the
      // physics and wrong for the picture: mid-morph the stage is nothing but
      // bound droplets, so the liquid went completely dead to the hand exactly
      // when it was most alive to look at. These droplets share one iso-surface
      // with the form halves beside them, and those halves are ALREADY being
      // displaced at draw time, so leaving the droplets behind also pulled the
      // one liquid apart.
      //
      // Scaled by bind, it is continuous across the whole blend: free liquid
      // (bind 0) still answers through the physics and receives nothing here, so
      // nothing is counted twice. And it touches only `buf` — never P, XP or XL
      // — so the physics body, the legacy shadow and every melt landing are
      // exactly what they were. With no hand and no live wave the displacement
      // is identically zero, which is what keeps exact rest exact.
      let bx = P[i * 2];
      let by = P[i * 2 + 1];
      if (touchLive && BIND[i] > 0.001) {
        fluid.formDisplace(bx, by, touchU, shockU, tMs, formD);
        bx += formD[0] * BIND[i];
        by += formD[1] * BIND[i];
      }
      buf[count * 3] = bx;
      buf[count * 3 + 1] = by;
      buf[count * 3 + 2] = R[i];
      if (zBuf) zBuf[count] = Z[i];
      if (dBuf) dBuf[count] = D[i];
      if (idBuf) idBuf[count] = i;
      depthMass += Z[i] * R[i];
      radiusMass += R[i];
      count++;
    }

    // pinch-off spray (physics mode) — the same liquid family, budgeted.
    // fluid-core stays depth-agnostic; pack spray on the visible parent
    // family's radius-weighted layer instead of flattening it to near depth.
    let satOn = false;
    if (fluid) {
      const c0 = count;
      count = fluid.packSatellites(buf, count, ballMax, tMs, dBuf);
      satOn = count > c0;
      if (idBuf) idBuf.fill(-1, c0, count);
      if (zBuf) {
        let familyZ = 0;
        for (let si = 0; si < scenes.length; si++)
          familyZ += W[si] * SCENE_Z[si];
        const satZ = radiusMass > 1e-6 ? depthMass / radiusMass : familyZ;
        zBuf.fill(clamp01(satZ), c0, count);
      }
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
    const spanX = Math.max(aspect - 0.1, 0.5);
    for (let j = 0; j < PHYS.AMBIENT_N; j++) {
      const m = AMB[j];
      AMBX[j] = 0.5 + (m.fx - 0.5) * spanX + 0.05 * Math.sin(t * m.f1 + m.p1);
      AMBY[j] =
        m.ay +
        0.09 * Math.sin(t * m.f2 + m.p2) +
        0.045 * Math.sin(t * m.f3 + m.p3) +
        stirY * m.stir;
    }
    // Integrated for EVERY bead on every frame, outside the packing loop: a
    // displacement body that only advanced on the frames its bead happened to
    // be visible would jump the moment the composition brought it back.
    if (fluid) {
      const dtA = Math.min(dt, 50) / 1000;
      const om = FLUID.AMB_OMEGA;
      const damp = 2 * FLUID.AMB_ZETA * om;
      for (let j = 0; j < PHYS.AMBIENT_N; j++) {
        const m = AMB[j];
        const jx = j * 2;
        // the beads' own stored phases double as their irregularity seeds —
        // deterministic, already unique per bead, and free
        fluid.probe(
          AMBX[j] + AMBD[jx],
          AMBY[j] + AMBD[jx + 1],
          tMs,
          env,
          ambA,
          m.p1 / 6.2832,
          m.p2 / 6.2832,
        );
        AMBV[jx] +=
          (ambA[0] * FLUID.AMB_RESPONSE - om * om * AMBD[jx] - damp * AMBV[jx]) *
          dtA;
        AMBV[jx + 1] +=
          (ambA[1] * FLUID.AMB_RESPONSE -
            om * om * AMBD[jx + 1] -
            damp * AMBV[jx + 1]) *
          dtA;
        AMBD[jx] += AMBV[jx] * dtA;
        AMBD[jx + 1] += AMBV[jx + 1] * dtA;
        // the atmosphere rocks; it never leaves its lane
        const dm = Math.hypot(AMBD[jx], AMBD[jx + 1]);
        if (dm > FLUID.AMB_MAX) {
          const kk = FLUID.AMB_MAX / dm;
          AMBD[jx] *= kk;
          AMBD[jx + 1] *= kk;
          AMBV[jx] *= kk;
          AMBV[jx + 1] *= kk;
        }
      }
    }
    if (ambMul > 0.02) {
      for (let j = 0; j < PHYS.AMBIENT_N && count < ballMax; j++) {
        const m = AMB[j];
        const x = AMBX[j] + AMBD[j * 2];
        const y = AMBY[j] + AMBD[j * 2 + 1];
        const r = m.r * ambMul * (0.86 + 0.14 * Math.sin(t * m.f4 + m.p1));
        if (r < 0.0012) continue;
        buf[count * 3] = x;
        buf[count * 3 + 1] = Math.min(Math.max(y, 0.04), 0.96);
        buf[count * 3 + 2] = r;
        if (zBuf) zBuf[count] = PHYS.AMBIENT_Z; // the atmosphere sits behind
        if (dBuf) dBuf[count] = 1; // written, not inherited — slots shift
        if (idBuf) idBuf[count] = -1;
        count++;
      }
    }

    // scene extras (cursor chain, probe, spray) — budget-enforced, near depth
    let extraZ = 0;
    const push = (x, y, r, z = extraZ) => {
      if (count >= ballMax) return;
      buf[count * 3] = x;
      buf[count * 3 + 1] = y;
      buf[count * 3 + 2] = r;
      if (zBuf) zBuf[count] = clamp01(z);
      if (dBuf) dBuf[count] = 1; // written, not inherited — slots shift
      if (idBuf) idBuf[count] = -1;
      count++;
    };
    for (let si = 0; si < scenes.length; si++) {
      if (W[si] < 1e-4 || !scenes[si].extras) continue;
      extraZ = SCENE_Z[si];
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

    // ── light score (R5-D): merge scene channels ────────────────────────────
    score.exposure = 1;
    score.veil = 0;
    score.vignette = 0;
    score.key = 0;
    score.mute = 0;
    if (cineOn) {
      for (let si = 0; si < scenes.length; si++) {
        const s = scenes[si];
        if (W[si] < 1e-4 || !s.score) continue;
        const sc = s.score(ctxs[si]);
        if (sc.exposure !== undefined) score.exposure *= sc.exposure;
        if (sc.veil !== undefined && sc.veil > score.veil) score.veil = sc.veil;
        if (sc.vignette !== undefined && sc.vignette > score.vignette)
          score.vignette = sc.vignette;
        if (sc.key !== undefined && sc.key > score.key) score.key = sc.key;
        if (sc.mute !== undefined && sc.mute > score.mute) score.mute = sc.mute;
      }
    }
    // The LAST GATE between a scene's arithmetic and the shader. Math.max(NaN,0)
    // is NaN, so the old clamp passed a poisoned exposure straight through to
    // `col *= 1 + iExpo` — one bad channel read blanked the entire liquid and
    // every state-level gate still reported healthy, because the droplet buffer
    // and the form weights were all fine. Anything not a number resolves to the
    // neutral value here.
    score.exposure = score.exposure > 0 ? Math.min(score.exposure, 1.5) : 1;
    // Same treatment as exposure, for the same reason: Math.max(NaN,0) is NaN,
    // so this clamp used to launder a poisoned key straight into the shader.
    score.key = score.key > 0 ? Math.min(score.key, 1) : 0;
    score.veil = clamp01(score.veil);
    score.vignette = clamp01(score.vignette);
    score.mute = clamp01(score.mute);

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
    // A strike must never land on a page the governor has already idled to
    // ~30 Hz and play its wave at half rate, so the live shock energy is part
    // of the term rather than something the pointer has to imply.
    const shockE = fluid ? fluid.shockEnergy(tMs) : 0;
    stats.energy = clamp01(
      act +
        Math.min(Math.abs(dmpVel) * 0.4, 0.4) +
        pv +
        (satOn ? 0.3 : 0) +
        shockE +
        dmpPress * 0.25,
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
      mute: score.mute,
      count,
      // R5-C: score-driven in-shader light (neutral until Phase D scenes
      // score) + the cadence-governor energy
      expo: score.exposure - 1,
      key: score.key,
      energy: stats.energy,
      // the form's share of the interaction (iTouch / iShock)
      touch: touchU,
      shock: shockU,
      touchLive,
    };
  };

  return {
    /**
     * Register a click/tap at (x, y) in field uv. Strength scales the blow —
     * the shell raises it for a fast stab. Queued, not applied: the wave starts
     * on the conductor's next frame, on the conductor's clock.
     */
    strike: (x, y, strength = 1) => {
      if (strikeCount >= STRIKE_QUEUE) return;
      const o = strikeCount * 3;
      strikeBuf[o] = x;
      strikeBuf[o + 1] = y;
      strikeBuf[o + 2] = strength;
      strikeCount++;
    },
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
