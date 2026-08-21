// Conductor sim harness (R5-A) — node-side, no browser. Proves the mechanics
// every scene relies on BEFORE any scene is ported:
//   1. continuity   — step-function raw channels never render as snaps (the
//                     damping + per-droplet inertia absorb them)
//   2. arbiter      — form-slot ownership transfers ONLY through a droplet-
//                     only state (holder drains below eps → claimant granted
//                     the same frame); per-slot texture indices never change
//                     while that slot still renders
//   3. suppression  — a scene claiming while the holder renders is counted a
//                     violation and IGNORED (output stays the holder's)
//   4. stress       — 10k frames of random dt spikes + channel noise: every
//                     output finite, ball count within budget
//   5. budget       — extras can never overflow the ball buffer
//   6. sticky gap   — all presences at 0: weights hold, output stays finite
//   7. the strike   — a click is a travelling wave that leaves bind=1 exact,
//                     never rings, throws spray only from liquid that was
//                     there, saturates under a mash, and rolls back cleanly
//   node scripts/verify-conductor.mjs

import {
  makeConductor,
  EPS_FORM,
  FLASH_ATTACK_MS,
  FLASH_DECAY_MS,
} from "../lib/webgl/conductor.mjs";
import { N, PHYS } from "../lib/webgl/phys.mjs";
import { FLUID } from "../lib/webgl/fluid-core.mjs";
import { SDF_BALL_MAX, SDF_WARP_REST } from "../lib/webgl/sdf-glass-shader.mjs";

const failures = [];
const ok = (cond, msg) => {
  if (!cond) failures.push(msg);
};

// ── stub scenes ────────────────────────────────────────────────────────────────
// A parks droplets at (0.3,0.5) and claims form 0 while its own weight allows;
// B parks at (0.7,0.5) and claims form 3. Both derive form weight from their
// presence channel so the CORRECT handoff grammar (drain → grant) is scripted
// by the channel script itself.
const mkScene = (id, x, form, opts = {}) => ({
  id,
  forms: [form],
  channels: { p: 0 },
  presence: (ctx) => ctx.ch.p,
  target: (i, ctx, out) => {
    // realistic composition: droplets spread on a small disc (scenes never
    // stack 48 live droplets on one point — footprints distribute them)
    out.x = x + 0.1 * Math.cos(i * 2.4) * (0.3 + (0.7 * ((i * 7) % 10)) / 10);
    out.y = 0.5 + 0.1 * Math.sin(i * 2.4) * (0.3 + (0.7 * ((i * 7) % 10)) / 10);
    out.r = 0.012 * ctx.ch.p;
    out.bind = 0;
    out.cluster = -1;
    out.z = 0;
  },
  form(ctx) {
    const w = opts.formW ? opts.formW(ctx) : ctx.ch.p;
    if (w <= 0) return null;
    return {
      a: form,
      b: form,
      fa: w,
      fb: 0,
      ea: 0,
      eb: 0,
      ox: 0,
      oy: 0,
      scale: 1,
      warp: SDF_WARP_REST,
    };
  },
  ...(opts.extras ? { extras: opts.extras } : {}),
});

const buf = new Float32Array(SDF_BALL_MAX * 3);
const finiteFrame = (f) =>
  [
    f.a,
    f.b,
    f.fa,
    f.fb,
    f.ea,
    f.eb,
    f.ox,
    f.oy,
    f.scale,
    f.warp,
    f.count,
  ].every(Number.isFinite);

// Packed identity metadata is optional and renderer-only: canonical droplets
// keep their stable 0…47 ids even when transient families shift packed slots;
// satellites, ambience, and scene extras stay explicitly anonymous (-1).
{
  const scene = mkScene("identity", 0.5, 0);
  const c = makeConductor([scene]);
  const ids = new Int16Array(SDF_BALL_MAX);
  let t = 0;
  let frame;
  c.raw.identity.p = 1;
  for (let i = 0; i < 30; i++) {
    ids.fill(-9);
    t += 16.7;
    frame = c.driver.frame(t, buf, 1.5, undefined, ids);
  }
  ok(
    frame.count >= N,
    `identity: only ${frame.count}/${N} canonical droplets packed`,
  );
  for (let i = 0; i < N; i++)
    ok(ids[i] === i, `identity: packed canonical slot ${i} reports ${ids[i]}`);
  for (let i = N; i < frame.count; i++)
    ok(ids[i] === -1, `identity: transient slot ${i} reports ${ids[i]}`);
}

// ── 1+2: continuity + arbiter across a scripted handoff ──────────────────────
{
  // CORRECT form grammar (the real drivers' sequencing): the form renders only
  // in the upper half of the scene's own presence, so A has fully DRAINED
  // before B rises — ownership passes through a droplet-only state.
  const seq = (ctx) => Math.max(0, (ctx.ch.p - 0.5) * 2);
  const A = mkScene("A", 0.3, 0, { formW: seq });
  const B = mkScene("B", 0.7, 3, { formW: seq });
  const c = makeConductor([A, B]);
  let t = 0;
  let prev = null;
  let prevFrame = null;
  let maxDelta = 0;
  let granted = "";
  let switchedWhileHot = false;
  for (let fr = 0; fr < 900; fr++) {
    // STEP functions on purpose — raw inputs are allowed to jump
    c.raw.A.p = fr < 300 ? 1 : fr < 460 ? 1 - (fr - 300) / 160 : 0;
    c.raw.B.p = fr < 300 ? 0 : fr < 460 ? (fr - 300) / 160 : 1;
    t += 16.7;
    const f = c.driver.frame(t, buf, 1.5);
    ok(finiteFrame(f), `handoff frame ${fr} not finite`);
    // continuity of the first droplet's packed position
    if (f.count > 0) {
      const px = buf[0],
        py = buf[1];
      if (prev) {
        const d = Math.hypot(px - prev[0], py - prev[1]);
        if (d > maxDelta) maxDelta = d;
      }
      prev = [px, py];
    }
    // per-slot index invariant: an index may change only while that slot is
    // VISUALLY empty on both sides of the switch (1% weight = invisible; the
    // arbiter's own release threshold is EPS_FORM, one epsilon below)
    const HOT = 0.01;
    if (prevFrame) {
      if (f.a !== prevFrame.a)
        if (Math.min(f.fa, prevFrame.fa) >= HOT) switchedWhileHot = true;
      if (f.b !== prevFrame.b)
        if (Math.min(f.fb, prevFrame.fb) >= HOT) switchedWhileHot = true;
    }
    prevFrame = { a: f.a, b: f.b, fa: f.fa, fb: f.fb };
    if (c.stats.holderId && !granted.endsWith(c.stats.holderId))
      granted += c.stats.holderId;
  }
  // no-teleport ceiling: physics moves faster than the old filter (velocity-
  // limited glide ≤ V_MAX), but a step input must never render as a jump
  ok(
    maxDelta < 0.04,
    `continuity: max per-frame droplet delta ${maxDelta.toFixed(4)} ≥ 0.04`,
  );
  ok(granted === "AB", `arbiter: holder sequence "${granted}" (want "AB")`);
  ok(
    !switchedWhileHot,
    "arbiter: a texture slot index changed while rendering",
  );
  ok(
    c.stats.violations === 0,
    `arbiter: ${c.stats.violations} violations on a correct script`,
  );
  ok(
    c.stats.holderId === "B",
    `arbiter: final holder ${c.stats.holderId} (want B)`,
  );
}

