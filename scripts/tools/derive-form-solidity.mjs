/**
 * DERIVE FORM_SOLIDITY — the per-form radius growth a cloud needs to cover the
 * form it stands in for, measured rather than assumed.
 *
 * melt.mjs rests on "CLOUDS[n] IS form n's metaball decomposition", and it is
 * not quite true: rendering each cloud alone against its own form, the seven
 * pillar decompositions come up short and the mark does not. FORM_SOLIDITY is
 * that shortfall, expressed as the fractional radius growth that closes it, and
 * it rides bridge presence so it is identically 0 at both endpoints where the
 * cloud hands back at its canonical size.
 *
 * IT IS A FUNCTION OF THE COMBINATION LAW. The original table was derived when
 * the field was a plain sum, where a large part of a cloud's coverage came from
 * superaddition BETWEEN droplets rather than from the droplets themselves. Raise
 * the exponent and that fill goes away, so the same clouds cover far less and
 * the table has to grow with it — mid-melt area otherwise collapses (measured
 * at −67% on the first pass to n = 2, which is the mass hole tools/melt-mass.mjs
 * exists to prevent).
 *
 * Run after ANY change to MELT_SAT, the clouds, or the forms:
 *   node scripts/tools/derive-form-solidity.mjs [--n 2] [--res 384]
 * Prints the table to paste into melt.mjs, and the residual it achieves.
 */
import { loadForms, prepareForms, addBalls } from "../support/melt-sim.mjs";
import { CLOUDS } from "../../lib/webgl/phys.mjs";
import { MELT_SAT } from "../../lib/webgl/sdf-glass-shader.mjs";

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const RES = +arg("--res", 384);
const NF = +arg("--n", MELT_SAT);
const KEYS = ["mark", "web", "software", "ai", "automation", "data", "branding", "marketing"];

const forms = await loadForms();

const litOf = (T) => {
  let n = 0;
  for (let i = 0; i < T.length; i++) if (T[i] >= 1) n++;
  return n;
};

/** area of form `a` rendered alone, at full weight and zero erosion */
function formArea(a) {
  const f = prepareForms({ forms, a, b: a, fa: 1, fb: 0, res: RES, n: NF });
  return litOf(f.T);
}

/** area of cloud `a` alone with every radius scaled by k */
const empty = prepareForms({ forms, res: RES, n: NF });
function cloudArea(a, k) {
  const balls = CLOUDS[a].map((b) => [b[0], b[1], b[2] * k, 1]);
  return addBalls(empty.T, empty.shield, RES, balls, NF).lit;
}

console.log(`FORM_SOLIDITY at saturation ceiling C = ${NF}  (res ${RES})\n`);
console.log("  form          form px   cloud@1×   ratio    solidity   residual");
const out = [];
for (let a = 0; a < 8; a++) {
  const target = formArea(a);
  const base = cloudArea(a, 1);
  // bisect k so the cloud covers its own form's area
  let lo = 0.5;
  let hi = 3;
  for (let it = 0; it < 22; it++) {
    const m = (lo + hi) / 2;
    if (cloudArea(a, m) < target) lo = m;
    else hi = m;
  }
  const k = (lo + hi) / 2;
  const got = cloudArea(a, k);
  out.push(k - 1);
  console.log(
    `  ${KEYS[a].padEnd(12)} ${String(target).padStart(7)}   ${String(base).padStart(7)}` +
      `   ${((base / target) * 100).toFixed(0).padStart(4)}%    ${(k - 1).toFixed(3)}` +
      `      ${(((got - target) / target) * 100).toFixed(1).padStart(5)}%`,
  );
}
console.log(
  `\nexport const FORM_SOLIDITY = [${out.map((v) => v.toFixed(3)).join(", ")}];`,
);
