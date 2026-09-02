/**
 * THE CONFLUENCE's gate — S3's resolved symbol, measured in the real field.
 *
 * confluence.mjs makes claims that are geometry, not taste, and every one of
 * them is a property of Sum r^2/d^2 >= 1 rather than of the numbers in the file.
 * Metaballs punish authored coordinates in ways that are invisible in the
 * source and obvious on screen — a chain whose spacing exceeds 0.83 x radius
 * breaks into beads; a taper that ends in one small droplet sheds it — so they
 * are asserted here, off GPU, against the same arithmetic the shader runs
 * (scripts/_melt-sim.mjs):
 *
 *   A · ONE BODY          — the symbol is a single connected mass, not three
 *                           arms and a scatter of tips.
 *   B · NO LOOSE BEADS    — no lit component beside it. A chain's last link is
 *                           where this material sheds one.
 *   C · SOLID             — no enclosed void: the arms really do merge into the
 *                           core rather than closing a ring around it.
 *   D · THE READ          — three arms with real concavities between them, the
 *                           arms free of the droplets' own period, at the
 *                           extent and centre the scene is composed around.
 *   E · THE CROSSING      — the melt out of S3 (confluence -> pillar 1) is
 *                           exact at both ends, never tears in the middle, and
 *                           its droplet/form handoff holds the mass budget.
 *
 *   node scripts/verify-confluence.mjs
 */

import {
  CONFLUENCE,
  armTip,
  armOf,
  ARM_SEQ,
  CORE_CENTRE,
} from "../lib/webgl/confluence.mjs";
import { CLOUDS } from "../lib/webgl/phys.mjs";
import {
  flow,
  matchClouds,
  meltDroplet,
  bridgePresence,
  bridgeDensity,
  formPhase,
  FORM_SOLIDITY,
} from "../lib/webgl/melt.mjs";
import { loadForms, prepareForms, addBalls } from "./_melt-sim.mjs";

const RES = 512;

