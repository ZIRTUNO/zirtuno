"use client";

/**
 * THE WETTING EDGE — the reading front, as one clock for the whole page.
 *
 * Chapter copy used to arrive on thirteen independent `Reveal` fade-ups firing
 * at `top 88%`, which build-spec §4.4 rules out and the owner rejected on
 * sight. This is the replacement, and it is the S7 pattern generalised: a
 * block gets ONE number per frame — `--wet-p`, how far the reading front has
 * travelled through it — and CSS derives every word's own arrival from that.
 * No per-word JavaScript, no ScrollTrigger per block, and the whole thing is
 * reversible because it is a position, not an event.
 *
 * Three properties of this module are load-bearing:
 *
 *   ONE LOOP.      A page can carry a dozen wet blocks; it gets one rAF and
 *                  one IntersectionObserver, not a dozen of each.
 *
 *   READ, THEN WRITE. Every rect is measured before any custom property is
 *                  written. Interleaving them makes each read after the first
 *                  a forced synchronous layout — which is essentially the
 *                  entire cost of a loop like this one.
 *
 *   GEOMETRY, NOT EVENTS. Lenis rewrites `window.scrollY` from inside its own
 *                  rAF and native `scroll` events do not keep up with it (a
 *                  900px travel has been measured here emitting two events,
 *                  the last of them 896px stale). Membership comes from an
 *                  IntersectionObserver and position from
 *                  `getBoundingClientRect`, so neither depends on an event
 *                  arriving.
 *
 * Fails safe, like `--origin-scrub`: `data-wet` is set only once this runtime
 * is actually driving a block, and the stylesheet's dry state hangs off that
 * attribute. Static tiers, reduced motion, pre-hydration and JS-off never get
 * it, so they render plain full-strength copy with nothing to un-hide.
 */

/**
 * THE READING LINE, and why the window straddles it.
 *
 * Measured off the reference treatment (brikken.co, 1440x900, a 51-word
 * 502px statement): its front does not track the block's ENTRY at all. It
 * pins a reading line at ~0.40 vh and wets each word as that word crosses it
 * — the first word arrives with the block top at 340px, the last with the
 * block bottom at 370px, so the travel IS the block's own height (471px
 * measured against 502px of block) and the reveal is mid-flight exactly while
 * the copy sits in the reading zone.
 *
 * A pure line model cannot be copied here, because it gives a two-line lead a
 * 70px reveal. So the window STRADDLES the line instead: it opens LEAD above
 * the line and closes TRAIL below it, which puts half-reveal at the line for a
 * block of any height while giving a short one real travel.
 *
 *   travel   = height + (ENTER - SETTLE) * vh
 *   half-way = block centre on the reading line
 *
 * The first pair tried here (0.96 / 0.44) had the right length and the wrong
 * PHASE: it opened with the block at the very bottom edge and closed at 0.44
 * vh, so the reveal was already finished by the time the copy reached a
 * comfortable reading position. Nobody ever saw it move. That is what reads as
 * "too fast" — not the duration.
 */
/**
 * Straddling the line SYMMETRICALLY is the whole tuning decision, and it is
 * worth stating why rather than leaving three numbers.
 *
 *   the word under the front sits at  ENTER*vh  at p=0
 *                              and at  SETTLE*vh at p=1,
 *
 * so a window of width W drifts the front from W/2 below the reading line to
 * W/2 above it. Centring it on the line means the front is IN the reading zone
 * for the middle half of every reveal, whatever the block's height — which is
 * the property the reference gets for free by having blocks half a viewport
 * tall, and the one a two-line lead cannot get any other way.
 *
 * Biasing the window downward (the first attempt: 0.88 / 0.26, mid-reveal with
 * the block centre at 0.57 vh) finishes the reveal below the reading line, so
 * the copy is already resolved by the time it is comfortable to read. Measured
 * against the reference, whose mid-reveal sits at 0.39 vh.
 */
/** The reading line: where a word is when the front is standing on it. */
const LINE = 0.48;
/** Opens this far below the line, closes this far above it. */
const LEAD = 0.38;
const TRAIL = 0.38;

