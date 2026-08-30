// The WATERLINE gate — the chapter rail's physics, in plain node.
//
// The kernel is DOM-free and deterministic for exactly this reason: the two
// contracts it exists to keep are numerical, and a screenshot cannot see
// either of them.
//
//   DISPLACEMENT the hand does not add material to the rail. Every lobe is
//                mean-removed against its own involvement window, so the
//                extensions sum to zero — the swell is paid for by the
//                withdrawal beside it. A rail that only bulges is a dock
//                magnifier wearing the site's palette.
//   EXACT REST   once nothing is touching and the page is still, every
//                extension snaps to zero, path() returns the resting string
//                character-for-character, and the loop stops.
//
// Plus the things that make it usable rather than merely correct: the swell
// stays inside the column the layout reserves for it, it lags the pointer
// instead of snapping to it, nine chapters own nine distinct dots, and the lit
// run is a truthful proportional thumb.
//
//   node scripts/verify-rail.mjs

import { RAIL, makeRail } from "../lib/motion/rail.mjs";

let failed = 0;
const pass = (name, extra = "") =>
  console.log(`  ok   ${name}${extra ? ` — ${extra}` : ""}`);
const fail = (name, why) => {
  failed++;
  console.log(`  FAIL ${name} — ${why}`);
};
const check = (name, cond, why, extra) =>
  cond ? pass(name, extra) : fail(name, why);

const SPAN = 708; // a 900 px viewport less the rail's insets
const X0 = 28; // the dot column, in the rail's local frame
const VH = 900;
const DOC = 8400; // roughly nine chapters
const MARKS = [0, 0.11, 0.23, 0.35, 0.47, 0.59, 0.7, 0.83, 0.95];

/** Drive a rail over `ms` at a fixed 16.7 ms cadence. */
function run(r, ms, t0 = 1000, onFrame) {
  let t = t0;
  const end = t0 + ms;
  while (t < end) {
    t += 16.7;
    r.step(t);
    if (onFrame) onFrame(t, r);
  }
  return t;
}

function fresh() {
  const r = makeRail(SPAN, X0);
  r.setMarks(MARKS);
  r.travel(0, VH, DOC);
  return r;
}

const sum = (a) => {
  let s = 0;
  for (const v of a) s += v;
  return s;
};
const peakOf = (a) => {
  let m = -1e9;
  for (const v of a) if (v > m) m = v;
  return m;
};
const troughOf = (a) => {
  let m = 1e9;
  for (const v of a) if (v < m) m = v;
  return m;
};

console.log("\n1. geometry — the dotted edge");
{
  const r = fresh();
  check(
    "dot count is pitch-derived",
    r.count === Math.round(SPAN / RAIL.PITCH) + 1,
    `got ${r.count}`,
    `${r.count} dots over ${SPAN} px`,
  );

  // The column must fill its span exactly: the dots are read against document
  // positions, so a rail ending short is a rail that lies about where a
  // chapter is.
  const ink = r.path("ink") + r.path("mark") + r.path("flow") + r.path("live");
  const ys = [...ink.matchAll(/M\d+(?:\.\d+)? (-?\d+(?:\.\d+)?)/g)]
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
  check(
    "the column spans exactly, end to end",
    ys[0] === 0 && Math.abs(ys[ys.length - 1] - SPAN) < 0.02,
    `${ys[0]}..${ys[ys.length - 1]} for a ${SPAN} px span`,
  );
  check(
    "every dot is emitted exactly once",
    ys.length === r.count,
    `${ys.length} emitted, ${r.count} dots`,
  );

  // Nine chapters, nine distinct dots — two marks inside one pitch must not
  // collapse onto the same dot and silently become eight.
  const owners = MARKS.map((_, i) => r.markY(i));
  check(
    "each chapter owns a distinct dot",
    new Set(owners).size === MARKS.length,
    `${new Set(owners).size} distinct of ${MARKS.length}`,
  );
  const tight = makeRail(SPAN, X0);
  tight.setMarks([0.5, 0.502, 0.504, 0.506]);
  check(
    "marks closer than one pitch still separate",
    new Set([0, 1, 2, 3].map((i) => tight.markY(i))).size === 4,
    "two chapters share a dot",
  );
}

