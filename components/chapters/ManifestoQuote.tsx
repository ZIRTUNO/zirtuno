"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { useReducedMotion } from "@/lib/animation/reduced-motion";

/** The reading window, as a fraction of viewport height: the swell is at full
 *  amplitude while the figure's top edge is at 88% down the viewport, and dead
 *  flat by the time it reaches 34%. `scripts/verify/manifesto-coda.mjs`
 *  mirrors both numbers to place its stops — move one, move it there too. */
const START = 0.88;
const END = 0.34;

type Props = {
  latin: string;
  quote: string;
  attribution: string;
  source: string;
};

/**
 * S7's coda — Seneca's port, as a sea going calm.
 *
 * ── WHY NOT THE MASKED RISE ────────────────────────────────────────────────
 * The obvious build is the GSAP line split: `type: "lines", mask: "lines"`,
 * each line clipped by its own line box and rising into it. Disclose already
 * ships that figure and it is the right one there. It is the wrong one HERE,
 * for a reason specific to this block and worth writing down before someone
 * "fixes" it back:
 *
 * `.manifesto-line` is a member of the standing-shadow list (search
 * `--copy-shadow-standing`). This copy sits on the live cyan field, whose
 * luminance wanders through the same band as muted paper, and the only thing
 * holding the type off it is a `0 0 26px` halo. A mask is `overflow: clip` at
 * the LINE BOX — so it would cut that halo into a hard rectangle exactly where
 * the field is brightest. The descender problem the mask block in globals.css
 * describes is this same problem an order of magnitude smaller: a 26px shadow
 * needs 26px of room, and the leading a display quote can carry is about 14px.
 *
 * `overflow-clip-margin` is not the way out. globals.css already rejects it,
 * and for a reason that applies here too: room bought below one line is room
 * the next line's word would be visible in on its way up.
 *
 * ── WHAT THIS IS INSTEAD ───────────────────────────────────────────────────
 * Nothing is ever clipped and nothing ever fades. Every word is always fully
 * painted, at full contrast, with its halo whole — it is only DISPLACED. At
 * the head of the passage the quote is a swell: one sine wave rolling through
 * the figure, the Latin at its leading edge and the attribution at its
 * trailing one. As the reader scrolls, the amplitude damps to zero and the sea
 * goes flat, the last word stilling last.
 *
 * Three things that buys, beyond the halo:
 *
 *   · IT IS THE COPY. The line is about a ship that does not know its port and
 *     a wind that therefore cannot help it. The words arrive on a swell and
 *     come to rest. The motion is the sentence.
 *
 *   · IT COSTS ALMOST NOTHING. The phase is a pure function of scroll
 *     position, so a reader who stops gets a rect read per frame and no
 *     writes, and a reader anywhere else on this very tall page gets nothing
 *     at all — the ticker is only subscribed while the figure is within a
 *     viewport of the screen. On a page whose budget is the liquid's fill
 *     rate, that is the only kind of coda worth adding.
 *
 *   · IT IS NEVER UNREADABLE. Reduced motion renders the resting state and
 *     registers nothing; and even at full swell the quote is legible, so no
 *     reader is ever waiting on motion to finish before the copy exists.
 *
 * The split is `type: "words"` only — no lines, no masks — so the browser's own
 * line breaking is untouched, and `autoSplit` re-measures on a resize or a late
 * font. `aria: "auto"` (the plugin default, explicit here because this split
 * PERSISTS rather than reverting on settle) labels the paragraph with the whole
 * sentence and hides the pieces from the accessibility tree.
 *
 * ── WHY THERE IS NO SCROLLTRIGGER ──────────────────────────────────────────
 * There was one, and it read `progress === 1` at every scroll position on the
 * homepage. ScrollTrigger caches `start` and `end` as ABSOLUTE scroll offsets
 * at creation, and this page is still growing when a leaf component hydrates:
 * the origin journey opens to 700svh and the chapters below stream in. The
 * cached offsets end up pointing somewhere near the top of a document that has
 * since become several times taller, so by the time the coda is on screen the
 * trigger believes it was passed long ago. Nothing throws — it just hands back
 * a plausible 1.0 forever. DocReveal documents the same hazard and dodges it
 * by deferring creation until the page settles; that is enough for a one-shot
 * `once: true` reveal and is NOT enough for a scrubbed one, which stays wrong
 * for good if anything moves afterwards.
 *
 * So progress comes from `getBoundingClientRect()` on the frame it is used —
 * a number that cannot be stale — and the only thing that needs to be right is
 * WHEN to read it. That is an IntersectionObserver, which is the sentinel this
 * page already wants for scroll work: Lenis rewrites scrollY every frame and
 * native scroll events arrive both sparse and behind.
 */
