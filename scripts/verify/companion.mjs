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
 *   legal state, and nothing may ever emit NaN. The containment sweep is run
 *   MID-TRANSITION as well as at rest, because the expression spring is
 *   deliberately underdamped: a pose overshoots its target by a few percent on
 *   the way in, so the widest aperture the droplet ever draws is one that
 *   appears in no preset and cannot be found by testing the presets alone.
 *
 *   THE EYE IS A STYLE, NOT A DRAWING. `wide`, `iris`, `slant` and `lift` are
 *   channels, so the lab's grid of eye presets interpolates like everything
 *   else. Each one has to MOVE the aperture measurably — a channel that reads
 *   nothing is a channel a taste pass will quietly zero — and `slant` has to be
 *   mirrored between the two eyes, because parallel slashes read as a
 *   typographic mark and mirrored ones read as a brow.
 *
 *   THE GESTURES COMPOSE AND THEN LEAVE. `shake`, `hop`, `laugh` and `wink` are
 *   impulses on top of whatever pose is current, so each must decay to exactly
 *   zero, must survive an expression change, and must TOP UP rather than
 *   restart when re-triggered. A gesture that could get stuck would be a
 *   droplet that shakes its head forever.
 *
 *   THE WHOLE REFERENCE VOCABULARY IS PRESENT. The owner's brief was to carry
 *   every expression the lab has. That is a list, so it is asserted as one —
 *   by preset or by alias — rather than left to a reviewer counting panels on
 *   a contact sheet.
 *
 * Run: node scripts/verify/companion.mjs   (npm run companion)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  ALIASES,
  COMP,
  EXPRESSIONS,
  EXPRESSION_NAMES,
  PARAM,
  bodyLobe,
  makeCompanion,
} from "../../lib/motion/companion.mjs";

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

  for (const name of EXPRESSION_NAMES) {
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
      ? `no pupil vertex escaped the body across ${EXPRESSION_NAMES.length} expressions x ${ANGLES} gaze angles, struck`
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
  for (const name of EXPRESSION_NAMES) {
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

// ── 4e. the eye is a style, not a drawing ───────────────────────────────────
section("4e. the eye styles");
{
  /**
   * One aperture, drawn with a synthetic vector rather than a named preset.
   *
   * The claim here is about a CHANNEL, and measuring it on a preset would fold
   * in everything else that preset happens to set. The vector is written
   * directly and read back in the same breath, with no step in between, so it
   * cannot spring back toward its target before it is measured.
   */
  const eye = (over) => {
    const c = makeCompanion(1);
    c.step(0);
    const v = c.params;
    const base = {
      open: 1,
      squint: 0,
      brow: 0,
      askew: 0,
      swell: 1,
      spread: 1,
      gaze: 1,
      wide: 1,
      iris: 1,
      slant: 0,
      lift: 0,
      lean: 0,
      tilt: 0,
    };
    for (const [k, x] of Object.entries({ ...base, ...over })) v[PARAM[k]] = x;
    return [c.pupilPath(-1), c.pupilPath(1)];
  };

  const box = (d) => {
    const pts = samplePath(d, 8);
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const [x, y] of pts) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  };

  const round = box(eye({})[0]);
  const dash = box(eye({ wide: 1.5, open: 0.2, squint: -0.9 })[0]);
  const bar = box(eye({ wide: 0.6, open: 1.3 })[0]);
  assert(
    dash.w / dash.h > (round.w / round.h) * 1.6,
    `a flat-dash eye is far wider than it is tall (aspect ${(dash.w / dash.h).toFixed(2)} vs round ${(round.w / round.h).toFixed(2)})`,
  );
  assert(
    bar.w / bar.h < (round.w / round.h) * 0.7,
    `a bar eye is far taller than it is wide (aspect ${(bar.w / bar.h).toFixed(2)})`,
  );

  const small = box(eye({ iris: 0.7 })[0]);
  assert(
    small.w < round.w * 0.8 && small.h < round.h * 0.8,
    `iris shrinks the whole aperture (${small.w.toFixed(2)}x${small.h.toFixed(2)} vs ${round.w.toFixed(2)}x${round.h.toFixed(2)})`,
  );

  const dropped = box(eye({ lift: 1.2 })[0]);
  assert(
    dropped.cy > round.cy + 0.9,
    `lift drops the eye's home (${dropped.cy.toFixed(2)} vs ${round.cy.toFixed(2)})`,
  );

  // THE SLANT IS MIRRORED. Measured as the tilt of each aperture's own long
  // axis: a channel that rotated both eyes the same way would draw two parallel
  // slashes, which is a typographic mark and not a brow.
  const tilted = eye({ slant: 0.45, wide: 1.5, open: 0.45 });
  const lean = (d) => {
    const pts = samplePath(d, 8);
    let cx = 0;
    let cy = 0;
    for (const [x, y] of pts) {
      cx += x / pts.length;
      cy += y / pts.length;
    }
    let best = -Infinity;
    let at = 0;
    for (const [x, y] of pts) {
      const r = Math.hypot(x - cx, y - cy);
      if (r > best) {
        best = r;
        at = Math.atan2(y - cy, x - cx);
      }
    }
    // Folded to a half turn: an axis has no head or tail.
    return ((at + Math.PI * 1.5) % Math.PI) - Math.PI / 2;
  };
  const lt = lean(tilted[0]);
  const rt = lean(tilted[1]);
  assert(
    Math.abs(lt) > 0.15 && Math.abs(rt) > 0.15,
    `slant tilts both apertures (${lt.toFixed(2)} / ${rt.toFixed(2)} rad)`,
  );
  assert(
    lt * rt < 0,
    "and it MIRRORS them — the two eyes cant toward each other, not in parallel",
  );

  // Every eye-style channel has to be spent by something. A channel no preset
  // uses is a channel a later pass deletes as dead, taking the vocabulary with
  // it.
  for (const k of ["wide", "iris", "slant", "lift"]) {
    const neutral = k === "slant" || k === "lift" ? 0 : 1;
    let used = 0;
    for (const name of EXPRESSION_NAMES) {
      if (Math.abs(EXPRESSIONS[name][PARAM[k]] - neutral) > 0.05) used++;
    }
    assert(used >= 3, `${used} expressions actually spend "${k}"`);
  }
}

// ── 4f. the light never leaves the brand's own cyans ────────────────────────
section("4f. the light channels");
{
  // Three channels, all inside AGENTS.md 6's palette. `chill` and `glow` are
  // the two ends of ONE axis; `lumen` is not a hue at all.
  let maxChill = 0;
  let maxGlow = 0;
  let minLumen = Infinity;
  let maxLumen = 0;
  let muddy = "";
  for (const name of EXPRESSION_NAMES) {
    const p = EXPRESSIONS[name];
    const chill = p[PARAM.chill];
    const glow = p[PARAM.glow];
    const lumen = p[PARAM.lumen];
    if (chill < 0 || glow < 0) bad(`${name} has a negative light channel`);
    if (lumen <= 0) bad(`${name} has a non-positive lumen (${lumen})`);
    if (chill > maxChill) maxChill = chill;
    if (glow > maxGlow) maxGlow = glow;
    if (lumen < minLumen) minLumen = lumen;
    if (lumen > maxLumen) maxLumen = lumen;
    // BOTH ENDS AT ONCE IS MUD. `chill` pulls toward cyan-deep and `glow`
    // toward cyan-glow; a pose that spends heavily on both mixes its way back
    // to something near plain cyan, having paid twice for no change. A little
    // of each is legitimate — `searching` is bright and slightly cold.
    if (chill > 0.3 && glow > 0.3) muddy = name;
  }
  assert(
    maxChill <= 1,
    `chill never exceeds 1 (max ${maxChill.toFixed(2)}, cyan -> cyan-deep)`,
  );
  assert(
    maxGlow <= 1,
    `glow never exceeds 1 (max ${maxGlow.toFixed(2)}, cyan -> cyan-glow)`,
  );
  assert(
    muddy === "",
    muddy === ""
      ? "no expression pulls hard toward BOTH ends of the axis at once"
      : `${muddy} spends heavily on chill and glow together, which mixes back to plain cyan`,
  );
  assert(
    minLumen > 0.2 && maxLumen <= 1.6,
    `lumen stays inside 0.2..1.6 (${minLumen.toFixed(2)} .. ${maxLumen.toFixed(2)})`,
  );

  // THE LADDER DIMS. Falling asleep has to READ as receding, and it is the one
  // place `lumen` carries a whole behaviour rather than decorating one.
  const l = (n) => EXPRESSIONS[n][PARAM.lumen];
  assert(
    l("rest") > l("bored") &&
      l("bored") > l("drowsy") &&
      l("drowsy") > l("sleeping"),
    `the sleep ladder dims monotonically (rest ${l("rest").toFixed(2)} > bored ${l("bored").toFixed(2)} > drowsy ${l("drowsy").toFixed(2)} > sleeping ${l("sleeping").toFixed(2)})`,
  );
  // …and it slows. `pulse` is depth and `rate` is speed; sleep is DEEP and
  // SLOW, which is the pair that separates it from being switched off.
  const r = (n) => EXPRESSIONS[n][PARAM.rate];
  assert(
    r("sleeping") < r("rest") * 0.6 && EXPRESSIONS.sleeping[PARAM.pulse] > 1.5,
    `sleep breathes slower and deeper (rate ${r("sleeping").toFixed(2)}, pulse ${EXPRESSIONS.sleeping[PARAM.pulse].toFixed(2)})`,
  );
  assert(
    r("celebrate") > 1.6 && l("celebrate") > 1.2,
    `and the confirmed send is the brightest, fastest thing it does (rate ${r("celebrate").toFixed(2)}, lumen ${l("celebrate").toFixed(2)})`,
  );
}

// ── 4g. the gestures compose, and then leave ────────────────────────────────
section("4g. gestures");
{
  /** Vertical extent of a pupil contour, for the wink. */
  const tall = (d) => {
    if (!d) return 0;
    const pts = samplePath(d, 8);
    let lo = Infinity;
    let hi = -Infinity;
    for (const [, y] of pts) {
      if (y < lo) lo = y;
      if (y > hi) hi = y;
    }
    return hi - lo;
  };

  // A WINK IS ONE LID. Measured against an identical twin that was not winked:
  // the kernel is deterministic, so everything except the wink is byte-equal.
  {
    const a = makeCompanion(1);
    const b = makeCompanion(1);
    a.step(0);
    b.step(0);
    run(a, 0, 600);
    run(b, 0, 600);
    b.wink(-1);
    run(a, 600, 96);
    run(b, 600, 96);
    assert(
      tall(b.pupilPath(-1)) < tall(a.pupilPath(-1)) * 0.8,
      `a wink closes the eye it was aimed at (${tall(b.pupilPath(-1)).toFixed(2)} vs ${tall(a.pupilPath(-1)).toFixed(2)})`,
    );
    assert(
      b.pupilPath(1) === a.pupilPath(1),
      "and leaves the OTHER eye byte-identical",
    );
    run(a, 696, 900);
    run(b, 696, 900);
    assert(b.pupilPath(-1) === a.pupilPath(-1), "the winked lid reopens completely");
  }

  // THE BOUNCE IS AN OFFSET, NOT A DEFORMATION. It must move the caller's
  // transform and leave the ring alone, or `VIEW` is being spent on travel.
  {
    const a = makeCompanion(1);
    const b = makeCompanion(1);
    a.step(0);
    b.step(0);
    run(a, 0, 400);
    run(b, 0, 400);
    b.hop(1);
    run(a, 400, 90);
    run(b, 400, 90);
    assert(b.offset.y < -0.5, `hop lifts the droplet (offset ${b.offset.y.toFixed(2)})`);
    assert(a.offset.y === 0, "an unbounced companion has no offset at all");
    assert(
      b.bodyPath() === a.bodyPath(),
      "and the RING is untouched — the bounce never enters the geometry",
    );
    run(b, 490, 4000);
    assert(
      b.offset.x === 0 && b.offset.y === 0,
      "the bounce returns to exactly zero",
    );
  }

  // TOPPING UP, NOT RESTARTING. A second push mid-swing has to make the bounce
  // bigger; if it reset the phase, the droplet would snap back to the floor.
  {
    const peak = (extra) => {
      const c = makeCompanion(1);
      c.step(0);
      let t = run(c, 0, 300);
      c.hop(1);
      let best = 0;
      for (let i = 0; i < 40; i++) {
        t = run(c, t, 1000 / 60);
        if (i === 6 && extra) c.hop(1);
        if (c.offset.y < best) best = c.offset.y;
      }
      return best;
    };
    const once = peak(false);
    const twice = peak(true);
    assert(
      twice < once * 1.15,
      `a second push mid-swing bounces HIGHER (${twice.toFixed(2)} vs ${once.toFixed(2)})`,
    );
  }

  // A REFUSAL IS A ROTATION, so it moves the body and cannot eject a pupil.
  //
  // STEPPED IN LOCKSTEP, on one shared clock. Running the twins through
  // separate `run` calls puts them on different absolute timestamps, and the
  // idle wander is a function of time — so they would drift apart for reasons
  // that have nothing to do with the gesture, and the comparison would be
  // measuring the test's own bookkeeping.
  {
    const a = makeCompanion(1);
    const b = makeCompanion(1);
    a.step(0);
    b.step(0);
    let t = 0;
    const advance = (frames) => {
      for (let i = 0; i < frames; i++) {
        t += 1000 / 60;
        a.step(t);
        b.step(t);
      }
    };
    advance(24);
    b.shake(1);
    let out = 0;
    for (let i = 0; i < 24; i++) {
      advance(1);
      const poly = samplePath(b.bodyPath(), 8);
      for (const side of [-1, 1]) {
        const d = b.pupilPath(side);
        if (!d) continue;
        for (const [x, y] of samplePath(d, 8)) {
          if (!inside(poly, x, y)) out++;
        }
      }
    }
    assert(b.bodyPath() !== a.bodyPath(), "a shake moves the body");
    assert(out === 0, "and the pupils stay inside it for the whole swing");
    advance(240);
    assert(
      b.bodyPath() === a.bodyPath(),
      "the refusal decays back to nothing — byte-identical to a twin that never shook",
    );
  }

  // MIRTH DRIVES THE CHEST AND THE FACE TOGETHER, and drains on its own.
  {
    const a = makeCompanion(1);
    const b = makeCompanion(1);
    a.step(0);
    b.step(0);
    run(a, 0, 400);
    run(b, 0, 400);
    b.laugh(1);
    run(a, 400, 60);
    run(b, 400, 60);
    assert(b.bodyPath() !== a.bodyPath(), "a laugh moves the chest");
    assert(
      b.pupilPath(-1) !== a.pupilPath(-1),
      "and squeezes the eyes on the same beat",
    );
    run(b, 460, 6000);
    assert(b.offset.y === 0, "mirth drains to nothing");
  }

  // GESTURES SURVIVE A CHANGE OF MOOD. An impulse cancelled by the next
  // expression would be a state machine pretending to be a body.
  {
    const c = makeCompanion(1);
    c.step(0);
    const t = run(c, 0, 300);
    c.hop(1);
    c.express("angry");
    run(c, t, 90);
    assert(c.offset.y < -0.5, "a bounce carries through an expression change");
    assert(!c.settled, "and a running gesture keeps `settled` false");
  }
}

// ── 4h. the breath has a rate, not just a depth ─────────────────────────────
section("4h. the breath");
{
  /** Crossings of the mean radius over 8 s — the chest's frequency, measured. */
  const beats = (name) => {
    const c = makeCompanion(1);
    c.step(0);
    c.express(name);
    // Let the vector arrive first: a rate measured through the transition is a
    // measurement of the transition.
    let t = run(c, 0, 1500);
    const xs = [];
    // 24 s at 100 ms. Long enough that the slowest chest here (`sleeping`, at a
    // 19 s period) completes a cycle — a window shorter than the slowest breath
    // measures the window, not the breath.
    for (let i = 0; i < 240; i++) {
      t = run(c, t, 100);
      xs.push(c.radiusAt(0));
    }
    let mean = 0;
    for (const x of xs) mean += x / xs.length;
    let n = 0;
    for (let i = 1; i < xs.length; i++) {
      if (xs[i - 1] < mean !== xs[i] < mean) n++;
    }
    return n;
  };
  const fast = beats("celebrate");
  const slow = beats("sleeping");
  assert(
    fast > slow * 1.8,
    `a celebrating chest beats far faster than a sleeping one (${fast} vs ${slow} crossings in 24 s)`,
  );
  assert(
    slow > 0,
    "and a sleeping one is still breathing — the liquid never freezes",
  );
}

// ── 4i. the reference's whole vocabulary is here ────────────────────────────
section("4i. the reference vocabulary");
{
  /**
   * The lab's own grid, verbatim: its LIFE CYCLE row and its REACTIONS rows.
   * The owner's brief was to carry all of them, so it is asserted as a list
   * rather than left to a reviewer counting panels on a contact sheet. Four of
   * them are this site's poses under the lab's name and resolve through
   * `ALIASES`; shipping duplicates instead would give the shell two ways to say
   * one thing and no way to tell which is current.
   */
  const LAB = [
    "sleeping",
    "waking",
    "idle",
    "listening",
    "thinking",
    "searching",
    "working",
    "excited",
    "bored",
    "suspicious",
    "angry",
    "drowsy",
    "happy",
    "curious",
    "confused",
    "surprised",
    "proud",
    "shy",
    "sad",
    "laughing",
    "scared",
    "playful",
    "celebrate",
  ];
  const missing = LAB.filter((n) => !EXPRESSIONS[n] && !ALIASES[n]);
  assert(
    missing.length === 0,
    missing.length === 0
      ? `all ${LAB.length} of the reference's expressions resolve (${EXPRESSION_NAMES.length} presets + ${Object.keys(ALIASES).length} aliases)`
      : `missing from the vocabulary: ${missing.join(", ")}`,
  );

  for (const [from, to] of Object.entries(ALIASES)) {
    const c = makeCompanion(1);
    c.step(0);
    c.express(from);
    assert(
      c.expression === to,
      `"${from}" resolves to "${to}" rather than falling through to rest`,
    );
  }

  // Distinctness. Two names that settle to the same silhouette are one pose
  // with a spare label, and a contact sheet cannot tell a reviewer that.
  const seen = new Map();
  let clashes = 0;
  for (const name of EXPRESSION_NAMES) {
    const c = makeCompanion(1);
    c.step(0);
    c.express(name);
    c.aim(0, 0);
    run(c, 0, 1600);
    const key = `${c.bodyPath()}|${c.pupilPath(-1)}|${c.pupilPath(1)}`;
    if (seen.has(key)) {
      clashes++;
      bad(`${name} draws exactly the same pose as ${seen.get(key)}`);
    }
    seen.set(key, name);
  }
  assert(
    clashes === 0,
    `all ${EXPRESSION_NAMES.length} expressions draw a distinct pose`,
  );
}

// ── 4j. containment holds MID-TRANSITION, not only at rest ──────────────────
section("4j. the overshoot");
{
  /**
   * THE SPRING IS DELIBERATELY UNDERDAMPED (`ZETA_E` 0.74), so every channel
   * overshoots its target by a few percent on the way in. The widest aperture
   * the droplet ever draws therefore appears in NO preset, and a containment
   * sweep over the presets alone cannot find it. That did not matter while the
   * eye was always the same round shape; with `wide`, `iris` and `open` all
   * live it is exactly where a pupil would escape.
   *
   * So: walk between the pairs with the largest eye-geometry gap, sampling
   * every frame of the transition.
   */
  const key = ["open", "wide", "iris", "slant", "lift", "spread", "gaze"];
  const spanOf = (a, b) => {
    let d = 0;
    for (const k of key) {
      d += Math.abs(EXPRESSIONS[a][PARAM[k]] - EXPRESSIONS[b][PARAM[k]]);
    }
    return d;
  };
  const pairs = [];
  for (const a of EXPRESSION_NAMES) {
    for (const b of EXPRESSION_NAMES) {
      if (a !== b) pairs.push([a, b, spanOf(a, b)]);
    }
  }
  pairs.sort((x, y) => y[2] - x[2]);

  /**
   * SAMPLED EVERY THIRD FRAME, over the 20 widest pairs and two opposed gaze
   * directions. That is a deliberate budget, not a corner cut: the overshoot is
   * an underdamped spring's first swing and lasts ~180 ms — a dozen frames — so
   * a 3-frame stride cannot step over it, while the full-density version of
   * this sweep cost the gate a minute and a half on its own and nobody runs a
   * gate they have to wait that long for.
   */
  let escapes = 0;
  let where = "";
  let worst = Infinity;
  let frames = 0;
  for (const [from, to] of pairs.slice(0, 20)) {
    for (const ang of [0, Math.PI]) {
      const c = makeCompanion(1);
      c.step(0);
      c.express(from);
      c.aim(Math.cos(ang) * 1.6, Math.sin(ang) * 1.6);
      let t = run(c, 0, 900);
      c.express(to);
      for (let i = 0; i < 18; i++) {
        t = run(c, t, 1000 / 20);
        frames++;
        const poly = samplePath(c.bodyPath(), 5);
        if (!poly) continue;
        for (const side of [-1, 1]) {
          const d = c.pupilPath(side);
          if (!d) continue;
          for (const [x, y] of samplePath(d, 5)) {
            if (!inside(poly, x, y)) {
              escapes++;
              where = `${from} -> ${to} @${ang.toFixed(2)}`;
            } else {
              const m = edgeDistance(poly, x, y);
              if (m < worst) worst = m;
            }
          }
        }
      }
    }
  }
  assert(
    escapes === 0,
    escapes === 0
      ? `no pupil escaped across ${frames} sampled frames of the 20 widest transitions (worst clearance ${worst.toFixed(2)} px)`
      : `${escapes} pupil vertices escaped mid-transition (first: ${where})`,
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
process.exit(failed === 0 ? 0 : 1);
