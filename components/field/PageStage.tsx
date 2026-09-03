"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { useInView } from "@/lib/animation/use-in-view";
import {
  detectFieldTier,
  setFieldTier,
  type FieldTier,
} from "@/lib/webgl/field-tier";
import { clamp01, smooth01 } from "@/lib/webgl/field-drivers";
import {
  GATHER_N,
  GATHER_SYSTEMS,
  SYS_OF_NODE,
  gatherTiming,
  systemTiming,
  arrivalPulse,
  fuse as gatherFuse,
} from "@/lib/webgl/gathering.mjs";
import { makeConductor } from "@/lib/webgl/conductor.mjs";
import { N } from "@/lib/webgl/phys.mjs";
import { SDF_BALL_CAP_TILED } from "@/lib/webgl/sdf-glass-shader.mjs";

import {
  FLUID_OBSTACLE_MAX,
  FLUID_OBSTACLE_STRIDE,
} from "@/lib/webgl/fluid-core.mjs";
import type {
  SceneChannels,
  SceneGeom,
  SceneModule,
} from "@/lib/webgl/scenes/types";
import { makeSiteScene } from "@/lib/webgl/scenes/site";
import { makeMethodScene } from "@/lib/webgl/scenes/method";
import { makeWorkScene } from "@/lib/webgl/scenes/work";
import { makeOriginScene } from "@/lib/webgl/scenes/origin";
import { makeStudioScene } from "@/lib/webgl/scenes/studio";
import { makeContactScene, EXHALE_EVENT } from "@/lib/webgl/scenes/contact";
import { makeFooterScene } from "@/lib/webgl/scenes/footer";
import { CinematicVeils } from "./CinematicVeils";
import { tickOriginClock, stopOriginClock } from "@/lib/animation/origin-clock";

// the unified liquid field is client-only (WebGL2) → lazy, no SSR.
const FieldStage = dynamic(() => import("@/components/field/FieldStage"), {
  ssr: false,
});

export type EcoNode = { name: string; tooltip: string };

// The v3 review path lets free liquid acknowledge a deliberately small set of
// business-critical reading surfaces. Bounds are cached outside the frame
// loop; weight controls influence without changing the authored composition.
//
// The one exception is S7's beat copy (ORIGIN_SURFACES, below): it sits in
// sticky frames, so its document position is wrong for exactly the frames
// that matter — the cache would hold where a band sat UNPINNED, and the
// vapour streamed straight through the purpose statement while a phantom
// rect a screen away pushed it about. Those are read live, while the chapter
// is on stage.
const FLOW_OBSTACLES = [
  ["#hero .lab-headline", 1],
  ["#hero .lab-sub", 0.72],
  ["#problem .type-section-title", 0.9],
  ["#ecosystem .type-section-title", 0.82],
  ["#services .type-section-title", 0.9],
  ["#method .type-section-title", 0.82],
  ["#work .type-section-title", 0.82],
  // S7 (R7): the chapter's opening block is in normal flow, so it caches
  // like any other surface. The beat copy is NOT — it lives in bands that
  // pin — and is measured live in applyObstacleFlow (ORIGIN_SURFACES).
  ["#name .origin-headline", 0.9],
  ["#name .origin-open", 0.7],
  ["#studio .type-feature-title", 0.72],
  ["#contact .type-section-title", 0.9],
  ["#contact .contact-form", 1],
] as const;

// S7's pinned reading surfaces — measured per frame while the chapter is on
// stage (see FLOW_OBSTACLES). Whole copy blocks rather than single lines, so
// the vapour and the free beads flow AROUND a band's type instead of between
// its lines. The resolve band is not listed: the vapour must enter it to
// spell the name, and the closing line below the name has its own entry.
const ORIGIN_SURFACES = [
  ['#name .origin-copy:not([data-beat="resolve"])', 0.9],
  ["#name .origin-closing", 0.72],
] as const;

/**
 * Simulated droplets per authored one (R6).
 *
 * The authored population is 48 — what every form SVG is packed to and what the
 * scenes address. Ranks above the first are MOTES: ordinary droplets whose
 * targets are derived from a host's (lib/webgl/motes.mjs), so the whole crowd
 * inherits every composition without a scene knowing it exists.
 *
 * 8 ranks is 384 simulated droplets. Measured cost on this machine: 0.69 ms of
 * conductor step plus 0.11 ms of tile binning per frame, against ~8 ms of GPU —
 * so the population is a GPU decision, and the renderer's rung ladder is what
 * actually spends it (RUNG_POP in FieldStage). A probe-lite machine allocates
 * less rather than allocating everything and immediately shedding it.
 *
 * The lite figure is deliberately not timid. The probe (field-tier.ts) measures
 * the OLD field shader — a full 48-ball uniform-array loop — so it is scoring a
 * cost model the tiled renderer no longer has, and it classifies this dev
 * machine lite. A lite machine also opens on the `rigid` rung, where RUNG_POP is
 * 0.5, so the ranks here are halved again before anything is drawn: at 3 that
 * left 24 motes over 48 hosts, which is indistinguishable from none. Measured on
 * that machine at that rung: 10.2 ms median, 16.9 ms p90 — headroom the ladder
 * will take back on its own if the machine turns out not to have it.
 */
const MOTE_RANKS = { full: 8, lite: 5 } as const;

