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
//   node scripts/verify-conductor.mjs

import { makeConductor, EPS_FORM } from "../lib/webgl/conductor.mjs";
import { N, PHYS } from "../lib/webgl/phys.mjs";
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
    out.x = x + 0.1 * Math.cos(i * 2.4) * (0.3 + 0.7 * ((i * 7) % 10) / 10);
    out.y = 0.5 + 0.1 * Math.sin(i * 2.4) * (0.3 + 0.7 * ((i * 7) % 10) / 10);
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
  [f.a, f.b, f.fa, f.fb, f.ea, f.eb, f.ox, f.oy, f.scale, f.warp, f.count].every(
    Number.isFinite,
  );

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
  ok(maxDelta < 0.04, `continuity: max per-frame droplet delta ${maxDelta.toFixed(4)} ≥ 0.04`);
  ok(granted === "AB", `arbiter: holder sequence "${granted}" (want "AB")`);
  ok(!switchedWhileHot, "arbiter: a texture slot index changed while rendering");
  ok(c.stats.violations === 0, `arbiter: ${c.stats.violations} violations on a correct script`);
  ok(c.stats.holderId === "B", `arbiter: final holder ${c.stats.holderId} (want B)`);
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
  ok(c.stats.holderId === "A", `suppression: holder stolen by violator (${c.stats.holderId})`);
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
  ok(maxCount <= SDF_BALL_MAX, `stress: count ${maxCount} > budget ${SDF_BALL_MAX}`);
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
    if (fr === 119) ok(f.fa < EPS_FORM, `gap: form still rendering (fa=${f.fa})`);
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
  ok(overshoot < 0.025, `settle: overshoot ${overshoot.toFixed(4)} ≥ 0.025 (ringing)`);
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
      const d = Math.abs(buf[i * 3] - buf2[i * 3]) + Math.abs(buf[i * 3 + 1] - buf2[i * 3 + 1]);
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

// ── P5: physics stress — random everything, all finite, budget held ─────────
{
  const A = mkScene("A", 0.3, 0);
  const B = mkScene("B", 0.7, 3);
  // free-liquid targets so all forces + spawning paths run
  A.target = (i, ctx, out) => {
    out.x = 0.2 + 0.5 * ((i * 37) % 100) / 100;
    out.y = 0.2 + 0.6 * ((i * 61) % 100) / 100;
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
  ok(maxCount <= SDF_BALL_MAX, `physics stress: count ${maxCount} > ${SDF_BALL_MAX}`);
}

// ═══ OPTICS PLUMBING (R5-C: depth pack, energy, score passthrough) ════════════

// ── O1: zBuf — every packed slot carries the right depth band ────────────────
{
  const A = mkScene("A", 0.3, 0);
  A.target = (i, ctx, out) => {
    out.x = 0.2 + 0.5 * ((i * 37) % 100) / 100;
    out.y = 0.2 + 0.6 * ((i * 61) % 100) / 100;
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
  ok(Math.abs(zBuf[0] - 0.55) < 1e-6, `zBuf[0] = ${zBuf[0]} (want the scene's 0.55)`);
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
  ok(f2.energy > 0.9, `energy: activity-less scene not conservative (${f2.energy})`);
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
  ok(f2.expo === 0 && f2.key === 0, `score: neutral frame carries expo=${f2.expo} key=${f2.key}`);
}

console.log(
  "CONDUCTOR_CHECK " +
    JSON.stringify({ droplets: N, ballMax: SDF_BALL_MAX, failures: failures.length }),
);
if (failures.length) {
  for (const f of failures) console.error("FAIL " + f);
  process.exit(1);
}
console.log("all conductor invariants hold");