let failures = 0;
const check = (ok, label, detail) => {
  console.log(`${ok ? "  OK  " : "  FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

/** The droplet field alone — no form, no shield (both are identity in S3). */
const EMPTY = prepareForms({ forms: [], fa: 0, fb: 0, res: RES });
const fieldOf = (balls) => addBalls(EMPTY.T, EMPTY.shield, RES, balls).T;

/** Connected components of `pass` over the grid, 4-connected; sizes, largest
 *  first. Used for the liquid (one body?) and its complement (any holes?). */
function components(T, pass) {
  const seen = new Uint8Array(RES * RES);
  const stack = new Int32Array(RES * RES);
  const sizes = [];
  for (let start = 0; start < RES * RES; start++) {
    if (seen[start] || !pass(T[start])) continue;
    let sp = 0;
    stack[sp++] = start;
    seen[start] = 1;
    let n = 0;
    const walk = (j) => {
      if (seen[j] || !pass(T[j])) return;
      seen[j] = 1;
      stack[sp++] = j;
    };
    while (sp > 0) {
      const i = stack[--sp];
      n++;
      const x = i % RES;
      const y = (i / RES) | 0;
      if (x > 0) walk(i - 1);
      if (x < RES - 1) walk(i + 1);
      if (y > 0) walk(i - RES);
      if (y < RES - 1) walk(i + RES);
    }
    sizes.push(n);
  }
  return sizes.sort((a, b) => b - a);
}

/** Dark regions that do not touch the border — the enclosed voids. */
function holes(T) {
  const seen = new Uint8Array(RES * RES);
  const stack = new Int32Array(RES * RES);
  const found = [];
  for (let start = 0; start < RES * RES; start++) {
    if (seen[start] || T[start] >= 1) continue;
    let sp = 0;
    stack[sp++] = start;
    seen[start] = 1;
    let n = 0;
    let open = false;
    const push = (j) => {
      if (seen[j] || T[j] >= 1) return;
      seen[j] = 1;
      stack[sp++] = j;
    };
    while (sp > 0) {
      const i = stack[--sp];
      n++;
      const x = i % RES;
      const y = (i / RES) | 0;
      if (x === 0 || y === 0 || x === RES - 1 || y === RES - 1) open = true;
      if (x > 0) push(i - 1);
      if (x < RES - 1) push(i + 1);
      if (y > 0) push(i - RES);
      if (y < RES - 1) push(i + RES);
    }
    if (!open) found.push(n);
  }
  return found.sort((a, b) => b - a);
}

console.log("\nTHE CONFLUENCE — S3's resolved symbol\n");

const T = fieldOf(CONFLUENCE.map((b) => [b[0], b[1], b[2], 1]));

// ── A · one body ─────────────────────────────────────────────────────────────
const bodies = components(T, (v) => v >= 1);
check(
  bodies.length === 1,
  "one connected body",
  `${bodies.length} component(s): ${bodies.slice(0, 6).join(", ")}`,
);

// ── B · no loose beads ───────────────────────────────────────────────────────
// A droplet that failed to merge lights ~pi (r RES)^2 on its own. Anything at
// all beside the body is debris, and an arm's last link is where this material
// sheds one.
const debris = bodies.slice(1).filter((n) => n > 4);
check(debris.length === 0, "no loose beads", debris.length ? debris.join(", ") : "clean");

// ── C · solid ────────────────────────────────────────────────────────────────
// The confluence is one substance, not a ring: an enclosed void here would mean
// the arms had failed to fill the core they are supposed to be merging into.
const voids = holes(T);
check(voids.length === 0, "no enclosed voids", `${voids.length} void(s)`);

// ── D · the read ─────────────────────────────────────────────────────────────
// The outline as radius-from-centre against angle. Single-valued for this
// silhouette, and it is what a reader's eye integrates.
const OUTLINE = 1440;
const outline = new Float64Array(OUTLINE);
for (let s = 0; s < OUTLINE; s++) {
  const th = (Math.PI * 2 * s) / OUTLINE;
  const c = Math.cos(th);
  const sn = Math.sin(th);
  let r = 0;
  for (let d = 0.02; d < 0.55; d += 0.0008) {
    const xi = Math.round((0.5 + d * c) * RES);
    const yi = Math.round((0.5 + d * sn) * RES);
    if (xi < 0 || yi < 0 || xi >= RES || yi >= RES) break;
    if (T[yi * RES + xi] >= 1) r = d;
  }
  outline[s] = r;
}
const angAt = (th) => {
  const s = Math.round(
    (((th % (Math.PI * 2)) + Math.PI * 2) / (Math.PI * 2)) * OUTLINE,
  );
  return outline[s % OUTLINE];
};

// The arms SWEEP, so a tip is not at its system's bearing — read the tips off
// the station table rather than re-deriving them.
const tips = [0, 1, 2].map((si) => {
  const t = armTip(si);
  return { th: Math.atan2(t.y - 0.5, t.x - 0.5) };
});
tips.sort((p, q) => q.th - p.th); // clockwise: consecutive pairs bracket a notch
const reachOf = tips.map((t) => {
  let best = 0;
  for (let k = -40; k <= 40; k++) best = Math.max(best, angAt(t.th + k * 0.006));
  return best;
});
const notches = tips.map((t, k) => {
  const nx = tips[(k + 1) % tips.length];
  let d = t.th - nx.th;
  while (d <= 0) d += Math.PI * 2;
  let lo = Infinity;
  for (let s = 1; s < 40; s++) lo = Math.min(lo, angAt(t.th - (d * s) / 40));
  return lo;
});
console.log(
  `       arm reach ${reachOf.map((v) => v.toFixed(3)).join(" / ")}   notch ${notches
    .map((v) => v.toFixed(3))
    .join(" / ")}`,
);

// Two of the three notches must be DEEP, and none shallow enough to read as a
// lobed disc. Not all three, and that is the design rather than a concession:
// the bearings are deliberately uneven (gathering.mjs — "equal thirds would
// rebuild the compass this design exists to avoid"), so one pair of arms always
// sits closer than the other two.
const ratios = notches
  .map((n, k) => n / Math.max(reachOf[k], 1e-6))
  .sort((p, q) => p - q);
check(
  ratios[1] < 0.5 && ratios[2] < 0.75,
  "three arms, not a lobed disc",
  `notch/reach ${ratios.map((v) => v.toFixed(2)).join(" / ")}`,
);

// Operation carries four capabilities, so its arm reaches furthest — the same
// claim gathering.mjs makes with `spread: 0.12`. Measured from the CORE, not
// from the cloud origin: the station table is recentred on the silhouette's
// bounding box, so an arm's radius from 0.5 is a fact about where the other two
// point rather than about how far this one goes.
const armLen = [0, 1, 2].map((si) => {
  const t = armTip(si);
  return Math.hypot(t.x - CORE_CENTRE.x, t.y - CORE_CENTRE.y);
});
check(
  armLen[2] > armLen[0] && armLen[2] > armLen[1],
  "operation reaches furthest",
  armLen.map((v) => v.toFixed(3)).join(" / "),
);

// THE CHAIN MARGIN — beading, measured where it happens rather than inferred
// from the outline. Between two consecutive droplets on an arm the field must
// not merely clear the iso: at T just over 1 the surface still pinches visibly,
// which is exactly what the two rejected loop-shaped drafts looked like. A
// comfortable margin is what makes a chain read as one body of liquid.
let margin = Infinity;
let worstAt = "";
for (let si = 0; si < 3; si++) {
  const seq = ARM_SEQ[si];
  for (let j = 1; j < seq.length; j++) {
    const A = CONFLUENCE[seq[j - 1]];
    const B = CONFLUENCE[seq[j]];
    const xi = Math.round(((A[0] + B[0]) / 2) * RES);
    const yi = Math.round(((A[1] + B[1]) / 2) * RES);
    const v = T[yi * RES + xi];
    if (v < margin) {
      margin = v;
      worstAt = `arm ${si}, link ${j}`;
    }
  }
}
check(
  margin > 1.6,
  "the arms are liquid, not beaded",
  `worst T = ${margin.toFixed(2)} (${worstAt})`,
);

// every capability seats on an arm; every other droplet is core
check(
  CONFLUENCE.every((_, i) => (i < 30) === (armOf(i) >= 0)),
  "the ten capabilities seat on the arms, the connective liquid is the core",
);

// extent + centre: the crossing is composed around a body the size the mark was,
// standing on its own cloud origin (jOx/jOy, the melt and the static fallback
// all assume that).
let x0 = 1;
let x1 = 0;
let y0 = 1;
let y1 = 0;
for (let i = 0; i < RES * RES; i++) {
  if (T[i] < 1) continue;
  const x = (i % RES) / RES;
  const y = ((i / RES) | 0) / RES;
  if (x < x0) x0 = x;
  if (x > x1) x1 = x;
  if (y < y0) y0 = y;
  if (y > y1) y1 = y;
}
const reach = Math.max(x1 - x0, y1 - y0) / 2;
check(
  reach > 0.32 && reach < 0.44,
  "silhouette reaches the composed extent",
  `half-extent ${reach.toFixed(3)} cloud (${(reach * 0.5).toFixed(3)} uv at ORGANISM_SCALE)`,
);
check(
  Math.abs((x0 + x1) / 2 - 0.5) < 0.012 && Math.abs((y0 + y1) / 2 - 0.5) < 0.012,
  "the body is centred on its own cloud origin",
  `centre ${((x0 + x1) / 2).toFixed(3)}, ${((y0 + y1) / 2).toFixed(3)}`,
);

// ── E · the crossing melt (confluence -> pillar 1) ───────────────────────────
// The body leaves S3 by BECOMING the first service. The melt kernel is the
// site's own, so what has to hold is what holds for every other melt: exact at
// both ends, one connected mass across, and no mass hole where the droplets
// hand the picture to the form.
const WEB = CLOUDS[1];
const perm = matchClouds(CONFLUENCE, WEB);
const stag = CONFLUENCE.map((b) => b[0]);
const drop = new Float32Array(4);
// THE SPIN rides the melt's output, unwinding across SPIN_UNWIND (site.ts). The
// worst case is half a turn — the angle is wrapped into (-pi, pi] while the body
// is still turning — so that is what the crossing is measured under: if the
// budget holds at pi it holds at every angle a reader can arrive with.
const SPIN_UNWIND = 0.55;
const spinAt = (p) => Math.PI * (1 - flow(Math.min(p / SPIN_UNWIND, 1)));
const cloudAt = (p, dens, spun = true) => {
  const a = spun ? spinAt(p) : 0;
  const c = Math.cos(a);
  const sn = Math.sin(a);
  return CONFLUENCE.map((_, i) => {
    meltDroplet(drop, i, CONFLUENCE, WEB, perm, stag, p, 0, FORM_SOLIDITY[1]);
    const x = drop[0] - 0.5;
    const y = drop[1] - 0.5;
    return [0.5 + x * c - y * sn, 0.5 + x * sn + y * c, drop[2], dens];
  });
};

const exact0 = cloudAt(0, 1, false).every(
  (b, i) => Math.hypot(b[0] - CONFLUENCE[i][0], b[1] - CONFLUENCE[i][1]) < 1e-6,
);
const exact1 = cloudAt(1, 1, false).every(
  (b, i) => Math.hypot(b[0] - WEB[perm[i]][0], b[1] - WEB[perm[i]][1]) < 1e-6,
);
check(exact0, "melt is exact at the confluence");
check(exact1, "melt is exact at pillar 1");

// Islands are counted against the DESTINATION's own decomposition. CLOUDS[1]
// alone lights 82% of the web form (melt.mjs FORM_SOLIDITY) and is genuinely
// several pieces at rest — the form carries it there, not the cloud — so "does
// not shatter" can only mean "no worse than the endpoint it travels to".
const MIN_ISLAND = 40;
const islandsOf = (p) =>
  components(fieldOf(cloudAt(p, 1)), (v) => v >= 1).filter((n) => n > MIN_ISLAND)
    .length;
let worstParts = 0;
let worstP = 0;
for (let s = 1; s < 20; s++) {
  const p = s / 20;
  const parts = islandsOf(p);
  if (parts > worstParts) {
    worstParts = parts;
    worstP = p;
  }
}
check(
  worstParts <= Math.max(islandsOf(0), islandsOf(1)) + 1,
  "the crossing never shatters",
  `worst ${worstParts} masses at p = ${worstP.toFixed(2)} (endpoints ${islandsOf(0)} -> ${islandsOf(1)})`,
);

// THE SPIN has to be finished before the pillar's silhouette arrives: the
// rotation acts on the droplets and the form has none of its own, so any
// residual at the moment form B opens is two bodies in the same place
// disagreeing about which way up they are.
check(
  spinAt(1 - 0.38) < 1e-6,
  "the spin is unwound before pillar 1's silhouette opens",
  `${((spinAt(0.62) * 180) / Math.PI).toFixed(2)} deg left at p = 0.62`,
);

// ── THE MASS BUDGET ─────────────────────────────────────────────────────────
// The handoff itself, rendered exactly as the site runs it: droplet density on
// bridgePresence's second half, pillar 1's silhouette landing on formPhase from
// the same clock. Two failure modes and the sum has to avoid both — a DIP,
// where the droplets have drained before the form is solid and the stage thins,
// and a BUMP, where both carry the picture at once and the liquid visibly
// swells (melt-shape.mjs measured 171% for the bridge this replaces).
const forms = await loadForms();
const litAt = (p) => {
  const { wB, eB } = formPhase(p);
  const f = prepareForms({
    forms,
    a: 0,
    b: 1,
    fa: 0,
    fb: wB,
    ea: 0,
    eb: eB,
    res: RES,
  });
  const dens = p <= 0.5 ? 1 : bridgeDensity(bridgePresence(p));
  return addBalls(f.T, f.shield, RES, cloudAt(p, dens)).lit;
};
// Measured as a ratio against the melt's OWN endpoints, the way melt-mass.mjs
// frames every other melt: the confluence is a smaller body than the web form,
// so comparing the middle against the destination alone would report the
// travel itself as a defect.
const A0 = litAt(0);
const A1 = litAt(1);
let dip = 1;
let bump = 1;
let dipAt = 0;
let bumpAt = 0;
for (let s = 0; s <= 24; s++) {
  const p = s / 24;
  const rel = litAt(p) / (A0 + (A1 - A0) * p);
  if (rel < dip) {
    dip = rel;
    dipAt = p;
  }
  if (rel > bump) {
    bump = rel;
    bumpAt = p;
  }
}
check(
  dip > 0.85,
  "the crossing never thins out",
  `worst ${(dip * 100).toFixed(0)}% of its own endpoints at p = ${dipAt.toFixed(2)}`,
);
// 24% is the budget melt-mass.mjs already gates every pillar melt against.
check(
  bump < 1.24,
  "the crossing never doubles up",
  `worst ${(bump * 100).toFixed(0)}% of its own endpoints at p = ${bumpAt.toFixed(2)}`,
);

console.log(
  `\n${failures === 0 ? "PASS" : `${failures} FAILURE(S)`} — THE CONFLUENCE\n`,
);
process.exit(failures === 0 ? 0 : 1);
