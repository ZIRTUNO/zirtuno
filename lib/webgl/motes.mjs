/**
 * MOTES (R6) — the simulated population beyond the authored 48.
 *
 * ── what 48 was, and what it was not ─────────────────────────────────────────
 *
 * 48 is an AUTHORING contract, not a budget: generate-morph-endpoints.mjs packs
 * every form SVG to exactly FIELD_N balls so a morph between any two forms is a
 * pure position-and-radius lerp with nothing to pop, and phys.mjs derives N from
 * that data. It was never measured against a frame, and it was never what the
 * GPU struggled with — the renderer's own ceiling was a different number (80),
 * set by uniform-array size, and the tiled path retires that one.
 *
 * So the 48 stay exactly what they are: the authored morph population, the
 * indices scenes address, the droplets that carry every form endpoint. What
 * changes is that they are no longer the whole system.
 *
 * ── replicas, not a second kind of thing ─────────────────────────────────────
 *
 * The simulated population is N × REPLICAS. Droplet i belongs to host i % N and
 * rank (i / N | 0). Rank 0 IS the authored droplet — zero offset, the host's own
 * radius, the host's own everything — so at REPLICAS = 1 the system is what it
 * was, arithmetic included. Ranks above 0 are MOTES: the same material, given a
 * station offset from their host's, and simulated exactly like it.
 *
 * They are not decoration riding on top of the physics. They are in the physics
 * arrays: they goal-seek, they repel, they cohere with their host's cluster,
 * they feel the curl and the scroll and the hand and the strike, they can pinch
 * off satellites, and they have their own temperament. What makes a body of 384
 * droplets read as liquid rather than as 384 dots is precisely that they push on
 * each other, and there is no cheap version of that.
 *
 * Two decisions make this affordable and safe:
 *
 *   TARGETS ARE DERIVED, NOT AUTHORED. A scene emits target(i, …) for i < N and
 *   knows nothing about any of this. A mote's target is its host's blended
 *   target plus a deterministic offset in the host's own frame, scaled by the
 *   host's radius. So every composition, morph, handoff and cluster the scenes
 *   already author carries the whole population with it for free — a lattice
 *   stays a lattice, it just gets denser — and the change touches no scene file.
 *
 *   PRESENCE IS THE HOST'S FREEDOM. A mote's field density scales by
 *   (1 − hostBind), the same gate every environmental force already passes
 *   through. At bind = 1 — the §3.3 melts, the resting footprints, the exact
 *   mark — motes contribute identically zero field, so the silhouette is the one
 *   the byte-exact rest contract asserts. Where the liquid is free (Método,
 *   Work, Studio and every pour hold bind ≈ 0.08-0.4) they are fully present,
 *   which is most of the page.
 *
 * PURITY CONTRACT (the sdf-core convention): no DOM, no timers, deterministic
 * from the identity hash. Node-runnable.
 */

import { hash, clamp01, N } from "./phys.mjs";
import { temperOf } from "./temperament.mjs";

export const MOTE = {
  /**
   * Station offset from the host, as a multiple of the host's visible radius.
   *
   * Under ~1 a mote sits inside its host and adds nothing but a bump in the
   * field. Past ~3 it detaches into a visibly separate bead and the body reads
   * as speckled rather than as one material. 1.05-2.35 keeps every mote inside
   * the necking band — two droplets merge while their gap is under ~0.83 ×
   * radius — so the crowd reads as surface on one body. Repulsion then spreads
   * them off their nominal stations, which is what stops the offsets reading as
   * a pattern.
   */
  ORBIT_MIN: 1.05,
  ORBIT_VAR: 0.7,
  /**
   * Rank barely moves the station — the shells are made by REPULSION, not by
   * arithmetic.
   *
   * Scheduling each rank further out (this was 0.5, so rank 7 sat up to 5.8
   * host radii away) put the outer ranks outside the necking band entirely.
   * Two droplets only merge while their gap is under ~0.83 × radius, which for
   * a mote at 0.28 × its host puts the limit at about 1.5 host radii — past it
   * a mote is not surface, it is a detached speck. In the scatter that read as
   * spray and looked right; on Método's circuit, where the hosts form a clean
   * thin ring, the same motes read as DUST scattered through the composition.
   *
   * So every rank now starts in the same tight band and the pair force sorts
   * them out: motes that overlap push each other apart until they find room,
   * which produces a shell that is a consequence of the material rather than a
   * schedule imposed on it — and one that adapts to how crowded the host's
   * neighbourhood actually is.
   */
  ORBIT_RANK: 0.06,
  /**
   * Mote radius as a share of its host's. Motes are surface, not mass.
   *
   * The first pass ran 0.30-0.56 at density 0.58 and orbit 1.05-2.35, and the
   * result was measured rather than argued: at the S3 scatter it took liquid
   * COVERAGE from 5.3% of the viewport to 10.7% and the largest connected body
   * from 1.2% to 4.7%. Motes were not adding surface to the authored droplets,
   * they were FUSING them — and the scatter's whole argument is fragmented
   * topology (see the dispersed generator in phys.mjs), so a 4x largest-blob is
   * that argument being overwritten by texture.
   *
   * Smaller, further out and thinner: a mote reads as spray thrown off its host
   * rather than as a lobe of it. Same population, roughly a third of the area.
   */
  R_MIN: 0.18,
  R_VAR: 0.2,
  /** How fast a mote's station drifts around its host (rad/s), before
   *  temperament. Slow: this is the composition breathing, not spinning. */
  STATION_RATE: 0.13,
  /** Depth spread around the host's plane — motes give the body thickness. */
  Z_SPREAD: 0.13,
  /**
   * Field density, so a mote adds surface without adding bulk.
   *
   * The combination law (SDF_FIELD_SAT) already bounds what a crowd can add,
   * but that ceiling exists to stop 48 droplets inflating a silhouette — it is
   * not a licence to pile another 300 sources into the same body at full
   * weight. At 0.4 a mote necks with its host and sculpts its outline without
   * moving the iso-surface far enough to round off the form it belongs to.
   */
  DENSITY: 0.4,
  /** Presence follows (1 − bind) through this power. >1 = motes clear out
   *  EARLY as a droplet binds, so a melt is clean well before bind reaches 1. */
  BIND_FADE: 1.5,
  /** Inertia relative to the host. Motes are smaller, so they answer faster —
   *  which is also what stops a host and its motes moving as one rigid clump. */
  TAU_MIN: 0.62,
  TAU_VAR: 0.5,
};

