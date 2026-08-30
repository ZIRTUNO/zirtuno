/**
 * MÉTODO scene (R5-A) — the liquid REHEARSES the client's transformation.
 * Five states of the same 48 droplets, one per method phase, rest plateaus
 * with melts across each gap. ONE material, five arguments, and every state
 * is made of the previous one's — nothing enters that the chapter has not
 * already put on the stage:
 *
 *   0 Diagnóstico  free droplets, scattered and restless — no order at all
 *   1 Estrutura    the same droplets take a grid: 8 columns x 6 rows, held.
 *                  Discrete cells: a PLAN, drawn, not yet built
 *   2 Construção   the grid's cells accrete into THREE distinct masses —
 *                  three systems, each built on its own
 *   3 Integração   the three masses meet, fuse into one body, and that body
 *                  OPENS into a closed circuit
 *   4 Evolução     the circuit holds, turns and grows, and a third of its
 *                  liquid steps radially outward to lay the same circuit out
 *                  again one scale up — discrete cells, the way Estrutura
 *                  looked: the next plan, around the working system
 *
 * THE MARK IS NOT IN THIS CHAPTER. It used to resolve at Integration, and it
 * was the one element here that was not made of the stage before it — an
 * outside object dropped onto three masses that had done nothing to earn it,
 * which is why Integration read as a collapse into a logo and Evolution had
 * nothing left to inherit. "Everything starts operating as a single organism"
 * has a better answer than a silhouette: three masses collapsing into one
 * puddle is three things GONE, while three masses that join into a continuous
 * loop are three things CONNECTED. The hole in the middle is the proof, and it
 * is the thing a puddle cannot show. So this scene claims no form slot at all
 * (`forms: []`, like the Work current) and the 48 droplets carry the picture
 * end to end.
 *
 * The circuit's locus keeps Construction's memory: a rounded triangle whose
 * three lobes point exactly where the three masses stood. And because the
 * three populations are interleaved evenly around it, no arc of the organism
 * belongs to one former system any more — which is the actual claim.
 *
 * Two clocks matter and neither is the melt's. `sEff` saturates the moment a
 * melt ends and cannot address the plateau after it, so anything scheduled on
 * it lands while the PREVIOUS phase's copy is still centred; the circuit's
 * opening and the growth are read against the phase coordinate `du` instead,
 * which is where the reader's eye actually is. And `ex` used to drain over
 * `wr.bottom - vh`, a line the runway crosses ~0.4vh BEFORE its last phase is
 * centred — Evolution was authored and then never rendered once: 0 droplets,
 * 0 area, at its own centre. The exit now hands over by DENSITY (site.ts's
 * argument: shrinking a metaball pulls it out of contact with its neighbours
 * and leaves solid beads behind, because peak field does not fall with radius)
 * and only after the last phase has been read.
 *
 * Damping and inertia are conductor-owned; the entry envelope (rIn) keeps the
 * droplets invisible until the runway actually enters — under the page-wide
 * canvas the stage is always on, so invisibility must be authored, not implied
 * by mounting.
 */

import {
  CLOUDS,
  N,
  clamp01,
  smooth01,
  hash,
  PHYS,
  VARY,
  wideScatter,
  ORGANISM_SCALE,
} from "../phys.mjs";
import type {
  SceneModule,
  SceneCtx,
  SceneGeom,
  SceneChannels,
  DropletOut,
} from "./types";
import { HANDOFF, centersMid, coordAt, handoffMix } from "./geom";

const M_STATES = 5;