export function ManifestoQuote({ latin, quote, attribution, source }: Props) {
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLElement | null>(null);
  const lineRef = useRef<HTMLParagraphElement | null>(null);
  const latinRef = useRef<HTMLParagraphElement | null>(null);
  const citeRef = useRef<HTMLElement | null>(null);
  const ruleRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (reduced) return;
    // Read every node ONCE, here. The cleanup below writes to the three the
    // split does not own, and a ref read at teardown is not guaranteed to be
    // the node this effect actually wrote to.
    const root = rootRef.current;
    const line = lineRef.current;
    const latinEl = latinRef.current;
    const citeEl = citeRef.current;
    const ruleEl = ruleRef.current;
    if (!root || !line) return;

    gsap.registerPlugin(SplitText);

    // Progress is read from the figure's LIVE rect, never from a cached scroll
    // offset. See the note on ScrollTrigger in the block comment above.
    const readProgress = () => {
      const h = window.innerHeight || 1;
      const top = root.getBoundingClientRect().top;
      return gsap.utils.clamp(0, 1, (START * h - top) / ((START - END) * h));
    };

    let detach: (() => void) | null = null;

    const split = SplitText.create(line, {
      type: "words",
      wordsClass: "manifesto-word",
      aria: "auto",
      autoSplit: true,
      onSplit: (self) => {
        // A re-split (resize, late font) invalidates both the element list and
        // the measured swell height. Tear the old reader down and rebuild
        // against the layout that exists now.
        detach?.();

        // The swell scales with the type, so it reads the same at the 3.5rem
        // desktop clamp and the 1.75rem mobile one. Measured per split, which
        // is exactly when the clamp can have moved.
        const em = parseFloat(getComputedStyle(line).fontSize) || 16;

        // The figure rides ONE wave: Latin at the leading edge, the words in
        // reading order, the attribution at the trailing edge. `place` is each
        // element's position along that wave, 0 → 1.
        const words = self.words as HTMLElement[];
        const riders = [
          { el: latinEl, place: 0 },
          ...words.map((word, i) => ({
            el: word,
            place: (i + 1) / (words.length + 1),
          })),
          { el: citeEl, place: 1 },
        ].filter((r): r is { el: HTMLElement; place: number } => Boolean(r.el));

        const setY = riders.map((r) => gsap.quickSetter(r.el, "y", "px"));
        const setRule = ruleEl ? gsap.quickSetter(ruleEl, "scaleX") : null;

        const draw = (progress: number) => {
          const calm = calmness(progress);
          for (let i = 0; i < riders.length; i++) {
            setY[i](em * swell(progress, riders[i].place, calm));
          }
          // The rule is the one beat that is not the sea: it draws out from the
          // left as the sea flattens, and gives the quote a foot to stand on.
          setRule?.(calm);
        };

        // ── THE CLOCK ──────────────────────────────────────────────────────
        // gsap.ticker is already Lenis's clock (LenisProvider feeds it), so a
        // frame here is a frame the page was rendering anyway. It is only
        // SUBSCRIBED while the figure is within a viewport of the screen, and
        // it writes only when progress has actually moved — so a reader
        // stopped on the quote pays a rect read per frame and nothing else,
        // and a reader anywhere else on this very tall page pays nothing.
        let last = -1;
        const frame = () => {
          const p = readProgress();
          if (Math.abs(p - last) < 0.0005) return;
          last = p;
          draw(p);
        };

        let ticking = false;
        const watch = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting === ticking) return;
            ticking = entry.isIntersecting;
            if (ticking) gsap.ticker.add(frame);
            else {
              gsap.ticker.remove(frame);
              // Land on the clamped end state. A flick past the figure can
              // otherwise leave the sea frozen mid-swell above the fold.
              last = -1;
              frame();
            }
          },
          { rootMargin: "100% 0px 100% 0px" },
        );
        watch.observe(root);

        detach = () => {
          watch.disconnect();
          if (ticking) gsap.ticker.remove(frame);
          ticking = false;
        };

        draw(readProgress());
      },
    });

    return () => {
      detach?.();
      split.revert();
      // quickSetter wrote transforms straight onto these three; the split does
      // not own them, so reverting it cannot give them back.
      const kept = [latinEl, citeEl, ruleEl].filter(
        (el): el is HTMLElement => Boolean(el),
      );
      if (kept.length) gsap.set(kept, { clearProps: "transform" });
    };
  }, [reduced]);

  return (
    <figure className="manifesto page-x" ref={rootRef}>
      <p className="manifesto-latin" lang="la" ref={latinRef}>
        {latin}
      </p>
      <blockquote className="manifesto-stream">
        <p className="manifesto-line font-poetic" ref={lineRef}>
          {quote}
        </p>
      </blockquote>
      <span className="manifesto-rule" aria-hidden="true" ref={ruleRef} />
      <figcaption className="manifesto-cite" ref={citeRef}>
        <span className="manifesto-author">{attribution}</span>
        <span className="manifesto-source">{source}</span>
      </figcaption>
    </figure>
  );
}

/**
 * ── THE SWELL ──────────────────────────────────────────────────────────────
 * The whole character of the coda is these two functions, and they are the only
 * place to tune it. Everything above is plumbing.
 *
 * `calmness` is how the sea flattens: 0 = full swell, 1 = dead flat. A
 * smoothstep, so the first and last scroll of the passage do almost nothing and
 * the settling happens in the middle, where the reader is looking.
 *
 * `swell` returns a rider's displacement in EM (the caller multiplies by the
 * measured font size). Three numbers decide how it reads:
 *
 *   REST    peak displacement at full swell. Past ~0.3em the line stops reading
 *           as type on water and starts reading as broken layout.
 *   CRESTS  how many full waves are visible across the figure at once. Below 1
 *           the whole quote heaves as a single block; past ~2.5 adjacent words
 *           move opposite each other and it reads as jitter, not sea.
 *   TRAVEL  how far the wave rolls THROUGH the copy over the passage, in
 *           radians. This is the one that decides whether the swell is a tide
 *           moving through the words or a standing wave shrinking in place —
 *           at zero it is a standing wave.
 */
const REST = 0.26;
const CRESTS = 1.6;
const TRAVEL = Math.PI * 2.2;

function calmness(progress: number): number {
  const p = Math.min(Math.max(progress, 0), 1);
  return p * p * (3 - 2 * p);
}

function swell(progress: number, place: number, calm: number): number {
  const phase = progress * TRAVEL - place * CRESTS * Math.PI * 2;
  return REST * (1 - calm) * Math.sin(phase);
}
