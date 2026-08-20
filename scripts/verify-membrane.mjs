// The MEMBRANE gate — the vector liquid's physics, in plain node.
//
// The kernel is DOM-free and deterministic for exactly this reason: the two
// contracts it exists to keep are numerical, not visual, and a screenshot
// cannot see either of them.
//
//   VOLUME     the hand and the strike are mean-removed around the ring, so the
//              enclosed area must not drift. A "liquid button" that inflates
//              under the cursor is a scale transform wearing a costume.
//   EXACT REST once nothing is touching, every displacement snaps to zero and
//              path() returns the authored string character-for-character.
//
// Plus the things that make it usable rather than merely correct: bounded
// under abuse, one overshoot and not a wobble, a front that actually travels,
// and a surface that stops burning frames when it is done.
//
//   node scripts/verify-membrane.mjs

import { MEM, makeMembrane, buildRest } from "../lib/motion/membrane.mjs";

let failed = 0;
const pass = (name, extra = "") =>
  console.log(`  ok   ${name}${extra ? ` — ${extra}` : ""}`);
const fail = (name, why) => {
  failed++;
  console.log(`  FAIL ${name} — ${why}`);
};
const check = (name, cond, why, extra) =>
  cond ? pass(name, extra) : fail(name, why);

const W = 232;
const H = 48;

// Drive a membrane over `ms` at a fixed 16.7 ms cadence, calling `onFrame`.
function run(m, ms, t0 = 1000, onFrame) {
  let t = t0;
  const end = t0 + ms;
  while (t < end) {
    t += 16.7;
    m.step(t);
    if (onFrame) onFrame(t, m);
  }
  return t;
}

console.log("\n1. geometry — the rest ring");
{
  const r = buildRest(W, H);
  check(
    "vertex count is arc-length derived",
    r.n >= MEM.N_MIN && r.n <= MEM.N_MAX,
    `n=${r.n} outside [${MEM.N_MIN}, ${MEM.N_MAX}]`,
    `n=${r.n} over ${r.L.toFixed(0)} px of perimeter`,
  );

  let min = Infinity;
  let max = 0;
  for (let i = 0; i < r.n; i++) {
    const j = (i + 1) % r.n;
    const d = Math.hypot(r.bx[j] - r.bx[i], r.by[j] - r.by[i]);
    if (d < min) min = d;
    if (d > max) max = d;
  }
  // Arc-length spacing is uniform by construction (s = i·L/n); what this
  // measures is the CHORD spread, which is what the Laplacian actually sees.
  // Chords that straddle a 2 px corner arc are legitimately shorter than
  // chords along an edge — a real surface carries more tension at a corner
  // too. Past ~1.5× the inhomogeneity starts to show as a stiff spot.
  check(
    "spacing is uniform",
    max / min < 1.45,
    `spread ${(max / min).toFixed(2)}× — the ring has a stiff spot`,
    `${min.toFixed(2)}–${max.toFixed(2)} px (${(max / min).toFixed(2)}× at the corners)`,
  );

  let bad = 0;
  const cx = W / 2;
  const cy = H / 2;
  for (let i = 0; i < r.n; i++) {
    const len = Math.hypot(r.nx[i], r.ny[i]);
    const out = (r.bx[i] - cx) * r.nx[i] + (r.by[i] - cy) * r.ny[i];
    if (Math.abs(len - 1) > 1e-3 || out <= 0) bad++;
  }
  check("normals are unit and outward", bad === 0, `${bad} bad normals`);

  const m = makeMembrane(W, H);
  const err = Math.abs(m.area() - W * H) / (W * H);
  check(
    "rest area matches the box",
    err < 0.01,
    `${(err * 100).toFixed(2)}% off`,
    `${m.area().toFixed(0)} px² vs ${W * H} px² — the ring IS the border box`,
  );
}

