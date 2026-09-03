/**
 * THE MIST (R7) — the finest scale of the one liquid.
 *
 * ── what it is ───────────────────────────────────────────────────────────────
 *
 * The liquid already exists at three scales: the exact FORMS (SDF textures),
 * the 48 authored DROPLETS, and the MOTES that give each droplet a surface
 * (R6). The Origin needed a fourth, and needed it for the argument rather than
 * for the picture: the chapter's claim is "form for what was dispersed", and
 * dispersal at the scale of a droplet is a scatter — twelve visible pieces
 * with black between them — while dispersal at the scale of VAPOUR is a field
 * with nothing solid in it at all. So S7 opens with the liquid boiling off
 * into tens of thousands of micro-droplets that fill the stage, and the whole
 * chapter is that field being drawn back in: onto two poles (the ideas), then
 * onto one point (the meeting), then onto the exact mark, then breathed out
 * again under the thesis, and finally onto the letters of the name.
 *
 * It is the same material. Every force a droplet feels — the curl-noise
 * current (lib/webgl/noise.mjs, same octave ladder), the hand's displacement
 * well and its wake, the travelling strike, the scroll lean, the type-aware
 * obstacle flow — is ported to the GPU from the same FLUID table, so a
 * gesture that moves the droplets moves the vapour, at a lighter mass.
 * Vapour that reaches a droplet is taken up as that droplet's SKIN and rides
 * its outline from then on, which is the one coupling the picture needs: the
 * field visibly EMPTIES INTO the bodies rather than merely thinning near
 * them. Population is conserved through the whole chapter, so the eye keeps
 * reading the same stuff changing state — vapour to skin to vapour to type —
 * rather than particles being spawned and killed.
 *
 * ── where it runs ────────────────────────────────────────────────────────────
 *
 * On the GPU, in the ONE homepage canvas, as two extra passes FieldStage runs
 * around its liquid pass (lib/webgl/mist-gl.ts): a ping-pong update over a
 * SIZE×SIZE float texture (one texel per particle, MRT: position+velocity,
 * life+state+host+phase) and an instanced draw of velocity-aligned capsules —
 * the arrows of the owner's drawing, drawn by the motion itself. It is NOT a
 * second canvas and NOT a second clock: the conductor hands it its dials
 * (the origin scene's `mist()` block), its hosts (the displayed positions of
 * the authored 48) and the same hand/strike/scroll environment the droplets
 * read, every frame, and the stage draws it into the same target the post
 * chain composites — so dense vapour blooms exactly as dense liquid does.
 *
 * ── this module ──────────────────────────────────────────────────────────────
 *
 * The tuning table, the population sizing, and a CPU REFERENCE of the update
 * rule for the node harness (scripts/verify/mist.mjs): the GPU kernel cannot
 * run in node, so the rules it implements — emission, capture, release,
 * spelling, the band wall, conservation — are asserted here against the same
 * constants. The GLSL in mist-shaders.mjs is generated from this table, so a
 * retune moves both.
 *
 * PURITY CONTRACT (the sdf-core convention): no DOM, no GL, no timers,
 * deterministic (hash-seeded). Node-runnable.
 */

import { N, hash, clamp01 } from "./phys.mjs";
import { FLUID } from "./fluid-core.mjs";
import { curl, fbm1 } from "./noise.mjs";