// ── 3: violation suppression ──────────────────────────────────────────────────
{
  const A = mkScene("A", 0.3, 0);
  // C claims AT FULL WEIGHT while A still renders — the wrong grammar
  const C = mkScene("C", 0.7, 5, { formW: () => 1 });
  const c = makeConductor([A, C]);
  let t = 0;
  let f = null;
  for (let fr = 0; fr < 200; fr++) {
    c.raw.A.p = 1;
    c.raw.C.p = 0.4; // both present; A is holder (first + stronger)
    t += 16.7;
    f = c.driver.frame(t, buf, 1.5);
  }
  ok(c.stats.violations > 0, "suppression: violating claim not counted");
  ok(
    c.stats.holderId === "A",
    `suppression: holder stolen by violator (${c.stats.holderId})`,
  );
  ok(f.a === 0, `suppression: output form ${f.a} (want holder's 0)`);
}

// ── 4: stress — random dt spikes + channel noise, 10k frames ─────────────────
{
  const A = mkScene("A", 0.3, 0);
  const B = mkScene("B", 0.7, 3);
  const c = makeConductor([A, B]);
  let t = 0;
  let rngState = 1234567;
  const rng = () => {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  };
  let allFinite = true;
  let maxCount = 0;
  for (let fr = 0; fr < 10000; fr++) {
    c.raw.A.p = rng();
    c.raw.B.p = rng();
    c.input.vel = (rng() - 0.5) * 12;
    t += rng() * 120; // dt spikes past the 100ms clamp
    const f = c.driver.frame(t, buf, 0.7 + rng() * 1.6);
    if (!finiteFrame(f)) allFinite = false;
    for (let i = 0; i < f.count * 3; i++)
      if (!Number.isFinite(buf[i])) allFinite = false;
    if (f.count > maxCount) maxCount = f.count;
  }
  ok(allFinite, "stress: non-finite output");
  ok(
    maxCount <= SDF_BALL_MAX,
    `stress: count ${maxCount} > budget ${SDF_BALL_MAX}`,
  );
}

// ── 5: extras budget ──────────────────────────────────────────────────────────
{
  const A = mkScene("A", 0.3, 0, {
    extras: (ctx, push) => {
      for (let i = 0; i < 500; i++) push(0.5, 0.5, 0.01);
    },
  });
  const c = makeConductor([A]);
  c.raw.A.p = 1;
  const f = c.driver.frame(16.7, buf, 1);
  ok(f.count <= SDF_BALL_MAX, `budget: extras overflowed to ${f.count}`);
}

// ── 6: sticky gap — presences all zero ────────────────────────────────────────
{
  const A = mkScene("A", 0.3, 0);
  const c = makeConductor([A]);
  let t = 0;
  for (let fr = 0; fr < 120; fr++) {
    c.raw.A.p = fr < 60 ? 1 : 0;
    t += 16.7;
    const f = c.driver.frame(t, buf, 1.5);
    ok(finiteFrame(f), `gap frame ${fr} not finite`);
    if (fr === 119)
      ok(f.fa < EPS_FORM, `gap: form still rendering (fa=${f.fa})`);
  }
}

// ═══ PHYSICS (R5-B: fluid-core through the conductor) ═════════════════════════

// a scene whose droplets sit at (x0,y0) then JUMP to (x1,y1) at a scripted
// frame, with a controllable bind — the physics test fixture
const mkJumpScene = (bind) => ({
  id: "J",
  forms: [0],
  channels: { p: 1, jump: 0 },
  damp: { p: false, jump: false },
  presence: (ctx) => ctx.ch.p,
  target: (i, ctx, out) => {
    out.x = ctx.ch.jump ? 0.7 : 0.3;
    out.y = 0.5;
    // ONE live droplet — free-droplet dynamics in isolation (48 coincident
    // live droplets would rightly repel into an equilibrium ring)
    out.r = i === 0 ? 0.02 : 0;
    out.bind = bind;
    out.cluster = -1;
    out.z = 0;
  },
  form: () => null,
});

// ── P1: settle — a free droplet reaches a jumped target fast, no ringing ────
{
  const c = makeConductor([mkJumpScene(0)]);
  let t = 0;
  for (let fr = 0; fr < 30; fr++) {
    t += 16.7;
    c.driver.frame(t, buf, 1.5); // settle at the initial target
  }
  c.raw.J.jump = 1;
  let settledAt = -1;
  let overshoot = 0;
  for (let fr = 0; fr < 180; fr++) {
    t += 16.7;
    const f = c.driver.frame(t, buf, 1.5);
    const x = buf[0]; // droplet 0 (first packed)
    if (x > 0.7) overshoot = Math.max(overshoot, x - 0.7);
    if (settledAt < 0 && Math.abs(x - 0.7) < 0.004) settledAt = fr * 16.7;
    ok(finiteFrame(f), `settle frame ${fr} not finite`);
  }
  ok(
    settledAt >= 0 && settledAt < 1500,
    `settle: free droplet took ${settledAt}ms (want < 1500)`,
  );
  // a whisper of slosh on a hard 0.4-uv jump is liquid; ringing is not
  ok(
    overshoot < 0.025,
    `settle: overshoot ${overshoot.toFixed(4)} ≥ 0.025 (ringing)`,
  );
}

// ── P2: bind=1 parity — bound droplets move EXACTLY like the legacy path ────
{
  const cPhys = makeConductor([mkJumpScene(1)]);
  const cLeg = makeConductor([mkJumpScene(1)], { physics: false });
  const buf2 = new Float32Array(SDF_BALL_MAX * 3);
  let t = 0;
  let maxDiff = 0;
  for (let fr = 0; fr < 300; fr++) {
    t += 16.7;
    if (fr === 60) {
      cPhys.raw.J.jump = 1;
      cLeg.raw.J.jump = 1;
    }
    cPhys.driver.frame(t, buf, 1.5);
    cLeg.driver.frame(t, buf2, 1.5);
    for (let i = 0; i < 8; i++) {
      const d =
        Math.abs(buf[i * 3] - buf2[i * 3]) +
        Math.abs(buf[i * 3 + 1] - buf2[i * 3 + 1]);
      if (d > maxDiff) maxDiff = d;
    }
  }
  ok(
    maxDiff < 1e-5,
    `bind parity: bound physics diverges from legacy by ${maxDiff.toExponential(2)} (melts would change)`,
  );
}

