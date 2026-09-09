/**
 * verify/companion.mjs — the contact companion's kernel, in plain node.
 *
 * `companion.mjs` is DOM-free and deterministic for exactly this reason: the
 * claims it makes are geometric, and a screenshot cannot check any of them.
 * What is pinned here is what would break silently and still look almost right:
 *
 *   CONTAINMENT. A pupil that leaves the body does not read as an emphatic
 *   stare, it reads as a rendering bug — and it is reachable from ordinary
 *   input, because `angry` deliberately spends `gaze` 1.25. Every expression is
 *   swept through every gaze angle, settled, then given a HAND PRESSED INTO THE
 *   SURFACE and a STRIKE, and every pupil vertex is tested against the body's
 *   own sampled outline. Not against a circle: against the polygon the browser
 *   will actually paint. The hand matters most — the membrane dents the body by
 *   up to `maxN`, so an analytic clamp would let a pupil sit outside a surface
 *   that had moved away from it.
 *
 *   DETERMINISM AND CADENCE. The same calls at the same timestamps must emit
 *   byte-identical path strings, and a 120 Hz caller must agree with a 60 Hz
 *   one. Without that this file is testing one run of a simulation rather than
 *   the simulation.
 *
 *   ANGER IS GEOMETRY. The whole permission to put this on a signature surface
 *   rests on the claim that the mood is carried by FORM, not by hue. So the
 *   angry silhouette has to be measurably flatter-crowned and measurably
 *   tauter than the resting one, and the module has to contain no warm colour
 *   at all — asserted against the source text, so a later tuning pass cannot
 *   quietly introduce one.
 *
 *   INTERRUPTIBILITY. A visitor changes their mind mid-word. Every expression
 *   must be reachable from every other, an interrupted transition must stay a
 *   legal state, and nothing may ever emit NaN.
 *
 * Run: node scripts/verify/companion.mjs   (npm run companion)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  COMP,
  EXPRESSIONS,
  EXPRESSION_NAMES,
  EYE_POSE_NAMES, MOOD_NAMES, MOOD_SCORES, BASE_EYE_POSE_NAMES, BASE_MOOD_NAMES, SPECIAL_MOOD_NAMES,
  PARAM,
  bodyLobe,
  makeCompanion,
} from "../../lib/motion/companion.mjs";
import { makeCompanionBehavior } from "../../lib/motion/companion-behavior.mjs";
const GEOMETRY_NAMES = [...EXPRESSION_NAMES, ...EYE_POSE_NAMES];

const HERE = dirname(fileURLToPath(import.meta.url));
const KERNEL = join(HERE, "..", "..", "lib", "motion", "companion.mjs");

let failed = 0;
let checks = 0;
const section = (s) => console.log(`\n${s}`);
const ok = (m) => {
  checks++;
  console.log(`  ok   ${m}`);
};
const bad = (m) => {
  checks++;
  failed++;
  console.log(`  FAIL ${m}`);
};
const assert = (cond, m) => (cond ? ok(m) : bad(m));

// ── path sampling ───────────────────────────────────────────────────────────
// The contour is emitted as one moveto and a run of cubics. Sampling the
// CURVES rather than the on-curve vertices matters: a Catmull-Rom segment bows
// outside the chord between its endpoints, and a containment test against the
// vertices alone would miss exactly the bulge that a pupil escapes through.

const NUM = /-?\d+(?:\.\d+)?/g;

function samplePath(d, per = 6) {
  const nums = d.match(NUM);
  if (!nums) return null;
  const v = nums.map(Number);
  if (v.some((x) => !Number.isFinite(x))) return null;
  // M x y then (C c1x c1y c2x c2y x y)*
  if (v.length < 2 || (v.length - 2) % 6 !== 0) return null;
  const pts = [];
  let x0 = v[0];
  let y0 = v[1];
  for (let i = 2; i < v.length; i += 6) {
    const [c1x, c1y, c2x, c2y, x1, y1] = v.slice(i, i + 6);
    for (let s = 0; s < per; s++) {
      const u = s / per;
      const w = 1 - u;
      const b0 = w * w * w;
      const b1 = 3 * w * w * u;
      const b2 = 3 * w * u * u;
      const b3 = u * u * u;
      pts.push([
        b0 * x0 + b1 * c1x + b2 * c2x + b3 * x1,
        b0 * y0 + b1 * c1y + b2 * c2y + b3 * y1,
      ]);
    }
    x0 = x1;
    y0 = y1;
  }
  return pts;
}

/** Ray casting. `poly` is a closed ring of [x, y]. */
function inside(poly, px, py) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      hit = !hit;
    }
  }
  return hit;
}

