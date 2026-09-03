// verify-mist (R7) — THE MIST's kernel gates, in plain node, no browser.
//
// The GPU kernel (lib/webgl/mist-shaders.mjs) cannot run here, so what is
// asserted is the RULE it implements, through the CPU reference in
// lib/webgl/mist.mjs — built from the same MIST table the GLSL is generated
// from — and the plumbing that carries the vapour's dials and hosts through
// the conductor:
//
//   1. THE SCORE      every envelope finite and bounded across p; the copy
//                     windows ordered and non-overlapping; the eases exact at
//                     their ends
//   2. EMISSION       the boil-off raises every dormant particle from its home
//                     droplet, progressively, never all at once
//   3. CONVERGENCE    the centre's pull draws the field in — mean distance to
//                     the centre falls, and nothing passes through it
//  3b. THE RETURN     …and with `recirc` dialled the inflow is a cycle: the
//                     field holds a steady radius instead of collapsing, and
//                     nothing piles at the core
//   4. CONDENSATION   vapour that reaches a body becomes its skin and rides
//                     its outline at the skin radius
//   5. RELEASE        the skin is breathed out: captured count → 0, moving
//                     outward
//   6. SPELLING       every particle lands on its letter target and stays —
//                     no ringing
//   7. THE WALL       the type band's floor holds the vapour above it
//   8. THE CONDUCTOR  a scene's block reaches the frame scaled by its weight,
//                     hosts are written by identity with sane presence, the
//                     environment is packed, and a scene without a block
//                     leaves the frame vapour-free
//   9. STRESS         random dials and dt spikes leave everything finite;
//                     two references with the same inputs agree exactly
//
//   node scripts/verify/mist.mjs

import {
  MIST,
  makeMistReference,
  makeMistDials,
  mistSize,
} from "../../lib/webgl/mist.mjs";
import {
  ORIGIN_BEATS,
  ORIGIN_ARC,
  copyWindow,
  makeOriginEnvelopes,
} from "../../lib/webgl/origin-score.mjs";
import { makeFluidCore } from "../../lib/webgl/fluid-core.mjs";
import { makeConductor } from "../../lib/webgl/conductor.mjs";
import { N } from "../../lib/webgl/phys.mjs";
import { SDF_BALL_MAX, SDF_WARP_REST } from "../../lib/webgl/sdf-glass-shader.mjs";
import { cubicBezierAt, EASE_POINTS } from "../../lib/animation/easings.mjs";

const failures = [];
const ok = (cond, msg) => {
  if (!cond) failures.push(msg);
};