// ── P3: bind handoff continuity — neither hidden branch may reappear stale ─
{
  const S = {
    id: "S",
    forms: [0],
    channels: { p: 1, x: 0.25, bind: 0 },
    damp: { p: false, x: false, bind: false },
    presence: (ctx) => ctx.ch.p,
    target: (i, ctx, out) => {
      out.x = ctx.ch.x;
      out.y = 0.5;
      out.r = i === 0 ? 0.02 : 0;
      out.bind = ctx.ch.bind;
      out.cluster = -1;
      out.z = 0;
    },
    form: () => null,
    ambient: () => 0,
    activity: () => 0,
  };
  const c = makeConductor([S]);
  let t = 0;
  let prev = 0;
  let bindRiseDelta = 0;
  let bindFallDelta = 0;
  for (let fr = 0; fr < 100; fr++) {
    // Let the free body and the hidden legacy shadow acquire different motion,
    // then switch both ways. The shown identity must continue from P rather
    // than reveal whichever branch was previously hidden.
    if (fr === 20) c.raw.S.x = 0.8;
    if (fr === 32) c.raw.S.bind = 1;
    if (fr === 52) c.raw.S.x = 0.2;
    if (fr === 64) c.raw.S.bind = 0;
    t += 16.7;
    c.driver.frame(t, buf, 1.5);
    const x = buf[0];
    if (fr > 0) {
      const d = Math.abs(x - prev);
      if (fr === 32) bindRiseDelta = d;
      if (fr === 64) bindFallDelta = d;
    }
    prev = x;
  }
  ok(
    bindRiseDelta < 0.04,
    `bind handoff: free→exact jumped ${bindRiseDelta.toFixed(4)} ≥ 0.04`,
  );
  ok(
    bindFallDelta < 0.04,
    `bind handoff: exact→free jumped ${bindFallDelta.toFixed(4)} ≥ 0.04`,
  );
}

// ── P4: high-refresh interpolation — no freeze/catch-up at 144/165 Hz ──────
{
  const makeMotionScene = () => ({
    id: "M",
    forms: [0],
    channels: { p: 1, x: 0.2 },
    damp: { p: false, x: false },
    presence: (ctx) => ctx.ch.p,
    target: (i, ctx, out) => {
      out.x = ctx.ch.x;
      out.y = 0.5;
      out.r = i === 0 ? 0.02 : 0;
      out.bind = 0;
      out.cluster = -1;
      out.z = 0;
    },
    form: () => null,
    ambient: () => 0,
    activity: () => 0,
  });

  for (const hz of [144, 165]) {
    const c = makeConductor([makeMotionScene()]);
    let t = 0;
    let prev = 0;
    let freezes = 0;
    for (let fr = 0; fr < 500; fr++) {
      c.raw.M.x = 0.2 + (0.35 * fr) / 499;
      t += 1000 / hz;
      c.driver.frame(t, buf, 1.5);
      const x = buf[0];
      if (fr > 80 && Math.abs(x - prev) < 1e-7) freezes++;
      prev = x;
    }
    ok(
      freezes === 0,
      `high refresh: ${freezes} frozen moving frames at ${hz} Hz`,
    );
  }
}

// ── P5: negative field x is valid — never reuse it as an init sentinel ──────
{
  const makeLeftScene = () => ({
    id: "X",
    forms: [0],
    channels: { p: 1, x: 0.05 },
    damp: { p: false, x: false },
    presence: (ctx) => ctx.ch.p,
    target: (i, ctx, out) => {
      out.x = ctx.ch.x;
      out.y = 0.5;
      out.r = i === 0 ? 0.02 : 0;
      out.bind = 0;
      out.cluster = -1;
      out.z = 0;
    },
    form: () => null,
    ambient: () => 0,
    activity: () => 0,
  });

  for (const physics of [true, false]) {
    const c = makeConductor([makeLeftScene()], { physics });
    let t = 0;
    let prev = 0;
    let maxDelta = 0;
    for (let fr = 0; fr < 180; fr++) {
      if (fr === 30) c.raw.X.x = -0.2;
      t += 16.7;
      c.driver.frame(t, buf, 1.5);
      const x = buf[0];
      if (fr > 30) maxDelta = Math.max(maxDelta, Math.abs(x - prev));
      prev = x;
    }
    ok(
      maxDelta < 0.04,
      `${physics ? "physics" : "legacy"} negative-x reset jumped ${maxDelta.toFixed(4)} ≥ 0.04`,
    );
  }
}

// ── P6: physics stress — random everything, all finite, budget held ─────────
{
  const A = mkScene("A", 0.3, 0);
  const B = mkScene("B", 0.7, 3);
  // free-liquid targets so all forces + spawning paths run
  A.target = (i, ctx, out) => {
    out.x = 0.2 + (0.5 * ((i * 37) % 100)) / 100;
    out.y = 0.2 + (0.6 * ((i * 61) % 100)) / 100;
    out.r = 0.02;
    out.bind = 0;
    out.cluster = i % 4;
    out.z = 0;
  };
  const c = makeConductor([A, B]);
  let rngState = 987654;
  const rng = () => {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  };
  let t = 0;
  let allFinite = true;
  let maxCount = 0;
  for (let fr = 0; fr < 10000; fr++) {
    c.raw.A.p = rng();
    c.raw.B.p = rng();
    c.input.vel = (rng() - 0.5) * 12;
    c.input.px = rng();
    c.input.py = rng();
    c.input.pvx = (rng() - 0.5) * 2;
    c.input.pvy = (rng() - 0.5) * 2;
    c.input.pon = rng() > 0.3 ? 1 : 0;
    t += rng() * 120;
    const f = c.driver.frame(t, buf, 0.7 + rng() * 1.6);
    if (!finiteFrame(f)) allFinite = false;
    for (let i = 0; i < f.count * 3; i++)
      if (!Number.isFinite(buf[i])) allFinite = false;
    if (f.count > maxCount) maxCount = f.count;
  }
  ok(allFinite, "physics stress: non-finite output");
  ok(
    maxCount <= SDF_BALL_MAX,
    `physics stress: count ${maxCount} > ${SDF_BALL_MAX}`,
  );
}