/** Shortest distance from a point to the polygon's boundary. */
function edgeDistance(poly, px, py) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const dx = xj - xi;
    const dy = yj - yi;
    const len2 = dx * dx + dy * dy || 1;
    let u = ((px - xi) * dx + (py - yi) * dy) / len2;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const d = Math.hypot(px - (xi + u * dx), py - (yi + u * dy));
    if (d < best) best = d;
  }
  return best;
}

/** Run a companion forward `ms` at `frame` ms per call, from `t0`. */
function run(c, t0, ms, frame = 1000 / 60) {
  let t = t0;
  const end = t0 + ms;
  while (t < end) {
    t += frame;
    c.step(t);
  }
  return t;
}

// ── 1. the contour is a contour ─────────────────────────────────────────────
section("1. path shape");
{
  const c = makeCompanion(1);
  c.step(0);
  run(c, 0, 400);
  const body = c.bodyPath();
  assert(body.startsWith("M") && body.endsWith("Z"), "body opens on M, closes on Z");
  assert(!/NaN|Infinity|undefined/.test(body), "body carries no NaN / Infinity");
  const bp = samplePath(body);
  assert(bp !== null, "body parses as moveto + whole cubics");
  assert(bp !== null && bp.length >= COMP.RING_N * 4, "body samples densely enough to test");

  for (const side of [-1, 1]) {
    const p = c.pupilPath(side);
    assert(p.startsWith("M") && p.endsWith("Z"), `pupil ${side} opens on M, closes on Z`);
    assert(!/NaN|Infinity|undefined/.test(p), `pupil ${side} carries no NaN / Infinity`);
    assert(samplePath(p) !== null, `pupil ${side} parses as moveto + whole cubics`);
  }
}

// ── 2. determinism and cadence ──────────────────────────────────────────────
section("2. determinism");
{
  const script = (c) => {
    c.step(0);
    run(c, 0, 300);
    c.express("attend");
    c.aim(0.4, -0.7);
    run(c, 300, 300);
    c.tick();
    c.express("angry");
    c.aim(-0.9, 0.3);
    run(c, 600, 500);
    c.poke(0.3, 0.9, 1);
    run(c, 1100, 200);
    return [c.bodyPath(), c.pupilPath(-1), c.pupilPath(1)].join("|");
  };
  const a = script(makeCompanion(1));
  const b = script(makeCompanion(1));
  assert(a === b, "same seed + same script emits byte-identical paths");

  const other = script(makeCompanion(4));
  assert(a !== other, "a different seed produces a different silhouette");

  // Cadence independence. The accumulator integrates the same total time, so a
  // 120 Hz caller and a 60 Hz caller must land on the same state.
  const at60 = makeCompanion(2);
  const at120 = makeCompanion(2);
  at60.step(0);
  at120.step(0);
  run(at60, 0, 1200, 1000 / 60);
  run(at120, 0, 1200, 1000 / 120);
  assert(
    Math.abs(at60.time - at120.time) < COMP.DT * 1.01,
    `60 Hz and 120 Hz integrate the same clock (${at60.time.toFixed(1)} vs ${at120.time.toFixed(1)} ms)`,
  );
}

