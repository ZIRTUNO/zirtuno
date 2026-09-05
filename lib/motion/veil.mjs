/**
 * THE VEIL — the route transition, and the fourth member of the vector-liquid
 * family beside the membrane, the coalescing drop and the waterline.
 *
 * Ported from GSAP's "Dynamic Morphing" demo (demos.gsap.com/demo/dynamic-
 * morphing — CodePen GreenSock/qBedXpg, itself a fork of Blake Bowen's
 * osublake/BYwgBg "SVG Shape Overlays"). The reference is ten y-values across a
 * `0 0 100 100` viewBox with `preserveAspectRatio="none"`: every column tweens
 * from the bottom to the top on its OWN random delay, a smooth polybezier is
 * rebuilt through them each frame, and two gradient-filled copies of that path
 * chase each other across the screen.
 *
 * Three things are ported exactly, because they are the demo:
 *
 *   THE COLUMN DELAY. The wave is not a shape being animated; it is a straight
 *   tween per column, offset in TIME. That is why it reads as a liquid finding
 *   its own level rather than as a path being interpolated — no two columns
 *   arrive together, and the crest is an emergent property of the schedule.
 *
 *   THE MIDPOINT CONTROL POINTS. Both handles of each cubic share the segment's
 *   midpoint x, and take the start and end y respectively. That is a smoothstep
 *   between neighbouring heights: horizontal tangents at every column, so the
 *   crest has no corners at any phase of the run.
 *
 *   THE FILL FLIP. `cover` closes the path DOWN to y=100, `reveal` closes it UP
 *   to y=0, and both tween their columns 100 → 0. So the wave always travels
 *   the same way — bottom to top — and only the side the paint sits on changes.
 *   At the seam between them both formulas describe the identical full-screen
 *   rectangle, which is what lets the route commit inside the transition
 *   without a frame of flicker.
 *
 * What is ours:
 *
 *   IT IS SEEDED. `Math.random()` cannot be reviewed, captured twice, or
 *   regression-tested. Every column delay here comes from a mulberry32 stream,
 *   so `?fveil=<n>` renders one exact wave for the capture sheet and the gate
 *   can assert on the geometry instead of on a screenshot.
 *
 *   IT IS DOM-FREE. Same contract as `membrane.mjs` and `rail.mjs`: time in,
 *   path strings out, so `scripts/verify/veil.mjs` runs it in plain node. The
 *   runtime (`components/motion/PageVeil.tsx`) only supplies a clock.
 *
 *   THE TEMPO IS THE SITE'S. One column's travel is `--dur-short` (0.4s) and
 *   the whole wave lands inside `--dur-medium` (0.72s ceiling); the easing is
 *   `--ease-calm`, which is the same curve as the reference's `power2.inOut`.
 *
 *   THREE LAYERS, NOT TWO, and the last one is opaque. The reference's two
 *   translucent sheets are decoration over a page that never leaves. Ours has
 *   to hide a route swap, so the layer that arrives last is the only one that
 *   must be solid — `PageVeil.tsx` and the `.page-veil` block in globals.css
 *   own that paint; this file only ever decides where the edges are.
 */

/** Tuning. Named constants only — `scripts/verify/veil.mjs` asserts on these. */
export const VEIL = {
  /** Control points across the width. Ten is the reference's; eleven keeps the
   *  lobes the same size while putting a column ON the centre line, so the wave
   *  is symmetric about the page's own axis rather than straddling it. */
  N: 11,
  /** Paint layers. See the module note above for why the third exists. */
  LAYERS: 3,
  /** One column's whole travel, seconds — the site's `--dur-short`. */
  DUR: 0.4,
  /** The most extra delay a column can draw, seconds. This IS the wave: at 0
   *  every column arrives together and the veil is a horizontal blind. */
  JITTER: 0.14,
  /** Per-layer offset, seconds. Reversed on `reveal`, so the layer that landed
   *  last is the first to lift. */
  STAGGER: 0.09,
  /** Decimals kept in the emitted path. Three is ~0.001% of a viewport at the
   *  `0 0 100 100` scale — far under a device pixel — and it keeps `d` near
   *  400 bytes instead of the reference's 1.6 kB of float noise. */
  DP: 3,
};

/** Worst-case run length, seconds. A run's real end is `DUR + max(colDelay) +
 *  STAGGER × (layers - 1)`, so it is always at or under this. */
export const VEIL_CEILING =
  VEIL.DUR + VEIL.JITTER + VEIL.STAGGER * (VEIL.LAYERS - 1);

/** `--ease-calm` / cubic-bezier(0.65, 0, 0.35, 1) / GSAP `power2.inOut` — the
 *  same curve to within a thousandth. Written closed-form rather than solved
 *  from the bezier because this runs once per column per layer per frame. */