export const MIST = {
  /**
   * Texture edge per probe tier — the population is its square. 192² is
   * 36 864 particles: dense enough that the converged field reads as a
   * luminous body and sparse enough that the dispersed field reads as specks
   * with black between them rather than as fog. The lite figure is a
   * dusting; the renderer's rung ladder (RUNG_MIST in FieldStage) shares it
   * down further before the glass goes.
   */
  SIZE_FULL: 192,
  SIZE_LITE: 96,
  /** Fixed substep, matching fluid-core so the two families integrate the
   *  same forces at the same rate. Bounded per frame — a tab stall must not
   *  spend a hundred GPU passes catching up — but the bound is generous: each
   *  substep is one small pass over a 192² texture, and 12 of them keep the
   *  vapour on wall-clock time down to ~10 fps. Below that the field runs
   *  slow rather than freezing, which is the right failure (rule #14). */
  H_MS: 8,
  MAX_STEPS: 12,
  /** Substeps run at a reset (a chapter entry, a deep link) so the field
   *  lands settled rather than visibly assembling itself. */
  WARMUP: 90,
  // ── the vapour's own dynamics ───────────────────────────────────────────────
  // R7-B — THE PACE. Every figure below was set so the field would visibly
  // MOVE, and together they made vapour that crossed the stage in a couple of
  // seconds: terminal speed under the centre pull was PULL_A/DRAG = 0.46 uv/s,
  // which is half the stage every second, and at that speed the streak length
  // (velocity × STREAK_T) was pinned to its cap, so every particle was drawn
  // as a full-length dash. A field of dashes moving that fast reads as
  // turbulence. The pull is gentler, the drag a little heavier, and terminal
  // speed is now 0.27 uv/s — the drawing's steady inflow, about four seconds
  // from the bleed to the centre.
  DRAG: 1.5, // 1/s — light, so the current can carry it
  V_MAX: 0.55, // uv/s
  CURL_V: 0.13, // curl force gain (the droplets run CURL_V 0.26 × 2.2, heavier)
  DRIFT: 0.035, // a particle's own aperiodic drift (uv/s²)
  // ── the attractors ─────────────────────────────────────────────────────────
  // A CONSTANT-magnitude inward pull with a soft core, not an inverse square.
  // The owner's drawing has arrows of one length everywhere in the field, and
  // that is what a convergence looks like — a steady inflow that thins the
  // edges and thickens the centre. An inverse-square law is a singularity, and
  // a singularity is the black-hole look this chapter must not have.
  PULL_A: 0.4, // centre pull (uv/s²) at pull = 1
  PULL_CORE: 0.07, // the pull rolls off inside this radius (uv)
  PULL_FAR: 1.1, // …and beyond this one (uv) — the field's own extent
  POLE_A: 0.34, // each idea's pull at poles = 1
  POLE_CORE: 0.05,
  POLE_FAR: 0.62,
  // ── condensation ───────────────────────────────────────────────────────────
  HOST_REACH: 3.2, // × host radius — the band inside which a body draws vapour
  HOST_A: 0.8, // that pull (uv/s²)
  CAPTURE_R: 1.14, // × host radius — vapour this close is taken up as skin
  SKIN_R: 1.07, // × host radius — where the skin rides
  SKIN_VAR: 0.07, // …with this much spread: a rind, not a ring, not a fur
  SKIN_OMEGA: 0.34, // rad/s — the skin turns slowly about its host
  SKIN_BREATH: 0.03, // radial breathing share
  // ── the return (R7-B) ──────────────────────────────────────────────────────
  // A particle is emitted once and never dies, so a pull with nothing to stop
  // it ends exactly one way: the whole field arrives, and the stage the vapour
  // came from is bare for the rest of the beat while a hot speck sits at the
  // centre. The owner's drawing is not a collapse — it is a STEADY inflow,
  // dots across the whole field with arrows through them, held for as long as
  // you look at it. So the field is a CYCLE: vapour that reaches the centre is
  // returned to the edge and comes in again, which is also the honest reading
  // of the material (it condenses at the centre and evaporates at the rim).
  //
  // Off unless a scene dials it (`recirc`), so the kernel's convergence rule —
  // pull the field in, mean radius falls, nothing through the centre — is
  // still exactly what the pull alone does.
  RECIRC_R: 0.05, // uv — a free particle this close has ARRIVED
  RECIRC_OUT: 0.58, // uv — and re-enters the field at about this radius
  RECIRC_VAR: 0.3, // …± this share of it, so the return is a band, not a ring
  RECIRC_V: 0.11, // uv/s — the inward drift it re-enters on
  RECIRC_LIFE: 0.02, // …and it fades back in rather than appearing
  // ── release and emission ───────────────────────────────────────────────────
  RELEASE_V: 0.14, // uv/s — breathed out, not fired
  // The boil-off speed. Against DRAG a particle travels v/drag before the
  // current takes over — at 0.34 against the heavier drag that is ~0.23 uv,
  // enough to carry a speck clear of the droplet it left without throwing it.
  // The spread across the whole stage is the CURL's job over the seconds that
  // follow, not the puff's over the first frame: thrown, the emission read as
  // a burst, and a burst is the one thing an appearance must not be.
  EVAP_V: 0.34,
  LIFE_RATE: 2.4, // 1/s — a spawned particle's alpha ramps in over ~0.4 s
  // ── the name ───────────────────────────────────────────────────────────────
  // A critically damped spring to a letter target, stiff enough to arrive
  // inside a beat and damped enough never to ring — with the curl still on at
  // a third of its gain, so the letters are found by a flow and not by a lerp.
  SPELL_OMEGA: 6.5,
  SPELL_ZETA: 1.0,
  // ── the stage's edges ──────────────────────────────────────────────────────
  FLOOR_A: 2.2, // the type band's wall (uv/s² at one margin of penetration)
  FLOOR_MARGIN: 0.13,
  // The wall also DAMPS the downward velocity of what crosses it (1/s): a
  // push alone lets vapour diving at V_MAX overshoot a whole margin and
  // bounce, and a bouncing edge on a band of type is exactly the seam this
  // wall exists to hide.
  FLOOR_DAMP: 7,
  // R7-B: the wall was a HARD STEP on the vertical edges — a constant push
  // the moment a particle crossed one line, with no gradient and no damping —
  // so the field piled into a thin bright band along the top of the stage and
  // sat there, which read as a smear glued under the topbar. The edges now
  // work the way the floor already does, and for the same reason the floor
  // gives in prose: a push alone lets vapour arrive, stop dead and stack.
  // Wider, too, so the deceleration is spread over a band instead of a line.
  EDGE_MARGIN: 0.09, // vapour is kept inside the bleed by a soft wall
  EDGE_A: 1.6,
  EDGE_DAMP: 5, // 1/s, on the component heading OUT of the stage
  // ── shares of the droplets' interaction ────────────────────────────────────
  // Vapour is light: it answers the hand and the strike hardest, and it leans
  // with the scroll less than a body does because it has less to lean with.
  HAND: 1.35,
  SHOCK: 0.9,
  // A fifth of the droplets' lean. Vapour has no spring pulling it home, so
  // at the droplets' share a fast scroll slid the whole field off the bottom
  // of the stage in under two seconds; at this share it visibly leans and
  // recovers on the current.
  SCROLL_LEAN: 0.18,
  // ── the picture ────────────────────────────────────────────────────────────
  // Additive light accumulates, and 37k sprites at a converging point
  // accumulate to white; the alphas are set so a lone speck is faint and only
  // real density reaches the bloom threshold — light from density, never a
  // hot core.
  SIZE_PX: 1.15, // sprite half-size at buffer scale 1 (device px)
  SIZE_VAR: 0.85,
  STREAK_T: 0.045, // s — a particle's streak is its velocity × this
  STREAK_MAX: 0.022, // uv
  // R7-B: with ?fmist=0 the mark blew out 1.0% of the frame; with the vapour
  // on, 4.7%. The SKIN — vapour condensed onto the mark's own outline, where
  // it is densest and most overlapped — was three quarters of the mark's
  // blow-out on its own. Halved, the mark is edged in light instead of
  // haloed, and the free field is a dusting rather than a wash.
  ALPHA: 0.085,
  ALPHA_SKIN: 0.16,
  DEPTH_DIM: 0.5, // far vapour dims by this much (the R5-C depth grade, at its scale)
  SPEED_GLOW: 0.5, // uv/s at which a streak reaches its brightest
  GLOW_MIX: 0.16, // how far a fast streak leans toward the glow tint
};