// ── 3. containment — the invariant this file exists for ─────────────────────
section("3. the pupils never leave the body");
{
  const ANGLES = 24;
  let worst = Infinity;
  let worstWhere = "";
  let escapes = 0;

  for (const name of GEOMETRY_NAMES) {
    for (let k = 0; k < ANGLES; k++) {
      const a = (k / ANGLES) * Math.PI * 2;
      const c = makeCompanion(1 + (k % 5));
      c.step(0);
      c.express(name);
      // Aim past the unit disc on purpose: `aim` must clamp, and the stare must
      // still be legal at full extension.
      c.aim(Math.cos(a) * 1.6, Math.sin(a) * 1.6);
      let t = run(c, 0, 1400);
      // A HAND PRESSED INTO THE SURFACE, from the same side the gaze is
      // committed to: the membrane dents the body exactly where the pupil has
      // travelled, which is the worst case the clamp exists for.
      c.hand(Math.cos(a) * COMP.R, Math.sin(a) * COMP.R, 0, 0);
      c.press(true);
      t = run(c, t, 260);
      // …and then strike it, at the worst moment: fully committed gaze.
      c.strike(Math.cos(a) * COMP.R, Math.sin(a) * COMP.R, t, 1);
      c.poke(Math.cos(a + 2.1), Math.sin(a + 2.1), 1.4);
      t = run(c, t, 90);

      const poly = samplePath(c.bodyPath(), 8);
      if (!poly) {
        bad(`${name} @${k}: body did not parse`);
        continue;
      }
      for (const side of [-1, 1]) {
        const d = c.pupilPath(side);
        if (!d) continue; // a closed aperture draws nothing, by contract
        const pts = samplePath(d, 8);
        if (!pts) {
          bad(`${name} @${k}: pupil ${side} did not parse`);
          continue;
        }
        for (const [px, py] of pts) {
          if (!inside(poly, px, py)) {
            escapes++;
            worstWhere = `${name} @${k} side ${side}`;
            worst = -1;
          } else {
            const m = edgeDistance(poly, px, py);
            if (m < worst) {
              worst = m;
              worstWhere = `${name} @${k} side ${side}`;
            }
          }
        }
      }
    }
  }

  assert(
    escapes === 0,
    escapes === 0
      ? `no pupil vertex escaped the body across ${GEOMETRY_NAMES.length} expressions and eye presets x ${ANGLES} gaze angles, struck`
      : `${escapes} pupil vertices escaped the body (first: ${worstWhere})`,
  );
  assert(
    worst > 0.6,
    `worst clearance ${worst.toFixed(2)} px stays above 0.6 px (${worstWhere})`,
  );
}

// ── 3b. nothing ever leaves the drawing surface ─────────────────────────────
section("3b. the silhouette stays inside its own viewBox");
{
  let worst = 0;
  let where = "";
  for (const name of GEOMETRY_NAMES) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const c = makeCompanion(1 + (k % 5));
      c.step(0);
      c.express(name);
      c.aim(Math.cos(a) * 1.6, Math.sin(a) * 1.6);
      let t = run(c, 0, 1600);
      c.hand(Math.cos(a) * COMP.R, Math.sin(a) * COMP.R, 900, 900);
      c.press(true);
      t = run(c, t, 240);
      c.strike(Math.cos(a) * COMP.R, Math.sin(a) * COMP.R, t, 1);
      c.poke(Math.cos(a + 2.1), Math.sin(a + 2.1), 1.4);
      for (let i = 0; i < 10; i++) {
        t = run(c, t, 1000 / 60);
        for (const d of [c.bodyPath(), c.pupilPath(-1), c.pupilPath(1)]) {
          if (!d) continue;
          for (const v of d.match(NUM).map(Number)) {
            if (Math.abs(v) > worst) {
              worst = Math.abs(v);
              where = `${name} @${k}`;
            }
          }
        }
      }
    }
  }
  assert(
    worst < COMP.VIEW,
    `the widest reachable state is ${worst.toFixed(2)}, inside the ${COMP.VIEW} half-viewBox (${where})`,
  );
  // If the margin gets thin, a taste pass on `swell` or `lean` will cut a
  // straight edge across the liquid and nobody will know why it looks wrong.
  assert(
    worst < COMP.VIEW * 0.98,
    `and keeps ${(COMP.VIEW - worst).toFixed(2)} units of margin for a future tuning pass`,
  );
}