console.log("\n2. VOLUME — the hand cannot inflate the button");
{
  const m = makeMembrane(W, H);
  const rest = m.area();
  let worst = 0;
  let worstAt = "";
  for (const [hx, hy, label] of [
    [W * 0.5, H * 0.5, "centre"],
    [W * 0.12, H * 0.5, "left third"],
    [W * 0.88, H * 0.5, "right third"],
    [W * 0.5, -22, "above the top edge"],
    [-30, H * 0.5, "off the left end"],
    [W * 0.3, H * 1.5, "below"],
  ]) {
    const b = makeMembrane(W, H);
    let t = 1000;
    for (let k = 0; k < 90; k++) {
      t += 16.7;
      b.hand(hx, hy, 0, 0);
      b.step(t);
    }
    const err = Math.abs(b.area() - rest) / rest;
    if (err > worst) {
      worst = err;
      worstAt = label;
    }
  }
  check(
    "held hand conserves area",
    worst < 0.02,
    `${(worst * 100).toFixed(2)}% at ${worstAt} — the mean-removal is not holding`,
    `worst ${(worst * 100).toFixed(2)}% (${worstAt})`,
  );

  // A moving hand is the harder case: the wake and drag terms are tangential
  // and must not pump area either.
  const b = makeMembrane(W, H);
  let t = 1000;
  let peak = 0;
  for (let k = 0; k < 240; k++) {
    t += 16.7;
    const u = k / 240;
    b.hand(u * W, H * 0.5 + 8 * Math.sin(u * 9), 620, 40 * Math.cos(u * 9));
    b.step(t);
    peak = Math.max(peak, Math.abs(b.area() - rest) / rest);
  }
  check(
    "swept hand conserves area",
    peak < 0.03,
    `${(peak * 100).toFixed(2)}% drift under a moving pointer`,
    `peak ${(peak * 100).toFixed(2)}%`,
  );

  // The strike is deliberately NOT area-conserving — it is an impact into the
  // surface, and the volume it displaces leaves through the third dimension.
  // What it must do is swell VISIBLY, briefly, and come back to exactly zero.
  const s = makeMembrane(W, H);
  s.step(1000);
  s.strike(W * 0.25, H * 0.5, 1016);
  let speak = 0;
  let sEnd = 0;
  run(s, MEM.SHOCK_LIFE + 900, 1016, (_, mm) => {
    speak = Math.max(speak, Math.abs(mm.area() - rest) / rest);
    sEnd = Math.abs(mm.area() - rest) / rest;
  });
  check(
    "strike swells the outline",
    speak > 0.01,
    `only ${(speak * 100).toFixed(2)}% — the click would not read`,
    `peak ${(speak * 100).toFixed(2)}% area, transient`,
  );
  check(
    "…but stays inside a plausible transient",
    speak < 0.12,
    `${(speak * 100).toFixed(1)}% — this is a scale-up, not a wave`,
  );
  check(
    "…and gives it all back",
    sEnd < 0.002,
    `${(sEnd * 100).toFixed(2)}% still held after the wave expired`,
  );
}

console.log("\n3. EXACT REST — the authored form comes back");
{
  const m = makeMembrane(W, H);
  m.step(1000);
  const authored = m.path();

  let t = 1016;
  for (let k = 0; k < 60; k++) {
    t += 16.7;
    m.hand(W * 0.3, H * 0.4, 500, 0);
    m.press(true);
    m.step(t);
  }
  m.strike(W * 0.3, H * 0.4, t);
  check(
    "the hand actually moves the surface",
    m.path() !== authored,
    "a touched membrane is byte-identical to rest — nothing is being simulated",
  );

  m.press(false);
  m.hand(null);
  let sleptAt = 0;
  const t0 = t;
  t = run(m, 4000, t, (tt, mm) => {
    if (!sleptAt && mm.asleep) sleptAt = tt;
  });

  check("the surface sleeps", m.asleep, "still awake after 4 s of no input");
  check(
    "rest is byte-exact",
    m.path() === authored,
    "the settled path differs from the authored path",
    `${authored.length} chars, identical`,
  );
  check(
    "step() is free once asleep",
    m.step(t + 16.7) === false,
    "a sleeping membrane still integrates — this is the per-frame cost budget",
  );
  if (sleptAt) pass("settle time", `${Math.round(sleptAt - t0)} ms from release to sleep`);
}

console.log("\n4. character — one overshoot, not a wobble");
{
  const m = makeMembrane(W, H);
  m.step(1000);
  m.strike(W * 0.5, H * 0.35, 1016);
  // Track the vertex that ends up moving most, and count the sign changes of
  // ITS displacement. That is the difference between a meniscus returning
  // through one soft overshoot and a jelly ringing down.
  const trace = [];
  run(m, 1600, 1016, (_, mm) => trace.push(Float32Array.from(mm.dn)));
  let hot = 0;
  let best = 0;
  for (let i = 0; i < m.count; i++) {
    let mx = 0;
    for (const f of trace) mx = Math.max(mx, Math.abs(f[i]));
    if (mx > best) {
      best = mx;
      hot = i;
    }
  }
  const sig = trace.map((f) => f[hot]);
  let crossings = 0;
  for (let i = 1; i < sig.length; i++)
    if (
      Math.sign(sig[i]) !== Math.sign(sig[i - 1]) &&
      Math.abs(sig[i]) > MEM.EPS_D * 4
    )
      crossings++;
  check(
    "the strike moves the surface visibly",
    best > 1.2,
    `peak displacement ${best.toFixed(2)} px — a click would not read`,
    `peak ${best.toFixed(2)} px at vertex ${hot}`,
  );
  check(
    "the surface does not ring",
    crossings >= 1 && crossings <= 4,
    `${crossings} sign changes — ${crossings < 1 ? "no recoil at all: crest without trough" : "this reads as jelly, not as a meniscus"}`,
    `${crossings} crossing(s): crest, trough, settle`,
  );

  // The recoil is the whole character of the wave — fluid-core: "the trough is
  // what makes it read as liquid rather than as a blast". It is also the first
  // thing that quietly dies when SHOCK_WIDTH, SHOCK_SPEED, ZETA or K_VIS are
  // touched, and it dies without failing anything else: the click still looks
  // fine in a still frame. Pin the ratio.
  const crest = Math.max(...sig);
  const trough = -Math.min(...sig);
  const pct = (trough / crest) * 100;
  check(
    "the trough comes back through rest",
    pct > 18 && pct < 60,
    `recoil is ${pct.toFixed(0)}% of the crest — ${pct <= 18 ? "the trough has been damped out of existence; this now reads as a blast" : "the surface is bouncing"}`,
    `${crest.toFixed(2)} px out, ${trough.toFixed(2)} px back through rest (${pct.toFixed(0)}%)`,
  );
  check("strike energy is spent", m.charge() === 0, "the wave never expired");
}