// ── 1: the score ─────────────────────────────────────────────────────────────
{
  const e = makeOriginEnvelopes();
  const keys = Object.keys(e).filter((k) => typeof e[k] === "number");
  let finite = true;
  let bounded = true;
  for (let i = 0; i <= 400; i++) {
    const p = i / 400;
    for (const lead of [0, 0.5, 1])
      for (const wide of [0, 1]) {
        e.update(p, lead, wide);
        for (const k of keys) {
          const v = e[k];
          if (!Number.isFinite(v)) finite = false;
          if (k === "exposure") {
            if (v < 0.9 || v > 1.1) bounded = false;
          } else if (v < -1e-9 || v > 1 + 1e-9) bounded = false;
        }
      }
  }
  ok(finite, "score: a non-finite envelope");
  ok(bounded, "score: an envelope left [0, 1]");
  // the arc is ordered: poles before the pull, the pull before the release,
  // the release before the spelling, the spelling before the fade
  const A = ORIGIN_ARC;
  ok(A.POLES_ON[1] <= A.PULL_ON[1], "score: the pull leads the poles");
  ok(A.PULL_OFF[0] >= A.RELEASE_ON[1], "score: the pull outlives the release's onset");
  ok(A.RELEASE_ON[1] <= A.SPELL[0], "score: spelling begins before the release has");
  ok(A.SPELL[1] <= A.FADE[0], "score: the type fades in before the letters are spelled");
  ok(A.FADE[1] <= 1, "score: the fade runs past the runway");
  // the copy windows: each block's release completes before the next arrives
  for (let i = 0; i < ORIGIN_BEATS.length - 1; i++) {
    const a = ORIGIN_BEATS[i];
    const b = ORIGIN_BEATS[i + 1];
    ok(a.from + a.span <= a.until, `score: ${a.id} releases before it has arrived`);
    ok(a.until + a.exit <= b.from + 1e-9, `score: ${a.id} still releasing when ${b.id} arrives`);
  }
  const last = ORIGIN_BEATS[ORIGIN_BEATS.length - 1];
  ok(last.until > 1, "score: the resolution must hold to the end of the runway");
  const w = copyWindow(ORIGIN_BEATS[1], 0.22);
  ok(Math.abs(w.inN - 0.5) < 1e-9 && w.outN === 0, `score: copyWindow ${JSON.stringify(w)}`);
  // the house eases, exact at their ends and monotone
  for (const name of Object.keys(EASE_POINTS)) {
    ok(cubicBezierAt(EASE_POINTS[name], 0) === 0 && cubicBezierAt(EASE_POINTS[name], 1) === 1, `ease ${name}: ends`);
    let prev = 0;
    let mono = true;
    for (let i = 1; i <= 100; i++) {
      const v = cubicBezierAt(EASE_POINTS[name], i / 100);
      if (v < prev - 1e-9) mono = false;
      prev = v;
    }
    ok(mono, `ease ${name}: not monotone`);
  }
  // the arrive curve is the fast-then-settle shape the bodies condense on
  ok(cubicBezierAt(EASE_POINTS.arrive, 0.5) > 0.9, "ease arrive: not front-loaded");
  ok(mistSize("full") > mistSize("lite") && mistSize("lite") >= 16, "mist: tier sizes");
}

// ── the fixture: a ring of hosts, a reference field, a quiet environment ────
const hostsRing = (r = 0.02, presence = 1) => {
  const h = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    h[i * 4] = 0.5 + 0.18 * Math.cos(a);
    h[i * 4 + 1] = 0.5 + 0.18 * Math.sin(a);
    h[i * 4 + 2] = r;
    h[i * 4 + 3] = presence;
  }
  return h;
};
const quietEnv = { px: 0.5, py: 0.5, pvx: 0, pvy: 0, pon: false, press: 0, vel: 0 };
const core = makeFluidCore({ pop: N });
const NP = 2048;
const run = (ref, hosts, dials, ms, env = quietEnv, spellT = null, t0 = 0) => {
  let t = t0;
  for (let k = 0; k < Math.round(ms / 16.7); k++) {
    t += 16.7;
    ref.step(16.7, t, hosts, dials, env, spellT, 1.5);
  }
  return t;
};
const alive = (ref) => {
  let n = 0;
  for (let i = 0; i < ref.n; i++) if (ref.LIFE[i] > 0) n++;
  return n;
};
const captured = (ref) => {
  let n = 0;
  for (let i = 0; i < ref.n; i++) if (ref.STATE[i] === 1) n++;
  return n;
};
const finiteState = (ref) => {
  for (let i = 0; i < ref.n * 2; i++)
    if (!Number.isFinite(ref.P[i]) || !Number.isFinite(ref.V[i])) return false;
  return true;
};

// ── 2: emission ──────────────────────────────────────────────────────────────
{
  const ref = makeMistReference(NP, { probe: core.probe });
  const hosts = hostsRing();
  ref.seedAt(hosts);
  ok(alive(ref) === 0, `emission: ${alive(ref)} particles alive before the boil-off`);
  const d = makeMistDials();
  // a partial boil-off raises a matching share, never everything
  d.evap = 0.3;
  run(ref, hosts, d, 500);
  const share = alive(ref) / NP;
  ok(share > 0.2 && share < 0.4, `emission: evap 0.3 raised ${(share * 100).toFixed(0)}% (want ~30%)`);
  d.evap = 1;
  run(ref, hosts, d, 500);
  ok(alive(ref) === NP, `emission: ${alive(ref)}/${NP} alive at full boil-off`);
  // …from their home droplets: every particle began within reach of its host
  ok(finiteState(ref), "emission: non-finite state");
  let far = 0;
  const ref2 = makeMistReference(NP, { probe: core.probe });
  ref2.seedAt(hosts);
  const d2 = makeMistDials();
  d2.evap = 1;
  ref2.step(16.7, 16.7, hosts, d2, quietEnv, null, 1.5);
  for (let i = 0; i < NP; i++) {
    const h = (i % N) * 4;
    const dd = Math.hypot(ref2.P[i * 2] - hosts[h], ref2.P[i * 2 + 1] - hosts[h + 1]);
    if (dd > hosts[h + 2] * 2 + 0.01) far++;
  }
  ok(far === 0, `emission: ${far} particles were born away from their home droplet`);
}