// THE CLAIM's grip, matching the site scene's EX_BIND_FLOOR. State 0 is FREE
// liquid (BINDS[0] = 0) and should be: a settled Diagnosis cloud is restless by
// argument. But it is free liquid whose targets are STILL, and that is the only
// reason it never sheds spray — fluid-core throws a satellite off any droplet
// at bind ≤ SAT_BIND_MAX whose target strains past SAT_STRAIN, and the ARRIVING
// cloud's targets are anything but still: they are half of a 0.67 uv crossing
// from the Services column. Blended against the site's floor, a 0 here pulls the
// shared bind back under the threshold exactly as this scene takes the weight,
// which put a dozen ballistic beads across Método's own headline. So the liquid
// is CLAIMED while it is being handed over and released once it has arrived —
// the same argument site.ts makes for the gathering, in the other direction.
const ARRIVAL_BIND = 0.55;

const TAU = Math.PI * 2;

// Per-gap melt windows on the fractional part of the phase coordinate. Four of
// the five gaps cross the middle third of their runway, which is what makes a
// phase read as a PLATEAU with a change between. The Construction → Integration
// gap is the exception because that gap is not a transition, it is the
// chapter's own event — the three built pieces meeting — so it opens a little
// later and runs a little longer, and the mark's resolve picks up where it
// lands rather than being finished before the copy arrives.
// The Integration → Evolution gap opens EARLY for the opposite reason: the
// per-droplet stagger means the last cell only starts its crossing at 0.4 of
// the window, so a gap centred like the others left the ring still budding off
// the silhouette at u = 3.7 — deforming the mark it is supposed to be circling.
// Shed sooner and the ring is clear and settled well before the plateau.
const MELT_LO = [0.35, 0.35, 0.38, 0.3];
const MELT_HI = [0.65, 0.65, 0.72, 0.62];

// THE MEETING: how far the three Construction cores travel toward the stage
// centre before their masses are one body. Their internal arrangement rides
// along unchanged — the pieces are JOINED, not re-made — and at 0.3 the three
// overlap into one dense mass, which is the body the circuit then opens out of.
// It also does the mixing where the mixing cannot be seen: by the time the
// droplets spread to the loop, no arc of the organism belongs to one former
// system, and the reader never watched them being shuffled.
const MEET_PULL = 0.3;

// THE CIRCUIT's locus — a rounded triangle, as a multiplier on its radius.
// Three lobes pointing exactly where Construction's three masses stood, so the
// organism keeps the memory of what it was made from. 0.16 is enough to read
// as three-lobed and not so much that the loop pinches at the waists.
const LOBE = 0.16;
const locus = (a: number) => 1 + LOBE * Math.cos(3 * (a - Math.PI / 2));

// Evolution's outer locus: the same curve, one scale up. Far enough out that a
// cell cannot neck with the circuit (a metaball ADDS to its neighbour's field
// rather than passing beside it) and inside the stage's own room at every
// aspect — which is not the same number on both, because a narrow stage puts
// the copy above the liquid rather than beside it. At 1.45 the surface gap is
// still ~2x the necking distance.
const NEXT_SCALE = 1.62;
const NEXT_SCALE_NARROW = 1.62;