// ── P7: physics-v3 review path — exact bind, obstacle response, finite stress
{
  // The experimental force path must still collapse to the sacred legacy
  // trajectory at bind=1, including when obstacle data is present.
  const v3Bound = makeConductor([mkJumpScene(1)], {
    physicsV3: true,
    obstacleFlow: true,
  });
  const legacyBound = makeConductor([mkJumpScene(1)], { physics: false });
  const legacyBuf = new Float32Array(SDF_BALL_MAX * 3);
  v3Bound.input.obstacles.set([0.5, 0.5, 0.08, 0.08, 1]);
  v3Bound.input.obstacleCount = 1;
  let t = 0;
  let parity = true;
  for (let fr = 0; fr < 180; fr++) {
    if (fr === 30) {
      v3Bound.raw.J.jump = 1;
      legacyBound.raw.J.jump = 1;
    }
    t += 16.7;
    // Scroll is a BODY FORCE on free liquid (fluid-core SCROLL_LEAN/SHEAR/STIR).
    // It scales by (1 − bind), so bind=1 must stay on the legacy trajectory no
    // matter how hard the page is being scrolled — assert that rather than
    // trusting it, since a parity run at vel=0 would never touch the term.
    const vel = Math.sin(fr * 0.11) * 3.4; // beyond SCROLL_CLAMP, both signs
    v3Bound.input.vel = vel;
    legacyBound.input.vel = vel;
    v3Bound.driver.frame(t, buf, 1.5);
    legacyBound.driver.frame(t, legacyBuf, 1.5);
    if (buf[0] !== legacyBuf[0] || buf[1] !== legacyBuf[1]) parity = false;
  }
  ok(parity, "physics-v3: bind=1 diverged from the legacy trajectory");

  const obstacleScene = {
    ...mkJumpScene(0),
    ambient: () => 0,
    activity: () => 0,
    target: (i, ctx, out) => {
      out.x = 0.5;
      out.y = 0.5;
      out.r = i === 0 ? 0.02 : 0;
      out.bind = 0;
      out.cluster = -1;
      out.z = 0;
    },
  };
  const clear = makeConductor([obstacleScene], { physicsV3: true });
  const avoided = makeConductor([obstacleScene], {
    physicsV3: true,
    obstacleFlow: true,
  });
  avoided.input.obstacles.set([0.5, 0.5, 0.04, 0.04, 1]);
  avoided.input.obstacleCount = 1;
  const clearBuf = new Float32Array(SDF_BALL_MAX * 3);
  t = 0;
  for (let fr = 0; fr < 180; fr++) {
    t += 16.7;
    clear.driver.frame(t, clearBuf, 1.5);
    avoided.driver.frame(t, buf, 1.5);
  }
  ok(
    Math.hypot(buf[0] - clearBuf[0], buf[1] - clearBuf[1]) > 0.002,
    "physics-v3: cached obstacle produced no measurable free-liquid response",
  );

  const A = mkScene("V3", 0.5, 0);
  A.target = (i, ctx, out) => {
    out.x = 0.18 + 0.64 * (((i * 37 + ctx.ch.p * 11) % 100) / 100);
    out.y = 0.18 + 0.64 * (((i * 61 + ctx.ch.p * 7) % 100) / 100);
    out.r = 0.009 + 0.016 * ((i % 7) / 6);
    out.bind = i % 9 === 0 ? 1 : 0;
    out.cluster = i % 4;
    out.z = 0.4;
  };
  A.form = () => null;
  A.ambient = () => 0;
  const stress = makeConductor([A], {
    physicsV3: true,
    obstacleFlow: true,
  });
  stress.raw.V3.p = 1;
  stress.input.obstacles.set([
    0.36, 0.48, 0.1, 0.07, 0.8, 0.66, 0.58, 0.12, 0.08, 1,
  ]);
  stress.input.obstacleCount = 2;
  t = 0;
  let allFinite = true;
  for (let fr = 0; fr < 2500; fr++) {
    stress.raw.V3.p = 0.5 + 0.5 * Math.sin(fr * 0.017);
    stress.input.px = 0.5 + 0.3 * Math.sin(fr * 0.023);
    stress.input.py = 0.5 + 0.25 * Math.cos(fr * 0.019);
    stress.input.pon = fr % 90 < 45 ? 1 : 0;
    t += fr % 113 === 0 ? 88 : 16.7;
    const frame = stress.driver.frame(t, buf, 1.5);
    if (!finiteFrame(frame)) allFinite = false;
    for (let i = 0; i < frame.count * 3; i++)
      if (!Number.isFinite(buf[i])) allFinite = false;
  }
  ok(allFinite, "physics-v3: non-finite output under force/obstacle stress");
}