/** Block TOP sits here, as a fraction of viewport height, at p = 0. */
const ENTER = LINE + LEAD;
/** Block BOTTOM sits here at p = 1. */
const SETTLE = LINE - TRAIL;
/** Write threshold — PageStage's own epsilon for per-frame custom properties.
 *  A block that has not moved a quarter of a percent does not get a style
 *  invalidation. */
const EPS = 0.004;
/** How far outside the viewport a block stays driven. Wide enough that the
 *  front is always already in the right place before a block is visible. */
const MARGIN = "25% 0px 25% 0px";

type Block = { readonly el: HTMLElement; last: number; armed: boolean };

const blocks = new Map<HTMLElement, Block>();
const live = new Set<Block>();
/** Reused between frames — this loop allocates nothing once it is warm. */
const measured: number[] = [];

let observer: IntersectionObserver | null = null;
let frame = 0;

function tick(): void {
  frame = 0;
  if (live.size === 0) return;

  const vh = window.innerHeight || 1;
  const enter = ENTER * vh;
  const settle = SETTLE * vh;

  let i = 0;
  for (const block of live) {
    const rect = block.el.getBoundingClientRect();
    // p = 0 with the block's top at ENTER, p = 1 with its bottom at SETTLE.
    // The travel is therefore `height + (ENTER - SETTLE) * vh`, which is
    // positive for every block down to a single line — and a tall block
    // honestly takes longer to read than a short one, which is the behaviour
    // we want rather than a fixed duration per block.
    const travel = rect.height + enter - settle;
    measured[i++] = travel > 0 ? (enter - rect.top) / travel : 1;
  }

  i = 0;
  for (const block of live) drive(block, measured[i++]);

  frame = requestAnimationFrame(tick);
}

/**
 * Write one block's position — and ARM it on the same pass.
 *
 * `data-wet` is what turns the stylesheet's dry state on, so it must never be
 * set before the block's real position is known. Setting it at registration
 * looked harmless because `--wet-p` fails safe to 1, but that is precisely the
 * problem: a block already on screen when the page loads (any deep link into a
 * chapter) would render fully arrived and then drop back to its true progress
 * on the first frame — copy visibly UN-reading itself. Both writes land in one
 * synchronous block, so the browser recomputes style once and there is no
 * intermediate paint.
 */
function drive(block: Block, p: number): void {
  const clamped = p < 0 ? 0 : p > 1 ? 1 : p;
  if (block.armed && Math.abs(clamped - block.last) < EPS) return;
  block.last = clamped;
  block.el.style.setProperty("--wet-p", clamped.toFixed(4));
  if (!block.armed) {
    block.armed = true;
    block.el.dataset.wet = "on";
  }
}

function wake(): void {
  if (!frame && live.size > 0) frame = requestAnimationFrame(tick);
}

function onIntersect(entries: IntersectionObserverEntry[]): void {
  for (const entry of entries) {
    const block = blocks.get(entry.target as HTMLElement);
    if (!block) continue;
    if (entry.isIntersecting) {
      live.add(block);
      continue;
    }
    live.delete(block);
    // Pin the terminal state on the way out, so a block that leaves the driven
    // band between two frames cannot be stranded mid-reveal: below the band it
    // has not been reached, above it has been read.
    drive(block, entry.boundingClientRect.top > 0 ? 0 : 1);
  }
  wake();
}

/**
 * Put one block under the reading front. Returns its unregister function.
 * Callers are responsible for not calling this under reduced motion — the
 * runtime deliberately has no opinion about that, so the decision lives in
 * one place (the component) rather than two.
 */
export function registerWetBlock(el: HTMLElement): () => void {
  observer ??= new IntersectionObserver(onIntersect, { rootMargin: MARGIN });

  const block: Block = { el, last: -1, armed: false };
  blocks.set(el, block);
  observer.observe(el);

  return () => {
    observer?.unobserve(el);
    blocks.delete(el);
    live.delete(block);
    delete el.dataset.wet;
    el.style.removeProperty("--wet-p");
    if (blocks.size === 0) {
      observer?.disconnect();
      observer = null;
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}