console.log("\n5. the strike travels");
{
  // A click that kicked every vertex on the same frame would be an explosion,
  // which is the one thing liquid never does. Measure when each end of the top
  // edge first MOVES, from the geometry itself.
  const ox = W * 0.08;
  const oy = H * 0.5;
  const m = makeMembrane(W, H);
  m.step(1000);
  m.strike(ox, oy, 1016);
  const r = m.rest;
  const nearest = (target) => {
    let b = -1;
    for (let i = 0; i < r.n; i++)
      if (
        r.ny[i] === -1 &&
        (b < 0 || Math.abs(r.bx[i] - target) < Math.abs(r.bx[b] - target))
      )
        b = i;
    return b;
  };
  const topNear = nearest(24);
  const topFar = nearest(W - 24);
  const THRESH = 0.35; // px — the smallest displacement that reads on screen
  let tNear = 0;
  let tFar = 0;
  run(m, MEM.SHOCK_LIFE + 200, 1016, (tt, mm) => {
    if (!tNear && Math.abs(mm.dn[topNear]) > THRESH) tNear = tt - 1016;
    if (!tFar && Math.abs(mm.dn[topFar]) > THRESH) tFar = tt - 1016;
  });
  const span = r.bx[topFar] - r.bx[topNear];
  check(
    "the far end moves after the near end",
    tNear > 0 && tFar > tNear + 40,
    `near ${tNear | 0} ms, far ${tFar | 0} ms — the wave is not travelling`,
    `near ${tNear | 0} ms → far ${tFar | 0} ms across ${span | 0} px`,
  );
  const measured = tFar > tNear ? (span / (tFar - tNear)) * 1000 : 0;
  check(
    "the measured front speed matches SHOCK_SPEED",
    Math.abs(measured - MEM.SHOCK_SPEED) / MEM.SHOCK_SPEED < 0.5,
    `measured ${measured | 0} px/s vs declared ${MEM.SHOCK_SPEED}`,
    `${measured | 0} px/s (declared ${MEM.SHOCK_SPEED}; surface tension carries the front)`,
  );
  check(
    "a click is acknowledged inside the immediate band",
    tNear > 0 && tNear < 120,
    `${tNear | 0} ms before anything moves under the finger`,
    `${tNear | 0} ms under the finger`,
  );
}

console.log("\n6. bounded under abuse");
{
  const m = makeMembrane(W, H);
  m.step(1000);
  let t = 1000;
  let maxDev = 0;
  let nan = false;
  const restArea = W * H;
  // 12 s of a hostile pointer: flicks, mashing, off-element jumps
  for (let k = 0; k < 720; k++) {
    t += 16.7;
    const u = k * 0.11;
    m.hand(
      W * 0.5 + Math.sin(u * 3.1) * W * 0.9,
      H * 0.5 + Math.cos(u * 2.3) * 90,
      Math.cos(u * 3.1) * 2400,
      -Math.sin(u * 2.3) * 1800,
    );
    m.press(k % 37 < 6);
    if (k % 11 === 0) m.strike(W * Math.abs(Math.sin(u)), H * 0.5, t);
    m.step(t);
    const a = m.area();
    if (!Number.isFinite(a)) nan = true;
    maxDev = Math.max(maxDev, Math.abs(a - restArea) / restArea);
  }
  check("no NaN under abuse", !nan, "the integrator diverged");
  check(
    "deformation stays bounded",
    maxDev < 0.3,
    `${(maxDev * 100).toFixed(0)}% area excursion — the clamp is not holding`,
    `worst ${(maxDev * 100).toFixed(1)}% area excursion under a hostile pointer`,
  );

  m.press(false);
  m.hand(null);
  run(m, 5000, t);
  check("it still finds rest", m.asleep, "abuse left it permanently awake");
}

