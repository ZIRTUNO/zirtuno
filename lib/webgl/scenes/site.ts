/**
 * THE SITE SCENE (R5-A) — the faithful port of makeSiteDriver into the scene
 * contract: Hero → Problem → Ecosystem → Services as ONE scene of the
 * conductor. Internals are the signed-off choreography, verbatim: the hero
 * machine (autocycle §3.3 melts, gooey cursor, keyboard), the pour, the
 * fracture, the travel/converge, the tendrils, the services melts and the
 * exit drain. What moved OUT (now conductor-owned): channel damping (same
 * PHYS taus), per-droplet inertia integration (same TAUP identity), the
 * ambient family packing (the scene contributes its calm multiplier), and
 * scroll-velocity smoothing (ctx.scrollVel).
 *
 * Phase D splits this into finer scenes when the act transitions are
 * redesigned; splitting during the structural port would risk the
 * visual-equivalence gate for zero Phase-A benefit.
 */

import {
  CLOUDS,
  N,
  STATE_COUNT,
  STAG,
  clamp01,
  smooth01,
  hash,
  PHYS,
  VARY,
  wideScatter,
  clusterTargets,
  convergeEnvelopes,
  ECO_NODES,
  ORGANISM_SCALE,
  TENDRIL_START,
  ecoSpreadX,
  ecoNodePos,
} from "../phys.mjs";
import type { ScatterTarget } from "../phys.mjs";
import {
  STAGGER,
  RADIUS_LEAD,
  arrive,
  permFor,
  packBridge,
  bridgeRadiusEnvelope,
  formPresence,
  formPhase,
  type SiteCallbacks,
} from "../field-drivers";
import {
  SDF_WARP_REST,
  SDF_WARP_MORPH,
  SDF_MELT_ERODE,
  CURSOR_R,
  CURSOR_TRAIL_N,
  CURSOR_SMOOTH,
  CURSOR_INFLUENCE_MARK,
} from "../sdf-glass-shader.mjs";
import { DURATIONS } from "../../animation/durations";
import type {
  SceneModule,
  SceneCtx,
  SceneGeom,
  SceneChannels,
  DropletOut,
  FormState,
} from "./types";
import { centersMid, coordAt } from "./geom";

// choreography of the eco runway progress pr ∈ [0,1] (moved from LiquidSite):
export const CONV_END = 0.5; // converge completes at half the runway
export const GROW_START = 0.46;
export const GROW_SPAN = 0.38;
// within each service gap: rest, then melt across the middle window
const MELT_LO = 0.35;
const MELT_HI = 0.65;

const HERO_DROPS = 1 + CURSOR_TRAIL_N; // gooey cursor chain length