function makeJourneyRuntime(
  search: URLSearchParams | null,
  tier: FieldTier | null,
) {
  // journey order: site → método → work → origin → studio → contact →
  // footer — the R5-D scenes fill what were the liquid-dead bands.
  // The Hero stream is rendered by components/hero/HeroRibbon. The page field
  // begins its work as the Hero leaves for The Problem.
  const scenes: SceneModule[] = [
    makeSiteScene(),
    makeMethodScene(),
    makeWorkScene(),
    makeOriginScene(),
    makeStudioScene(),
    makeContactScene(),
    makeFooterScene(),
  ];
  // ?fphys=0 routes the legacy low-pass integrator (A/B + escape hatch).
  // v3 forces (area-weighted mass, local viscosity, the cohesive band that
  // stands in for surface tension) and type-aware flow are now the material's
  // default behaviour rather than a review path — they are what makes separated
  // beads read as one substance instead of independent discs. ?fphysv3=0 and
  // ?fobstacles=0 roll each back independently.
  // ?fcine=0 keeps the light score neutral (no veils or score grade).
  // ?fstrike=0 keeps the hand but removes the click: the strike wave, its
  // crown of spray and the press gain all go, hover physics stays. One flag
  // per force, the same rollback grammar as the rest of R5-B.
  const physics = search?.get("fphys") !== "0";
  const physicsV3 = physics && search?.get("fphysv3") !== "0";
  const obstacleFlow = physicsV3 && search?.get("fobstacles") !== "0";
  const strike = physics && search?.get("fstrike") !== "0";
  // ?fformtouch=<n> is a live multiplier on the FORMS' response, not just an
  // on/off. Three owner rounds went into that one number, and each cost a
  // rebuild; a URL is the right granularity for a taste dial.
  const formTouchRaw = search?.get("fformtouch");
  const formGainParsed = formTouchRaw === null || formTouchRaw === undefined
    ? 1
    : Number(formTouchRaw);
  const formGain =
    Number.isFinite(formGainParsed) && formGainParsed >= 0 ? formGainParsed : 1;
  const cine = search?.get("fcine") !== "0";
  // ?fmotes=<ranks> — the population, in droplets per authored droplet. 1 is
  // the pre-R6 system exactly: no motes, and every array, loop and force in the
  // conductor and the fluid core identical to what they were. ?ftemper=<0…1>
  // is the other half of the rollback: 0 restores pre-R6 MOTION (the shared
  // curl with no per-droplet character) while leaving the population alone, so
  // the two halves of R6 can be judged apart.
  const ranksRaw = search?.get("fmotes");
  const ranksParsed = ranksRaw === null || ranksRaw === undefined
    ? (tier === "lite" ? MOTE_RANKS.lite : MOTE_RANKS.full)
    : Number(ranksRaw);
  const ranks =
    Number.isFinite(ranksParsed) && ranksParsed >= 1
      ? Math.min(Math.floor(ranksParsed), 16)
      : 1;
  // ?fleash=<n> — the neighbourhood a free droplet may wander inside instead of
  // being sprung to a point. 0 restores the pre-R6-B spring exactly, which is
  // the A/B for "is the liquid too loose"; values above 1 open it further.
  const leashRaw = search?.get("fleash");
  const leashParsed =
    leashRaw === null || leashRaw === undefined ? 1 : Number(leashRaw);
  const leash =
    Number.isFinite(leashParsed) && leashParsed >= 0 ? leashParsed : 1;
  const temperRaw = search?.get("ftemper");
  const temperParsed =
    temperRaw === null || temperRaw === undefined ? 1 : Number(temperRaw);
  const temper =
    Number.isFinite(temperParsed) && temperParsed >= 0
      ? Math.min(temperParsed, 1)
      : 1;

  return [
    makeConductor(scenes, {
      physics,
      physicsV3,
      obstacleFlow,
      strike,
      formGain,
      cine,
      // Only the tiled renderer can carry a population; on a device that falls
      // back to the uniform arrays FieldStage packs the authored 48 and the
      // motes stay simulated but undrawn. Allocating for the tier rather than
      // for the renderer keeps this one decision in one place.
      pop: tier === null ? undefined : N * ranks,
      temper,
      leash,
      ballMax: SDF_BALL_CAP_TILED,
    }),
    scenes,
    cine,
    physics ? (physicsV3 ? "v3" : "v2") : "legacy",
    obstacleFlow,
  ] as const;
}

/**
 * PageStage (R5-A) — the CONDUCTOR's shell: ONE persistent fluid renderer for
 * the ENTIRE page. One sticky full-viewport canvas under every chapter, one
 * rAF measurement loop, seven scenes (site · method · work · origin · studio ·
 * contact · footer) whose 48 droplets are the SAME 48 droplets end to end —
 * the conductor damps every
 * channel, blends per-droplet targets across scene handoffs, arbitrates the
 * two form slots (ownership transfers only through droplet-only states) and
 * packs the one shared field. No per-chapter canvases, no handoffs-as-swaps.
 *
 * DOM choreography also lives here (in the sticky layer): the gathering's
 * capability names and system markers, the origin founding-pillar labels, and
 * the method progress
 * thread (--method-flow). Deterministic layering: canvas z-0 (pointer-events
 * none), copy z-10, Ecosystem controls z-12. Reduced-motion / "none" tiers
 * render no canvas and flag the wrapper `data-liquid="static"` so every
 * chapter's static fallback shows instead.
 *
 * QA: ?feco=c freezes the S3 gathering at c ∈ [0,1]. Exact form stills live
 * on the isolated `/[locale]/lab/forms` route, not inside the homepage.
 * window.__liquid exposes the site scene's raw channels; window.__scenes
 * exposes all seven.
 */