console.log("\n2. DISPLACEMENT — the hand cannot add material");
{
  // Four hand positions, including both ends, where the lobe is clipped by the
  // rail. A closed-form difference of Gaussians cancels only in the middle;
  // this cancellation is discrete and holds everywhere.
  for (const at of [0, 0.5, 1, 0.08]) {
    const r = fresh();
    r.hand(X0, SPAN * at);
    run(r, 600);
    const s = sum(r.ext);
    check(
      `sums to zero with the hand at ${(at * 100).toFixed(0)}%`,
      Math.abs(s) < 1e-3,
      `sum ${s.toFixed(5)} px`,
      `${s.toExponential(1)} px`,
    );
  }

  const r = fresh();
  r.hand(X0, SPAN * 0.5);
  run(r, 600);
  const p = peakOf(r.ext);
  const tr = troughOf(r.ext);
  check(
    "the swell reaches the authored peak",
    Math.abs(p - RAIL.MAX_EXT) < 0.2,
    `peak ${p.toFixed(2)} px, want ${RAIL.MAX_EXT}`,
    `${p.toFixed(2)} px`,
  );
  check(
    "the withdrawal is present and subordinate",
    tr < -0.5 && tr / p > -0.32 && tr / p < -0.1,
    `trough ${tr.toFixed(2)} px is ${((tr / p) * 100).toFixed(0)}% of peak`,
    `${((tr / p) * 100).toFixed(0)}% of peak`,
  );

  // Monotone out of the peak to the zero crossing: a falloff with a second
  // bump in it reads as ringing, not as a surface.
  const e = r.ext;
  let iPeak = 0;
  for (let i = 0; i < e.length; i++) if (e[i] > e[iPeak]) iPeak = i;
  let mono = true;
  for (let i = iPeak + 1; i < e.length && e[i] > 0; i++)
    if (e[i] > e[i - 1] + 1e-6) mono = false;
  for (let i = iPeak - 1; i >= 0 && e[i] > 0; i--)
    if (e[i] > e[i + 1] + 1e-6) mono = false;
  check("the falloff is monotone out of the peak", mono, "the swell ripples");

  // The bow wave is the page's own motion and obeys the same rule.
  const w = fresh();
  w.travel(3000, VH, DOC);
  w.wake(1400);
  run(w, 120);
  check(
    "the page's wake sums to zero too",
    Math.abs(sum(w.ext)) < 1e-3 && peakOf(w.ext) > 1,
    `sum ${sum(w.ext).toFixed(5)}, peak ${peakOf(w.ext).toFixed(2)}`,
    `peak ${peakOf(w.ext).toFixed(2)} px, residue ${sum(w.ext).toExponential(1)} px`,
  );
}

console.log("\n2b. the page's own motion");
{
  const r = fresh();
  r.travel(3000, VH, DOC, 700);
  run(r, 60);
  check(
    "an ordinary scroll raises a wave",
    peakOf(r.ext) > 3,
    `peak ${peakOf(r.ext).toFixed(2)} px`,
    `peak ${peakOf(r.ext).toFixed(2)} px`,
  );

  // A hash landing moves the document by thousands of pixels between two
  // frames. That is not a reader scrolling, and the rail must not answer it as
  // though it were — the swell would sit at full for most of a second while
  // the smoothed velocity fell back through WAKE_V.
  const j = fresh();
  j.travel(20000, VH, 29200, 640000);
  run(j, 60);
  check(
    "but a jump raises none",
    peakOf(j.ext) === 0,
    `peak ${peakOf(j.ext).toFixed(2)} px after a 640 000 px/s jump`,
    "silent",
  );

  // …and the wave leaves on its own, or a rail the reader scrolled past stays
  // deformed with nobody touching it.
  const s2 = fresh();
  s2.travel(3000, VH, DOC, 900);
  run(s2, 1400);
  check(
    "and the wave drains to nothing",
    peakOf(s2.ext) === 0 && s2.asleep,
    `peak ${peakOf(s2.ext).toFixed(3)} px, asleep=${s2.asleep}`,
  );
}