// ── 4. anger is geometry, not hue ───────────────────────────────────────────
section("4. anger reads in black and white");
{
  const silhouette = (name) => {
    const c = makeCompanion(1);
    c.step(0);
    c.express(name);
    c.aim(0, 0);
    run(c, 0, 1600);
    const poly = samplePath(c.bodyPath(), 8);
    let halfW = 0;
    let topH = 0;
    for (const [x, y] of poly) {
      if (Math.abs(x) > halfW) halfW = Math.abs(x);
      if (-y > topH) topH = -y;
    }
    return { crown: topH / halfW, chill: c.chill };
  };

  const rest = silhouette("rest");
  const angry = silhouette("angry");
  assert(
    angry.crown < rest.crown * 0.92,
    `the angry crown is flatter (${angry.crown.toFixed(3)} vs rest ${rest.crown.toFixed(3)})`,
  );

  // Tension: a furious drop is taut, a calm one is irregular. Measured on the
  // pure lobe function, so the crest cannot flatter the result.
  const amp = (tension) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 512; i++) {
      const l = bodyLobe((i / 512) * Math.PI * 2, 1, tension);
      if (l < lo) lo = l;
      if (l > hi) hi = l;
    }
    return hi - lo;
  };
  const restAmp = amp(EXPRESSIONS.rest[PARAM.tension]);
  const angryAmp = amp(EXPRESSIONS.angry[PARAM.tension]);
  assert(
    angryAmp < restAmp * 0.45,
    `the angry surface is tauter (lobe amplitude ${angryAmp.toFixed(4)} vs rest ${restAmp.toFixed(4)})`,
  );

  // Nothing may leave the cyan ramp, and nothing may warm.
  let maxChill = 0;
  for (const name of EXPRESSION_NAMES) {
    const v = EXPRESSIONS[name][PARAM.chill];
    if (v > maxChill) maxChill = v;
    if (v < 0) bad(`${name} has a negative chill (${v})`);
  }
  assert(maxChill <= 1, `chill never exceeds 1 (max ${maxChill.toFixed(2)}, cyan -> cyan-deep)`);

  // COMMENTS ARE STRIPPED FIRST. The guard is about what EXECUTES: the kernel's
  // own header states the rule by naming `--color-warn`, and a scan that could
  // not tell prose from code would make the rule undocumentable in the file it
  // governs.
  const src = readFileSync(KERNEL, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");
  const warm = /--color-warn|#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(|crimson|orange|\bred\b/.exec(src);
  assert(
    warm === null,
    warm === null
      ? "the kernel contains no colour literal and no warn token at all"
      : `the kernel introduced a colour literal: ${warm[0]}`,
  );
}

// ── 4b. the surface is the CTAs' surface ──
section("4b. the membrane is real, not an imitation");
{
  const c = makeCompanion(1);
  c.step(0);
  let t = run(c, 0, 400);
  const calm = c.bodyPath();

  c.hand(COMP.R, 0, 0, 0);
  t = run(c, t, 220);
  assert(c.bodyPath() !== calm, "a hand held against the surface deforms it");
  assert(c.aware > 0, `the proximity wake rose (aware ${c.aware.toFixed(3)})`);

  c.strike(COMP.R, 0, t, 1);
  t = run(c, t, 40);
  const hot = c.charge;
  assert(hot > 0.2, `a strike charged the surface (${hot.toFixed(2)})`);
  t = run(c, t, 1800);
  assert(
    c.charge < hot,
    `and the charge drains (${hot.toFixed(2)} -> ${c.charge.toFixed(2)})`,
  );

  c.hand(null);
  t = run(c, t, 1600);
  assert(c.aware < 0.35, `lifting the hand lets the wake fall (${c.aware.toFixed(3)})`);
  assert(c.asleep === false, "asleep is always false — the liquid never freezes");
}

// ── 4c. the two eyes can disagree ──
section("4c. asymmetry");
{
  const both = (name) => {
    const c = makeCompanion(1);
    c.step(0);
    c.express(name);
    c.aim(0, 0);
    run(c, 0, 1600);
    return [c.pupilPath(-1), c.pupilPath(1)];
  };
  const [dl, dr] = both("doubt");
  assert(dl !== dr, "doubt raises ONE brow — the two apertures differ");
  const [cl, cr] = both("curious");
  assert(cl !== cr, "curious raises ONE brow too");
  const [al, ar] = both("angry");
  assert(al !== ar, "the scowl's inner corners are mirrored, not duplicated");
}

