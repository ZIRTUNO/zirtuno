/**
 * THE WATERLINE — the chapter rail as liquid.
 *
 * The rail used to be nine numbers stacked in a column: correct, legible, and
 * the one piece of chrome on this site that could have come from any template.
 * It is now a DOTTED EDGE the length of the viewport — the page's own water
 * line, seen from the side. The nine chapters are marks in it, the visible part
 * of the document is lit, and the hand deforms it.
 *
 * The mechanic is a length magnification: every dot is a zero-length round-cap
 * stroke, so a dot and a dash are the SAME primitive at two extensions.
 * Nothing is added to the rail to make it swell; the dot simply reaches.
 *
 * The one contract this file exists to keep:
 *
 *   DISPLACEMENT, NOT INFLATION. A dock magnifier grows what is under the
 *   cursor and leaves everything else alone — it manufactures material. Every
 *   other surface here answers a hand as an incompressible liquid does:
 *   `membrane.mjs` mean-removes the hand's normal acceleration around the ring
 *   so the enclosed area cannot change, and the button is unable to bulge
 *   toward the cursor without drawing itself in somewhere else. This is that
 *   rule in one dimension. Each lobe is emitted with a wide involvement window
 *   and that window's weighted mean is subtracted, so the extensions sum to
 *   ZERO exactly, every frame, for every lobe. The swell is paid for by a
 *   shallow withdrawal on both sides of it, and the rail reads as a surface
 *   under tension instead of as an animated list.
 *
 *   EXACT REST. With no hand, no wake and a still page, every extension snaps
 *   to zero and the rail SLEEPS; `path()` then returns the resting string
 *   character-for-character (AGENTS.md §4.3, in spirit). A rail at rest is a
 *   drawn column of dots, not a simulation idling at 0.01 px.
 *
 * The LIGHT is deliberately not the hand. Extension says "your hand is here" —
 * feedback, which the reader already knows. Cyan says "the page is here" —
 * information, which they do not. Keeping the two channels separate is what
 * lets the rail be a scrollbar and a chapter index at once without either
 * reading as decoration.
 *
 * DOM-free and deterministic on purpose — `scripts/verify-rail.mjs` runs it in
 * plain node.
 */