console.log("\n3. the reserved column");
{
  // `--rail-safe` is 2.75rem and the column sits 20 px in from the page edge.
  // The swell must never reach past that into the copy — under any hand, at
  // any speed, including the ones a reader produces by accident.
  const r = fresh();
  let worst = 0;
  let t = 1000;
  for (let i = 0; i < 900; i++) {
    const y = (Math.sin(i * 0.31) * 0.5 + 0.5) * SPAN;
    r.hand(X0 - (i % 7) * 26, y);
    t += 16.7;
    r.step(t);
    for (const v of r.ext) worst = Math.max(worst, Math.abs(v));
  }
  check(
    "no hand can push the rail out of its column",
    worst <= RAIL.MAX_EXT * 1.02,
    `reached ${worst.toFixed(2)} px, ceiling ${RAIL.MAX_EXT}`,
    `worst ${worst.toFixed(2)} px`,
  );

  const both = fresh();
  both.hand(X0, SPAN * 0.5);
  run(both, 600);
  both.wake(4000);
  run(both, 60);
  let stacked = 0;
  for (const v of both.ext) stacked = Math.max(stacked, Math.abs(v));
  check(
    "a hand and a hard scroll together stay bounded",
    stacked <= RAIL.MAX_EXT + RAIL.WAKE_EXT + 0.5,
    `reached ${stacked.toFixed(2)} px`,
    `${stacked.toFixed(2)} px`,
  );
}

console.log("\n4. the lag — a target, not a snap");
{
  const r = fresh();
  r.hand(X0, SPAN * 0.2);
  run(r, 600);
  const before = r.ext.indexOf(peakOf(r.ext));

  // Jump the pointer the length of the rail. The swell must travel, not
  // teleport: smoothing the TARGET is what removes the kick at t=0.
  r.hand(X0, SPAN * 0.8);
  run(r, 33);
  const mid = r.ext.indexOf(peakOf(r.ext));
  check(
    "the swell travels toward a jumped pointer",
    mid > before && mid < Math.round(0.8 * (r.count - 1)) - 1,
    `went straight to ${mid} of ${r.count}`,
    `${before} → ${mid} after 2 frames`,
  );

  run(r, 300);
  const after = r.ext.indexOf(peakOf(r.ext));
  check(
    "and arrives inside a third of a second",
    Math.abs(after - Math.round(0.8 * (r.count - 1))) <= 1,
    `stalled at ${after}, want ${Math.round(0.8 * (r.count - 1))}`,
  );
}

console.log("\n5. EXACT REST");
{
  const r = fresh();
  const rest = ["ink", "mark", "flow", "live"].map((k) => r.path(k));

  r.hand(X0, SPAN * 0.42);
  run(r, 900);
  check(
    "the rail is deformed while the hand is on it",
    peakOf(r.ext) > 10,
    "nothing moved",
  );

  r.hand(null);
  const t = run(r, 1500);
  let allZero = true;
  for (const v of r.ext) if (v !== 0) allZero = false;
  check("every extension snaps to exactly zero", allZero, "residue remains");
  const back = ["ink", "mark", "flow", "live"].map((k) => r.path(k));
  check(
    "path() returns the resting string character-for-character",
    back.every((s, i) => s === rest[i]),
    "the rest string drifted",
  );
  check(
    "and the loop stops",
    r.asleep && r.step(t + 16.7) === false,
    "the rail keeps asking for frames with nothing to draw",
  );

  // A sleeping rail must still answer a hand arriving on the next frame.
  r.hand(X0, SPAN * 0.5);
  check("a sleeping rail still wakes", r.step(t + 33) === true, "stayed asleep");
}