// ── 4d. it looks around on its own ──
section("4d. the idle wander");
{
  const c = makeCompanion(1);
  c.step(0);
  const seen = new Set();
  let t = 0;
  let maxR = 0;
  for (let i = 0; i < 40; i++) {
    t = run(c, t, 400);
    seen.add(c.pupilPath(-1));
    maxR = Math.max(maxR, Math.hypot(c.gaze.x, c.gaze.y));
  }
  assert(seen.size > 25, `an unaimed gaze keeps moving (${seen.size}/40 distinct poses)`);
  assert(
    maxR > 0.1 && maxR <= COMP.WANDER_A * 1.4,
    `the wander stays a drift rather than a scan (peak ${maxR.toFixed(2)} vs amplitude ${COMP.WANDER_A})`,
  );

  c.aim(1, 0);
  t = run(c, t, 900);
  assert(c.gaze.x > 0.75, `aiming overrides the wander (gaze.x ${c.gaze.x.toFixed(2)})`);
  c.release();
  t = run(c, t, 2600);
  assert(
    Math.hypot(c.gaze.x, c.gaze.y) < COMP.WANDER_A * 1.4,
    "and releasing hands it back to the wander",
  );
}

// ── 5. every expression is reachable, and interruptible ─────────────────────
section("5. reachability and interruption");
{
  let slowest = 0;
  let slowestPair = "";
  for (const from of EXPRESSION_NAMES) {
    for (const to of EXPRESSION_NAMES) {
      const c = makeCompanion(1);
      c.step(0);
      c.express(from);
      let t = run(c, 0, 1600);
      c.express(to);
      // Walk forward until the vector has arrived, capped well past the spring.
      let settledAt = -1;
      for (let ms = 0; ms < 2000; ms += 1000 / 60) {
        t += 1000 / 60;
        c.step(t);
        let far = 0;
        for (let i = 0; i < c.params.length; i++) {
          const d = Math.abs(c.params[i] - EXPRESSIONS[to][i]);
          if (d > far) far = d;
        }
        if (far < 0.006) {
          settledAt = ms;
          break;
        }
      }
      if (settledAt < 0) {
        bad(`${from} -> ${to} did not arrive within 2000 ms`);
      } else if (settledAt > slowest) {
        slowest = settledAt;
        slowestPair = `${from} -> ${to}`;
      }
    }
  }
  // The spring is deliberately underdamped, so a big change RINGS before it
  // settles. That ring is the expressiveness; what it must not do is outlast
  // the house's long duration, or an interrupted pose would still be wobbling
  // when the next one arrives.
  assert(
    slowest > 0 && slowest < 1200,
    `slowest transition ${slowest.toFixed(0)} ms (${slowestPair}) stays inside the long-duration ladder`,
  );

  // Interrupt every transition halfway through and assert nothing degenerates.
  let dirty = 0;
  for (const to of EXPRESSION_NAMES) {
    const c = makeCompanion(3);
    c.step(0);
    let t = 0;
    for (const mid of EXPRESSION_NAMES) {
      c.express(mid);
      c.aim(Math.random() * 2 - 1, Math.random() * 2 - 1);
      t = run(c, t, 40);
      c.express(to);
      t = run(c, t, 30);
      const s = c.bodyPath() + c.pupilPath(-1) + c.pupilPath(1);
      if (/NaN|Infinity/.test(s) || !s.startsWith("M")) dirty++;
    }
  }
  assert(dirty === 0, "interrupting a transition every 40 ms never degenerates a contour");

  const c = makeCompanion(1);
  c.step(0);
  c.express("not-a-real-expression");
  assert(c.expression === "rest", "an unknown expression name falls through to rest, never throws");
}