export function PageStage({
  nodes,
  centerLabel,
  ecosystemLabel,
  systems,
  children,
}: {
  nodes: EcoNode[];
  centerLabel: string;
  ecosystemLabel: string;
  /** the three organ-system names (identity · growth · operation) */
  systems: string[];
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const [wrapRef, inView, seen] = useInView<HTMLDivElement>("400px");
  const layerRef = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState<FieldTier | null>(null);
  const [fEco, setFEco] = useState<number | null>(null);
  const [fieldReady, setFieldReady] = useState(false);
  const [ecoInteractive, setEcoInteractive] = useState(false);
  const [ecoKeyboardEnabled, setEcoKeyboardEnabled] = useState(false);
  const [openEcoNode, setOpenEcoNode] = useState<number | null>(null);
  const [hovSlot, setHovSlot] = useState(-1);
  // The most recently arrived capability keeps the explanatory note useful
  // before a visitor chooses to hover or focus a name.
  const [landedSlot, setLandedSlot] = useState(-1);
  const [ecoHost, setEcoHost] = useState<HTMLElement | null>(null);
  const nodeEls = useRef<(HTMLLIElement | null)[]>([]);
  const centerEl = useRef<HTMLSpanElement>(null);
  const systemEls = useRef<(HTMLLIElement | null)[]>([]);
  const fusedRef = useRef(0);
  const landedRef = useRef(-1);
  // THE COLUMN AS AN OBSTACLE. The type-aware flow already exists for exactly
  // this — a small set of reading surfaces free liquid is asked to respect —
  // but its geometry cache is document-relative, and the column lives in a
  // STICKY layer, so its document position moves every frame while its
  // on-screen position does not. Measured against the host instead: that
  // offset is constant, and while the chapter is pinned the host IS the
  // viewport, so one measurement holds for the whole runway.
  const ecoObstacle = useRef<{
    l: number;
    t: number;
    w: number;
    h: number;
  } | null>(null);
  const ecoObstacleOn = useRef(false);
  const ecoLayerEl = useRef<HTMLDivElement | null>(null);
  const ecoInteractiveRef = useRef(false);

  // Client components are also rendered on the server. Build an SSR-safe
  // default bundle, then replace it from the real browser query before the
  // tier probe can mount the canvas. This keeps hydration deterministic while
  // making review/rollback flags effective in production.
  const [runtime, setRuntime] = useState(() => makeJourneyRuntime(null, null));
  const [conductor, scenes, cine, physicsMode, obstacleFlow] = runtime;
  const site = conductor.raw.site;
  const enabled = !reduced && (tier === "full" || tier === "lite");

  useEffect(() => {
    setRuntime(
      makeJourneyRuntime(
        new URLSearchParams(window.location.search),
        detectFieldTier(),
      ),
    );
  }, []);

  useEffect(() => {
    setTier(detectFieldTier());
    const sp = new URLSearchParams(window.location.search);
    const fc = sp.get("feco");
    if (fc !== null) {
      const c = Number(fc);
      if (Number.isFinite(c) && c >= 0 && c <= 1) setFEco(c);
    }
  }, []);

  // Keep the focusable organism controls in Chapter Ecosystem's DOM order
  // while PageStage retains their shared choreography and geometry.
  useEffect(() => {
    setEcoHost(document.getElementById("ecosystem-interactions-host"));
  }, []);

  // Keep the desktop orbit in the document's keyboard order for the whole
  // live experience. Its visual/pointer envelope may follow the choreography,
  // but focus must never disappear merely because focusing caused a scroll.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const sync = () => setEcoKeyboardEnabled(enabled && desktop.matches);
    sync();
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, [enabled]);

  // QA visibility: the live raw channels + the merged light score (read-only
  // diagnostics for the cinematic and renderer harnesses).
  useEffect(() => {
    const w = window as unknown as {
      __liquid?: SceneChannels;
      __scenes?: Record<string, SceneChannels>;
      __cine?: { score: typeof conductor.score; stats: typeof conductor.stats };
      // the live physics input — the obstacle set is the only part of the
      // composition that is invisible in a screenshot, so it needs a way to be
      // asserted rather than eyeballed
      __flow?: typeof conductor.input;
    };
    w.__liquid = site;
    w.__scenes = conductor.raw;
    w.__cine = { score: conductor.score, stats: conductor.stats };
    w.__flow = conductor.input;
  }, [site, conductor]);

  // the exhale gesture (ContactForm dispatches on submit) → the contact scene
  useEffect(() => {
    const onExhale = () => {
      conductor.raw.contact.exhaleAt = performance.now();
    };
    window.addEventListener(EXHALE_EVENT, onExhale);
    return () => window.removeEventListener(EXHALE_EVENT, onExhale);
  }, [conductor]);

  // THE GATHERING's type no longer has a geometry problem to solve.
  //
  // Everything below used to place the chapter's type in JS: three blocks
  // positioned at their lobes' pixel heights, de-overlapped against each other
  // by a 1-D relaxation pass, clamped off the chapter-index rail, and joined to
  // their masses by ten leader lines redrawn every frame. That is a great deal
  // of machinery whose entire purpose was to stop composed type from colliding
  // with a moving body — and it still read as loose, because type that is
  // placed by a solver has no relationship to the page's own grid.
  //
  // The column is CSS. It sits in the page gutter, it does not move, and the
  // liquid has its own field beside it (gathering.mjs owns that split), so
  // there is nothing to dodge and nothing to draw a line across. All that is
  // left for JS is handing each row the timing of the mass it names — which is
  // the one thing that genuinely has to come from the liquid's own clock.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const layout = () => {
      const r = layer.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const h = r.height;
      // THE CLOCK, handed to the type. Each block and each row carries the
      // envelope of the SYSTEM or MASS it names, so a name ignites at the
      // instant its liquid lands rather than on a timer of its own. This is the
      // whole of the type's relationship to the liquid now — no placement, no
      // leaders, no collision pass. Position is the column's job and the column
      // is CSS.
      GATHER_SYSTEMS.forEach((_sys, si) => {
        const el = systemEls.current[si];
        if (!el) return;
        const t = systemTiming(si);
        el.style.setProperty("--d", String(t.d));
        el.style.setProperty("--w", String(t.w));
      });
      nodeEls.current.forEach((el, s) => {
        if (!el) return;
        const t = gatherTiming(s);
        el.style.setProperty("--d", String(t.d));
        el.style.setProperty("--w", String(t.w));
      });
      // the column's footprint inside the sticky host — one measurement, held
      // for the runway. The height is the FULL extension, not the current one:
      // an obstacle that grew with the column would push liquid around as the
      // chapter advanced, which is a force with no cause on screen.
      const host = ecoHost;
      const col = host?.querySelector<HTMLElement>(".gather-col");
      if (host && col && getComputedStyle(col).display !== "none") {
        const hb = host.getBoundingClientRect();
        const cb = col.getBoundingClientRect();
        // A standoff on the right edge, so liquid is turned before it reaches
        // the words rather than after it has already landed on one.
        //
        // And the box runs OFF-STAGE to the left. The core ejects a droplet
        // through its nearest edge, so a box that merely wrapped the column
        // pushed anything left of the column's own centreline further left —
        // a 130px traverse straight across the words to escape, against a
        // target pulling it back the other way. Droplets settled mid-word
        // exactly there. With the left edge past the viewport there is no
        // "nearest left edge" to leave by: everything is ejected right, back
        // into the field, which is also where the composition wants it.
        const STANDOFF = 44;
        const OFFSTAGE = Math.max(hb.width * 0.6, 560);
        ecoObstacle.current = {
          l: cb.left - hb.left - OFFSTAGE,
          t: cb.top - hb.top,
          w: cb.width + STANDOFF + OFFSTAGE,
          h: Math.max(cb.height, h * 0.72),
        };
      } else {
        ecoObstacle.current = null;
      }
      // The founding-pillar labels used to be positioned here, floated at fixed
      // anchors "beside the mark's lobes" and clamped into the stage. Removed:
      // photographed at the beat they annotate, the three landed as debris —
      // SOCIAL alone at the left margin, HEALTH in the top right, FINANCE
      // orphaned near the bottom, none of them touching the mark. They are a
      // composed triptych in ChapterName now, which is both the composition the
      // beat wanted and one fewer imperative layout pass per resize.
    };
    layout();
    // label widths shift when the mono face lands — re-run the edge safety
    let alive = true;
    document.fonts?.ready.then(() => alive && layout());
    const ro = new ResizeObserver(layout);
    ro.observe(layer);
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, [nodes.length, ecoHost, enabled]);

  // The system response: touching one capability answers through its SYSTEM
  // first and the rest of the body after. There is no graph to walk any more —
  // membership is the relationship the chapter is arguing for, so distance is
  // "same lobe / other lobe", and the delay makes that structure audible.
  //
  // TOUCH, not readout: this is the slot the reader is pointing at, and it must
  // stay -1 when they are pointing at nothing, because it drives the liquid's
  // rack focus. The column's readout falls back to the last ARRIVED capability
  // separately, so an idle stage still reads as instrumented.
  const activeSlot = hovSlot >= 0 ? hovSlot : (openEcoNode ?? -1);
  const readoutSlot = activeSlot >= 0 ? activeSlot : landedSlot;
  useEffect(() => {
    site.hov = activeSlot;
    const root = ecoLayerEl.current;
    if (!root) return;
    if (activeSlot < 0) {
      root.removeAttribute("data-pulse");
      return;
    }
    const HOP = 110; // ms per step outward — a readable travel, not a blink
    const activeSys = SYS_OF_NODE[activeSlot]?.si ?? -1;
    nodeEls.current.forEach((el, s) => {
      if (!el) return;
      const d = s === activeSlot ? 0 : SYS_OF_NODE[s]?.si === activeSys ? 1 : 2;
      el.style.setProperty("--pd", `${d * HOP}ms`);
    });
    systemEls.current.forEach((el, si) => {
      if (!el) return;
      el.style.setProperty("--pd", `${(si === activeSys ? 0 : 2) * HOP}ms`);
    });
    root.setAttribute("data-pulse", "true");
  }, [activeSlot, site]);

  // ── the ONE measurement loop (all scenes' channels + DOM choreography) ─────
  useEffect(() => {
    if (tier === null) return; // wait for the tier probe (static path included)
    const wrap = wrapRef.current;
    if (!wrap) return;

    const ecoDesktop = window.matchMedia("(min-width: 1024px)");
    let lastG = -1;
    let lastS = -1;
    let lastEcoDesktop = ecoDesktop.matches;
    let lastEcoInteractive = ecoInteractiveRef.current;
    const applyEcoLabels = (grow: number, svcPos: number) => {
      const desktop = ecoDesktop.matches;
      if (
        Math.abs(grow - lastG) < 0.002 &&
        Math.abs(svcPos - lastS) < 0.002 &&
        desktop === lastEcoDesktop
      )
        return;
      lastG = grow;
      lastS = svcPos;
      lastEcoDesktop = desktop;
      const fade = 1 - smooth01(svcPos);
      // The column answers as soon as it has rows to answer with. This used to
      // wait for grow >= 0.8 — the body being whole — which meant the first two
      // systems were on screen and inert for most of the runway, and the rack
      // focus (the chapter's one real interaction) was only reachable in its
      // last beat. A row is touchable once its own mass has landed; the CSS
      // envelope is what stops an unarrived row from being under the cursor.
      const interactive = enabled && desktop && grow >= 0.2 && fade >= 0.55;
      // the column only displaces liquid while it is actually on screen
      ecoObstacleOn.current = desktop && grow > 0.01 && grow < 0.999 && fade > 0.05;
      if (interactive !== lastEcoInteractive) {
        lastEcoInteractive = interactive;
        ecoInteractiveRef.current = interactive;
        if (
          !interactive &&
          !ecoLayerEl.current?.contains(document.activeElement)
        )
          setOpenEcoNode(null);
        setEcoInteractive(interactive);
      }
      // THREE vars drive the whole gathering — each label derives its own
      // envelope from --eco-grow via its inline --d/--w (one write point, the
      // same gathering.mjs timing the liquid masses use), and --eco-fuse lets
      // the names recede as the body closes: once it is one thing, naming the
      // parts is the wrong emphasis.
      const root = ecoLayerEl.current;
      if (root) {
        root.style.setProperty("--eco-grow", grow.toFixed(4));
        root.style.setProperty("--eco-fade", fade.toFixed(3));
        root.style.setProperty("--eco-fuse", gatherFuse(grow).toFixed(3));
      }
      fusedRef.current = gatherFuse(grow);
      // Per-label arrival: the pulse peaks exactly as its mass lands, so the
      // name ignites on the arrival rather than on a timer of its own.
      nodeEls.current.forEach((el, s) => {
        if (!el) return;
        el.style.setProperty("--pulse", arrivalPulse(s, grow).toFixed(3));
      });
      // Keep the note aligned with the most recent arrival. This changes only
      // ten times across the runway, not on every rendered frame.
      let last = -1;
      for (let s = 0; s < GATHER_N; s++) {
        const t = gatherTiming(s);
        if (grow >= t.d + t.w * 0.6) {
          if (last < 0 || gatherTiming(last).d < t.d) last = s;
        }
      }
      if (last !== landedRef.current) {
        landedRef.current = last;
        setLandedSlot(last);
      }
    };
    // WHERE a custom property is written is a performance decision, not a
    // stylistic one. Every var below used to be set on `wrap` — the element
    // that contains the entire page — and a custom property written on an
    // ancestor invalidates style for everything that inherits from it. Four of
    // them move every frame, so the page paid a full-document style recalc per
    // frame to animate three fixed overlays and one hairline: measured in a
    // devtools trace of a coasting scroll, ~1.6 ms/frame in UpdateLayoutTree,
    // on a frame budget of 6.9 ms.
    //
    // Each of these has exactly ONE consumer in the stylesheet, so each is
    // written on that consumer instead and the invalidation stops there. If a
    // target is absent (a static tier renders no veils) the write is simply
    // skipped — nothing reads the value in that case either.
    const methodRunway =
      wrap.querySelector<HTMLElement>(".method-runway") ?? wrap;
    let lastFlow = -1;
    const applyMethodFlow = (flow: number) => {
      if (Math.abs(flow - lastFlow) < 0.004) return;
      lastFlow = flow;
      methodRunway.style.setProperty("--method-flow", flow.toFixed(4));
    };
    // S7's DAWN — the one place on the site where the GROUND moves. The origin
    // scene's own p drives two consumers and no others: `.journey-dawn` (the
    // horizon sheet behind the canvas) and `.origin-journey` (the horizon wipe
    // that arrives and releases every block of chapter copy, replacing the
    // thirteen independent fade-ups the chapter used to run).
    //
    // Two targets, not one on `wrap`, for the reason the block above gives: a
    // custom property written on an ancestor invalidates style for everything
    // that inherits from it, and these move every frame. `.origin-journey` is
    // a bounded subtree (five beats), and the dawn sheet has no descendants at
    // all beyond its two pseudo-elements.
    //
    // `--origin-scrub` is raised to 1 once, HERE, and nowhere else. It is the
    // switch the CSS defaults hang on: every path that does not reach this
    // loop — static tiers, reduced motion, the hero QA still, the ?feco hold,
    // pre-hydration, JS-off — leaves it at 0, which resolves the copy masks
    // fully open and the dawn fully closed. Content is never hidden behind
    // motion (rule #13) without a branch having to remember to say so.
    const dawnEls = [
      wrap.querySelector<HTMLElement>(".journey-dawn"),
      wrap.querySelector<HTMLElement>(".origin-journey"),
    ].filter((el): el is HTMLElement => el !== null);
    let lastOriginP = -1;
    let lastOriginOn = -1;
    let lastOriginLead = -1;
    const applyOriginDawn = (p: number, on: number, lead: number) => {
      const pMoved = Math.abs(p - lastOriginP) >= 0.0015;
      const onMoved = Math.abs(on - lastOriginOn) >= 0.004;
      const leadMoved = Math.abs(lead - lastOriginLead) >= 0.004;
      if (!pMoved && !onMoved && !leadMoved) return;
      if (pMoved) lastOriginP = p;
      if (onMoved) lastOriginOn = on;
      if (leadMoved) lastOriginLead = lead;
      for (const el of dawnEls) {
        if (pMoved) el.style.setProperty("--origin-p", p.toFixed(4));
        if (onMoved) el.style.setProperty("--origin-on", on.toFixed(3));
      }
      // R7: the same clock, handed to the chapter's DIRECTOR — the GSAP master
      // timeline that choreographs S7's copy (components/chapters/
      // OriginDirector.tsx). One measurement, three readers: the liquid, the
      // dawn, the type. The director scrubs; it never measures.
      tickOriginClock(p, on, lead);
    };
    // R5-D: the merged light score → the veil CSS vars, once per frame (the
    // conductor mutates `score` inside driver.frame from the render loop;
    // reading it here is at most one frame behind — invisible at veil speeds)
    const veils = wrap.querySelector<HTMLElement>(".cine-veils");
    let lastVeil = -1;
    let lastVig = -1;
    const applyScore = () => {
      if (!veils) return;
      const s = conductor.score;
      if (Math.abs(s.veil - lastVeil) > 0.002) {
        lastVeil = s.veil;
        veils.style.setProperty("--cine-veil", s.veil.toFixed(3));
      }
      if (Math.abs(s.vignette - lastVig) > 0.002) {
        lastVig = s.vignette;
        veils.style.setProperty("--cine-vig", s.vignette.toFixed(3));
      }
    };

    // static paths / deterministic QA hold
    if (!enabled || fEco !== null) {
      const c = fEco ?? 1;
      site.heroPhase = 1;
      site.fracture = 1;
      site.travel = 1;
      // ?feco=c freezes the gathering at c — one clock now, so the QA hold is
      // simply that clock rather than two derived windows
      site.gather = c;
      site.svcPos = 0;
      site.pairA = 0;
      site.pairB = 0;
      site.pairM = 0;
      site.exit = 0;
      conductor.input.vel = 0;
      applyEcoLabels(site.gather, 0);
      // static thread reads full (scoped to its own consumer, as above)
      methodRunway.style.setProperty("--method-flow", "1");
      // NOTE: --origin-scrub is deliberately NOT raised here. This branch never
      // reaches the per-frame loop, so leaving the switch at its registered 0
      // is what gives the deterministic surfaces plain readable S7 copy on pure
      // ink — no half-driven mask, no dawn frozen mid-sweep. The director is
      // told the same thing: a clock that never ticks never hides copy.
      stopOriginClock();
      return;
    }

    // The live runway owns S7's clock from here down. Raising the switch after
    // the early return is the whole contract: only a loop that will actually
    // keep writing --origin-p is allowed to turn the masks on.
    for (const el of dawnEls) el.style.setProperty("--origin-scrub", "1");

    // scene-anchor element caches (queried once — the DOM is stable post-
    // hydration; every chapter renders inside this wrapper)
    const geoms = scenes.map((sc) => {
      const anchorEls = new Map<string, HTMLElement | null>();
      for (const [key, sel] of Object.entries(sc.anchors ?? {}))
        anchorEls.set(key, document.querySelector(sel));
      const listEls = new Map<string, HTMLElement[]>();
      const listRects = new Map<string, DOMRect[]>();
      for (const [key, sel] of Object.entries(sc.lists ?? {})) {
        const els = Array.from(wrap.querySelectorAll<HTMLElement>(sel));
        listEls.set(key, els);
        listRects.set(key, new Array<DOMRect>(els.length));
      }
      const g: SceneGeom = {
        vh: 0,
        vw: 0,
        scrollY: 0,
        rect: (key) => anchorEls.get(key)?.getBoundingClientRect() ?? null,
        list: (key) => {
          const els = listEls.get(key) ?? [];
          const rects = listRects.get(key) ?? [];
          for (let i = 0; i < els.length; i++)
            rects[i] = els[i].getBoundingClientRect();
          return rects;
        },
      };
      return g;
    });
    const methodPhases = Math.max(
      wrap.querySelectorAll("#method .method-phase").length - 1,
      1,
    );

    // Physics-v3 obstacle source geometry is document-relative and refreshed
    // only when layout can change. The rAF path merely translates cached
    // bounds into the fixed field, avoiding getBoundingClientRect/layout work.
    const obstacleDoc = new Float32Array(
      FLUID_OBSTACLE_MAX * FLUID_OBSTACLE_STRIDE,
    );
    const obstacleSources = obstacleFlow
      ? FLOW_OBSTACLES.map(([selector, weight]) => ({
          el: wrap.querySelector<HTMLElement>(selector),
          weight,
        }))
      : [];
    const originSurfaces = obstacleFlow
      ? ORIGIN_SURFACES.flatMap(([selector, weight]) =>
          Array.from(wrap.querySelectorAll<HTMLElement>(selector)).map(
            (el) => ({ el, weight }),
          ),
        )
      : [];
    let obstacleDocCount = 0;
    const cacheObstacleGeometry = () => {
      obstacleDocCount = 0;
      if (!obstacleFlow) return;
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      for (let i = 0; i < obstacleSources.length; i++) {
        const source = obstacleSources[i];
        if (!source.el || obstacleDocCount >= FLUID_OBSTACLE_MAX) continue;
        const rect = source.el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        const off = obstacleDocCount * FLUID_OBSTACLE_STRIDE;
        obstacleDoc[off] = rect.left + scrollX;
        obstacleDoc[off + 1] = rect.top + scrollY;
        obstacleDoc[off + 2] = rect.width;
        obstacleDoc[off + 3] = rect.height;
        obstacleDoc[off + 4] = source.weight;
        obstacleDocCount++;
      }
    };
    cacheObstacleGeometry();
    let obstacleRefresh = 0;
    let obstacleDisposed = false;
    const queueObstacleGeometry = () => {
      if (!obstacleFlow || obstacleDisposed || obstacleRefresh) return;
      obstacleRefresh = window.requestAnimationFrame(() => {
        obstacleRefresh = 0;
        cacheObstacleGeometry();
      });
    };
    const obstacleResize = obstacleFlow
      ? new ResizeObserver(queueObstacleGeometry)
      : null;
    for (const source of obstacleSources)
      if (source.el) obstacleResize?.observe(source.el);
    if (obstacleFlow)
      window.addEventListener("resize", queueObstacleGeometry, {
        passive: true,
      });
    let obstacleWarmup = 0;
    if (obstacleFlow) {
      obstacleWarmup = window.setTimeout(cacheObstacleGeometry, 1400);
      void document.fonts?.ready.then(queueObstacleGeometry);
    }

    const applyObstacleFlow = (
      vh: number,
      vw: number,
      md: number,
      y: number,
    ) => {
      if (!obstacleFlow) {
        conductor.input.obstacleCount = 0;
        return;
      }
      const out = conductor.input.obstacles;
      const scrollX = window.scrollX;
      const overscan = Math.min(vh * 0.14, 120);
      const padding = Math.min(Math.max(md * 0.018, 12), 24);
      let count = 0;
      for (let i = 0; i < obstacleDocCount && count < FLUID_OBSTACLE_MAX; i++) {
        const src = i * FLUID_OBSTACLE_STRIDE;
        const left = obstacleDoc[src] - scrollX;
        const top = obstacleDoc[src + 1] - y;
        const width = obstacleDoc[src + 2];
        const height = obstacleDoc[src + 3];
        if (top + height < -overscan || top > vh + overscan) continue;
        const dst = count * FLUID_OBSTACLE_STRIDE;
        out[dst] = 0.5 + (left + width * 0.5 - vw * 0.5) / md;
        out[dst + 1] = 0.5 - (top + height * 0.5 - vh * 0.5) / md;
        out[dst + 2] = (width * 0.5 + padding) / md;
        out[dst + 3] = (height * 0.5 + padding) / md;
        out[dst + 4] = obstacleDoc[src + 4];
        count++;
      }
      // THE COLUMN. Viewport-fixed while the chapter is pinned, so it is
      // appended directly rather than translated out of document space. This
      // is what finally keeps beads off the type: the field edge decides where
      // liquid is PULLED, and free physics was still carrying a few droplets
      // across the gap. Now the type displaces them, which is also the better
      // effect — the words push the liquid aside instead of being under it.
      const eco = ecoObstacle.current;
      if (eco && ecoObstacleOn.current && count < FLUID_OBSTACLE_MAX) {
        const dst = count * FLUID_OBSTACLE_STRIDE;
        out[dst] = 0.5 + (eco.l + eco.w * 0.5 - vw * 0.5) / md;
        out[dst + 1] = 0.5 - (eco.t + eco.h * 0.5 - vh * 0.5) / md;
        out[dst + 2] = (eco.w * 0.5 + padding) / md;
        out[dst + 3] = (eco.h * 0.5 + padding) / md;
        // Weight is a multiplier on the avoidance acceleration, and this
        // surface needs more of it than a headline does. The others are single
        // lines that free liquid crosses in under a second; this is a
        // full-height column that liquid would otherwise SETTLE on, and at
        // weight 1 the push lost to curl and repulsion often enough to leave a
        // bead sitting on a word. Raising it here rather than raising
        // FLUID.OBSTACLE_A keeps every other chapter's flow untouched.
        out[dst + 4] = 2.6;
        count++;
      }
      // S7's BANDS. Read live — five rects at most, taken after the scroll
      // read and before any DOM write, so they force no layout the scene's
      // own reads would not have forced — and only while the chapter is on
      // stage, which the previous frame's channel already knows.
      if (conductor.raw.origin.on > 0.01) {
        for (
          let i = 0;
          i < originSurfaces.length && count < FLUID_OBSTACLE_MAX;
          i++
        ) {
          const r = originSurfaces[i].el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) continue;
          if (r.bottom < -overscan || r.top > vh + overscan) continue;
          const dst = count * FLUID_OBSTACLE_STRIDE;
          out[dst] = 0.5 + (r.left + r.width * 0.5 - vw * 0.5) / md;
          out[dst + 1] = 0.5 - (r.top + r.height * 0.5 - vh * 0.5) / md;
          out[dst + 2] = (r.width * 0.5 + padding) / md;
          out[dst + 3] = (r.height * 0.5 + padding) / md;
          out[dst + 4] = originSurfaces[i].weight;
          count++;
        }
      }
      conductor.input.obstacleCount = count;
    };

    const canHover =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    // the work meniscus (R5-D): delegated hover over the project cards → the
    // work scene's raw `hov` channel (index into its measured card list —
    // both sides query the same selector, so the order matches)
    const workSec = document.getElementById("work");
    const workCards = workSec
      ? Array.from(workSec.querySelectorAll<HTMLElement>(".zw-card"))
      : [];
    const workCardFrom = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLElement>(".zw-card")
        : null;
    const setWorkCard = (card: HTMLElement | null) => {
      conductor.raw.work.hov = card ? workCards.indexOf(card) : -1;
    };
    let workHoverCard: HTMLElement | null = null;
    let workFocusCard: HTMLElement | null = null;
    let workTouchCard: HTMLElement | null = null;
    const syncWorkCard = () => {
      setWorkCard(workFocusCard ?? workTouchCard ?? workHoverCard);
    };
    const onWorkOver = (e: PointerEvent) => {
      workHoverCard = workCardFrom(e.target);
      syncWorkCard();
    };
    const onWorkOut = () => {
      workHoverCard = null;
      syncWorkCard();
    };
    const onWorkFocusIn = (e: FocusEvent) => {
      workFocusCard = workCardFrom(e.target);
      syncWorkCard();
    };
    const onWorkFocusOut = (e: FocusEvent) => {
      workFocusCard = workCardFrom(e.relatedTarget);
      syncWorkCard();
    };
    let workTouchRelease = 0;
    const onWorkPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
      if (workTouchRelease) window.clearTimeout(workTouchRelease);
      workTouchCard = workCardFrom(e.target);
      syncWorkCard();
    };
    const releaseWorkTouch = (e: PointerEvent) => {
      if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
      if (workTouchRelease) window.clearTimeout(workTouchRelease);
      workTouchRelease = window.setTimeout(() => {
        workTouchCard = null;
        syncWorkCard();
      }, 420);
    };
    if (canHover && workSec && workCards.length > 0) {
      workSec.addEventListener("pointerover", onWorkOver, { passive: true });
      workSec.addEventListener("pointerleave", onWorkOut);
    }
    if (workSec && workCards.length > 0) {
      workSec.addEventListener("focusin", onWorkFocusIn);
      workSec.addEventListener("focusout", onWorkFocusOut);
      workSec.addEventListener("pointerdown", onWorkPointerDown, {
        passive: true,
      });
      workSec.addEventListener("pointerup", releaseWorkTouch, {
        passive: true,
      });
      workSec.addEventListener("pointercancel", releaseWorkTouch, {
        passive: true,
      });
    }

    // page-wide pointer → the cursor force field (R5-B) and the strike.
    // Field uv + velocity; velocity decays in the rAF loop so a resting hand
    // stops dragging the liquid.
    let lastPT = 0;
    let lastPX = 0.5;
    let lastPY = 0.5;
    let pressing = false;
    const pageUv = (e: PointerEvent) => {
      const md = Math.min(window.innerWidth, window.innerHeight);
      return [
        0.5 + (e.clientX - window.innerWidth / 2) / md,
        0.5 - (e.clientY - window.innerHeight / 2) / md,
      ] as const;
    };
    const onPageMove = (e: PointerEvent) => {
      // A coarse pointer has no hover to speak of, so it drove nothing here.
      // A finger held ON the glass is a different claim entirely — track it for
      // as long as it is down, and touch gains the drag-stir the mouse has.
      if (!canHover && !pressing) return;
      const [px, py] = pageUv(e);
      const now = performance.now();
      if (lastPT > 0) {
        const dts = Math.min(Math.max((now - lastPT) / 1000, 1e-3), 0.1);
        conductor.input.pvx = (px - lastPX) / dts;
        conductor.input.pvy = (py - lastPY) / dts;
      }
      lastPT = now;
      lastPX = px;
      lastPY = py;
      conductor.input.px = px;
      conductor.input.py = py;
      conductor.input.pon = 1;
    };
    const onPageLeave = () => {
      conductor.input.pon = 0;
    };
    // The strike. Anywhere on the page, because the whole viewport IS the one
    // liquid — there is no interactive region to be inside of. Every listener
    // here is passive and none of them calls preventDefault: this observes the
    // gesture, it never consumes it, so links, buttons, form fields, text
    // selection and scrolling behave exactly as they did before.
    const onPageDown = (e: PointerEvent) => {
      const [px, py] = pageUv(e);
      pressing = true;
      lastPT = performance.now();
      lastPX = px;
      lastPY = py;
      conductor.input.px = px;
      conductor.input.py = py;
      conductor.input.pon = 1;
      conductor.input.press = 1;
      // A stab hits harder than a resting tap, and the hand's own speed at the
      // moment of contact is the only honest measure of that.
      const speed = Math.hypot(conductor.input.pvx, conductor.input.pvy);
      conductor.strike(px, py, 1 + Math.min(speed * 0.3, 0.7));
    };
    const endPress = () => {
      pressing = false;
      conductor.input.press = 0;
      // a finger leaving the glass leaves no hover behind it
      if (!canHover) conductor.input.pon = 0;
    };
    window.addEventListener("pointermove", onPageMove, { passive: true });
    window.addEventListener("pointerdown", onPageDown, { passive: true });
    window.addEventListener("pointerup", endPress, { passive: true });
    window.addEventListener("pointercancel", endPress, { passive: true });
    if (canHover)
      document.documentElement.addEventListener("pointerleave", onPageLeave);

    let raf = 0;
    let lastY = window.scrollY;
    let lastNow = performance.now();
    const update = () => {
      raf = requestAnimationFrame(update);
      const now = performance.now();
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const md = Math.min(vw, vh);

      // scroll velocity (viewport-heights/s) — the stir
      const dts = Math.max((now - lastNow) / 1000, 1e-3);
      const y = window.scrollY;
      conductor.input.vel = dts > 0.25 ? 0 : (y - lastY) / dts / vh; // long gaps = idle
      lastY = y;
      lastNow = now;

      // pointer velocity decays between move events (a resting hand lets go)
      conductor.input.pvx *= 0.82;
      conductor.input.pvy *= 0.82;
      applyObstacleFlow(vh, vw, md, y);

      // every scene's geometry → channels (pure math, reads only)
      for (let si = 0; si < scenes.length; si++) {
        const g = geoms[si];
        g.vh = vh;
        g.vw = vw;
        g.scrollY = y;
        scenes[si].read?.(g, conductor.raw[scenes[si].id]);
      }

      // DOM choreography (writes AFTER all reads — no layout thrash)
      applyEcoLabels(site.gather, site.svcPos);
      applyMethodFlow(clamp01(conductor.raw.method.u / methodPhases));
      applyOriginDawn(
        clamp01(conductor.raw.origin.p),
        clamp01(conductor.raw.origin.on),
        clamp01(conductor.raw.origin.lead),
      );
      applyScore();
    };
    update();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      stopOriginClock();
      obstacleDisposed = true;
      conductor.input.obstacleCount = 0;
      obstacleResize?.disconnect();
      if (obstacleRefresh) cancelAnimationFrame(obstacleRefresh);
      if (obstacleWarmup) window.clearTimeout(obstacleWarmup);
      if (obstacleFlow)
        window.removeEventListener("resize", queueObstacleGeometry);
      if (canHover && workSec && workCards.length > 0) {
        workSec.removeEventListener("pointerover", onWorkOver);
        workSec.removeEventListener("pointerleave", onWorkOut);
      }
      if (workSec && workCards.length > 0) {
        workSec.removeEventListener("focusin", onWorkFocusIn);
        workSec.removeEventListener("focusout", onWorkFocusOut);
        workSec.removeEventListener("pointerdown", onWorkPointerDown);
        workSec.removeEventListener("pointerup", releaseWorkTouch);
        workSec.removeEventListener("pointercancel", releaseWorkTouch);
      }
      if (workTouchRelease) window.clearTimeout(workTouchRelease);
      setWorkCard(null);
      window.removeEventListener("pointermove", onPageMove);
      window.removeEventListener("pointerdown", onPageDown);
      window.removeEventListener("pointerup", endPress);
      window.removeEventListener("pointercancel", endPress);
      conductor.input.press = 0;
      conductor.input.pon = 0;
      if (canHover)
        document.documentElement.removeEventListener(
          "pointerleave",
          onPageLeave,
        );
    };
  }, [
    enabled,
    tier,
    fEco,
    conductor,
    scenes,
    site,
    obstacleFlow,
    wrapRef,
  ]);

  return (
    <div
      ref={wrapRef}
      className="liquid-journey"
      data-liquid={enabled ? "live" : "static"}
      data-field-ready={fieldReady ? "true" : "false"}
      data-fluid-physics={physicsMode}
      data-fluid-obstacles={obstacleFlow ? "true" : "false"}
    >
        <div className="journey-layer" ref={layerRef}>
          {/* S7's ground — inside the sticky layer so it holds still while the
              runway scrolls past. It paints ABOVE the canvas and blends as
              light (`mix-blend-mode: screen`): the post chain's final pass
              writes alpha 1, so the canvas ships opaque and a sheet behind it
              would never be seen. See the .journey-dawn block in globals.css.

              Gated to the FULL probe tier, one notch tighter than the
              cinematic veils. This is a viewport-sized blended surface, and a
              blend costs a backdrop read on a renderer that is already
              fill-rate bound — so it belongs with the effects the ladder sheds
              first (rule #14: lower effects, never freeze). Note this reads
              the PROBE, so it excludes devices that start weak; it does not
              follow a mid-session watchdog demotion, which changes the field
              tier through the module setter without re-rendering here. The
              copy's horizon wipe is unaffected and runs at every live tier —
              only the ground stops moving. */}
          {enabled && cine && fEco === null && tier === "full" && (
            <div className="journey-dawn" aria-hidden="true" />
          )}
          {enabled && seen && (
            <div className="journey-canvas" aria-hidden="true">
              <FieldStage
                driver={conductor.driver}
                play={inView}
                tier={tier === "lite" ? "lite" : "full"}
                onReady={() => setFieldReady(true)}
                onContextLost={() => setFieldReady(false)}
                onTierChange={setFieldTier}
              />
            </div>
          )}
        </div>
        {/* R5-D: the cinematic layer — a SIBLING of the sticky layer (which
            is its own stacking context at z-0; nesting the fixed veils there
            would trap them under the z-10 copy). Live path only: never under
            reduced motion, static tiers, deterministic QA holds, or
            ?fcine=0. */}
        {/* THE CIRCULATION's controls sit above chapter copy while the canvas
            stays below it. Only visible controls opt back into hit testing.
            Live path only — static tiers read the semantic eco-stack. */}
        {ecoHost &&
          enabled &&
          createPortal(
            <div
              className="journey-interactions"
              ref={ecoLayerEl}
              data-interactive={ecoInteractive ? "true" : "false"}
              aria-hidden={!ecoKeyboardEnabled}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node))
                  setOpenEcoNode(null);
              }}
            >
              {/* One quiet editorial column beside the liquid field. The
                  systems arrive as human-readable groups: no counter, index,
                  progress meter, spine, or simulated interface chrome. */}
              <div className="gather-col">
                {/* Each group takes up room only as its liquid family arrives,
                    so the reading accumulates instead of starting as a dimmed
                    checklist. */}
                <ul className="gather-plate" aria-label={ecosystemLabel}>
                {GATHER_SYSTEMS.map((sys, si) => (
                  <li
                    key={sys.id}
                    className="gather-block"
                    data-sys={sys.id}
                    ref={(el) => {
                      systemEls.current[si] = el;
                    }}
                  >
                    <p className="gather-block-title">
                      <span className="gather-block-name">
                        {systems[si] ?? sys.id}
                      </span>
                    </p>
                    <ul className="gather-rows">
                      {sys.nodes.map((slot) => {
                        const n = nodes[slot];
                        if (!n) return null;
                        const descriptionId = `ecosystem-node-${slot}-description`;
                        const open = openEcoNode === slot;
                        return (
                          <li
                            key={n.name}
                            className="gather-row"
                            data-open={open ? "true" : "false"}
                            ref={(el) => {
                              nodeEls.current[slot] = el;
                            }}
                          >
                            <button
                              type="button"
                              className="gather-row-trigger"
                              data-slot={slot}
                              tabIndex={ecoKeyboardEnabled ? 0 : -1}
                              aria-expanded={open}
                              aria-controls={descriptionId}
                              aria-describedby={descriptionId}
                              onClick={() => setOpenEcoNode(open ? null : slot)}
                              onPointerEnter={() => setHovSlot(slot)}
                              onPointerLeave={() => setHovSlot(-1)}
                              onFocus={() => setHovSlot(slot)}
                              onBlur={() => setHovSlot(-1)}
                            >
                              <span className="gather-row-dot" aria-hidden="true" />
                              <span className="gather-row-name">{n.name}</span>
                            </button>
                            {/* Read by AT via aria-describedby; sighted users
                                receive the same copy in the note below. */}
                            <span id={descriptionId} className="gather-row-cap">
                              {n.tooltip}
                            </span>
                          </li>
                        );
                      })}
                      </ul>
                    </li>
                  ))}
                </ul>
                {/* The business label arrives only when the bodies have fused. */}
                <p className="gather-col-sum" aria-hidden="true">
                  <span className="organism-center" ref={centerEl}>
                    {centerLabel}
                  </span>
                </p>
                <div className="gather-note" aria-hidden="true">
                  {readoutSlot >= 0 && nodes[readoutSlot] ? (
                    <>
                      <span className="gather-note-name">
                        {nodes[readoutSlot].name}
                      </span>
                      <span className="gather-note-copy">
                        {nodes[readoutSlot].tooltip}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>,
            ecoHost,
          )}
        {/* Score-driven light stays above both story layers and below chrome. */}
        {enabled && cine && fEco === null && <CinematicVeils />}
        <div className="journey-content">{children}</div>
    </div>
  );
}