// ── P8: the STRIKE — click physics (wave, crown, saturation, rollback) ──────
{
  // A composition of free liquid on a small disc, quiet enough that anything
  // that moves in these checks moved because of the strike.
  const disc = [];
  for (let i = 0; i < N; i++) {
    const a = i * 2.39996; // golden angle — an even fill with no ring in it
    const rr = 0.19 * Math.sqrt((i + 0.5) / N);
    disc.push([0.5 + rr * Math.cos(a), 0.5 + rr * Math.sin(a)]);
  }
  const mkPool = (bind, radius = 0.02) => ({
    id: "K",
    forms: [0],
    channels: { p: 1 },
    presence: () => 1,
    target: (i, ctx, out) => {
      out.x = disc[i][0];
      out.y = disc[i][1];
      out.r = radius;
      out.bind = bind;
      out.cluster = -1;
      out.z = 0;
    },
    form: () => null,
    ambient: () => 0,
    activity: () => 0,
  });
  const settle = (c, frames = 200, t0 = 0) => {
    let t = t0;
    for (let fr = 0; fr < frames; fr++) {
      t += 16.7;
      c.driver.frame(t, buf, 1.5);
    }
    return t;
  };
  const snapshot = () => {
    const out = [];
    for (let i = 0; i < N; i++) out.push([buf[i * 3], buf[i * 3 + 1]]);
    return out;
  };

  // ── bind=1: what the interaction may and may not do to bound liquid.
  //
  // Bound droplets — the §3.3 melts, resting footprints, the exact mark — take
  // the form's displacement at RENDER time, because mid-morph the stage is
  // nothing but bound droplets and the liquid would otherwise go dead to the
  // hand precisely when it is most alive to look at. What that must NOT touch
  // is the choreography underneath. Three claims, in order of severity.
  {
    const legacyBuf = new Float32Array(SDF_BALL_MAX * 3);

    // 1. UNTOUCHED means untouched. With no hand and no live wave, bound liquid
    //    is byte-identical to the legacy trajectory — this is exact rest and
    //    every melt in every capture, and it is not negotiable.
    {
      const quiet = makeConductor([mkPool(1)], { physicsV3: true });
      const legacy = makeConductor([mkPool(1)], { physics: false });
      let t = 0;
      let parity = true;
      for (let fr = 0; fr < 260; fr++) {
        t += 16.7;
        quiet.driver.frame(t, buf, 1.5);
        legacy.driver.frame(t, legacyBuf, 1.5);
        for (let i = 0; i < N; i++)
          if (
            buf[i * 3] !== legacyBuf[i * 3] ||
            buf[i * 3 + 1] !== legacyBuf[i * 3 + 1]
          )
            parity = false;
      }
      ok(
        parity,
        "bind=1: bound liquid diverged from legacy with NOTHING touching it",
      );
    }

    // 2. Under a hand and a strike it moves — that is the point — but only by
    //    the form's displacement, which is bounded by construction. A droplet
    //    escaping that envelope would mean a force had leaked into the body.
    const MAX_FORM_DISP =
      FLUID.FORM_TOUCH * (1 + FLUID.CURSOR_PRESS) * 1.2 +
      FLUID.FORM_SHOCK * 2 * 1.2 * (1 + FLUID.SHOCK_IRREG);
    {
      const struck = makeConductor([mkPool(1)], { physicsV3: true });
      const legacy = makeConductor([mkPool(1)], { physics: false });
      let t = 0;
      let moved = 0;
      let worst = 0;
      for (let fr = 0; fr < 200; fr++) {
        t += 16.7;
        if (fr === 40) struck.strike(0.5, 0.5, 2);
        if (fr === 70) struck.strike(0.42, 0.55, 2);
        struck.input.pon = 1;
        struck.input.px = 0.5;
        struck.input.py = 0.5;
        struck.input.press = 1;
        struck.driver.frame(t, buf, 1.5);
        legacy.driver.frame(t, legacyBuf, 1.5);
        for (let i = 0; i < N; i++) {
          const d = Math.hypot(
            buf[i * 3] - legacyBuf[i * 3],
            buf[i * 3 + 1] - legacyBuf[i * 3 + 1],
          );
          if (d > moved) moved = d;
          if (d > worst) worst = d;
        }
      }
      ok(
        moved > 0.004,
        `bind=1: bound liquid ignored the hand entirely (${moved.toFixed(4)}) — a morph would read dead`,
      );
      ok(
        worst < MAX_FORM_DISP,
        `bind=1: bound liquid moved ${worst.toFixed(4)} uv, past the form-displacement envelope ${MAX_FORM_DISP.toFixed(4)} — a force has leaked into the body`,
      );
    }

    // 3. And it RETURNS. This is the one that proves the displacement is a pure
    //    render offset: once the hand leaves and the waves expire, bound liquid
    //    is back on the legacy trajectory byte-for-byte. Any leakage into the
    //    physics body or the legacy shadow would show up here as a permanent
    //    offset, however small.
    {
      const struck = makeConductor([mkPool(1)], { physicsV3: true });
      const legacy = makeConductor([mkPool(1)], { physics: false });
      let t = 0;
      for (let fr = 0; fr < 120; fr++) {
        t += 16.7;
        if (fr === 30) struck.strike(0.5, 0.5, 2);
        struck.input.pon = 1;
        struck.input.px = 0.5;
        struck.input.py = 0.5;
        struck.input.press = 1;
        struck.driver.frame(t, buf, 1.5);
        legacy.driver.frame(t, legacyBuf, 1.5);
      }
      struck.input.pon = 0;
      struck.input.press = 0;
      let parity = true;
      let firstDiff = -1;
      for (let fr = 0; fr < 260; fr++) {
        t += 16.7;
        struck.driver.frame(t, buf, 1.5);
        legacy.driver.frame(t, legacyBuf, 1.5);
        if (fr < 120) continue; // let the press damp out and the waves expire
        for (let i = 0; i < N; i++)
          if (
            buf[i * 3] !== legacyBuf[i * 3] ||
            buf[i * 3 + 1] !== legacyBuf[i * 3 + 1]
          ) {
            parity = false;
            if (firstDiff < 0) firstDiff = i;
          }
      }
      ok(
        parity,
        `bind=1: bound liquid never returned to the legacy trajectory (droplet ${firstDiff}) — the render offset leaked into the body`,
      );
    }
  }

  // ── it TRAVELS. A click that moves every droplet on the same frame is an
  // explosion; liquid carries a blow outward at a finite speed.
  {
    const c = makeConductor([mkPool(0)], { physicsV3: true });
    let t = settle(c);
    const base = snapshot();
    c.strike(0.5, 0.5, 1);
    const arrive = new Array(N).fill(-1);
    for (let fr = 0; fr < 200; fr++) {
      t += 16.7;
      c.driver.frame(t, buf, 1.5);
      for (let i = 0; i < N; i++) {
        if (arrive[i] >= 0) continue;
        const d = Math.hypot(buf[i * 3] - base[i][0], buf[i * 3 + 1] - base[i][1]);
        if (d > 0.004) arrive[i] = fr * 16.7;
      }
    }
    const rows = [];
    for (let i = 0; i < N; i++)
      rows.push({
        d: Math.hypot(base[i][0] - 0.5, base[i][1] - 0.5),
        at: arrive[i],
      });
    const near = rows.filter((r) => r.d < 0.07 && r.at >= 0);
    const far = rows.filter((r) => r.d > 0.15 && r.at >= 0);
    ok(near.length > 0 && far.length > 0, "strike: no measurable response");
    const nearAt = near.reduce((a, r) => a + r.at, 0) / Math.max(near.length, 1);
    const farAt = far.reduce((a, r) => a + r.at, 0) / Math.max(far.length, 1);
    ok(
      farAt - nearAt > 40,
      `strike: front is not travelling — near ${nearAt.toFixed(0)}ms vs far ${farAt.toFixed(0)}ms`,
    );

    // … and it is NOT A RING. phys.mjs refuses accidental rings in its scatter
    // generator for the same reason: a clean circle is the signature of
    // arithmetic. Droplets at a comparable distance must not arrive together.
    const band = rows.filter((r) => r.d > 0.09 && r.d < 0.16 && r.at >= 0);
    const ats = band.map((r) => r.at);
    ok(
      band.length > 6 && Math.max(...ats) - Math.min(...ats) > 50,
      `strike: the front arrives as a ring (spread ${(Math.max(...ats) - Math.min(...ats)).toFixed(0)}ms over ${band.length} droplets)`,
    );

  }

  // ── it SETTLES. The ambient curl never stops, so "back where it started" is
  // the wrong question — every measurement of a strike has to be taken against
  // an identical UNSTRUCK conductor, which isolates the wave exactly.
  {
    const hit = makeConductor([mkPool(0)], { physicsV3: true });
    const control = makeConductor([mkPool(0)], { physicsV3: true });
    const ctlBuf = new Float32Array(SDF_BALL_MAX * 3);
    let t = 0;
    for (let fr = 0; fr < 200; fr++) {
      t += 16.7;
      hit.driver.frame(t, buf, 1.5);
      control.driver.frame(t, ctlBuf, 1.5);
    }
    hit.strike(0.5, 0.5, 1);
    let peak = 0;
    let peakMs = 0;
    let quiet = -1;
    for (let fr = 0; fr < 420; fr++) {
      t += 16.7;
      hit.driver.frame(t, buf, 1.5);
      control.driver.frame(t, ctlBuf, 1.5);
      let maxD = 0;
      for (let i = 0; i < N; i++)
        maxD = Math.max(
          maxD,
          Math.hypot(
            buf[i * 3] - ctlBuf[i * 3],
            buf[i * 3 + 1] - ctlBuf[i * 3 + 1],
          ),
        );
      if (maxD > peak) {
        peak = maxD;
        peakMs = fr * 16.7;
      }
      if (quiet < 0 && fr * 16.7 > peakMs && peak > 0 && maxD < peak * 0.12)
        quiet = fr * 16.7;
    }
    ok(peak > 0.02, `strike: barely registered (peak ${peak.toFixed(4)} uv)`);
    ok(
      quiet >= 0 && quiet < 2500,
      `strike: liquid never settled after the wave passed (peak ${peak.toFixed(4)} at ${peakMs.toFixed(0)}ms, still ringing)`,
    );
  }

  // ── the crown comes from LIQUID, never from empty space ────────────────────
  {
    // Spray SWELLS in — packSatellites drives its density off the lifetime
    // envelope precisely so a satellite cannot pop into being as a hard bead —
    // so the crown is not in the buffer on the very frame it was thrown.
    const crownPeak = (strikeX, strikeY) => {
      const c = makeConductor([mkPool(0)], { physicsV3: true });
      let t = settle(c);
      let before = Infinity;
      for (let fr = 0; fr < 12; fr++) {
        t += 16.7;
        before = Math.min(before, c.driver.frame(t, buf, 1.5).count);
      }
      c.strike(strikeX, strikeY, 1);
      let peak = 0;
      for (let fr = 0; fr < 30; fr++) {
        t += 16.7;
        peak = Math.max(peak, c.driver.frame(t, buf, 1.5).count);
      }
      return { before, peak };
    };
    const onLiquid = crownPeak(0.5, 0.5);
    ok(
      onLiquid.peak > onLiquid.before,
      `strike: no crown thrown from liquid it landed on (${onLiquid.before} → ${onLiquid.peak})`,
    );
    ok(
      onLiquid.peak - onLiquid.before <= FLUID.SHOCK_SPRAY,
      `strike: crown exceeded its budget (${onLiquid.peak - onLiquid.before} > ${FLUID.SHOCK_SPRAY})`,
    );

    // inside the wave's reach, far outside any droplet: the front still
    // travels, but there was nothing there to throw
    const onNothing = crownPeak(0.5, 0.94);
    ok(
      onNothing.peak === onNothing.before,
      `strike: spray appeared out of empty space (${onNothing.before} → ${onNothing.peak})`,
    );
  }

  // ── the ATMOSPHERE answers too. The ambient beads are analytic, so this is
  // the one family that could silently keep ignoring the pointer.
  {
    const air = {
      ...mkPool(0, 0),
      ambient: () => 1,
    };
    const still = makeConductor([air], { physicsV3: true });
    const hit = makeConductor([air], { physicsV3: true });
    let t = 0;
    for (let fr = 0; fr < 200; fr++) {
      t += 16.7;
      still.driver.frame(t, buf, 1.5);
    }
    const stillBuf = new Float32Array(SDF_BALL_MAX * 3);
    t = 0;
    for (let fr = 0; fr < 200; fr++) {
      t += 16.7;
      hit.driver.frame(t, buf, 1.5);
    }
    hit.strike(0.5, 0.5, 1.4);
    let moved = 0;
    let tt = t;
    for (let fr = 0; fr < 90; fr++) {
      tt += 16.7;
      still.driver.frame(tt, stillBuf, 1.5);
      const fr2 = hit.driver.frame(tt, buf, 1.5);
      for (let i = 0; i < fr2.count; i++)
        moved = Math.max(
          moved,
          Math.hypot(
            buf[i * 3] - stillBuf[i * 3],
            buf[i * 3 + 1] - stillBuf[i * 3 + 1],
          ),
        );
    }
    ok(moved > 0.002, "strike: the ambient family ignored the wave");
    ok(
      moved < FLUID.AMB_MAX * 2.1,
      `strike: ambient displacement ${moved.toFixed(4)} escaped its clamp`,
    );
    // … and returns. The atmosphere rocks; it does not relocate.
    for (let fr = 0; fr < 220; fr++) {
      tt += 16.7;
      still.driver.frame(tt, stillBuf, 1.5);
      hit.driver.frame(tt, buf, 1.5);
    }
    let residual = 0;
    for (let i = 0; i < PHYS.AMBIENT_N; i++)
      residual = Math.max(
        residual,
        Math.hypot(
          buf[i * 3] - stillBuf[i * 3],
          buf[i * 3 + 1] - stillBuf[i * 3 + 1],
        ),
      );
    ok(
      residual < 0.004,
      `strike: ambient bead never returned to its anchor (${residual.toFixed(4)})`,
    );
  }

  // ── the HAND DISPLACES, it does not EVACUATE. A monotone repulsion carries
  // net outward flux, so held long enough it clears a hole and keeps clearing;
  // the well profile has to reach an equilibrium and stay there.
  {
    const c = makeConductor([mkPool(0)], { physicsV3: true });
    let t = settle(c);
    const meanDist = () => {
      let sum = 0;
      for (let i = 0; i < N; i++)
        sum += Math.hypot(buf[i * 3] - 0.5, buf[i * 3 + 1] - 0.5);
      return sum / N;
    };
    const rest = meanDist();
    c.input.pon = 1;
    c.input.px = 0.5;
    c.input.py = 0.5;
    c.input.press = 1;
    let early = 0;
    for (let fr = 0; fr < 700; fr++) {
      t += 16.7;
      c.driver.frame(t, buf, 1.5);
      if (fr === 120) early = meanDist();
    }
    const late = meanDist();
    ok(
      early - rest > 0.002,
      `hover: a pressed hand barely moved the liquid (${(early - rest).toFixed(4)})`,
    );
    ok(
      late - early < 0.004,
      `hover: the hand is evacuating, not displacing — mean radius still growing (${(late - early).toFixed(4)} after 10s)`,
    );
  }

  // ── a MASH stays finite, bounded and inside the ball budget ────────────────
  {
    const c = makeConductor([mkPool(0)], { physicsV3: true });
    let t = settle(c, 120);
    let allFinite = true;
    let maxExcursion = 0;
    let maxCount = 0;
    for (let fr = 0; fr < 1200; fr++) {
      t += fr % 97 === 0 ? 91 : 16.7;
      if (fr < 70) c.strike(0.5 + (fr % 7) * 0.012, 0.5, 1.7);
      const frame = c.driver.frame(t, buf, 1.5);
      if (!finiteFrame(frame)) allFinite = false;
      maxCount = Math.max(maxCount, frame.count);
      for (let i = 0; i < frame.count * 3; i++)
        if (!Number.isFinite(buf[i])) allFinite = false;
      for (let i = 0; i < N; i++)
        maxExcursion = Math.max(
          maxExcursion,
          Math.hypot(buf[i * 3] - 0.5, buf[i * 3 + 1] - 0.5),
        );
    }
    ok(allFinite, "strike: non-finite output under a strike mash");
    ok(
      maxExcursion < 0.45,
      `strike: a mash threw liquid ${maxExcursion.toFixed(3)} uv from centre (runaway)`,
    );
    ok(
      maxCount <= SDF_BALL_MAX,
      `strike: a mash overflowed the ball budget (${maxCount} > ${SDF_BALL_MAX})`,
    );
  }

  // ── the governor cannot sleep through a click ──────────────────────────────
  {
    const c = makeConductor([mkPool(0)], { physicsV3: true });
    let t = settle(c, 400);
    const idle = c.driver.frame((t += 16.7), buf, 1.5).energy;
    c.strike(0.5, 0.5, 1);
    const struck = c.driver.frame((t += 16.7), buf, 1.5).energy;
    ok(
      struck > idle + 0.3,
      `strike: energy ${idle.toFixed(2)} → ${struck.toFixed(2)} — the cadence governor would play the wave at 30 Hz`,
    );
  }

  // ── ?fstrike=0 removes the blow and keeps the hand ─────────────────────────
  {
    const off = makeConductor([mkPool(0)], { physicsV3: true, strike: false });
    const ctl = makeConductor([mkPool(0)], { physicsV3: true, strike: false });
    const ctlBuf = new Float32Array(SDF_BALL_MAX * 3);
    let t = 0;
    for (let fr = 0; fr < 200; fr++) {
      t += 16.7;
      off.driver.frame(t, buf, 1.5);
      ctl.driver.frame(t, ctlBuf, 1.5);
    }
    off.strike(0.5, 0.5, 2);
    off.input.press = 1;
    let moved = 0;
    for (let fr = 0; fr < 200; fr++) {
      t += 16.7;
      off.driver.frame(t, buf, 1.5);
      ctl.driver.frame(t, ctlBuf, 1.5);
      for (let i = 0; i < N; i++)
        moved = Math.max(
          moved,
          Math.hypot(
            buf[i * 3] - ctlBuf[i * 3],
            buf[i * 3 + 1] - ctlBuf[i * 3 + 1],
          ),
        );
    }
    ok(
      moved === 0,
      `?fstrike=0: a strike (or its press gain) still moved liquid (${moved.toExponential(2)})`,
    );

    // … and the hand is still there. The flag removes the blow, not the field.
    off.input.pon = 1;
    off.input.px = 0.5;
    off.input.py = 0.5;
    let hovered = 0;
    for (let fr = 0; fr < 200; fr++) {
      t += 16.7;
      off.driver.frame(t, buf, 1.5);
      ctl.driver.frame(t, ctlBuf, 1.5);
      for (let i = 0; i < N; i++)
        hovered = Math.max(
          hovered,
          Math.hypot(
            buf[i * 3] - ctlBuf[i * 3],
            buf[i * 3 + 1] - ctlBuf[i * 3 + 1],
          ),
        );
    }
    ok(hovered > 0.004, "?fstrike=0: hover physics went with it");
  }
}