// ── 6. the clocks ───────────────────────────────────────────────────────────
section("6. blink, breath, sleep");
{
  const c = makeCompanion(1);
  c.step(0);
  let t = 0;
  let closed = 0;
  let minOpen = Infinity;
  let sawEmpty = false;
  for (let i = 0; i < 60 * 40; i++) {
    t += 1000 / 60;
    c.step(t);
    const d = c.pupilPath(-1);
    if (d === "") sawEmpty = true;
    const wide = c.params[PARAM.open];
    if (wide < minOpen) minOpen = wide;
    if (d === "") closed++;
  }
  assert(minOpen > 0, `the aperture PARAMETER never goes negative (min ${minOpen.toFixed(3)})`);
  assert(sawEmpty, "the lid does fully close at least once in 40 s (blink fires)");
  assert(
    closed < 60 * 40 * 0.06,
    `the lid is shut for under 6% of the time (${((closed / (60 * 40)) * 100).toFixed(2)}%)`,
  );

  // The breath must keep the body alive at rest — the liquid never freezes.
  const a = c.bodyPath();
  t = run(c, t, 2000);
  assert(c.bodyPath() !== a, "the resting body keeps breathing (never a frozen frame)");

  // …and the springs must still report sleep, so a caller can throttle.
  //
  // AN UNDISTURBED COMPANION IS NOT SETTLED, and that is the wander working:
  // left alone it keeps looking around, so its gaze spring never stops. The
  // claim worth pinning is that a HELD gaze settles — otherwise `settled` would
  // mean nothing and no caller could ever trust it.
  const idle = makeCompanion(1);
  idle.step(0);
  run(idle, 0, 3000);
  assert(!idle.settled, "an unaimed companion never settles — it is looking around");

  const s = makeCompanion(1);
  s.step(0);
  s.aim(0.3, -0.2);
  run(s, 0, 2500);
  assert(s.settled, "a companion with a held gaze does settle");
  s.poke(0, 1, 1);
  assert(!s.settled, "a press clears settled");
  s.express("angry");
  assert(!s.settled, "and so does a change of expression");
}

// ── 7. allocation discipline ────────────────────────────────────────────────
section("7. allocation");
{
  const c = makeCompanion(1);
  c.step(0);
  const first = c.params;
  let t = 0;
  for (let i = 0; i < 240; i++) {
    t += 1000 / 60;
    c.step(t);
    c.bodyPath();
    c.pupilPath(-1);
    c.pupilPath(1);
  }
  assert(c.params === first, "the parameter vector is allocated once, never per frame");
  assert(c.params.length === Object.keys(PARAM).length, "the vector has exactly one slot per named channel");
}

// ── result ──────────────────────────────────────────────────────────────────
console.log(
  `\n${failed === 0 ? "PASS" : "FAIL"} — ${checks - failed}/${checks} checks`,
);
section("8. complete vocabulary and animated containment");
assert(BASE_EYE_POSE_NAMES.length === 27, "all 27 reference eye presets are preserved");
assert(EYE_POSE_NAMES.length === 40, "13 special eye styles extend the collection to 40");
assert(BASE_MOOD_NAMES.length === 23, "all 23 reference lifecycle and reaction moods are preserved");
assert(MOOD_NAMES.length === 41 && SPECIAL_MOOD_NAMES.length === 18, "18 new moods extend the vocabulary to 41");
const used = new Set(Object.values(MOOD_SCORES).flatMap(s => s.steps.map(([p]) => p)));
assert(EYE_POSE_NAMES.every(p => used.has(p)), "every eye preset is used by a live mood score");
let escaped = 0, restarted = 0;
for (const mood of MOOD_NAMES) {
  const c = makeCompanion(2);
  c.step(0); c.play(mood); c.aim(.65, -.4);
  const poses = new Set();
  const end = MOOD_SCORES[mood].steps.reduce((ms, step) => ms + step[1], 0) + 200;
  for (let t = 0; t < end; t += 1000 / 60) {
    c.play(mood); // the shell may ask repeatedly; this must NOT restart.
    c.step(t); poses.add(c.pose);
    if (Math.round(t) % 7 === 0) {
      const body = samplePath(c.bodyPath(), 4);
      for (const side of [-1, 1]) {
        const pupil = samplePath(c.pupilPath(side), 4);
        if (pupil?.some(([x, y]) => !inside(body, x, y))) escaped++;
      }
    }
  }
  if (poses.size < 2) restarted++;
}
assert(escaped === 0, "eyes remain contained through the animated scores, including morphs and bobbing");
assert(restarted === 0, "repeated play requests preserve every mood's sequence clock");