// ── 3: convergence ───────────────────────────────────────────────────────────
{
  const ref = makeMistReference(NP, { probe: core.probe });
  const hosts = hostsRing(0.02, 0); // hosts absent: pure field
  ref.seedAt(hosts);
  const d = makeMistDials();
  d.evap = 1;
  const t = run(ref, hosts, d, 800);
  const meanR = () => {
    let s = 0;
    for (let i = 0; i < NP; i++) s += Math.hypot(ref.P[i * 2] - 0.5, ref.P[i * 2 + 1] - 0.5);
    return s / NP;
  };
  const r0 = meanR();
  d.pull = 1;
  d.cx = 0.5;
  d.cy = 0.5;
  run(ref, hosts, d, 3000, quietEnv, null, t);
  const r1 = meanR();
  ok(r1 < r0 * 0.6, `convergence: mean radius ${r0.toFixed(3)} → ${r1.toFixed(3)} (want < 60%)`);
  // a soft core, not a singularity: nothing is flung through the centre
  let maxSpeed = 0;
  for (let i = 0; i < NP; i++) maxSpeed = Math.max(maxSpeed, Math.hypot(ref.V[i * 2], ref.V[i * 2 + 1]));
  ok(maxSpeed <= MIST.V_MAX + 1e-6, `convergence: speed ${maxSpeed.toFixed(3)} past V_MAX`);
  ok(finiteState(ref), "convergence: non-finite state");
}

// ── 3b: the return (R7-B) ────────────────────────────────────────────────────
// With `recirc` dialled the inflow is a CYCLE, not a collapse: the field
// reaches a steady state that still has a rim to fall from, so the drawing's
// arrows keep having something to carry. Without it (invariant 3 above) the
// pull's meaning is unchanged — which is why this is a dial and not a rewrite.
{
  const ref = makeMistReference(NP, { probe: core.probe });
  const hosts = hostsRing(0.02, 0); // hosts absent: pure field
  ref.seedAt(hosts);
  const d = makeMistDials();
  d.evap = 1;
  d.cx = 0.5;
  d.cy = 0.5;
  let t = run(ref, hosts, d, 800);
  const meanR = () => {
    let s = 0;
    for (let i = 0; i < NP; i++) s += Math.hypot(ref.P[i * 2] - 0.5, ref.P[i * 2 + 1] - 0.5);
    return s / NP;
  };
  const atCore = () => {
    let n = 0;
    for (let i = 0; i < NP; i++)
      if (Math.hypot(ref.P[i * 2] - 0.5, ref.P[i * 2 + 1] - 0.5) < MIST.RECIRC_R) n++;
    return n;
  };
  d.pull = 1;
  d.recirc = 0.85;
  t = run(ref, hosts, d, 4000, quietEnv, null, t);
  const rA = meanR();
  run(ref, hosts, d, 3000, quietEnv, null, t);
  const rB = meanR();
  // a steady state: the field settles instead of draining to the centre
  ok(rA > MIST.RECIRC_R * 3, `the return: field collapsed to ${rA.toFixed(3)}`);
  ok(
    Math.abs(rB - rA) < rA * 0.25,
    `the return: no steady state — mean radius ${rA.toFixed(3)} → ${rB.toFixed(3)}`,
  );
  // …and the centre does not pile up: what stays is the share `recirc` leaves
  ok(atCore() < NP * 0.2, `the return: ${atCore()}/${NP} piled at the core`);
  ok(finiteState(ref), "the return: non-finite state");
  // the dial is OFF by default, so every other consumer is untouched
  ok(makeMistDials().recirc === 0, "the return: dial not off by default");
}