// ═══ OPTICS PLUMBING (R5-C: depth pack, energy, score passthrough) ════════════

// ── O1: zBuf — every packed slot carries the right depth band ────────────────
{
  const A = mkScene("A", 0.3, 0);
  A.target = (i, ctx, out) => {
    out.x = 0.2 + (0.5 * ((i * 37) % 100)) / 100;
    out.y = 0.2 + (0.6 * ((i * 61) % 100)) / 100;
    out.r = 0.02;
    out.bind = 0;
    out.cluster = -1;
    out.z = 0.55; // the scene stages its droplets mid-depth
  };
  A.extras = (ctx, push) => push(0.5, 0.5, 0.01);
  const c = makeConductor([A]);
  const zBuf = new Float32Array(SDF_BALL_MAX).fill(9); // poison — all must be written
  c.raw.A.p = 1;
  let t = 0;
  let f = null;
  for (let fr = 0; fr < 240; fr++) {
    t += 16.7;
    f = c.driver.frame(t, buf, 1.5, zBuf);
  }
  let droplets = 0;
  let ambient = 0;
  let bad = 0;
  for (let s = 0; s < f.count; s++) {
    const z = zBuf[s];
    if (Math.abs(z - 0.55) < 1e-6) droplets++;
    else if (Math.abs(z - PHYS.AMBIENT_Z) < 1e-6) ambient++;
    else if (z !== 0) bad++; // satellites + extras pack near (0)
  }
  ok(bad === 0, `zBuf: ${bad} packed slots carry a stale/unknown depth`);
  ok(droplets > 0, "zBuf: no droplet slot carries the scene depth");
  ok(ambient > 0, `zBuf: ambient slots missing AMBIENT_Z (${PHYS.AMBIENT_Z})`);
  ok(
    Math.abs(zBuf[0] - 0.55) < 1e-6,
    `zBuf[0] = ${zBuf[0]} (want the scene's 0.55)`,
  );
}