/** Character constants. Distances in px, time constants in seconds. */
export const RAIL = {
  // ── integration ───────────────────────────────────────────────────────────
  H_MS: 8, // fixed substep — MEM.H_MS
  MAX_SUB: 10, // 80 ms of catch-up, then give up — MEM.MAX_SUB

  // ── geometry ──────────────────────────────────────────────────────────────
  /** Dot pitch (px). At 9 px a 900 px-tall viewport carries ~79 dots: dense
   *  enough to read as a continuous edge, sparse enough that each dot is still
   *  a dot rather than a dotted line pretending to be solid. */
  PITCH: 9,
  /** Peak extension (px). The rail reserves `--rail-safe` (2.75rem = 44 px)
   *  and its column sits 20 px in from the page edge, so 22 px is the largest
   *  swell that can never reach the copy. The reference ran ~25 CSS px. */
  MAX_EXT: 22,
  /** Extension falloff (px) — the swell's half-width. The reference exposed
   *  this as "Extension Falloff"; here it is a Gaussian radius. */
  R_EXT: 76,
  /** The involvement window, as a multiple of R_EXT: what the displacement is
   *  drawn FROM. Below ~2.4 the withdrawal is a visible dent competing with
   *  the swell; above ~4 it spreads so thin the rail looks like it inflates
   *  after all. The trough's DEPTH is set by this alone — conservation fixes
   *  it near 34% of the peak here — so the only thing left to choose is how
   *  far the tautening reaches, and 2.8 keeps it inside the swell's own
   *  neighbourhood rather than leaning the whole column. */
  K_RET: 2.8,

  // ── the hand ──────────────────────────────────────────────────────────────
  /** Horizontal wake radius (px). The rail feels the hand coming, the way the
   *  membranes do — `pointerenter` on an 8 px column would be far too late. */
  AWARE_X: 168,
  /** Wake rise / fall (s). Water rises fast and drains slowly; symmetric
   *  constants here read as a light switch. MEM.AWARE_TAU / AWARE_TAU_OUT. */
  AWARE_TAU: 0.1,
  AWARE_TAU_OUT: 0.28,
  /** Pointer-target smoothing (s). The lag is the whole point: a spring
   *  chasing a step target has its peak acceleration at t=0, so smoothing the
   *  TARGET rather than the response is what removes the kick — the same
   *  reasoning as `coalesce.mjs`'s TARGET_TAU, at a tenth of the scale. */
  TARGET_TAU: 0.075,

  // ── the page's own motion ─────────────────────────────────────────────────
  /** Scroll speed (px/s) that produces a full bow wave. */
  WAKE_V: 900,
  /**
   * Above this (px/s) the page did not scroll, it JUMPED.
   *
   * A hash landing, a restored position or `scrollTo({immediate:true})` moves
   * the document by thousands of pixels between two frames. Fed to the wave
   * that is meant to say "the reader is moving", it pins the bow at full for
   * as long as the smoothed velocity takes to fall back through WAKE_V — most
   * of a second of swell for something the reader did not do with their hand
   * or their wheel. A flick tops out near 5 000 px/s; past 8 000 nobody is
   * scrolling.
   */
  JUMP_V: 8000,
  /** Bow-wave peak extension (px) and radius (px). Smaller and wider than the
   *  hand's: the page moving past is a swell, not a touch. */
  WAKE_EXT: 9,
  WAKE_R: 120,
  /** Bow-wave decay (s). */
  WAKE_TAU: 0.22,

  /**
   * The shortest the lit run may be, in dots.
   *
   * The homepage is ~29 000 px against a 900 px viewport, so an honestly
   * proportional thumb is two dots — arithmetically correct and impossible to
   * read as a run. This is the scrollbar's oldest convention (a minimum thumb
   * length) and it is kept for the oldest reason: below it, the one thing the
   * control exists to show stops being visible. Above the floor the run is
   * proportional again, so on a short page it still says how much is left.
   */
  MIN_RUN: 5,

  // ── arriving at rest ──────────────────────────────────────────────────────
  /** An exponential approach never arrives: at AWARE_TAU_OUT the wake is still
   *  at 0.005 two seconds after the hand left — a tenth of a pixel nobody can
   *  see, holding the rail off its resting string and the loop awake. So the
   *  last of it DRAINS: below `DRAIN_AT` the state falls linearly to zero over
   *  `DRAIN_S`. A real meniscus finishes leaving. */
  DRAIN_AT: 0.06,
  DRAIN_S: 0.15,

  /** Below this (px) an extension is not a deformation, it is a rounding
   *  error. Snapped to zero so rest is exact and the loop can stop. */
  EPS: 0.004,
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The last of a decaying state, taken off linearly so it actually arrives. */
const drain = (v, dt) =>
  v < RAIL.DRAIN_AT ? Math.max(0, v - dt / RAIL.DRAIN_S) : v;

/**
 * One mean-removed lobe, accumulated into `out`.
 *
 * `g` is the swell (a Gaussian of radius `r` about `c`) and `w` the wide
 * involvement window it is drawn from. Subtracting w·(Σg/Σw) makes the sum of
 * (g − w·k) vanish identically — the discrete form of the membrane's mean
 * removal, and it holds even when the lobe is clipped by the end of the rail,
 * which a closed-form difference of Gaussians would not.
 *
 * Normalised so the lobe's own peak is exactly `amp`, so a constant in px
 * means what it says regardless of where on the rail the lobe landed.
 */
function lobe(out, ys, n, c, r, amp, scratch) {
  if (amp === 0 || r <= 0) return;
  const rw = r * RAIL.K_RET;
  let sg = 0;
  let sw = 0;
  for (let i = 0; i < n; i++) {
    const d = ys[i] - c;
    const a = d / r;
    const b = d / rw;
    const g = Math.exp(-a * a);
    const w = Math.exp(-b * b);
    scratch[i] = g;
    scratch[n + i] = w;
    sg += g;
    sw += w;
  }
  if (sw <= 0) return;
  const k = sg / sw;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const v = scratch[i] - scratch[n + i] * k;
    scratch[i] = v;
    if (v > peak) peak = v;
  }
  if (peak <= 1e-6) return;
  const s = amp / peak;
  for (let i = 0; i < n; i++) out[i] += scratch[i] * s;
}

/**
 * The rail.
 *
 * `h` is its span in px and `x0` the x of the dot column, both in the local
 * frame the pointer arrives in — the runtime hands over element-local
 * coordinates. Chapter positions are set later by `setMarks`, as fractions of
 * the DOCUMENT rather than of the rail, so a resize moves the dots and never
 * the meaning.
 */