// ── 4: condensation ──────────────────────────────────────────────────────────
{
  const ref = makeMistReference(NP, { probe: core.probe });
  const hosts = hostsRing(0.022, 1);
  ref.seedAt(hosts);
  const d = makeMistDials();
  d.evap = 1;
  let t = run(ref, hosts, d, 600);
  ok(captured(ref) === 0, `condensation: ${captured(ref)} captured with condense off`);
  d.condense = 1;
  t = run(ref, hosts, d, 3000, quietEnv, null, t);
  const c = captured(ref);
  ok(c > NP * 0.3, `condensation: only ${c}/${NP} taken up as skin after 3 s`);
  // the skin rides its host's outline at the skin radius. A particle taken up
  // on the very last substep is placed on the outline on the next, so let one
  // frame pass with nothing new being captured before measuring.
  d.condense = 0;
  t = run(ref, hosts, d, 34, quietEnv, null, t);
  let off = 0;
  let worst = 0;
  for (let i = 0; i < NP; i++) {
    if (ref.STATE[i] !== 1) continue;
    const h = ref.HOST[i] * 4;
    const dd = Math.hypot(ref.P[i * 2] - hosts[h], ref.P[i * 2 + 1] - hosts[h + 1]) / hosts[h + 2];
    const lo = MIST.SKIN_R - MIST.SKIN_BREATH - 0.02;
    const hi = MIST.SKIN_R + MIST.SKIN_VAR + MIST.SKIN_BREATH + 0.02;
    if (dd < lo || dd > hi) off++;
    worst = Math.max(worst, Math.abs(dd - MIST.SKIN_R));
  }
  ok(off === 0, `condensation: ${off} skin particles off the outline (worst ${worst.toFixed(3)} radii)`);

  // ── 5: release ─────────────────────────────────────────────────────────────
  d.release = 1;
  // outward on the frame of release: measure the first step
  const before = new Float32Array(ref.P);
  const wasSkin = new Uint8Array(ref.STATE);
  ref.step(16.7, t + 16.7, hosts, d, quietEnv, null, 1.5);
  let outward = 0;
  let inward = 0;
  for (let i = 0; i < NP; i++) {
    if (!wasSkin[i]) continue;
    const h = ref.HOST[i] * 4;
    const dx = before[i * 2] - hosts[h];
    const dy = before[i * 2 + 1] - hosts[h + 1];
    const dot = ref.V[i * 2] * dx + ref.V[i * 2 + 1] * dy;
    if (dot > 0) outward++;
    else inward++;
  }
  ok(outward > inward * 20, `release: ${inward} of ${outward + inward} released particles moved inward`);
  run(ref, hosts, d, 1500, quietEnv, null, t + 16.7);
  ok(captured(ref) === 0, `release: ${captured(ref)} still captured after 1.5 s`);
}

// ── 6: spelling ──────────────────────────────────────────────────────────────
{
  const ref = makeMistReference(NP, { probe: core.probe });
  const hosts = hostsRing(0.02, 0);
  ref.seedAt(hosts);
  const d = makeMistDials();
  d.evap = 1;
  const t0 = run(ref, hosts, d, 600);
  // targets: a lattice inside a box — the letters' stand-in
  const spellT = new Float32Array(NP * 2);
  for (let i = 0; i < NP; i++) {
    spellT[i * 2] = ((i % 64) / 63) * 2 - 1;
    spellT[i * 2 + 1] = (Math.floor(i / 64) / 31) * 2 - 1;
  }
  d.spellOn = 1;
  d.spell = 1;
  d.wx = 0.5;
  d.wy = 0.22;
  d.ww = 0.3;
  d.wh = 0.05;
  d.curl = 0.3;
  run(ref, hosts, d, 3000, quietEnv, spellT, t0);
  let sum = 0;
  let maxV = 0;
  for (let i = 0; i < NP; i++) {
    const tx = d.wx + spellT[i * 2] * d.ww;
    const ty = d.wy + spellT[i * 2 + 1] * d.wh;
    sum += Math.hypot(ref.P[i * 2] - tx, ref.P[i * 2 + 1] - ty);
    maxV = Math.max(maxV, Math.hypot(ref.V[i * 2], ref.V[i * 2 + 1]));
  }
  const mean = sum / NP;
  ok(mean < 0.012, `spelling: mean distance to the letters ${mean.toFixed(4)} uv after 3 s`);
  ok(maxV < 0.12, `spelling: still moving at ${maxV.toFixed(3)} uv/s — ringing`);
}