export function makeSiteScene(cbs: SiteCallbacks = {}): SceneModule {
  const base = CLOUDS[0];

  // ── aspect-cached targets + services placement ──────────────────────────────
  let cachedAspect = -1;
  let Tclu: ScatterTarget[] = [];
  let Tdis: ScatterTarget[] = [];
  let Teco: ScatterTarget[] = [];
  let svcOx = 0;
  let svcOy = 0;
  let svcScale = ORGANISM_SCALE;

  // ── hero machine (autocycle / melt / queue) ─────────────────────────────────
  const texReady = new Array(STATE_COUNT).fill(false) as boolean[];
  let hState = 0;
  let hTarget = 0;
  let hPhase: "rest" | "melt" = "rest";
  let hMorphT = 0;
  let hDwell = 0;
  let hQueued = -1;
  let perm: number[] = [];
  let stag: number[] = [];
  const scratch = new Float32Array(N * 3); // hero bridge cloud (form-local)
  const startMelt = (s: number) => {
    perm = permFor(hState, s);
    stag = STAG[hState];
    hTarget = s;
    hMorphT = 0;
    hPhase = "melt";
    cbs.onHeroActive?.(s - 1);
  };

  // ── gooey cursor chain (same spring family as the old hero) ─────────────────
  const drops = Array.from({ length: HERO_DROPS }, () => ({ x: 0.5, y: 0.5 }));
  let cursorOn = 0;
  let markMul = 1;

  // ── pair melt: snap on pair switch, damp otherwise (self-managed) ───────────
  let lastPair = "0-0";
  let mState = 0;

  // ── per-frame factors (computed once in tick, read by target/form/extras) ──
  let F = 0; // fracture
  let TR = 0; // travel
  let SP = 0; // services position
  let EXW = 1; // exit drain (radii)
  let jScale = ORGANISM_SCALE;
  let jOx = 0;
  let jOy = 0;
  let inSvcMelt = false;
  let pa = 0;
  let pb = 0;
  let heroBridge = false;
  let pourR = 0;
  let stirY = 0;
  let convP = 1; // p = 1 - converge
  let rEnv = 0;
  let shed = 1;
  let sx = 1;
  let hp = 0; // damped heroPhase
  let grow = 0;
  let ambW = 1;
  let hOx = 0;
  let hOy = 0;
  let hScale = 0.5;
  const formOut: FormState = {
    a: 0,
    b: 0,
    fa: 1,
    fb: 0,
    ea: 0,
    eb: 0,
    ox: 0,
    oy: 0,
    scale: 0.5,
    warp: SDF_WARP_REST,
  };

  return {
    id: "site",
    forms: [0, 1, 2, 3, 4, 5, 6, 7],
    channels: {
      on: 1,
      heroPhase: 0,
      fracture: 0,
      travel: 0,
      converge: 0,
      grow: 0,
      svcPos: 0,
      exit: 0,
      pairA: 0,
      pairB: 0,
      pairM: 0,
      heroPlay: 1,
      heroHover: 0,
      heroManual: -1,
      heroDwellMs: DURATIONS.autocycle,
      heroPx: 0.5,
      heroPy: 0.5,
      heroCursorOn: 0,
      heroOx: 0,
      heroOy: 0,
      heroScale: 0.5,
    },
    // raw passthroughs: the pair triple self-manages its snap-or-damp; the
    // hero machine inputs are events/geometry applied 1:1 (as today)
    damp: {
      on: false,
      pairA: false,
      pairB: false,
      pairM: false,
      heroPlay: false,
      heroHover: false,
      heroManual: false,
      heroDwellMs: false,
      heroPx: false,
      heroPy: false,
      heroCursorOn: false,
      heroOx: false,
      heroOy: false,
      heroScale: false,
    },
    anchors: {
      hero: "#hero",
      runway: "[data-organism]",
      services: "#services",
    },
    lists: {
      symptoms: "#problem .symptom",
      pillars: "#services .pillar",
    },
    formReady: (s) => {
      texReady[s] = true;
    },

    read(g: SceneGeom, out: SceneChannels) {
      const vh = g.vh;
      const cy = vh * 0.5;
      const hr = g.rect("hero");
      if (hr) out.heroPhase = clamp01(-hr.top / (hr.height * 0.72));

      // S3 — the fracture, one notch per symptom shard
      const symptoms = g.list("symptoms");
      if (symptoms.length >= 2) {
        const u = coordAt(cy, centersMid(symptoms));
        const kk = Math.floor(u);
        const frac = u - kk;
        const stepped = kk + smooth01((frac - 0.25) / 0.5); // hold on each shard
        out.fracture = clamp01(stepped / (symptoms.length - 1));
      }

      // S3 → S4 travel + the eco runway (converge → tendrils)
      const rw = g.rect("runway");
      if (rw) {
        out.travel = clamp01((vh - rw.top) / (vh * 0.9));
        const pr = clamp01(-rw.top / Math.max(rw.height - vh, 1));
        out.converge = clamp01(pr / CONV_END);
        out.grow = clamp01((pr - GROW_START) / GROW_SPAN);
      }

      // S4 → S5: the organism clears the services HEADLINE (drift + scale
      // start as the section approaches, not when the first pillar arrives)
      const sr = g.rect("services");
      if (sr) {
        out.svcPos = clamp01((vh * 0.92 - sr.top) / (vh * 0.85));
        // S5 → S6: the liquid settles away BEFORE the method chapter, so the
        // handoff never drags visible liquid. The window is the services CTA
        // zone only — the last pillar keeps its liquid while read. (Anchored
        // to the services bottom — identical geometry to the old wrap bottom.)
        out.exit = clamp01(1 - (sr.bottom - vh) / (vh * 0.35));
        // presence: this scene's grip fades once the services have fully left
        // (long after the exit drain made everything invisible) — the method
        // scene takes the weights from here
        out.on = clamp01((sr.bottom + vh * 0.2) / (vh * 0.8));
      }
      const pillars = g.list("pillars");
      if (pillars.length >= 2 && out.svcPos > 0.02) {
        // virtual pre-pillar centre gives the organism → pillar-1 melt a runway
        const centers = centersMid(pillars);
        const virtual = centers[0] - vh * 0.85;
        const uu = coordAt(cy, [virtual, ...centers]) - 1; // ∈ [-1, n-1]
        const idx = Math.floor(uu);
        const frac = uu - idx;
        const m =
          frac <= MELT_LO
            ? 0
            : frac >= MELT_HI
              ? 1
              : (frac - MELT_LO) / (MELT_HI - MELT_LO);
        out.pairA = Math.max(idx + 1, 0);
        out.pairB = Math.min(idx + 2, 7);
        out.pairM = m;
      } else {
        out.pairA = 0;
        out.pairB = 0;
        out.pairM = 0;
      }

    },

    presence(ctx: SceneCtx) {
      return ctx.ch.on;
    },

    tick(ctx: SceneCtx) {
      const aspect = ctx.aspect;
      if (Math.abs(aspect - cachedAspect) > 0.02) {
        cachedAspect = aspect;
        // S3's liquid lives right of the copy column on wide stages
        const sCx = 0.5 + Math.min(0.14 * aspect, Math.max(aspect / 2 - 0.34, 0));
        // services placement: beside the copy on wide stages; BELOW it (smaller,
        // lower half) on narrow ones — legibility is first-class everywhere
        const wide = aspect >= 1.4;
        svcOx = wide ? Math.min(0.15 * aspect, aspect / 2 - 0.32) : 0;
        svcOy = wide ? 0 : -0.22;
        svcScale = wide ? ORGANISM_SCALE : 0.38;
        Tclu = clusterTargets(aspect, sCx);
        Tdis = wideScatter(aspect, sCx, 0.5, 0.85);
        Teco = wideScatter(aspect, 0.5, 0.5, 1);
      }
      const dt = ctx.dt;
      const ch = ctx.ch;
      const k = 1 - Math.exp(-dt / PHYS.TAU_CHANNEL);

      // pair melt: snap on pair switch (rest boundaries render the same exact
      // form on both readings), damp otherwise — self-managed on RAW channels
      pa = ch.pairA | 0;
      pb = ch.pairB | 0;
      const pairKey = pa + "-" + pb;
      const mRaw = clamp01(ch.pairM);
      if (pairKey !== lastPair) {
        lastPair = pairKey;
        mState = mRaw;
      } else {
        mState += (mRaw - mState) * k;
      }

      hp = clamp01(ch.heroPhase);
      F = smooth01(clamp01(ch.fracture));
      TR = smooth01(clamp01(ch.travel));
      const c = clamp01(ch.converge);
      grow = clamp01(ch.grow);
      SP = smooth01(clamp01(ch.svcPos));
      EXW = 1 - smooth01(clamp01(ch.exit));
      jScale = ORGANISM_SCALE + (svcScale - ORGANISM_SCALE) * SP;
      jOx = svcOx * SP;
      jOy = svcOy * SP;
      const inServices = pa !== pb || pa > 0;
      inSvcMelt = pa !== pb && mState > 0.0005 && mState < 0.9995;
      hOx = ch.heroOx;
      hOy = ch.heroOy;
      hScale = ch.heroScale;

      // ── hero machine tick ──────────────────────────────────────────────────
      const atHero = hp < 0.04;
      if (hPhase === "melt") {
        hMorphT += dt;
        if (hMorphT >= DURATIONS.morph) {
          hState = hTarget;
          hPhase = "rest";
          hDwell = 0;
          cbs.onHeroActive?.(hState - 1);
        }
      }
      const man = ch.heroManual < 0 ? null : ch.heroManual | 0;
      if (hPhase === "rest") {
        if (man != null && man !== hState && texReady[man]) {
          startMelt(man);
        } else if (hQueued >= 0 && hQueued !== hState && texReady[hQueued]) {
          const q = hQueued;
          hQueued = -1;
          startMelt(q);
        } else if (man == null && ch.heroPlay > 0.5 && !(ch.heroHover > 0.5) && atHero) {
          hDwell += dt;
          const next = (hState + 1) % STATE_COUNT;
          if (hDwell >= ch.heroDwellMs && texReady[next]) startMelt(next);
        }
      } else if (man != null && man !== hTarget) {
        hQueued = man; // retarget applies on arrival (no snap)
      }

      // ── gooey cursor (hero only; presence drains as the hero pours out) ────
      const cGoal = ch.heroCursorOn > 0.5 && atHero ? 1 : 0;
      if (cursorOn > 0.003 || cGoal > 0) {
        const goalMul =
          hPhase === "rest" && hState === 0 ? CURSOR_INFLUENCE_MARK : 1;
        markMul += (goalMul - markMul) * (1 - Math.exp(-dt / 160));
        cursorOn += (cGoal - cursorOn) * (1 - Math.exp(-dt / (cGoal ? 110 : 60)));
        if (cursorOn < 0.01 && cGoal > 0) {
          for (const d of drops) {
            d.x = ch.heroPx;
            d.y = ch.heroPy;
          } // materialise AT the pointer (no fly-in)
        }
        const ck = 1 - Math.pow(1 - CURSOR_SMOOTH, dt / 16.7);
        const ckt = 1 - Math.pow(1 - CURSOR_SMOOTH * 0.7, dt / 16.7);
        drops[0].x += (ch.heroPx - drops[0].x) * ck;
        drops[0].y += (ch.heroPy - drops[0].y) * ck;
        for (let i = 1; i < HERO_DROPS; i++) {
          drops[i].x += (drops[i - 1].x - drops[i].x) * ckt;
          drops[i].y += (drops[i - 1].y - drops[i].y) * ckt;
        }
      } else cursorOn = 0;

      // ── hero presence (the pour) + form-slot ownership ─────────────────────
      // The resting form erodes thin-edges-first across heroPhase 0.04 → 0.62;
      // its droplets emerge on the footprint and stream to the journey.
      const heroQ = 1 - smooth01((hp - 0.04) / 0.58);
      const [heroW, heroE] = formPresence(heroQ);
      const meltP = clamp01(hMorphT / DURATIONS.morph);
      const meltEnv = hPhase === "melt" ? Math.sin(Math.PI * meltP) : 0;

      let warp =
        SDF_WARP_REST +
        Math.min(Math.abs(ctx.scrollVel) * 0.003, 0.004); // scroll agitates

      if (heroW > 0.002) {
        // hero owns the form slots (journey form weight is 0 out here)
        formOut.ox = hOx;
        formOut.oy = hOy;
        formOut.scale = hScale;
        if (hPhase === "melt") {
          const ph = formPhase(meltP);
          formOut.a = hState;
          formOut.b = hTarget;
          formOut.fa = ph.wA * heroW;
          formOut.fb = ph.wB * heroW;
          formOut.ea = ph.eA + heroE;
          formOut.eb = ph.eB + heroE;
          warp += (SDF_WARP_MORPH - SDF_WARP_REST) * meltEnv;
        } else {
          formOut.a = hState;
          formOut.b = hState;
          formOut.fa = heroW;
          formOut.fb = 0;
          formOut.ea = heroE;
          formOut.eb = 0;
        }
      } else {
        formOut.ox = jOx;
        formOut.oy = jOy;
        formOut.scale = jScale;
        if (inServices) {
          formOut.a = pa;
          formOut.b = pb;
          if (pa === pb) {
            // degenerate pair (last pillar) — a solid rest, never a weight dip
            formOut.fa = 1;
            formOut.fb = 0;
            formOut.ea = 0;
            formOut.eb = 0;
          } else {
            const ph = formPhase(mState);
            formOut.fa = ph.wA;
            formOut.fb = ph.wB;
            formOut.ea = ph.eA;
            formOut.eb = ph.eB;
            warp +=
              (SDF_WARP_MORPH - SDF_WARP_REST) * Math.sin(Math.PI * mState);
          }
        } else {
          // the mark emerges only at full convergence — never while dispersed
          const [w, e] = formPresence(convergeEnvelopes(1 - c).q);
          formOut.a = 0;
          formOut.b = 0;
          formOut.fa = w;
          formOut.fb = 0;
          formOut.ea = e;
          formOut.eb = 0;
        }
        // exit: the form erodes away before the sticky layer unsticks
        const exE = smooth01(clamp01(ch.exit));
        formOut.fa *= 1 - exE;
        formOut.fb *= 1 - exE;
        formOut.ea += exE * SDF_MELT_ERODE;
        formOut.eb += exE * SDF_MELT_ERODE;
      }
      formOut.warp = warp;

      // ── per-droplet shared factors ──────────────────────────────────────────
      heroBridge = false;
      if (hPhase === "melt" && heroW > 0.002) {
        packBridge(scratch, 0, CLOUDS[hState], CLOUDS[hTarget], perm, stag, meltP);
        heroBridge = true;
      }
      pourR = smooth01((hp - 0.05) / 0.3); // droplets emerge as the form erodes
      // loose liquid drags with the scroll (bounded — a flick stirs, never flings)
      stirY = Math.max(-2.2, Math.min(2.2, ctx.scrollVel)) * PHYS.STIR;
      convP = 1 - c;
      const env = convergeEnvelopes(convP);
      rEnv = env.rEnv;
      shed = env.shed;
      sx = ecoSpreadX(aspect);

      // ambient calm — always alive, calmer where a composition must read
      ambW = (1 - 0.5 * smooth01(c) * (1 - SP)) * (1 - 0.35 * SP) * EXW;
    },

    target(i: number, ctx: SceneCtx, out: DropletOut) {
      const t = ctx.t;
      const aspect = ctx.aspect;
      const bb = base[i];
      // hero-side target
      let hx: number;
      let hy: number;
      let hr: number;
      if (heroBridge) {
        hx = scratch[i * 3];
        hy = scratch[i * 3 + 1];
        hr = scratch[i * 3 + 2];
      } else {
        hx = bb[0];
        hy = bb[1];
        hr = bb[2] * pourR * (0.55 + 0.45 * VARY[i]);
      }
      // stage into field space
      hx = 0.5 + hOx + (hx - 0.5) * hScale;
      hy = 0.5 + hOy + (hy - 0.5) * hScale;
      hr *= hScale;

      // journey-side target: clusters → dispersed (S3) → the eco field
      let bindJ = 0; // journey-side bind (exactness of the current regime)
      let clusJ = -1; // cohesion group (the fracture's unstable chunks)
      const clu = Tclu[i],
        dis = Tdis[i],
        eco = Teco[i];
      let tx = clu.tx + (dis.tx - clu.tx) * F;
      let ty = clu.ty + (dis.ty - clu.ty) * F;
      tx += (eco.tx - tx) * TR;
      ty += (eco.ty - ty) * TR;
      // converge home: the organism's cloud (centred, scaled, services drift)
      const hx2 = 0.5 + jOx + (bb[0] - 0.5) * jScale;
      const hy2 = 0.5 + jOy + (bb[1] - 0.5) * jScale;
      const lt = smooth01((convP - (0.16 + 0.3 * dis.key)) / 0.5);
      // landed at the converge home = exact under the form; loose = free liquid
      bindJ = 1 - lt;
      // the fracture's unstable CHUNKS cohere like liquid until the field
      // fully disperses / travels — the same anchor pick as clusterTargets
      if (TR < 0.6 && F < 0.85 && lt > 0.5)
        clusJ = Math.min((hash(i, 11) * 4) | 0, 3);
      const drift = PHYS.DRIFT * lt;
      let jx = hx2 + (tx - hx2) * lt + drift * Math.sin(t * dis.f1 + i * 1.7);
      let jy =
        hy2 +
        (ty - hy2) * lt +
        drift * Math.cos(t * dis.f2 + i * 2.3) +
        stirY * lt; // loose liquid drags with the scroll; landed liquid holds
      const vary = 1 + (VARY[i] - 1) * lt; // size spread while loose
      let jr = bb[2] * jScale * (1 - 0.28 * lt) * rEnv * shed * vary;
      if (inSvcMelt) {
        // the §3.3 services bridge is the journey target while melting
        const A = CLOUDS[pa],
          B = CLOUDS[pb];
        const pm = permFor(pa, pb),
          st = STAG[pa];
        const lm = clamp01(mState * (1 + STAGGER) - STAGGER * st[i]);
        const tp = arrive(lm);
        const trr = arrive(clamp01(lm * RADIUS_LEAD));
        const aa = A[i],
          bb2 = B[pm[i]];
        const rEnvM = bridgeRadiusEnvelope(mState);
        jx = 0.5 + jOx + (aa[0] + (bb2[0] - aa[0]) * tp - 0.5) * jScale;
        jy = 0.5 + jOy + (aa[1] + (bb2[1] - aa[1]) * tp - 0.5) * jScale;
        jr = (aa[2] + (bb2[2] - aa[2]) * trr) * rEnvM * jScale;
        bindJ = 1; // the §3.3 bridge is analytic-exact — physics hands off
        clusJ = -1;
      } else if (i < 40) {
        // tendrils: the same droplets feed the capabilities once resolved
        const nIdx = i % 10;
        const e = (1 - SP) * smooth01((grow - nIdx * 0.055) / 0.32);
        if (e > 0.001) {
          const node = ECO_NODES[nIdx];
          const na = ((node.ang - 90) * Math.PI) / 180;
          const np = ecoNodePos(nIdx, aspect);
          const sxp = 0.5 + Math.cos(na) * sx * TENDRIL_START;
          const syp = 0.5 - Math.sin(na) * TENDRIL_START;
          const bead = (i / 10) | 0;
          let txp: number;
          let typ: number;
          let trp: number;
          if (bead === 3) {
            txp = np.x;
            typ = np.y;
            trp = 0.012;
          } else {
            // marching beads: born at the organism's edge, absorbed just
            // short of the node — a continuous outward pulse
            const fr = (bead + ((t * 0.3 + nIdx * 0.618) % 1)) / 3;
            txp = sxp + (np.x - sxp) * fr * 0.9;
            typ = syp + (np.y - syp) * fr * 0.9;
            trp = 0.015 * (0.45 + 0.55 * Math.sin(Math.PI * fr));
          }
          jx += (txp - jx) * e;
          jy += (typ - jy) * e;
          jr = jr * (1 - e) + trp * e;
          // tendril beads march exact paths — mostly protected from forces
          bindJ = Math.max(bindJ, e * 0.9);
          if (e > 0.3) clusJ = -1;
        }
      }

      // the pour: hero side ⟶ journey side, each droplet on its own schedule
      const li = smooth01((hp - 0.08 - 0.42 * hash(i, 15)) / 0.44);
      out.x = hx + (jx - hx) * li;
      out.y = hy + (jy - hy) * li;
      out.r = (hr + (jr - hr) * li) * EXW;
      // physics attributes (R5-B): the hero side is analytic-exact (rest
      // footprint / §3.3 bridge); looseness grows through the pour and lands
      // at the journey regime's own exactness
      out.bind = 1 - li * (1 - bindJ);
      out.cluster = li > 0.6 ? clusJ : -1;
      out.z = 0;
    },

    form() {
      return formOut;
    },

    ambient() {
      return ambW;
    },

    extras(ctx: SceneCtx, push) {
      // cursor chain (hero only)
      if (cursorOn > 0.003) {
        const cw = cursorOn * markMul * (1 - smooth01(hp * 3));
        for (let j = 0; j < HERO_DROPS; j++) {
          const r = CURSOR_R * Math.pow(0.58, j) * cw;
          if (r < 0.002) continue;
          push(drops[j].x, drops[j].y, r);
        }
      }
    },
  };
}