export function makeMethodScene(): SceneModule {
  const base = CLOUDS[0];
  let cachedAspect = -1;
  let ST = new Float32Array(M_STATES * N * 3); // per-state droplet targets
  const MRG = new Float32Array(N * 2); // THE MEETING — state 2's masses, joined
  let stageCx = 0.5;
  let stageCy = 0.5;
  let mOx = 0;
  let mOy = 0;
  let mScale = ORGANISM_SCALE;
  let nextScale = NEXT_SCALE;
  // per-state wander activity (fragmented = restless … integrated = still)
  const ACT = [1, 0.3, 0.5, 0.2, 0.3];
  // per-state physics bind (R5-B): the cloud is FREE liquid, the lattice is
  // mostly held (order taking hold), the masses stay loose enough to ACCRETE
  // by cohesion, the circuit holds its shape but is not dead, the outer cells
  // drift. Nothing is bind 1 in this chapter any more: with no exact form to
  // protect there is nothing that has to be analytically perfect, and a body
  // pinned at 1 receives no environmental force at all.
  const BINDS = [0, 0.7, 0.3, 0.9, 0.55];
  /** The identities that step out at Evolution — the same third of the family
   *  that becomes the Work chapter's current on the very next screen. Spread
   *  evenly around the circuit (i, not i % 3, sets the angle) so what leaves
   *  is every third position on the loop and never one whole arc of it. */
  const inRing = (i: number) => i % 3 === 0;
  /** A non-ring droplet's rank among the 32 that HOLD the circuit — they close
   *  ranks as the other sixteen leave, so the loop stays evenly populated
   *  instead of being pinched every third position. Shifts stay under ~11°. */
  const holdRank = (i: number) => i - ((i / 3) | 0) - 1;

  const put = (s: number, i: number, x: number, y: number, r: number) => {
    const j = (s * N + i) * 3;
    ST[j] = x;
    ST[j + 1] = y;
    ST[j + 2] = r;
  };

  // per-frame factors (tick → target)
  let k0 = 0;
  let k1 = 0;
  let fw = 0;
  let sEff = 0;
  let exW = 0; // the drain, as density: 0 = solid … 1 = gone
  let rInW = 0;
  let claimW = 0; // THE CLAIM — this liquid is still being handed over
  let openW = 0; // the fused body opening into the circuit
  let spinA = 0; // the circuit's own circulation (rad/s)
  let grow = 1; // Evolution's expansion, about the stage centre

  return {
    id: "method",
    forms: [], // droplet-only — the mark belongs to Origin and Contact, not here
    channels: { u: 0, ex: 0, on: 0, rIn: 0, claim: 1 },
    // scroll-continuous envelopes, applied raw
    damp: { on: false, rIn: false, claim: false },
    anchors: { wrap: "#method .method-journey" },
    lists: { phases: "#method .method-phase" },

    read(g: SceneGeom, out: SceneChannels) {
      const vh = g.vh;
      const wr = g.rect("wrap");
      if (wr) {
        // GRIP — and it is not free. The premise this used to rest on ("both
        // entirely off-screen; the drain/entry envelopes own visibility") is
        // false for POSITION: the conductor blends every scene's droplet
        // targets by presence weight, and that average is taken regardless of
        // density or radius. A scene at weight 0.5 with rIn = 0 is invisible
        // and still drags the shared droplets halfway to its own targets.
        // Rising at 1.9vh put this scene at half weight while the seventh
        // Services form was still holding its column two thirds of a stage to
        // the right, so the cloud that eventually appeared had spent the whole
        // approach being pulled between two places — and, once Services began
        // its own departure, was carried down out of frame with it.
        //
        // So the grip rises exactly where the site scene gives it up — and
        // "exactly" is now structural rather than a matching pair of hand-typed
        // numbers. Both sides read HANDOFF's crossing window and run the same
        // handoffMix, so this scene's weight is the site's exact complement at
        // every scroll position and the normalised blend the conductor takes IS
        // that curve. The pair this replaces (a smoothstep falling against a
        // linear rise, over windows that had drifted apart) described one
        // journey with two different clocks — and, measured, the site's half
        // was not even running on the clock it claimed (see the grip in
        // site.ts's read). The window this replaced was 0.92vh → 0.36vh.
        out.on =
          handoffMix(
            (HANDOFF.crossHi * vh - wr.top) / (HANDOFF.crossSpan * vh),
          ) * clamp01((wr.bottom + vh * 0.3) / (vh * 0.5));
        // ENTRY — and it must be FINISHED before the grip starts to bite, not
        // spread across it. Radius is weight-averaged too, so a cloud still
        // swelling at half weight contributes half of a partial radius: the
        // blended body thins in the middle of the crossing, and thinning radius
        // is exactly what breaks a merged field into loose beads (two droplets
        // only neck while their gap is under 0.83 x radius). Swelling over
        // 1.25vh → 1.00vh — under the site's release, where this scene has no
        // weight and therefore no picture — means the arriving liquid is at its
        // full size the moment it starts to count for anything. The crossing
        // does not open until HANDOFF.crossHi = 0.754vh, so the swell is
        // finished a quarter of a viewport before this scene's weight leaves
        // zero.
        out.rIn = clamp01((vh * 1.25 - wr.top) / (vh * 0.25));
        // EXIT — and it must not begin until the LAST phase has been read.
        // This used to drain over `wr.bottom - vh`: a line the runway crosses
        // 0.41vh before Evolution reaches the middle of the screen, because
        // the last phase owns 74vh and the runway only carries 4vh of padding
        // under it. Measured at Evolution's own centre the stage held ZERO
        // droplets and zero area — a dead band by verify-boundaries' own
        // definition, sitting exactly where the chapter's closing claim is.
        // The whole of state 4 was authored and never once rendered.
        //
        // So the drain is read from the runway's bottom edge crossing the
        // FOLD instead: full material while Evolution is the subject, gone by
        // the time the grip releases (which happens over wr.bottom 0.2 → -0.3)
        // so the handoff is a transfer and never a gap.
        out.ex = clamp01((vh * 0.8 - wr.bottom) / (vh * 0.55));
        // THE CLAIM: 1 for the whole handoff, releasing to 0 as the runway
        // reaches the fold — by which point this liquid has arrived, its
        // targets are the still Diagnosis scatter, and free liquid on still
        // targets strains nothing and sheds nothing. Ending it exactly at the
        // fold also means the grip is gone before Diagnosis is the subject, so
        // the phase the reader actually looks at is the authored free cloud.
        //
        // It reaches 1 where the CROSSING LANDS, not 0.36vh above it. The claim
        // is what holds the blended bind above FLUID.SAT_BIND_MAX while this
        // liquid is in flight, and the crossing now lands at 0.20vh: on the old
        // divisor the floor was already down to 0.32 through the last 0.16vh of
        // the travel, which is exactly the condition that throws ballistic
        // spray across Método's own headline. Tied to the landing it cannot.
        out.claim = clamp01(wr.top / (vh * (HANDOFF.open - HANDOFF.span)));
      }
      const phases = g.list("phases");
      if (phases.length >= 2) out.u = coordAt(vh * 0.5, centersMid(phases));
    },

    presence(ctx: SceneCtx) {
      return ctx.ch.on;
    },

    tick(ctx: SceneCtx) {
      const aspect = ctx.aspect;
      if (Math.abs(aspect - cachedAspect) > 0.02) {
        cachedAspect = aspect;
        // stage left of the copy column on wide stages; below it on narrow
        // NARROW STAGES carry the copy ABOVE the liquid instead of beside it,
        // and had been given a fraction of the room they actually have. ONE UV
        // UNIT IS THE SMALLER VIEWPORT DIMENSION, so on a 430 x 932 phone a uv
        // is ~430px, not 932: the band between the last line of copy and the
        // bottom of the frame is nearly a whole uv, where the old staging
        // (0.38 at -0.22) put a composition a third of that size directly
        // under the text. Measured with scripts/_bbox.mjs rather than modelled
        // — the landscape mapping (a uv = the height) does not hold here and
        // predicted the stage 140px away from where it renders.
        const wide = aspect >= 1.4;
        mOx = wide ? -Math.min(0.15 * aspect, aspect / 2 - 0.32) : 0;
        mOy = wide ? 0 : -0.55;
        mScale = wide ? ORGANISM_SCALE : 0.44;
        nextScale = wide ? NEXT_SCALE : NEXT_SCALE_NARROW;
        stageCx = 0.5 + mOx;
        stageCy = 0.5 + mOy;
        const sz = mScale / ORGANISM_SCALE; // local size factor
        ST = new Float32Array(M_STATES * N * 3);
        // 0 — the fragmented cloud (Diagnosis): SEPARATED droplets — small
        // enough that their falloff tails never fuse into a dark film — and
        // compressed into the stage column so the copy stays clear
        // wideScatter clamps ty into [0.09, 0.91] to keep its droplets in
        // frame — a landscape assumption, where a uv IS the frame height. On a
        // portrait stage the visible band is roughly [-0.66, 1.66], so that
        // clamp is not a safety rail, it is a pin: drop the stage to where the
        // copy leaves room and the whole lower half of the Diagnosis scatter
        // collapses onto one horizontal line at 0.09. So it is generated about
        // a safe centre and TRANSLATED onto the stage afterwards, which keeps
        // the authored scatter shape at any offset.
        const dis = wideScatter(aspect, stageCx, 0.5, 0.62);
        const clampD = (v: number, c: number, lim: number) =>
          c + Math.max(-lim, Math.min(lim, (v - c) * 0.9));
        // 1 — the lattice (Structure): 8 × 6 = exactly the 48 droplets
        const COLS = 8;
        const ROWS = 6;
        const spanX = 0.54 * sz;
        const spanY = 0.42 * sz;
        // 2 — three SEPARATE masses (Construction). At the old 0.155 with
        // spreads to 0.074 the cores sat inside each other's fields and the
        // three pieces rendered as one blob, which spent Integration's event
        // a phase early. Pushed out and drawn in, the gap between neighbours
        // is ~0.2 uv — far past the 0.83 × radius at which two droplets neck —
        // so three pieces are built, and joining them is still to come.
        const CORE_R = 0.2 * sz;
        // 3 — THE CIRCUIT (Integration). 48 droplets evenly around a rounded
        // triangle: at this radius the spacing is ~0.022 uv against a droplet
        // radius of ~0.019, so consecutive droplets overlap and the loop
        // renders as one continuous tube of liquid rather than a bead chain.
        // The hole it encloses is ~0.29 uv across — the whole point, and the
        // one thing a fused puddle cannot show.
        const CIRCUIT_R = 0.33 * mScale;
        const CIRCUIT_D = 0.038 * mScale;
        for (let i = 0; i < N; i++) {
          const b = base[i];
          put(
            0,
            i,
            clampD(dis[i].tx, stageCx, 0.33),
            clampD(dis[i].ty - 0.5 + stageCy, stageCy, 0.33),
            b[2] * mScale * (0.24 + 0.24 * VARY[i]),
          );
          const col = i % COLS;
          const row = (i / COLS) | 0;
          put(
            1,
            i,
            stageCx -
              spanX / 2 +
              (spanX / (COLS - 1)) * col +
              (row % 2 ? spanX / (COLS - 1) / 2 : 0) +
              (hash(i, 72) - 0.5) * 0.014,
            stageCy -
              spanY / 2 +
              (spanY / (ROWS - 1)) * row +
              (hash(i, 73) - 0.5) * 0.014,
            0.012 * sz * (0.92 + 0.16 * hash(i, 74)),
          );
          const core = i % 3;
          const ca = ((core * 120 + 90) * Math.PI) / 180;
          const cx = stageCx + Math.cos(ca) * CORE_R;
          const cy = stageCy + Math.sin(ca) * CORE_R;
          const od = (0.01 + 0.044 * Math.pow(hash(i, 75), 1.4)) * sz;
          const oa = hash(i, 76) * Math.PI * 2;
          const ox = Math.cos(oa) * od;
          const oy = Math.sin(oa) * od;
          put(2, i, cx + ox, cy + oy, (0.03 - 0.2 * od) * sz);
          // 2b — THE MEETING (Integration's own event): each core carried in
          // toward the stage centre with its mass's internal arrangement
          // intact. This is not a keyframe — it is the waypoint the 2 → 3 path
          // bends through, so the three pieces are seen to ARRIVE at each
          // other before any of them lets go of its position.
          MRG[i * 2] = stageCx + (cx - stageCx) * MEET_PULL + ox;
          MRG[i * 2 + 1] = stageCy + (cy - stageCy) * MEET_PULL + oy;
          // 3 — the circuit. Position around the loop is set by `i` itself, so
          // the three masses (i % 3) land INTERLEAVED: every third droplet on
          // the loop came from the same former system, and no arc of the
          // organism belongs to one of them any more.
          const la = (i / N) * TAU;
          const lq = locus(la);
          put(
            3,
            i,
            stageCx + Math.cos(la) * CIRCUIT_R * lq,
            stageCy + Math.sin(la) * CIRCUIT_R * lq,
            // a touch heavier on the lobes, thinner through the waists, so the
            // three joined bodies stay legible inside the one that they made
            CIRCUIT_D * (0.92 + 0.16 * hash(i, 74)) * (1 + 0.5 * (lq - 1)),
          );
          // 4 — EVOLUTION. The circuit holds, and a third of its liquid steps
          // RADIALLY OUTWARD — same bearing, next scale — to lay the same
          // circuit out again as discrete, separated cells. That is what
          // Estrutura looked like: cells apart are a PLAN, cells joined are a
          // thing that has been built. So the closing image is the working
          // system with the next one measured out around it, which is the
          // method not ending at what it made.
          //
          // The 32 that stay CLOSE RANKS (holdRank), because with every third
          // droplet gone the loop would otherwise be pinched at sixteen
          // regular points. The redistribution is small — under ~11° each —
          // so it reads as the organism healing, not rearranging.
          if (inRing(i)) {
            put(
              4,
              i,
              stageCx + Math.cos(la) * CIRCUIT_R * nextScale * lq,
              stageCy + Math.sin(la) * CIRCUIT_R * nextScale * lq,
              0.028 * mScale * (0.9 + 0.2 * hash(i, 74)),
            );
          } else {
            const ha = (holdRank(i) / (N - N / 3)) * TAU;
            const hq = locus(ha);
            put(
              4,
              i,
              stageCx + Math.cos(ha) * CIRCUIT_R * hq,
              stageCy + Math.sin(ha) * CIRCUIT_R * hq,
              // A third of the tube has left, so the spacing between what is
              // still there goes from ~0.022 to ~0.032 uv. Without the
              // compensation the loop thins and starts to undulate exactly
              // where it has to keep reading as one continuous thing.
              CIRCUIT_D *
                1.2 *
                (0.92 + 0.16 * hash(i, 74)) *
                (1 + 0.5 * (hq - 1)),
            );
          }
        }
      }

      const du = Math.min(Math.max(ctx.ch.u, 0), 4); // conductor-damped

      // rest plateau on each phase, melt across its own window
      k0 = Math.min(Math.floor(du), 3);
      const f = du - k0;
      const lo = MELT_LO[k0];
      const hi = MELT_HI[k0];
      fw = f <= lo ? 0 : f >= hi ? 1 : (f - lo) / (hi - lo);
      sEff = k0 + fw;
      k1 = Math.min(k0 + 1, M_STATES - 1);

      // exit: the liquid hands over AFTER the last phase has been read;
      // entry: it swells only once the runway approaches
      const exE = smooth01(clamp01(ctx.ch.ex));
      exW = exE;
      rInW = smooth01(clamp01(ctx.ch.rIn));
      claimW = smooth01(clamp01(ctx.ch.claim));

      // THE CIRCUIT OPENS on INTEGRATION's own runway, not on the melt's.
      // `sEff` pins to 3 the instant the 2 → 3 melt ends and cannot address
      // anything inside the plateau that follows, so anything written against
      // it lands while CONSTRUCTION's copy is still centred. Read against the
      // phase coordinate the gesture tracks its sentence: the three masses
      // finish fusing at du ≈ 2.72, and the fused body opens from 2.62 to 3.10
      // — completing just after "Integração" reaches the middle of the screen,
      // so the aperture finishes while the reader is on the line rather than
      // before they arrive.
      //
      // The window is deliberately WIDE because a hole is a topological event
      // and does not appear when the droplets start moving: 48 droplets on a
      // small ring still sum enough field at its centre to close it, so the
      // gap only breaks open at about 55% of the sweep. Measured over a 0.30
      // window that put the whole aperture in ~110px of scroll — one flick of
      // the wheel. Over 0.48 it grows across ~160px and reads as an opening.
      openW = smooth01((du - 2.62) / 0.48);
      // …and then it HOLDS, and turns. A closed circuit that rotates is an
      // organism operating; the same loop held still is a diagram. One rate for
      // the whole system — the outer cells included — so the composition turns
      // as one piece and the cells keep the radial alignment that says they
      // stepped straight out of it.
      spinA = 0.02 * smooth01((du - 2.85) / 0.4);
      // The system GROWS across Evolution. Everything from the circuit outward
      // rides the same scale about the stage centre, so the clearance between
      // the loop and the cells around it is preserved.
      grow = 1 + 0.05 * smooth01((du - 3.5) / 0.45);
    },

    target(i: number, ctx: SceneCtx, out: DropletOut) {
      const t = ctx.t;
      const ja = (k0 * N + i) * 3;
      const jb = (k1 * N + i) * 3;
      // staggered flow: each droplet crosses the melt on its own window
      const fi = smooth01((fw - 0.4 * hash(i, 71)) / 0.6);
      let x: number;
      let y: number;
      let r: number;
      if (k0 === 2) {
        // INTEGRATION is two events on one runway, and a straight lerp gives
        // neither. Lerping the three masses onto the circuit would send every
        // droplet off on its own long diagonal at once — the pieces would stop
        // existing without ever having touched, and the loop would assemble
        // out of traffic. Bending the path through MRG splits it: the three
        // bodies MEET and fuse into one dense mass (g1, on the melt's own
        // stagger), and then that mass OPENS into the circuit (openW, on
        // Integration's runway, landing as the line centres).
        //
        // The opening is radial out of a single blob at the stage centre,
        // which is why the interleaving costs nothing to read: the shuffle
        // happens inside the fused body where there is nothing to see, and
        // what the reader gets is one mass blooming into a ring.
        const g1 = smooth01(fi / 0.6);
        const mx = ST[ja] + (MRG[i * 2] - ST[ja]) * g1;
        const my = ST[ja + 1] + (MRG[i * 2 + 1] - ST[ja + 1]) * g1;
        x = mx + (ST[jb] - mx) * openW;
        y = my + (ST[jb + 1] - my) * openW;
        // the mass keeps Construction's weight the whole way in — it is being
        // joined, not spent — and only thins into the tube as the loop opens
        r = ST[ja + 2] + (ST[jb + 2] - ST[ja + 2]) * openW;
      } else {
        x = ST[ja] + (ST[jb] - ST[ja]) * fi;
        y = ST[ja + 1] + (ST[jb + 1] - ST[ja + 1]) * fi;
        r = ST[ja + 2] + (ST[jb + 2] - ST[ja + 2]) * fi;
        // The aperture runs PAST du = 3.0, where k0 rolls over and the branch
        // above stops being taken. Pulling the result back toward the fused
        // mass by the same (1 - openW) is the identical expression written
        // from the other end, so the two branches agree exactly at the seam
        // and the opening does not step as the phase index changes.
        if (k0 === 3 && openW < 1) {
          const k = 1 - openW;
          x += (MRG[i * 2] - x) * k;
          y += (MRG[i * 2 + 1] - y) * k;
          r += (ST[(2 * N + i) * 3 + 2] - r) * k;
        }
      }
      // THE ORGANISM OPERATES: from the moment the circuit closes the whole
      // composition turns about the stage centre and grows with Evolution.
      // Both are applied here rather than baked into the states because they
      // must reach the outer cells and the loop identically — one rate, one
      // scale, so the cells hold the radial line that says they stepped
      // straight out of the circuit rather than drifting into place.
      if (sEff > 2.6) {
        const rot = t * spinA;
        const dx = (x - stageCx) * grow;
        const dy = (y - stageCy) * grow;
        const cs = Math.cos(rot);
        const sn = Math.sin(rot);
        x = stageCx + dx * cs - dy * sn;
        y = stageCy + dx * sn + dy * cs;
      }
      // life: restless while fragmented, stiller as order takes hold
      const act = ACT[k0] + (ACT[k1] - ACT[k0]) * fi;
      // The 32 that HOLD the circuit through Evolution keep the loop's own
      // bind; only the sixteen that leave inherit the looser drift, or the
      // tube would go slack exactly where it has to stay one continuous thing.
      const b1 = k1 === 4 && !inRing(i) ? BINDS[3] : BINDS[k1];
      // Through the meeting the bodies stay loose enough for cohesion to
      // actually pull them together, and firm up as the circuit takes its
      // shape — so bind follows the two events, not the raw melt.
      const bind =
        k0 === 2
          ? BINDS[2] +
            0.2 * smooth01(fi / 0.6) +
            (BINDS[3] - BINDS[2] - 0.2) * openW
          : BINDS[k0] + (b1 - BINDS[k0]) * fi;
      // Curl supplies life to free droplets. Bound choreography retains only
      // the authored share that physics intentionally suppresses; the legacy
      // rollback keeps the original target motion in full.
      const authored = ctx.physics ? bind : 1;
      const wob = PHYS.DRIFT * act * authored;
      x += wob * Math.sin(t * (0.5 + hash(i, 80)) + i * 1.7);
      y += wob * Math.cos(t * (0.44 + hash(i, 81)) + i * 2.3);
      r *= rInW; // entry swell (the exit is density — see below)

      out.x = x;
      out.y = y;
      out.r = r;
      // THE EXIT DISSOLVES, IT DOES NOT SHRINK — site.ts's argument, which
      // this scene had never taken up. Scaling `r` toward zero does not fade a
      // metaball: its peak field is independent of its size, so the body
      // separates into fully-solid beads (two droplets only neck while their
      // gap is under 0.83 × radius) and the organism appeared to come apart
      // into dust on its way out. Density recedes the SURFACE, and the
      // conductor culls a droplet once it is too thin to register. With no
      // form in this chapter there is nothing else for density to do: the
      // liquid is solid from the entry swell to the drain.
      out.d = 1 - exW;
      // physics attributes (R5-B): per-state bind; Construction's three
      // masses share cluster ids so cohesion makes the accretion REAL —
      // floored while THE CLAIM is still carrying this liquid in from Services,
      // so the crossing cannot shed spray from either side of the seam. `max`,
      // not a blend: the states that are already MORE bound than the floor
      // (the lattice, the circuit) must keep their exactness untouched.
      out.bind = Math.max(bind, ARRIVAL_BIND * claimW);
      // Construction's three pieces are three COHESION groups, so the masses
      // are held together by the liquid rather than merely drawn apart, and
      // they become ONE group at the meeting — the moment "a single organism"
      // stops being a caption and becomes the physics. The group is dropped
      // the instant the circuit starts to open: cohesion pulls toward the
      // cluster's CENTROID, which for a ring is the middle of its hole, so
      // holding it would close the one thing the state exists to show.
      if (k0 === 2) out.cluster = openW > 0.06 ? -1 : fi > 0.45 ? 0 : i % 3;
      else out.cluster = (fi > 0.5 ? k1 : k0) === 2 ? i % 3 : -1;
      // The cells that step out sit a little BEHIND the circuit they left —
      // the same argument the ecosystem makes with depth, and the plane the
      // Work chapter's current (these very identities) is already swimming in
      // on the next screen.
      out.z = inRing(i) ? 0.26 * smooth01((sEff - 3.1) / 0.6) : 0;
    },

    form() {
      return null; // the 48 droplets carry this chapter end to end
    },

    ambient() {
      return 0; // the method stage had no ambient family (parity with pre-R5)
    },

    activity() {
      // everything here is scroll-scrubbed (the conductor's velocity term
      // covers motion) or slow (evolution orbits) — 30 Hz-safe
      return 0;
    },
  };
}