// ── 7: the wall ──────────────────────────────────────────────────────────────
{
  const ref = makeMistReference(NP, { probe: core.probe });
  const hosts = hostsRing(0.02, 0);
  ref.seedAt(hosts);
  const d = makeMistDials();
  d.evap = 1;
  d.pull = 1;
  d.cx = 0.5;
  d.cy = 0.2; // the centre is BELOW the floor: the wall has to win
  d.floorOn = 1;
  d.floor = 0.38;
  run(ref, hosts, d, 4000);
  // a dive is braked inside the margin; nothing sits a margin and a half deep
  let below = 0;
  let deep = 0;
  for (let i = 0; i < NP; i++) {
    const y = ref.P[i * 2 + 1];
    if (y < d.floor - MIST.FLOOR_MARGIN) below++;
    if (y < d.floor - MIST.FLOOR_MARGIN * 1.5) deep++;
  }
  ok(below <= NP * 0.01, `wall: ${below} particles a margin below the type band's floor`);
  ok(deep === 0, `wall: ${deep} particles a margin and a half below the floor`);
}

// ── 8: the conductor ─────────────────────────────────────────────────────────
{
  const block = makeMistDials();
  block.on = 1;
  block.hostR.fill(0.03);
  const mk = (id, withMist) => ({
    id,
    forms: [0],
    channels: { p: 0 },
    damp: { p: false },
    presence: (ctx) => ctx.ch.p,
    target: (i, ctx, out) => {
      out.x = 0.3 + 0.4 * ((i * 7) % 10) / 10;
      out.y = 0.5;
      out.r = i < 40 ? 0.015 : 0; // eight authored droplets deliberately culled
      out.bind = 0;
      out.cluster = -1;
      out.z = 0;
      out.d = 1;
    },
    form: () => null,
    ambient: () => 0,
    activity: () => 0,
    ...(withMist ? { mist: () => block } : {}),
  });
  const buf = new Float32Array(SDF_BALL_MAX * 3);
  const A = mk("A", true);
  const B = mk("B", false);
  const c = makeConductor([A, B]);
  c.raw.A.p = 1;
  c.raw.B.p = 1; // equal weight → the block's master is halved
  c.input.px = 0.31;
  c.input.py = 0.62;
  c.input.pon = 1;
  c.input.vel = 0.7;
  let f = null;
  for (let fr = 0; fr < 120; fr++) f = c.driver.frame((fr + 1) * 16.7, buf, 1.5);
  ok(f.mist === block, "conductor: the scene's block did not reach the frame");
  ok(Math.abs(f.mistOn - 0.5) < 0.02, `conductor: mistOn ${f.mistOn} (want 0.5 at equal weight)`);
  ok(f.hosts && f.hosts.length === N * 4, "conductor: hosts array missing or mis-sized");
  let finite = true;
  let present = 0;
  let absent = 0;
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    for (let k = 0; k < 4; k++) if (!Number.isFinite(f.hosts[o + k])) finite = false;
    if (f.hosts[o + 3] > 0.5) present++;
    else absent++;
    ok(Math.abs(f.hosts[o + 2] - 0.03) < 1e-6 || f.hosts[o + 3] === 0, `conductor: host ${i} skin radius ${f.hosts[o + 2]}`);
  }
  ok(finite, "conductor: non-finite host");
  ok(present === 40 && absent === 8, `conductor: ${present} present / ${absent} absent hosts (want 40 / 8)`);
  ok(
    f.mistEnv &&
      Math.abs(f.mistEnv[0] - 0.31) < 1e-6 &&
      Math.abs(f.mistEnv[1] - 0.62) < 1e-6 &&
      f.mistEnv[4] === 1 &&
      f.mistEnv[6] > 0.5 &&
      f.mistEnv[7] > 0,
    `conductor: mistEnv ${f.mistEnv && Array.from(f.mistEnv).map((v) => +v.toFixed(3))}`,
  );
  // the block's master follows the scene's weight to zero
  c.raw.A.p = 0;
  for (let fr = 0; fr < 60; fr++) f = c.driver.frame(2000 + (fr + 1) * 16.7, buf, 1.5);
  ok(f.mistOn === 0 && f.mist === null, `conductor: vapour survives its scene (on ${f.mistOn})`);
  // a scene set without a block is vapour-free
  const c2 = makeConductor([mk("C", false)]);
  c2.raw.C.p = 1;
  const f2 = c2.driver.frame(16.7, buf, 1.5);
  ok(f2.mist === null && f2.mistOn === 0, "conductor: a block appeared from nowhere");
  // the form contract is untouched by the hook
  ok(f2.warp === SDF_WARP_REST, "conductor: warp moved");
}