console.log("\n6. the lit run — a truthful thumb");
{
  const r = fresh();
  const frac = (VH / DOC) * (r.count - 1);
  check(
    "the run is proportional to what is on screen",
    Math.abs(r.tailIndex - r.headIndex - frac) <= 1,
    `${r.tailIndex - r.headIndex} dots for ${frac.toFixed(1)}`,
    `${r.tailIndex - r.headIndex + 1} of ${r.count} dots`,
  );

  let live = -1;
  let monotone = true;
  let redraws = 0;
  let t = 2000;
  for (let y = 0; y <= DOC - VH; y += 40) {
    r.travel(Math.min(y, DOC - VH), VH, DOC);
    t += 16.7;
    if (r.step(t)) redraws++;
    if (r.liveMark < live) monotone = false;
    live = r.liveMark;
  }
  // land on the true bottom, which a fixed step is not guaranteed to hit
  r.travel(DOC - VH, VH, DOC);
  r.step((t += 16.7));
  live = r.liveMark;
  check(
    "the live chapter only ever advances while scrolling down",
    monotone,
    "it went backwards",
  );
  check(
    "and it reaches the last chapter at the bottom",
    live === MARKS.length - 1,
    `stopped at ${live}`,
  );
  check(
    "scrolling redraws the rail without a hand on it",
    redraws > 20,
    `only ${redraws} redraws`,
    `${redraws} frames`,
  );

  r.travel(0, VH, DOC);
  r.step((t += 16.7));
  check(
    "the run is clamped at the top",
    r.headIndex === 0,
    `head at ${r.headIndex}`,
  );
  r.travel(DOC, VH, DOC);
  r.step((t += 16.7));
  check(
    "and at the bottom",
    r.tailIndex === r.count - 1,
    `tail at ${r.tailIndex} of ${r.count - 1}`,
  );

  // The real homepage is ~29 000 px against a 900 px viewport, where an
  // honestly proportional run is two dots. The floor is what keeps the one
  // thing this control exists to show visible.
  const long = makeRail(SPAN, X0);
  long.setMarks(MARKS);
  long.travel(14000, VH, 29200);
  long.step(3000);
  const run = long.tailIndex - long.headIndex + 1;
  check(
    "a very long document still shows a readable run",
    run === RAIL.MIN_RUN,
    `${run} dots, floor is ${RAIL.MIN_RUN}`,
    `${run} dots`,
  );
  long.travel(0, VH, 29200);
  long.step(3020);
  check(
    "and the floored run sits flush at the top",
    long.headIndex === 0 && long.tailIndex === RAIL.MIN_RUN - 1,
    `${long.headIndex}..${long.tailIndex}`,
  );
  long.travel(29200 - VH, VH, 29200);
  long.step(3040);
  check(
    "and flush at the bottom",
    long.tailIndex === long.count - 1,
    `${long.headIndex}..${long.tailIndex} of ${long.count - 1}`,
  );
}

console.log("\n7. idle cost");
{
  // One live frame is correct and required: the rail has to DRAW once, or a
  // reader who never touches it never sees it. What must not happen is a
  // second one.
  const r = fresh();
  let frames = 0;
  run(r, 3000, 1000, (_, rail) => {
    if (!rail.asleep) frames++;
  });
  check(
    "an untouched rail draws once and then costs nothing",
    frames === 1,
    `${frames} live frames with nobody there`,
    "1 mount draw, then asleep",
  );

  // …and a cursor parked somewhere else on the page is not an interaction.
  // The shared runtime hands over the pointer on EVERY tick, so this is the
  // difference between an idle page costing nothing and costing a frame each.
  const p = fresh();
  let t = run(p, 400, 1000);
  let live = 0;
  for (let i = 0; i < 120; i++) {
    p.hand(X0 - 600, 120); // far to the left, never moving
    t += 16.7;
    p.step(t);
    if (!p.asleep) live++;
  }
  check(
    "a still cursor elsewhere on the page keeps nothing awake",
    live <= 2,
    `${live} live frames under a parked cursor`,
    `${live} frames`,
  );
}

console.log(
  failed
    ? `\n${failed} check(s) FAILED\n`
    : "\nall rail checks passed — the waterline holds\n",
);
process.exit(failed ? 1 : 0);