section("9. behavior priorities and complete reachability");
const input = {status:"idle",focused:false,typing:false,longText:false,invalid:false,crowded:false,moving:false};
const reached = new Set();
const read = (b, t, override = {}) => { const mood = b.read(t, {...input,...override}); reached.add(mood); return mood; };
let b = makeCompanionBehavior(0);
for (const t of [0, 2000, 11000, 20000, 32000, 46000]) read(b, t);
b.activity(47000);
assert(read(b, 47001) === "waking", "sleep interrupts immediately when the reader returns");
for (const override of [{focused:true}, {typing:true}, {typing:true,longText:true}, {typing:true,invalid:true}, {focused:true,invalid:true}, {crowded:true,moving:true}, {moving:true}]) read(b, 49000, override);
for (const kind of ["choice", "advance", "back", "correct"]) {
  b = makeCompanionBehavior(0); b.event(kind, 2000); read(b, 2200);
}
b = makeCompanionBehavior(0);
b.event("reject", 2000); assert(read(b,2200)==="confused", "first rejection is mild confusion");
b.event("reject", 2500); assert(read(b,2600)==="angry", "repeated rejection escalates");
b.event("correct", 2650); assert(read(b,2700)==="relieved", "one correction immediately forgives anger");
read(b, 3800);
for (const status of ["busy","pending","success","error"]) {
  b = makeCompanionBehavior(0);
  read(b,2000,{status}); read(b,5600,{status}); read(b,9000,{status});
}
b = makeCompanionBehavior(0);
b.touch(true,2000); assert(read(b,2050)==="surprised", "a tap starts with surprise");
b.touch(false,2100); read(b,2900);
b.touch(true,3000); assert(read(b,3100)==="playful", "a second tap starts play");
b.touch(false,3200); b.touch(true,3400); assert(read(b,3450)==="laughing", "a third tap starts laughter");
assert(read(b,4500)==="scared", "a held touch tightens into fear");
b.cancel(); assert(read(b,8000)!=="scared", "pointer cancellation clears held-touch state");
b.hover(true,10000); for (const t of [10100,12100,14600,16100]) read(b,t);
assert(read(b,17000,{status:"busy"})==="working", "a real send outranks direct play");
assert(read(b,19000,{status:"pending"})!=="celebrate", "pending never announces delivery");
for (const t of [40000,72000]) read(makeCompanionBehavior(0),t);
b=makeCompanionBehavior(0); b.hover(true,2000); read(b,15500);
for (const kind of ["return","milestone"]) {
  b=makeCompanionBehavior(0); b.event(kind,2000); read(b,2200); read(b,4200);
}
b=makeCompanionBehavior(0); b.event("type",2000);
for(let t=2100;t<9400;t+=100){b.event("type",t);read(b,t,{typing:true});}
b=makeCompanionBehavior(0);
for(let i=0;i<6;i++){
  const t=2000+i*300;b.touch(true,t);read(b,t+30);b.touch(false,t+50);
}
read(b,5300);
b=makeCompanionBehavior(0);b.touch(true,2000);read(b,3650);b.touch(false,4000);read(b,4050);
b=makeCompanionBehavior(0);b.hover(true,2000);
for(let i=0;i<6;i++)b.stroke(24,200,true,2100+i*100);
assert(read(b,2700)==="affectionate", "gentle petting earns heart eyes");
assert(read(b,4500)==="smitten", "affection settles into a heart wink");
b=makeCompanionBehavior(0);b.touch(true,2000);b.touch(false,2050);b.touch(true,2300);b.touch(false,2350);
assert(read(b,3500)==="wink", "a playful double tap resolves to a wink");
b=makeCompanionBehavior(0);read(b,1000,{status:"pending"});
assert(read(b,12000,{status:"pending"})==="patient", "long unconfirmed delivery stays patient, never celebratory");
assert(MOOD_NAMES.every(n=>reached.has(n)), `all 41 moods are reachable through real events (${reached.size}; missing ${MOOD_NAMES.filter(n=>!reached.has(n)).join(',') || 'none'})`);
console.log(`\n${failed ? "FAIL" : "PASS"} — ${checks - failed}/${checks} checks including full vocabulary and behavior`);
process.exit(failed === 0 ? 0 : 1);