console.log("\n7. cost");
{
  const m = makeMembrane(W, H);
  m.step(1000);
  let t = 1000;
  const t0 = process.hrtime.bigint();
  const FRAMES = 6000;
  for (let k = 0; k < FRAMES; k++) {
    t += 16.7;
    m.hand(W * 0.5 + 40 * Math.sin(k * 0.05), H * 0.5, 200, 0);
    m.step(t);
    m.path();
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const per = ms / FRAMES;
  check(
    "sim + path build fits a frame budget",
    per < 0.35,
    `${per.toFixed(3)} ms/frame is too much beside a WebGL fluid`,
    `${per.toFixed(3)} ms/frame (${m.count} vertices, sim + Bézier string)`,
  );
}

console.log("\n8. the TIDE — the autonomous behaviour on touch devices");
{
  const W2 = 280;
  const H2 = 54;
  const peakOf = (m) => {
    let x = 0;
    for (let i = 0; i < m.count; i++) x = Math.max(x, Math.abs(m.dn[i]));
    return x;
  };

  const m = makeMembrane(W2, H2);
  m.step(1000);
  m.setTide(1);
  let t = 1000;
  let swell = 0;
  const restArea = W2 * H2;
  let areaDrift = 0;
  for (let k = 0; k < 480; k++) {
    t += 16.7;
    m.step(t);
    if (k > 70) {
      swell = Math.max(swell, peakOf(m));
      areaDrift = Math.max(areaDrift, Math.abs(m.area() - restArea) / restArea);
    }
  }
  // Above the legibility floor: below ~1 px, motion on a 1 px hairline reads as
  // unstable antialiasing rather than as life. That finding killed BREATH_A and
  // BOW, and the tide only exists because it clears the same bar.
  check(
    "the swell is legible",
    swell > 1.1,
    `${swell.toFixed(2)} px — under the 1 px hairline floor, this reads as antialiasing noise`,
    `${swell.toFixed(2)} px resting swell`,
  );
  check(
    "the tide barely moves area",
    areaDrift < 0.02,
    `${(areaDrift * 100).toFixed(2)}% — a travelling wave should very nearly cancel itself`,
    `${(areaDrift * 100).toFixed(2)}% area`,
  );

  // A flick must stir the surface, never rival a deliberate press. The press
  // crest is measured in section 4; if scroll can reach it, the autonomous
  // motion becomes indistinguishable from a response to touch.
  let flick = 0;
  for (let k = 0; k < 160; k++) {
    t += 16.7;
    m.scroll(1900);
    m.step(t);
    flick = Math.max(flick, peakOf(m));
  }
  check(
    "scroll stirs but does not rival a press",
    flick > swell * 1.15 && flick < 3.2,
    `${flick.toFixed(2)} px vs a ${swell.toFixed(2)} px rest — ${flick <= swell * 1.15 ? "scroll is doing nothing" : "this is press-sized, and unprompted"}`,
    `${swell.toFixed(2)} px → ${flick.toFixed(2)} px under a hard flick`,
  );

  // The exact-rest contract is SUSPENDED by the tide, never broken.
  m.setTide(0);
  let slept = 0;
  const t0 = t;
  for (let k = 0; k < 400; k++) {
    t += 16.7;
    m.step(t);
    if (!slept && m.asleep) slept = t - t0;
  }
  check(
    "turning the tide off restores exact rest",
    m.asleep && peakOf(m) === 0,
    "the surface never settled once the tide was withdrawn",
    `slept ${Math.round(slept)} ms after withdrawal, peak 0`,
  );

  // The arrival must be gentler than a press, or the button announces itself
  // more loudly than it responds.
  const a = makeMembrane(W2, H2);
  a.step(1000);
  a.arrive(true, 1016);
  let arr = 0;
  run(a, MEM.SHOCK_LIFE + 200, 1016, (_, mm) => {
    arr = Math.max(arr, peakOf(mm));
  });
  check(
    "the arrival is quieter than a press",
    arr > 0.8 && arr < 3.0,
    `${arr.toFixed(2)} px — ${arr <= 0.8 ? "nobody would notice it" : "louder than the press it is advertising"}`,
    `${arr.toFixed(2)} px (a press crest is ~3.5 px)`,
  );
}

console.log(
  failed === 0
    ? "\nMEMBRANE OK — volume held, rest exact, bounded, cheap, tide legible.\n"
    : `\n${failed} FAILED\n`,
);
process.exit(failed === 0 ? 0 : 1);