/**
 * A mote's inertia relative to its host's, from the same draw the identity table
 * uses. Exported so fluid-core can build its own TAU table without importing the
 * whole identity table or — worse — retyping the hash and letting the two drift.
 */
export const moteTauScale = (i) => MOTE.TAU_MIN + MOTE.TAU_VAR * hash(i, 57);

/**
 * Per-mote identity, as flat typed arrays over the FULL simulated population.
 * Index by droplet index directly — entries below n are the authored droplets
 * and carry the identity values (offset 0, radius 1) that make every expression
 * in moteTarget collapse to the host's own, so rank 0 needs no branch.
 *
 * @param {number} pop   the simulated population (n × replicas)
 * @param {number} [n]   the authored population (N = 48)
 * @param {number} [gain] temperament master; 0 = neutral character
 */
export function makeMoteTable(pop, n = N, gain = 1) {
  const host = new Int16Array(pop);
  const orbit = new Float32Array(pop);
  const phase = new Float32Array(pop);
  const rate = new Float32Array(pop);
  const rScale = new Float32Array(pop);
  const zOff = new Float32Array(pop);
  const tauScale = new Float32Array(pop);

  for (let i = 0; i < pop; i++) {
    const h = i % n;
    const rank = (i / n) | 0;
    host[i] = h;
    if (rank === 0) {
      // the authored droplet, unchanged in every respect
      orbit[i] = 0;
      phase[i] = 0;
      rate[i] = 0;
      rScale[i] = 1;
      zOff[i] = 0;
      tauScale[i] = 1;
      continue;
    }
    const t = temperOf(i, gain);
    orbit[i] =
      MOTE.ORBIT_MIN + MOTE.ORBIT_RANK * (rank - 1) + MOTE.ORBIT_VAR * hash(i, 51);
    phase[i] = hash(i, 52) * Math.PI * 2;
    // Signed rate: a host's motes shear past each other instead of rotating as
    // a rigid ring around it.
    rate[i] =
      MOTE.STATION_RATE *
      (0.4 + 1.2 * hash(i, 53)) *
      (hash(i, 55) < 0.5 ? -1 : 1) *
      t.restless;
    rScale[i] = MOTE.R_MIN + MOTE.R_VAR * hash(i, 54);
    zOff[i] = (hash(i, 56) - 0.5) * 2 * MOTE.Z_SPREAD;
    tauScale[i] = moteTauScale(i);
  }
  return { host, orbit, phase, rate, rScale, zOff, tauScale, pop, n };
}

/**
 * Derive one mote's target from its host's already-blended target.
 *
 * Call only for i >= n; ranks below that are the authored droplets and are
 * written by the scenes themselves. Everything is expressed in units of the
 * HOST's radius, so a mote stays in proportion as its host swells through a
 * composition or drains through a melt — including all the way to zero, which
 * is what makes a mote disappear with its host rather than outliving it.
 *
 * Writes into the conductor's own per-droplet arrays; allocates nothing.
 */
export function moteTarget(tab, i, t, TGT, TR, BIND, CLUS, Z, D) {
  const h = tab.host[i];
  const hx = h * 2;
  const hr = TR[h];
  const hBind = clamp01(BIND[h]);
  const free = 1 - hBind;

  const a = tab.phase[i] + t * tab.rate[i];
  const off = hr * tab.orbit[i];
  const ix = i * 2;
  TGT[ix] = TGT[hx] + Math.cos(a) * off;
  TGT[ix + 1] = TGT[hx + 1] + Math.sin(a) * off;
  TR[i] = hr * tab.rScale[i];
  // A mote binds exactly as hard as its host does. At bind 1 it tracks its
  // offset station analytically and contributes no field at all, so the two
  // statements a melt needs — "nothing here is loose" and "nothing here is
  // visible" — are made by the same number rather than by two that could drift.
  BIND[i] = hBind;
  CLUS[i] = CLUS[h];
  Z[i] = clamp01(Z[h] + tab.zOff[i]);
  // THE EXACTNESS GATE.
  D[i] = D[h] * MOTE.DENSITY * Math.pow(free, MOTE.BIND_FADE);
}