export function makeRail(h = 720, x0 = 28) {
  let span = Math.max(h, RAIL.PITCH * 2);
  let X0 = x0;

  let n = 0;
  let pitch = RAIL.PITCH;
  let ys = new Float32Array(0);
  let ext = new Float32Array(0);
  let scratch = new Float32Array(0);
  /** Chapter index per dot, or -1. Rebuilt on layout/marks, never per frame. */
  let owner = new Int8Array(0);

  // the hand, in local px
  let hx = null;
  let hy = 0;
  // smoothed target y and wake gain — the two integrated quantities
  let ty = 0;
  let gain = 0;
  let seeded = false;

  // the page's own motion
  let bow = 0; // 0..1, decaying
  let bowY = 0;

  // scroll geometry, as fractions of the document
  let head = 0; // top of the visible run
  let tail = 0; // bottom of it
  let marks = new Float32Array(0);
  let live = -1; // the page's answer to "which chapter", or -1 to derive one

  let last = 0;
  let asleep = true;
  let dirty = true;

  /** Which dot carries which chapter. A mark claims its nearest dot, and two
   *  chapters closer together than one pitch cannot claim the same one — the
   *  second takes the dot below, so nine marks are always nine dots. */
  function assign() {
    owner.fill(-1);
    let used = -1;
    for (let m = 0; m < marks.length; m++) {
      let i = Math.round((marks[m] * span) / pitch);
      if (i <= used) i = used + 1;
      if (i > n - 1) i = n - 1;
      if (i <= used) continue;
      owner[i] = m;
      used = i;
    }
  }

  function build() {
    const count = Math.max(2, Math.round(span / RAIL.PITCH) + 1);
    if (count !== n) {
      n = count;
      ys = new Float32Array(n);
      ext = new Float32Array(n);
      scratch = new Float32Array(n * 2);
      owner = new Int8Array(n);
    }
    // The pitch is re-derived so the column fills its span exactly: a rail
    // ending 6 px short of where it claims to end is a rail whose dots no
    // longer mean the document positions they are read against.
    pitch = span / (n - 1);
    for (let i = 0; i < n; i++) ys[i] = i * pitch;
    assign();
    dirty = true;
  }
  build();

  /** Integrate one substep of the two first-order states. */
  function substep(dt) {
    // the wake: 1 where the hand is at the rail, falling off horizontally
    let want = 0;
    if (hx !== null) {
      const dx = (X0 - hx) / RAIL.AWARE_X;
      want = Math.exp(-dx * dx);
      if (want < 0.004) want = 0;
    }
    const tau = want > gain ? RAIL.AWARE_TAU : RAIL.AWARE_TAU_OUT;
    gain += (want - gain) * (1 - Math.exp(-dt / tau));
    if (want === 0) gain = drain(gain, dt);

    // The target. Seeded rather than eased on the first hand of a session, so
    // the swell does not travel the length of the rail to reach a pointer that
    // was already sitting there.
    if (hx !== null) {
      if (!seeded) {
        ty = hy;
        seeded = true;
      } else {
        ty += (hy - ty) * (1 - Math.exp(-dt / RAIL.TARGET_TAU));
      }
    }

    bow = drain(bow * Math.exp(-dt / RAIL.WAKE_TAU), dt);
  }

  /**
   * The lit run as dot indices, floored at RAIL.MIN_RUN.
   *
   * The floor grows the run about its own CENTRE, so the reading position does
   * not jump when it engages, and is then pushed back inside the rail at
   * either end — which is also what makes the run sit flush at the very top
   * and the very bottom, where a centred floor would hang off the edge.
   */
  function runDots() {
    let a = Math.round(head * (n - 1));
    let b = Math.round(tail * (n - 1));
    const want = Math.min(RAIL.MIN_RUN, n) - 1;
    if (b - a < want) {
      a = Math.round((a + b - want) / 2);
      b = a + want;
      if (a < 0) {
        a = 0;
        b = want;
      } else if (b > n - 1) {
        b = n - 1;
        a = b - want;
      }
    }
    return [a, b];
  }

  /** Rebuild `ext` from the current state. No integration here. */
  function shape() {
    ext.fill(0);
    const a = gain * RAIL.MAX_EXT;
    if (a > RAIL.EPS && seeded) lobe(ext, ys, n, ty, RAIL.R_EXT, a, scratch);
    const b = bow * RAIL.WAKE_EXT;
    if (b > RAIL.EPS) lobe(ext, ys, n, bowY, RAIL.WAKE_R, b, scratch);

    // The epsilon snap is taken on the WHOLE rail, not dot by dot. Zeroing
    // individual dots under the threshold looks equivalent and is not: each
    // one removes up to EPS of signed displacement from a set whose defining
    // property is that it sums to zero, and the tail of a lobe that hangs off
    // the end of the rail is mostly such dots — enough of them to put a
    // hundredth of a pixel of material back into a contract that is supposed
    // to be exact. Snapping only when nothing anywhere is above the threshold
    // keeps rest exact and leaves the displacement alone while it is live.
    let peak = 0;
    for (let i = 0; i < n; i++) {
      const v = Math.abs(ext[i]);
      if (v > peak) peak = v;
    }
    if (peak < RAIL.EPS) {
      ext.fill(0);
      return false;
    }
    return true;
  }

  const api = {
    /** Re-span the rail. Marks survive — they are document fractions. */
    layout(hPx, x0Px = X0) {
      const s = Math.max(hPx, RAIL.PITCH * 2);
      if (s === span && x0Px === X0) return;
      span = s;
      X0 = x0Px;
      build();
    },

    /** Chapter positions, as 0..1 of the document. */
    setMarks(list) {
      marks = Float32Array.from(list, clamp01);
      assign();
      dirty = true;
    },

    /** The page's own answer to which chapter is current; -1 to derive one. */
    setLive(i) {
      const v = i >= 0 && i < marks.length ? i : -1;
      if (v === live) return;
      live = v;
      dirty = true;
    },

    /**
     * Where the reader is. `y` is the scroll position, `vh` the viewport,
     * `docH` the full document height and `vel` the page's own speed in px/s.
     * The lit run is the part of the DOCUMENT currently on screen — a real
     * thumb, proportional, so the rail answers "how much is left" as well as
     * "where am I".
     */
    travel(y, vh, docH, vel = 0) {
      const doc = Math.max(docH, 1);
      const h0 = clamp01(y / doc);
      const h1 = clamp01((y + vh) / doc);
      if (h0 !== head || h1 !== tail) {
        head = h0;
        tail = h1;
        dirty = true;
      }
      // after the run has moved, so the wave rises where the reader now is
      if (vel) api.wake(vel);
    },

    /**
     * The page's own motion, in px/s. Its wake rises at the reading head: the
     * document moving past the rail disturbs the surface where the reader is
     * looking, and on a device with no hover that is the only life the rail
     * has.
     */
    wake(pxPerSec) {
      const speed = Math.abs(pxPerSec);
      if (speed > RAIL.JUMP_V) return;
      const v = clamp01(speed / RAIL.WAKE_V);
      if (v <= bow) return;
      bow = v;
      bowY = ((head + tail) / 2) * span;
      dirty = true;
    },

    /**
     * Pointer in LOCAL px. `null` lifts it.
     *
     * Only a pointer that actually MOVED is a change. The shared runtime hands
     * every registered surface the pointer on every tick, not only on
     * `pointermove`, so marking the rail dirty unconditionally here would mean
     * a cursor parked anywhere on the page kept the rail — and therefore the
     * whole loop — awake for as long as the reader sat still.
     */
    hand(x, y = 0) {
      if (x === null || x === undefined) {
        if (hx !== null) dirty = true;
        hx = null;
        return;
      }
      if (x === hx && y === hy) return;
      hx = x;
      hy = y;
      dirty = true;
    },

    step(tMs) {
      if (!last) last = tMs;
      const dtRaw = tMs - last;
      last = tMs;

      // Nothing has changed and nothing is still settling: the one branch that
      // lets the runtime stop calling. `dirty` is deliberately NOT cleared on
      // the way out of a zero-length frame — the first step() after mount has
      // dt = 0, and consuming the flag there swallowed the redraw that `wake`
      // and `travel` had just asked for.
      if (asleep && !dirty) return false;
      if (dtRaw <= 0) return dirty;

      let dt = dtRaw;

      dt = Math.min(dt, RAIL.H_MS * RAIL.MAX_SUB);
      const steps = Math.max(1, Math.ceil(dt / RAIL.H_MS));
      const hSec = dt / steps / 1000;
      for (let i = 0; i < steps; i++) substep(hSec);

      const moved = shape();
      // Rest is exact, and it is also the condition for stopping: no wake, no
      // bow, nothing displaced. `dirty` covers the frames where only the lit
      // run moved — the paths change without a single extension changing.
      const wasAwake = !asleep;
      asleep = !moved && gain === 0 && bow === 0;
      if (asleep) seeded = false;
      const out = dirty || moved || wasAwake;
      dirty = false;
      return out;
    },

    /**
     * The dot column as SVG path data.
     *
     * `kind` selects which dots are emitted: "ink" is every plain dot the hand
     * has drawn OUT, "taut" every plain dot it has drawn FROM, "mark" the
     * chapters, "flow" the lit run, "live" the single chapter the reader is
     * inside. They share one geometry pass, so a chapter mark and its dot can
     * never disagree about where it is.
     *
     * Ink and taut are the same dots split by the SIGN of their displacement,
     * and they exist as two paths for one reason: a stroke width cannot vary
     * inside a path. The withdrawal is as real as the swell and has to be
     * drawn, but a dot that gave up material should read as a surface pulled
     * thin, not as a dash pointing the wrong way — so the negative half is
     * drawn on a lighter stroke. Nothing about the state changes; this is the
     * one place the rail chooses how loudly to say a true thing.
     *
     * A dot is a zero-length subpath with a round cap — the same primitive as
     * a dash, at extension zero. `0.01` rather than a true zero because a
     * zero-length subpath is a rendering edge case with a history of browser
     * disagreement, and 0.01 px is invisible at any device ratio.
     */
    path(kind) {
      const a = api.headIndex;
      const b = api.tailIndex;
      const live = api.liveMark;
      let d = "";
      for (let i = 0; i < n; i++) {
        const m = owner[i];
        const lit = i >= a && i <= b;
        const plain = m < 0 && !lit;
        const keep =
          kind === "ink"
            ? plain && ext[i] >= 0
            : kind === "taut"
              ? plain && ext[i] < 0
              : kind === "mark"
                ? m >= 0 && m !== live
                : kind === "flow"
                  ? lit && m < 0
                  : m >= 0 && m === live;
        if (!keep) continue;
        const y = Math.round(ys[i] * 100) / 100;
        // A READING never renders the withdrawal. The plain dots are the
        // surface and deform both ways; the marks, the lit run and the live
        // chapter are readings PAINTED on that surface. They ride the swell,
        // because that is where the surface visibly went and a reading that
        // stayed behind would have peeled off it — but they never draw the
        // tautening, because a chapter's position is not a thing the reader's
        // hand is entitled to move, and 8 px of reversed cyan under a glow
        // shouts louder than the swell it is paying for.
        const raw = plain ? ext[i] : Math.max(ext[i], 0);
        const len = Math.round((raw + 0.01) * 100) / 100;
        d += `M${X0} ${y}h${-len}`;
      }
      return d;
    },

    /** Local y of chapter `i` — where its dot actually sits, not where the
     *  fraction says, so a label can never point between two dots. */
    markY(i) {
      for (let d = 0; d < n; d++) if (owner[d] === i) return ys[d];
      return (marks[i] ?? 0) * span;
    },

    get headIndex() {
      return runDots()[0];
    },
    get tailIndex() {
      return runDots()[1];
    },
    /**
     * Which chapter the reader is in, when the page has not said.
     *
     * The page usually HAS said: the site already answers this question with an
     * IntersectionObserver against a reading band, and two answers to it would
     * eventually disagree on screen. `setLive` overrides; this derivation is
     * what keeps the kernel complete on its own, and testable in node.
     *
     * The line is 45% down the viewport — the same band the observer uses. The
     * bottom of the document is special-cased because a short final chapter's
     * top can never reach that line, and "you are not in any chapter" is not a
     * true thing to say about the end of a page.
     */
    get liveMark() {
      if (live >= 0) return live;
      // Within half a percent of the end IS the end: a reader 40 px from the
      // bottom of an 8 000 px page is in the last chapter whatever the
      // arithmetic of a reading line says.
      if (tail >= 0.995) return marks.length - 1;
      const line = head + (tail - head) * 0.45;
      let best = -1;
      for (let m = 0; m < marks.length; m++) if (marks[m] <= line) best = m;
      return best;
    },
    /** 0..1 — how awake the rail is. Drives its resting opacity. */
    get aware() {
      return gain;
    },
    get count() {
      return n;
    },
    get span() {
      return span;
    },
    /** Read-only extensions (px) — harness and debug only. */
    get ext() {
      return ext;
    },
    get asleep() {
      return asleep && !dirty;
    },
  };
  return api;
}
