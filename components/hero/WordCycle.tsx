"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/lib/animation/reduced-motion";

/**
 * The widths have to exist BEFORE the first paint.
 *
 * Measured in a plain effect, the slot paints once with no width at all — and a
 * slot with no width is sized by its content, which is exactly the thing the
 * measurement exists to stop.
 */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

const ARRIVE = [0.22, 1, 0.36, 1] as const;
const LEAVE = [0.55, 0, 0.85, 0.3] as const;

/** per-character beats. Typed in left to right; cleared right to left, the way
 *  a line actually gets rewritten — the word is unmade, then written again. */
const TYPE_STAGGER = 0.034;
const CLEAR_STAGGER = 0.016;
const TYPE_MS = 0.32;
const CLEAR_MS = 0.19;

/**
 * VARIANTS, not per-letter props.
 *
 * Hanging initial/animate/exit on each letter while the face above them
 * declared nothing left AnimatePresence with no orchestration to drive: the
 * letters mounted at their resting values and the word went back to swapping.
 * Variants are the mechanism that actually cascades — the face names a state,
 * every letter inherits that name, and staggerChildren is what turns the
 * cascade into a sequence.
 */
const FACE = {
  written: { transition: { staggerChildren: TYPE_STAGGER } },
  // staggerDirection -1 clears from the tail, so the word unwrites itself
  cleared: { transition: { staggerChildren: CLEAR_STAGGER, staggerDirection: -1 } },
} as const;

const LETTER = {
  blank: { opacity: 0, y: "26%" },
  written: {
    opacity: 1,
    y: "0%",
    transition: { duration: TYPE_MS, ease: ARRIVE },
  },
  cleared: {
    opacity: 0,
    y: "-18%",
    transition: { duration: CLEAR_MS, ease: LEAVE },
  },
} as const;

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/**
 * One box per VISIBLE character.
 *
 * Splitting on code points would tear a combining accent off the letter it
 * belongs to and animate it as its own glyph — "ç" and "ã" reach these words
 * both precomposed and decomposed depending on where the copy came from, and
 * only grapheme segmentation is right for both. A plain space has to become a
 * non-breaking one on the way out: an inline-block wrapping a normal space
 * collapses to zero width and the word loses its gap.
 */
function splitGraphemes(word: string) {
  const raw = segmenter
    ? [...segmenter.segment(word)].map((s) => s.segment)
    : [...word];
  return raw.map((char) => (char === " " ? "\u00A0" : char));
}

/**
 * How wide is this word, really?
 *
 * NOT `getBoundingClientRect()`. That reports the box as PAINTED, so every
 * transform on every ancestor is baked into it — and this rig is measured from
 * inside two of them. The page transition holds the whole route at `scale(.8)`
 * across its enter timeline (`PageTransition`, ENTER_FROM), and the hero's own
 * camera tilts `.lab-plane` in perspective. Mounting during that window — which
 * is exactly what arriving from /contact does — measured every word at 80% of
 * itself and pinned the slot there: `crescimento` needs 221px and got 178. The
 * word is centred in its slot and nothing clips it, so it simply hung ~21px out
 * of both ends and sat on top of the words either side of it. Nothing ever
 * corrected it, either: ResizeObserver reports LAYOUT, and clearing a transform
 * changes no layout, so the one thing watching the rig stayed silent.
 *
 * The used `width` is the same layout value the observer reports — untouched by
 * transforms, and unlike `offsetWidth` it keeps its fraction, so `ceil` still
 * means "never narrower than the word".
 */
function layoutWidth(el: Element): number {
  const used = Number.parseFloat(getComputedStyle(el).width);
  return Math.ceil(
    Number.isFinite(used) ? used : el.getBoundingClientRect().width,
  );
}