// ── O2: energy — activity/scroll/pointer raise it; a calm scene idles low ───
{
  const calm = mkScene("A", 0.3, 0);
  calm.activity = () => 0;
  const c = makeConductor([calm]);
  c.raw.A.p = 1;
  let t = 0;
  let f = null;
  for (let fr = 0; fr < 300; fr++) {
    t += 16.7;
    f = c.driver.frame(t, buf, 1.5);
  }
  ok(f.energy < 0.05, `energy: calm scene idles at ${f.energy} (want < 0.05)`);
  c.input.vel = 2; // a scroll flick
  for (let fr = 0; fr < 60; fr++) {
    t += 16.7;
    f = c.driver.frame(t, buf, 1.5);
  }
  ok(f.energy > 0.2, `energy: scroll ignored (${f.energy})`);
  c.input.vel = 0;
  for (let fr = 0; fr < 600; fr++) {
    t += 16.7;
    f = c.driver.frame(t, buf, 1.5); // velocity decays back to idle
  }
  ok(f.energy < 0.05, `energy: no decay back to idle (${f.energy})`);
  c.input.pon = 1;
  c.input.pvx = 1;
  t += 16.7;
  f = c.driver.frame(t, buf, 1.5);
  ok(f.energy > 0.2, `energy: pointer velocity ignored (${f.energy})`);
  c.input.pon = 0;
  // a scene WITHOUT an activity hook stays conservatively active
  const legacy = mkScene("L", 0.4, 0);
  const c2 = makeConductor([legacy]);
  c2.raw.L.p = 1;
  const f2 = c2.driver.frame(16.7, buf, 1.5);
  ok(
    f2.energy > 0.9,
    `energy: activity-less scene not conservative (${f2.energy})`,
  );
}

