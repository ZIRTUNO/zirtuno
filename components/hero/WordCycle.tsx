"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/lib/animation/reduced-motion";

const ARRIVE = [0.22, 1, 0.36, 1] as const;
const DEPART = [0.64, 0, 0.78, 0] as const;

/**
 * The changing noun keeps the baseline calm while its individual letters leave
 * right-to-left and arrive left-to-right. The measured slot eases to the next
 * width at the same time, so the complete line recentres instead of snapping.
 */
export function WordCycle({ words, index }: { words: string[]; index: number }) {
  const reduced = useReducedMotion();
  const [widths, setWidths] = useState<number[]>([]);
  const sizerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const sizer = sizerRef.current;
    if (!sizer) return;

    const measure = () => {
      const next = [...sizer.children].map((child) =>
        Math.round(child.getBoundingClientRect().width * 100) / 100,
      );
      setWidths((current) =>
        current.length === next.length && current.every((w, i) => w === next[i])
          ? current
          : next,
      );
    };

    measure();
    let alive = true;
    document.fonts?.ready.then(() => alive && measure());
    const observer = new ResizeObserver(measure);
    observer.observe(sizer);

    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [words]);

  const safeIndex = Math.max(0, Math.min(index, words.length - 1));
  const word = words[safeIndex] ?? "";
  const width = widths[safeIndex];

  return (
    <motion.span
      className="lab-word"
      initial={false}
      animate={width ? { width } : undefined}
      transition={{ duration: reduced ? 0 : 0.68, ease: ARRIVE }}
    >
      <span className="lab-word-sizer" ref={sizerRef} aria-hidden="true">
        {words.map((candidate) => (
          <span key={candidate}>{candidate}</span>
        ))}
      </span>

      <span className="lab-word-clip">
        {reduced ? (
          <span className="lab-word-face">{word}</span>
        ) : (
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              key={word}
              className="lab-word-face"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={{
                hidden: {},
                visible: {
                  transition: { delayChildren: 0.04, staggerChildren: 0.04 },
                },
                exit: {
                  transition: {
                    staggerChildren: 0.022,
                    staggerDirection: -1,
                  },
                },
              }}
            >
              {[...word].map((character, characterIndex) => (
                <motion.span
                  key={`${character}-${characterIndex}`}
                  className="lab-word-char"
                  variants={{
                    hidden: {
                      opacity: 0,
                      y: "0.14em",
                      filter: "blur(3px)",
                      clipPath: "inset(100% 0 0 0)",
                    },
                    visible: {
                      opacity: 1,
                      y: 0,
                      filter: "blur(0px)",
                      clipPath: "inset(0% 0 0 0)",
                      transition: { duration: 0.3, ease: ARRIVE },
                    },
                    exit: {
                      opacity: 0,
                      y: "-0.08em",
                      filter: "blur(2px)",
                      clipPath: "inset(0 0 100% 0)",
                      transition: { duration: 0.18, ease: DEPART },
                    },
                  }}
                >
                  {character}
                </motion.span>
              ))}
            </motion.span>
          </AnimatePresence>
        )}
      </span>
    </motion.span>
  );
}