// ── 9: stress and determinism ────────────────────────────────────────────────
{
  const ref = makeMistReference(1024, { probe: core.probe });
  const hosts = hostsRing(0.02, 1);
  ref.seedAt(hosts);
  let rng = 424242;
  const rand = () => {
    rng = (rng * 1103515245 + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  };
  const d = makeMistDials();
  const spellT = new Float32Array(1024 * 2);
  for (let i = 0; i < spellT.length; i++) spellT[i] = rand() * 2 - 1;
  let t = 0;
  for (let fr = 0; fr < 3000; fr++) {
    d.evap = rand();
    d.pull = rand();
    d.poles = rand();
    d.condense = rand();
    d.release = rand() > 0.7 ? rand() : 0;
    d.spell = rand() > 0.8 ? rand() : 0;
    d.spellOn = rand() > 0.5 ? 1 : 0;
    d.floorOn = rand() > 0.5 ? 1 : 0;
    d.floor = rand() * 0.5;
    d.curl = rand() * 1.5;
    d.cx = 0.2 + rand() * 0.6;
    d.cy = 0.2 + rand() * 0.6;
    const dt = fr % 97 === 0 ? 140 : 16.7 * (0.5 + rand());
    t += dt;
    const env = { px: rand(), py: rand(), pvx: rand() - 0.5, pvy: rand() - 0.5, pon: rand() > 0.5, press: rand(), vel: (rand() - 0.5) * 6 };
    ref.step(dt, t, hosts, d, env, spellT, 0.7 + rand() * 1.6);
  }
  ok(finiteState(ref), "stress: non-finite state");
}
{
  // determinism proper: identical inputs, identical outputs
  const refA = makeMistReference(512, { probe: core.probe });
  const refB = makeMistReference(512, { probe: core.probe });
  const hosts = hostsRing(0.02, 1);
  refA.seedAt(hosts);
  refB.seedAt(hosts);
  const d = makeMistDials();
  d.evap = 1;
  d.pull = 0.7;
  d.condense = 0.5;
  let t = 0;
  for (let fr = 0; fr < 400; fr++) {
    t += 16.7;
    refA.step(16.7, t, hosts, d, quietEnv, null, 1.5);
    refB.step(16.7, t, hosts, d, quietEnv, null, 1.5);
  }
  let same = true;
  for (let i = 0; i < refA.P.length; i++) if (refA.P[i] !== refB.P[i]) same = false;
  ok(same, "determinism: two references with the same inputs diverged");
}

console.log(
  "MIST_CHECK " +
    JSON.stringify({
      hosts: N,
      sizeFull: mistSize("full"),
      sizeLite: mistSize("lite"),
      failures: failures.length,
    }),
);
if (failures.length) {
  for (const f of failures) console.error("FAIL " + f);
  process.exit(1);
}
console.log("all mist invariants hold");