/** Texture edge for a probe tier; the population is its square. */
export function mistSize(tier) {
  return tier === "lite" ? MIST.SIZE_LITE : MIST.SIZE_FULL;
}

/** Field-uv radius of a sprite: device px at buffer scale → uv. */
export function mistSizeUv(sizePx, bufferScale, minDim) {
  return (sizePx * bufferScale) / Math.max(minDim, 1);
}

// ── the profiles the GPU ports (shared here so the reference is the spec) ──

/** The centre/pole pull magnitude at distance r — soft core, bounded reach. */
export function pullProfile(r, core, far) {
  const inner = clamp01(r / core);
  const soft = inner * inner * (3 - 2 * inner);
  const outer = 1 - clamp01((r - far * 0.7) / (far * 0.3));
  return soft * outer;
}

/**
 * The CPU REFERENCE of the update rule, for the node harness.
 *
 * `n` particles, `hosts` = Float32Array(N × 4) of (x, y, skin radius,
 * presence), `dials` = the origin scene's mist block, `probe` = a fluid core's
 * probe() (the hand and the strike, so the reference reads the droplets' own
 * interaction law rather than a copy of it). Writes into typed arrays; never
 * allocates in step().
 */
export function makeMistReference(n, opts = {}) {
  const P = new Float32Array(n * 2);
  const V = new Float32Array(n * 2);
  const LIFE = new Float32Array(n); // 0 = dormant (never emitted)
  const STATE = new Uint8Array(n); // 0 free · 1 captured
  const HOST = new Int16Array(n);
  const THETA = new Float32Array(n);
  const A2 = new Float32Array(2);
  const CURL = new Float32Array(2);
  const probe = opts.probe ?? null;
  const HS = MIST.H_MS / 1000;

  const seedAt = (hosts) => {
    for (let i = 0; i < n; i++) {
      const h = i % N;
      const o = h * 4;
      const a = hash(i, 301) * Math.PI * 2;
      const rr = hosts[o + 2] * hash(i, 302);
      P[i * 2] = hosts[o] + Math.cos(a) * rr;
      P[i * 2 + 1] = hosts[o + 1] + Math.sin(a) * rr;
      V[i * 2] = 0;
      V[i * 2 + 1] = 0;
      LIFE[i] = 0;
      STATE[i] = 0;
      HOST[i] = h;
      THETA[i] = a;
    }
  };

  /**
   * One fixed substep. `d` = the dial block ({ evap, pull, poles, condense,
   * release, spell, curl, floorOn, floor, cx, cy, ax, ay, bx, by, wx, wy, ww,
   * wh, spellOn }), `spellT` = Float32Array(n × 2) of targets in box space.
   */
  const substep = (tS, hosts, d, env, spellT, aspect) => {
    const halfW = Math.max(aspect, 0.6) / 2;
    for (let i = 0; i < n; i++) {
      const ix = i * 2;
      const h1 = hash(i, 311);
      const h2 = hash(i, 312);
      const h3 = hash(i, 313);
      const home = i % N;
      // ── dormant: emitted only while the liquid is boiling off ───────────
      if (LIFE[i] <= 0 && STATE[i] === 0) {
        if (d.evap > h1) {
          const o = home * 4;
          const a = hash(i, 314) * Math.PI * 2;
          const r = hosts[o + 2] * (0.6 + 0.8 * h2);
          P[ix] = hosts[o] + Math.cos(a) * r;
          P[ix + 1] = hosts[o + 1] + Math.sin(a) * r;
          const sp = MIST.EVAP_V * (0.5 + h3);
          V[ix] = Math.cos(a) * sp;
          V[ix + 1] = Math.sin(a) * sp;
          LIFE[i] = 0.02;
          THETA[i] = a;
        } else continue;
      }
      LIFE[i] = Math.min(1, LIFE[i] + MIST.LIFE_RATE * HS);
      // ── the skin ──────────────────────────────────────────────────────────
      if (STATE[i] === 1) {
        const o = HOST[i] * 4;
        const hx = hosts[o];
        const hy = hosts[o + 1];
        const hr = hosts[o + 2];
        const pres = hosts[o + 3];
        const rel =
          d.release > h2 || (d.spellOn > 0.5 && d.spell > h3) || pres < 0.05;
        if (rel) {
          STATE[i] = 0;
          const c = Math.cos(THETA[i]);
          const s = Math.sin(THETA[i]);
          const sp = MIST.RELEASE_V * (0.6 + 0.8 * h1);
          P[ix] = hx + c * hr * MIST.SKIN_R;
          P[ix + 1] = hy + s * hr * MIST.SKIN_R;
          V[ix] = c * sp;
          V[ix + 1] = s * sp;
        } else {
          THETA[i] += MIST.SKIN_OMEGA * (0.5 + h1) * (h2 < 0.5 ? -1 : 1) * HS;
          const rr =
            hr *
            (MIST.SKIN_R +
              MIST.SKIN_VAR * h3 +
              MIST.SKIN_BREATH * Math.sin(tS * 1.7 + h1 * 6.28));
          P[ix] = hx + Math.cos(THETA[i]) * rr;
          P[ix + 1] = hy + Math.sin(THETA[i]) * rr;
          V[ix] = 0;
          V[ix + 1] = 0;
          continue;
        }
      }
      // ── free vapour ───────────────────────────────────────────────────────
      // THE RETURN. Arrival is a position test, not a force: a particle that
      // has reached the centre is put back at the rim and comes in again. The
      // angle carries the clock as well as the particle's own hash, so a
      // particle does not keep returning to the same place and the rim never
      // shows spokes. `recirc` is a share of the field, like evap and
      // condense — what stays behind is the small steady population that
      // gives the centre its glow.
      if (d.recirc > 0 && d.pull > 0.05) {
        const cdx = P[ix] - d.cx;
        const cdy = P[ix + 1] - d.cy;
        if (cdx * cdx + cdy * cdy < MIST.RECIRC_R * MIST.RECIRC_R && d.recirc > h2) {
          const a = (hash(i, 315) + tS * 0.11) * Math.PI * 2;
          const rr = MIST.RECIRC_OUT * (1 + MIST.RECIRC_VAR * (h3 - 0.5) * 2);
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          P[ix] = d.cx + ca * rr;
          P[ix + 1] = d.cy + sa * rr;
          V[ix] = -ca * MIST.RECIRC_V;
          V[ix + 1] = -sa * MIST.RECIRC_V;
          LIFE[i] = MIST.RECIRC_LIFE;
          THETA[i] = a;
          continue;
        }
      }
      const x = P[ix];
      const y = P[ix + 1];
      let ax = 0;
      let ay = 0;
      // the centre
      if (d.pull > 0) {
        const dx = d.cx - x;
        const dy = d.cy - y;
        const r = Math.hypot(dx, dy);
        if (r > 1e-5) {
          const k = (MIST.PULL_A * d.pull * pullProfile(r, MIST.PULL_CORE, MIST.PULL_FAR)) / r;
          ax += dx * k;
          ay += dy * k;
        }
      }
      // the poles
      if (d.poles > 0) {
        for (let q = 0; q < 2; q++) {
          const px = q === 0 ? d.ax : d.bx;
          const py = q === 0 ? d.ay : d.by;
          const dx = px - x;
          const dy = py - y;
          const r = Math.hypot(dx, dy);
          if (r > 1e-5) {
            const k = (MIST.POLE_A * d.poles * pullProfile(r, MIST.POLE_CORE, MIST.POLE_FAR)) / r;
            ax += dx * k;
            ay += dy * k;
          }
        }
      }
      // condensation
      if (d.condense > 0) {
        let captured = false;
        for (let j = 0; j < N; j++) {
          const o = j * 4;
          const pres = hosts[o + 3];
          const hr = hosts[o + 2];
          if (pres < 0.05 || hr < 1e-4) continue;
          const dx = hosts[o] - x;
          const dy = hosts[o + 1] - y;
          const r = Math.hypot(dx, dy);
          const reach = MIST.HOST_REACH * hr;
          if (r >= reach) continue;
          if (r < MIST.CAPTURE_R * hr && d.condense > h3) {
            STATE[i] = 1;
            HOST[i] = j;
            THETA[i] = Math.atan2(y - hosts[o + 1], x - hosts[o]);
            captured = true;
            break;
          }
          const k = (MIST.HOST_A * d.condense * (1 - r / reach)) / Math.max(r, 1e-4);
          ax += dx * k;
          ay += dy * k;
        }
        if (captured) continue;
      }
      // the current, and the particle's own clock
      curl(x, y, tS, CURL);
      const restless = 0.6 + 0.8 * h1;
      ax += CURL[0] * MIST.CURL_V * d.curl * restless;
      ay += CURL[1] * MIST.CURL_V * d.curl * restless;
      ax += fbm1(tS * (0.1 + 0.2 * h2), i * 2) * MIST.DRIFT;
      ay += fbm1(tS * (0.1 + 0.2 * h2), i * 2 + 1) * MIST.DRIFT;
      // the hand and the strike — the droplets' own law, through probe()
      if (probe && env) {
        probe(x, y, tS * 1000, env, A2, h1, h2);
        ax += A2[0] * MIST.HAND;
        ay += A2[1] * MIST.HAND;
        const sc = Math.max(-FLUID.SCROLL_CLAMP, Math.min(FLUID.SCROLL_CLAMP, env.vel || 0));
        ay -= sc * FLUID.SCROLL_LEAN * MIST.SCROLL_LEAN;
      }
      // the type band's wall — a push, and a brake on what dives into it
      if (d.floorOn > 0 && y < d.floor) {
        const pen = clamp01((d.floor - y) / MIST.FLOOR_MARGIN);
        ay += MIST.FLOOR_A * pen * d.floorOn;
        if (V[ix + 1] < 0) ay -= V[ix + 1] * MIST.FLOOR_DAMP * pen * d.floorOn;
      }
      // the bleed's edges
      const exl = 0.5 - halfW - MIST.EDGE_MARGIN;
      const exr = 0.5 + halfW + MIST.EDGE_MARGIN;
      if (x < exl) {
        const pen = clamp01((exl - x) / MIST.EDGE_MARGIN);
        ax += MIST.EDGE_A * pen;
        if (V[ix] < 0) ax -= V[ix] * MIST.EDGE_DAMP * pen;
      }
      if (x > exr) {
        const pen = clamp01((x - exr) / MIST.EDGE_MARGIN);
        ax -= MIST.EDGE_A * pen;
        if (V[ix] > 0) ax -= V[ix] * MIST.EDGE_DAMP * pen;
      }
      if (y < -MIST.EDGE_MARGIN) {
        const pen = clamp01((-MIST.EDGE_MARGIN - y) / MIST.EDGE_MARGIN);
        ay += MIST.EDGE_A * pen;
        if (V[ix + 1] < 0) ay -= V[ix + 1] * MIST.EDGE_DAMP * pen;
      }
      if (y > 1 + MIST.EDGE_MARGIN) {
        const pen = clamp01((y - 1 - MIST.EDGE_MARGIN) / MIST.EDGE_MARGIN);
        ay -= MIST.EDGE_A * pen;
        if (V[ix + 1] > 0) ay -= V[ix + 1] * MIST.EDGE_DAMP * pen;
      }
      // the name
      if (d.spellOn > 0.5 && d.spell > 0 && spellT) {
        const tx = d.wx + spellT[ix] * d.ww;
        const ty = d.wy + spellT[ix + 1] * d.wh;
        const om = MIST.SPELL_OMEGA * (0.8 + 0.4 * h3);
        ax += (om * om * (tx - x) - 2 * MIST.SPELL_ZETA * om * V[ix]) * d.spell;
        ay += (om * om * (ty - y) - 2 * MIST.SPELL_ZETA * om * V[ix + 1]) * d.spell;
      }
      // integrate
      let vx = V[ix] + ax * HS;
      let vy = V[ix + 1] + ay * HS;
      const dragK = Math.exp(-MIST.DRAG * HS);
      vx *= dragK;
      vy *= dragK;
      const sp = Math.hypot(vx, vy);
      if (sp > MIST.V_MAX) {
        vx *= MIST.V_MAX / sp;
        vy *= MIST.V_MAX / sp;
      }
      V[ix] = vx;
      V[ix + 1] = vy;
      P[ix] = x + vx * HS;
      P[ix + 1] = y + vy * HS;
    }
  };

  let acc = 0;
  const step = (dtMs, tMs, hosts, dials, env, spellT, aspect = 1.5) => {
    acc += Math.min(Math.max(dtMs, 0), 100);
    let steps = 0;
    while (acc >= MIST.H_MS && steps < MIST.MAX_STEPS) {
      acc -= MIST.H_MS;
      steps++;
      substep((tMs - acc) / 1000, hosts, dials, env, spellT, aspect);
    }
    if (steps === MIST.MAX_STEPS) acc = 0;
    return steps;
  };

  return { n, P, V, LIFE, STATE, HOST, THETA, seedAt, step };
}

/** A neutral dial block — every regime off, vapour merely drifting. */
export function makeMistDials() {
  return {
    on: 0,
    evap: 0,
    pull: 0,
    poles: 0,
    condense: 0,
    /** R7-B — the share of the field that returns to the rim on arrival. */
    recirc: 0,
    release: 0,
    spell: 0,
    fade: 1,
    curl: 1,
    floorOn: 0,
    floor: 0,
    cx: 0.5,
    cy: 0.5,
    ax: 0.3,
    ay: 0.5,
    bx: 0.7,
    by: 0.5,
    wx: 0.5,
    wy: 0.5,
    ww: 0.2,
    wh: 0.05,
    spellOn: 0,
    hostR: new Float32Array(N),
  };
}
