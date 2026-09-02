/**
 * TEMPERAMENT (R6) — per-droplet character for the controlled-entropy layer.
 *
 * ── why this exists ──────────────────────────────────────────────────────────
 *
 * The liquid already had genuine dynamics: velocity state, a damped goal-seek
 * spring, repulsion, cohesion, curl drift, cursor forces, strikes and pinch-off
 * (fluid-core.mjs). What it did NOT have is individuality. At bind 0 every
 * droplet sampled the SAME three global gyres (GYRES) at the same CURL_V, and
 * the only thing separating one droplet from its neighbour was TAUP — how fast
 * it answers. They differed in RESPONSE, never in INTENT.
 *
 * That is why a free body still read as one mass being carried rather than as a
 * population travelling together. A shared flow field moves everything the same
 * way; a shared flow field plus per-droplet lag moves everything the same way,
 * smeared.
 *
 * ── why this cannot break the choreography ───────────────────────────────────
 *
 * Because the contract for it already existed and is already load-bearing.
 * Every environmental force in fluid-core scales by (1 − bind), and at bind = 1
 * the output is a byte-exact replica of the signed-off low-pass. Temperament is
 * not a new axis of risk: every field below MULTIPLIES a force that is already
 * gated that way. The §3.3 melts, resting footprints and the exact mark are
 * bind = 1 and feel none of it, by the same contract that already protects them
 * from curl and scroll.
 *
 * The macro layer is untouched: scenes still emit targets, clusters and bind;
 * the conductor still blends them across handoffs; the arbiter still owns the
 * form slots. What changes is only what a droplet does on the way there.
 *
 * ── the distribution: SKEWED (owner decision, R6) ───────────────────────────
 *
 * hash(i, k) is uniform on [0,1); what it is mapped through decides what the
 * body looks like, and that mapping is the whole "controlled entropy" dial.
 * Three were on the table:
 *
 *   UNIFORM   0.6 + 0.8·u          every droplet mildly different from every
 *                                  other. Homogeneous grain — texture, not
 *                                  events. Safe, and quiet enough to be missed.
 *   SKEWED    0.5 + 1.6·u²         most droplets placid, a few markedly
 *                                  livelier. ← CHOSEN
 *   BIMODAL   two populations      a settled majority plus a restless minority.
 *                                  Most legible, easiest to overdo into noise.
 *
 * Skewed is the one that matches how liquid actually behaves: a still body that
 * occasionally throws up a stray bead, rather than a body that is uniformly
 * fizzing. u² puts the MEDIAN droplet below the old flat 1.0 — the body as a
 * whole gets CALMER than it was — and spends the whole liveliness range on a
 * short tail. The mean is preserved (∫0.5+1.6u² = 1.033), so the total energy in
 * the field is what it was; it is redistributed, not added.
 *
 * The constraint behind the choice: §3.3 puts droplets on type that has to be
 * read. `restless` and `spin` compound, so a droplet drawn high on both is the
 * one that visibly escapes the body — which is the intent, at the rate a square
 * law gives it (≈8% of droplets above 1.5×) rather than at a uniform one (≈50%).
 */

import { hash } from "./phys.mjs";

/**
 * The skew exponent. 1 = uniform (the rollback), 2 = the shipped square law,
 * higher = a calmer body with a longer, rarer tail. Exposed because this is the
 * dial an owner round will reach for, and retyping the mappings is how a retune
 * silently changes three things instead of one.
 */
export const TEMPER_SKEW = 2;

/** Amplitude master. 0 is an EXACT bypass: every field returns its neutral
 *  value, so `?ftemper=0` restores pre-R6 motion without a second code path. */
export const TEMPER_GAIN = 1;

const skew = (u) => Math.pow(u, TEMPER_SKEW);

/**
 * One droplet's character, derived from its stable identity — the same
 * hash(i, k) every other per-droplet table in phys.mjs uses, so a droplet is
 * the same droplet across mounts, sessions and machines. Deterministic entropy
 * is the only kind this codebase allows.
 *
 * Every field is a MULTIPLIER on an existing force. None of them adds a new
 * force, which is what keeps the material one material.
 *
 * @param {number} i     droplet index (its stable identity)
 * @param {number} [gain] 0 = neutral bypass … 1 = the shipped character
 */
export function temperOf(i, gain = TEMPER_GAIN) {
  const g = gain > 0 ? (gain > 1 ? 1 : gain) : 0;
  const u = skew(hash(i, 71)); // liveliness
  const s = hash(i, 72); // orbital sign + magnitude
  const w = hash(i, 73); // drift rate
  const p = hash(i, 74); // drift phase
  const c = skew(hash(i, 75)); // sociability

  // restless — multiplies this droplet's share of FLUID.CURL_V. Median ≈ 0.9,
  // mean ≈ 1.03, top decile ≈ 1.8: a calmer body with a livelier few.
  const restless = 1 + g * (0.5 + 1.6 * u - 1);
  // spin — a signed orbital tendency about the droplet's OWN target. Squared
  // magnitude for the same reason: most droplets barely orbit, a few really do.
  const spin = g * (2 * s - 1) * Math.abs(2 * s - 1);
  // sociable — multiplies its repulsion/cohesion response. Below 1 the droplet
  // ignores its neighbours and drifts through them; above 1 it clings.
  const sociable = 1 + g * (0.62 + 0.9 * c - 1);

  // roam — this droplet's share of THE LEASH (FLUID.LEASH_R), and the single
  // most visible field here. It is the difference between a droplet that holds
  // its station and one that circulates, because the leash is what decides
  // whether any of the forces below can move a droplet at all: sprung to a
  // point at ω² = 77…343, the whole ambient current is worth 0.4-4 px on a
  // 20 px droplet. Skewed like the rest, so most of the body keeps its shape
  // tightly and a minority genuinely travels.
  const roam = 1 + g * (0.45 + 1.5 * skew(hash(i, 76)) - 1);

  return {
    roam,
    restless,
    spin,
    // The droplet's own slow clock, independent of the shared gyres. Kept low
    // deliberately: this term decides whether quiet sections read as breathing
    // or as vibrating, and the site has no use for the second one. The AMB
    // family's rates are the precedent — minutes-slow is indistinguishable from
    // stillness over the seconds a visitor spends in one chapter.
    wanderF: 0.07 + 0.13 * w,
    wanderP: p * Math.PI * 2,
    sociable,
  };
}

/**
 * The population as flat typed arrays — the shape fluid-core's hot loop wants.
 * Built once per (n, gain); an object-per-droplet table would put a property
 * load inside the substep loop for no reason.
 */
export function temperTable(n, gain = TEMPER_GAIN) {
  const roam = new Float32Array(n);
  const restless = new Float32Array(n);
  const spin = new Float32Array(n);
  const wanderF = new Float32Array(n);
  const wanderP = new Float32Array(n);
  const sociable = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = temperOf(i, gain);
    roam[i] = t.roam;
    restless[i] = t.restless;
    spin[i] = t.spin;
    wanderF[i] = t.wanderF;
    wanderP[i] = t.wanderP;
    sociable[i] = t.sociable;
  }
  return { roam, restless, spin, wanderF, wanderP, sociable, n, gain };
}