// ── O3: score → frame (iExpo/iKey passthrough; neutral without scores) ──────
{
  const A = mkScene("A", 0.3, 0);
  A.score = () => ({ exposure: 0.8, key: 0.5 });
  const c = makeConductor([A]);
  c.raw.A.p = 1;
  const f = c.driver.frame(16.7, buf, 1.5);
  ok(Math.abs(f.expo - -0.2) < 1e-9, `score: expo ${f.expo} (want -0.2)`);
  ok(Math.abs(f.key - 0.5) < 1e-9, `score: key ${f.key} (want 0.5)`);
  const B = mkScene("B", 0.7, 0);
  const c2 = makeConductor([B]);
  c2.raw.B.p = 1;
  const f2 = c2.driver.frame(16.7, buf, 1.5);
  ok(
    f2.expo === 0 && f2.key === 0,
    `score: neutral frame carries expo=${f2.expo} key=${f2.key}`,
  );
}

// ═══ CINEMATICS (R5-D: score merge, the ONE flash, ?fcine=0) ═════════════════

// a scene that raises the raw flash channel whenever its `p` sits inside the
// fusion window — the origin scene's exact grammar, stubbed
const mkFlashScene = () => ({
  id: "F",
  forms: [0],
  channels: { p: 0 },
  damp: { p: false },
  presence: () => 1,
  target: (i, ctx, out) => {
    out.x = 0.5;
    out.y = 0.5;
    out.r = i === 0 ? 0.02 : 0;
    out.bind = 0;
    out.cluster = -1;
    out.z = 0;
  },
  form: () => null,
  ambient: () => 0,
  activity: () => 0,
  score: (ctx) => ({ flash: ctx.ch.p > 0.42 && ctx.ch.p < 0.62 ? 1 : 0 }),
});

// ── D1: the flash — exactly ONE ≤400 ms envelope, ever ───────────────────────
{
  const c = makeConductor([mkFlashScene()]);
  let t = 0;
  let onMs = 0;
  let peak = 0;
  let windows = 0;
  let wasOn = false;
  // TWO full traversals through the fusion window + a long park inside it —
  // the raw channel rises three separate times; the envelope may fire once
  const script = (fr) =>
    fr < 60
      ? 0
      : fr < 120
        ? 0.5
        : fr < 180
          ? 1
          : fr < 240
            ? 0.5
            : fr < 300
              ? 0
              : 0.5;
  for (let fr = 0; fr < 500; fr++) {
    c.raw.F.p = script(fr);
    t += 16.7;
    c.driver.frame(t, buf, 1.5);
    const fl = c.score.flash;
    if (fl > 0) onMs += 16.7;
    if (fl > peak) peak = fl;
    if (fl > 0 && !wasOn) windows++;
    wasOn = fl > 0;
  }
  ok(
    c.stats.flashes === 1,
    `flash: latched ${c.stats.flashes} times (want exactly 1)`,
  );
  ok(
    windows === 1,
    `flash: ${windows} visible windows (want 1 — re-scrub re-fired it)`,
  );
  ok(onMs <= 400, `flash: visible for ${onMs.toFixed(0)}ms (WCAG budget 400)`);
  ok(peak > 0.9, `flash: envelope peak ${peak.toFixed(2)} never reached full`);
  ok(
    FLASH_ATTACK_MS + FLASH_DECAY_MS <= 400,
    `flash: envelope constants sum to ${FLASH_ATTACK_MS + FLASH_DECAY_MS}ms > 400`,
  );
  ok(c.score.flash === 0, "flash: still lit long after the moment");
}

// ── D2: merge semantics + the afterglow ──────────────────────────────────────
{
  const mk = (id, sc) => ({
    ...mkFlashScene(),
    id,
    channels: { p: 1 },
    score: () => sc,
  });
  const A = mk("A", { veil: 0.3, vignette: 0.1, exposure: 0.9 });
  const B = mk("B", { veil: 0.5, vignette: 0.05, exposure: 0.9, key: 0.4 });
  const c = makeConductor([A, B]);
  c.driver.frame(16.7, buf, 1.5);
  ok(
    Math.abs(c.score.veil - 0.5) < 1e-9,
    `merge: veil ${c.score.veil} (want max 0.5)`,
  );
  ok(
    Math.abs(c.score.vignette - 0.1) < 1e-9,
    `merge: vignette ${c.score.vignette} (want max 0.1)`,
  );
  ok(
    Math.abs(c.score.exposure - 0.81) < 1e-9,
    `merge: exposure ${c.score.exposure} (want 0.9·0.9)`,
  );
  ok(
    Math.abs(c.score.key - 0.4) < 1e-9,
    `merge: key ${c.score.key} (want 0.4)`,
  );

  // afterglow: right after the latch the exposure lifts, then settles back
  const c2 = makeConductor([mkFlashScene()]);
  let t = 0;
  for (let fr = 0; fr < 30; fr++) {
    c2.raw.F.p = 0.5; // inside the window from frame 0 — latch immediately
    t += 16.7;
    c2.driver.frame(t, buf, 1.5);
  }
  ok(
    c2.score.exposure > 1.02,
    `afterglow: exposure ${c2.score.exposure.toFixed(3)} not lifted at +500ms`,
  );
  for (let fr = 0; fr < 60; fr++) {
    t += 16.7;
    c2.driver.frame(t, buf, 1.5);
  }
  ok(
    Math.abs(c2.score.exposure - 1) < 1e-6,
    `afterglow: exposure ${c2.score.exposure.toFixed(3)} never settled`,
  );
}

// ── D3: ?fcine=0 — the score stays neutral, the flash can never fire ────────
{
  const c = makeConductor([mkFlashScene()], { cine: false });
  let t = 0;
  for (let fr = 0; fr < 200; fr++) {
    c.raw.F.p = 0.5; // permanently inside the fusion window
    t += 16.7;
    const f = c.driver.frame(t, buf, 1.5);
    ok(f.expo === 0 && f.key === 0, `fcine: frame ${fr} carries grade`);
  }
  ok(
    c.stats.flashes === 0,
    `fcine: flash latched ${c.stats.flashes} times with cine off`,
  );
  ok(
    c.score.veil === 0 && c.score.flash === 0 && c.score.vignette === 0,
    "fcine: veil channels not neutral",
  );
}

console.log(
  "CONDUCTOR_CHECK " +
    JSON.stringify({
      droplets: N,
      ballMax: SDF_BALL_MAX,
      failures: failures.length,
    }),
);
if (failures.length) {
  for (const f of failures) console.error("FAIL " + f);
  process.exit(1);
}
console.log("all conductor invariants hold");