function calm(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** mulberry32 — 32 bits of state, uniform enough for a delay draw, and it
 *  yields the same stream in node and in the browser. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Compact fixed point. `1.000` and `-0` both cost bytes, and neither is a
 *  number anyone wants to read in a diff. */
function f(v) {
  const s = v.toFixed(VEIL.DP);
  const trimmed = s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
  return trimmed === "-0" || trimmed === "" ? "0" : trimmed;
}

/** The x of each column, and the shared control-point x of the segment ending
 *  there. Constant for a given N, so they are strings from the start. */
function columns(n) {
  const x = new Array(n);
  const cx = new Array(n);
  const step = 100 / (n - 1);
  for (let j = 0; j < n; j++) {
    x[j] = f(j * step);
    cx[j] = f(j * step - step / 2);
  }
  return { x, cx };
}

/**
 * A veil.
 *
 * `arm()` schedules a run and returns its length; `seek(t)` moves to `t`
 * seconds into it and reports whether anything moved; `path(i)` is the `d` for
 * layer `i` at the current time. Nothing here touches a document, a clock, or a
 * random source it was not handed.
 */
export function makeVeil() {
  const n = VEIL.N;
  const { x, cx } = columns(n);
  /** y per (layer, column). 100 is the bottom edge, 0 the top. */
  const y = new Float64Array(VEIL.LAYERS * n);
  /** Each column's own delay, redrawn per run and SHARED by every layer — the
   *  layers are one body of liquid seen at three depths, not three waves. */
  const colDelay = new Float64Array(n);

  let mode = "idle";
  let layers = VEIL.LAYERS;
  let total = 0;
  let at = -1;

  return {
    get mode() {
      return mode;
    },
    get layers() {
      return layers;
    },
    /** Run length in seconds; 0 before the first `arm()`. */
    get total() {
      return total;
    },
    /** True only while a completed FULL-STACK cover is standing over the page —
     *  which is the one state in which the route may be swapped unseen. A
     *  finished `wash` half satisfies every other clause and must not count:
     *  the crest on its own hides nothing. */
    get covered() {
      return mode === "cover" && layers === VEIL.LAYERS && at >= total;
    },

    /**
     * Schedule a run.
     *
     * `nextMode` is `"cover"` (paint grows up from the bottom and closes down
     * onto y=100) or `"reveal"` (paint hangs from the top and its lower edge
     * climbs out). `seed` picks the column delays. `layerCount` runs a prefix
     * of the stack: the crest alone is the WASH that answers a back/forward,
     * where nothing may be hidden because the page has already changed
     * underneath and there is no route left to wait for.
     */
    arm(nextMode, seed, layerCount = VEIL.LAYERS) {
      mode = nextMode;
      layers = Math.max(1, Math.min(VEIL.LAYERS, layerCount | 0));
      const draw = rng(seed);
      let last = 0;
      for (let j = 0; j < n; j++) {
        colDelay[j] = draw() * VEIL.JITTER;
        if (colDelay[j] > last) last = colDelay[j];
      }
      total = VEIL.DUR + last + VEIL.STAGGER * (layers - 1);
      // Every run starts with every column at the bottom. In `cover` that is a
      // zero-area path; in `reveal` it is the whole screen — which is exactly
      // the picture `cover` ended on, so the two meet without a seam.
      y.fill(100);
      at = -1;
      return total;
    },

    /** Move to `t` seconds into the armed run. Returns true if any column
     *  moved, so the runtime can skip a DOM write on a repeated frame. */
    seek(t) {
      const clamped = t < 0 ? 0 : t > total ? total : t;
      if (clamped === at) return false;
      at = clamped;
      for (let i = 0; i < layers; i++) {
        // On the way out the stack unwinds: the layer that arrived last — the
        // opaque one, on top — is the first to lift.
        const lead = VEIL.STAGGER * (mode === "cover" ? i : layers - 1 - i);
        const base = i * n;
        for (let j = 0; j < n; j++) {
          const p = (clamped - lead - colDelay[j]) / VEIL.DUR;
          y[base + j] = p <= 0 ? 100 : p >= 1 ? 0 : 100 * (1 - calm(p));
        }
      }
      return true;
    },

    /** Where the veil is in its run, seconds; -1 before the first `seek()`. */
    get at() {
      return at;
    },

    /** One column's height — the gate reads the geometry through this. */
    columnY(layer, column) {
      return y[layer * n + column];
    },

    /**
     * `d` for layer `i`, in the `0 0 100 100` viewBox.
     *
     * The reference's construction, with ONE deliberate deviation.
     *
     * The reference opens its cover path `M 0 0 V y₀ C …` — down the left edge
     * from the top corner before the curve starts. That prefix encloses no
     * area (the close runs back up the same edge), so it changes nothing about
     * what is painted. What it does change is the path's BOUNDING BOX, which it
     * pins to the top of the viewBox for the whole run — and an
     * `objectBoundingBox` gradient on a box like that is a gradient nailed to
     * the viewport. In the reference that is invisible, because both of its
     * sheets are flat orange and the demo is about the shape. Here it is the
     * difference between a wave with light on its crest and a wave that is
     * black at the leading edge and bright somewhere it has not reached yet.
     * The first capture of this transition showed exactly that: dark humps.
     *
     * So the cover starts on its first column, like the reveal already did.
     * The bbox is then the wave's own extent, the gradient rides it, and the
     * lit stop sits on the crest at every phase of the run. It is also 8 bytes
     * shorter. See `PageVeil.tsx` for the reveal's units, which are pinned on
     * purpose for the opposite reason.
     *
     * Layers past the armed count return an empty path — a `d` of `""` paints
     * nothing, and still lets the element, its gradient and its class stay
     * exactly where they are.
     */
    path(i) {
      if (i >= layers) return "";
      const base = i * n;
      let d = `M 0 ${f(y[base])} C`;
      for (let j = 0; j < n - 1; j++) {
        const a = f(y[base + j]);
        const b = f(y[base + j + 1]);
        d += ` ${cx[j + 1]} ${a} ${cx[j + 1]} ${b} ${x[j + 1]} ${b}`;
      }
      return d + (mode === "cover" ? " V 100 H 0" : " V 0 H 0");
    },
  };
}