/**
 * The changing noun.
 *
 * The slot is sized to the word CURRENTLY in it and eased between sizes. Held
 * at the widest word in the set instead, the sentence never moves — but a short
 * word then sits in a hole the length of the longest one, and "futuro" was
 * floating in 223px of dead space. Snug wins; the cost is that the line has to
 * give, so the width travels rather than jumps, and it travels in the beat
 * after the old word has cleared and before the new one is written, which is
 * the one moment nothing is on screen to be dragged sideways by it.
 *
 * The exchange is per-CHARACTER, not per word. Fading one whole face into
 * another reads as a swap — the word is simply a different word the next time
 * you look at it, with nothing in between. Staggering the letters gives the
 * change a direction and a duration: the old word is cleared from its tail and
 * the new one is written from its head, so it reads as the line being typed
 * rather than replaced.
 *
 * Every letter sits at its FINAL position the whole time and only opacity and
 * a small lift are animated. Laying letters out as they arrive would grow the
 * word from its centre and undo the fixed slot above — and opacity/transform
 * are the two things that cost the compositor nothing, which matters when a
 * long word is fourteen of them.
 */
export function WordCycle({ words, index }: { words: string[]; index: number }) {
  const reduced = useReducedMotion();
  const [widths, setWidths] = useState<number[]>([]);
  const sizerRef = useRef<HTMLSpanElement>(null);

  useIsomorphicLayoutEffect(() => {
    const sizer = sizerRef.current;
    if (!sizer) return;

    const candidates = [...sizer.children];

    const measure = () => {
      const next = candidates.map(layoutWidth);
      setWidths((current) =>
        current.length === next.length && current.every((w, i) => w === next[i])
          ? current
          : next,
      );
    };

    measure();
    let alive = true;
    // the display face changes the metrics — remeasure once it lands
    document.fonts?.ready.then(() => alive && measure());
    // One observer per CANDIDATE, not one on the rig. The rig shrink-wraps its
    // widest child, so a change to any other word — a font swap that only moves
    // "futuro" — never changes the rig's own box and never fires.
    const observer = new ResizeObserver(measure);
    for (const candidate of candidates) observer.observe(candidate);

    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [words]);

  const safeIndex = Math.max(0, Math.min(index, words.length - 1));
  const word = words[safeIndex] ?? "";
  const letters = splitGraphemes(word);

  const slot = widths[safeIndex] ?? 0;

  // The width is a plain style with a CSS transition, NOT a Motion value.
  // Motion only writes a style when it has something to animate, so on mount —
  // where the target already equalled the measured width — it wrote nothing at
  // all and left the slot at auto. An auto slot is sized by the ghost below it,
  // and the ghost swaps to the new word the instant the index changes, so the
  // width jumped a whole word before Motion ever took control. An explicit
  // width is never auto, and the transition lives in lab.css so reduced motion
  // switches it off with everything else.
  return (
    <span
      className="lab-word"
      style={slot ? { width: `${slot}px` } : undefined}
    >
      <span className="lab-word-sizer" ref={sizerRef} aria-hidden="true">
        {words.map((candidate) => (
          <span key={candidate}>{candidate}</span>
        ))}
      </span>

      <span className="lab-word-clip">
        {/* both faces are absolute so they can overlap during the exchange —
            this ghost is what still gives the clip its height */}
        <span className="lab-word-ghost" aria-hidden="true">
          {word}
        </span>
        {reduced ? (
          <span className="lab-word-face">{word}</span>
        ) : (
          // wait, not sync: the old word finishes clearing before the new one
          // starts being written. Overlapping them is the cross-fade again.
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              key={word}
              className="lab-word-face"
              variants={FACE}
              initial="blank"
              animate="written"
              exit="cleared"
            >
              {letters.map((char, i) => (
                <motion.span
                  className="lab-word-char"
                  key={`${word}-${i}`}
                  variants={LETTER}
                >
                  {char}
                </motion.span>
              ))}
            </motion.span>
          </AnimatePresence>
        )}
      </span>
    </span>
  );
}
