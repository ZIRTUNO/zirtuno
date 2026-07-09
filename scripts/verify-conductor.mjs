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
import { N } from "../lib/webgl/phys.mjs";
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
    out.x = x;
    out.y = 0.5;
    out.r = 0.03 * ctx.ch.p;
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
  ok(maxDelta < 0.02, `continuity: max per-frame droplet delta ${maxDelta.toFixed(4)} ≥ 0.02`);
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

console.log(
  "CONDUCTOR_CHECK " +
    JSON.stringify({ droplets: N, ballMax: SDF_BALL_MAX, failures: failures.length }),
);
if (failures.length) {
  for (const f of failures) console.error("FAIL " + f);
  process.exit(1);
}
console.log("all conductor invariants hold");
