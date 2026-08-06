"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/animation/reduced-motion";

const ARRIVE = [0.22, 1, 0.36, 1] as const;

/** The callouts restart from rings and resolve into checks on every word beat. */
export function ProofRow({
  items,
  cycle,
}: {
  items: string[];
  cycle: number;
}) {
  const reduced = useReducedMotion();

  return (
    <ul className="lab-proof" data-cycle={cycle}>
      {items.map((item, i) => {
        const delay = 0.68 + i * 0.18;
        return (
          <motion.li
            key={`${cycle}-${item}`}
            className="lab-proof-item"
            initial={reduced ? false : { opacity: 0.62 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduced ? 0 : delay, duration: 0.34 }}
          >
            <span className="lab-proof-mark" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none">
                <motion.circle
                  className="lab-proof-ring"
                  cx="8"
                  cy="8"
                  r="6"
                  initial={reduced ? false : { opacity: 1, scale: 1 }}
                  animate={{ opacity: 0, scale: 0.78 }}
                  transition={{
                    delay: reduced ? 0 : delay,
                    duration: 0.24,
                    ease: ARRIVE,
                  }}
                />
                <motion.path
                  className="lab-proof-tick"
                  d="M4.4 8.3 L6.9 10.8 L11.7 5.6"
                  initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{
                    delay: reduced ? 0 : delay + 0.08,
                    duration: 0.34,
                    ease: ARRIVE,
                  }}
                />
              </svg>
            </span>
            <motion.span
              className="lab-proof-label"
              initial={reduced ? false : { opacity: 0.58 }}
              animate={{ opacity: 1 }}
              transition={{
                delay: reduced ? 0 : delay + 0.04,
                duration: 0.38,
              }}
            >
              {item}
            </motion.span>
            <span className="lab-proof-rule" aria-hidden="true">
              <motion.span
                className="lab-proof-rule-fill"
                initial={reduced ? false : { scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{
                  delay: reduced ? 0 : delay + 0.02,
                  duration: 0.46,
                  ease: ARRIVE,
                }}
              />
            </span>
          </motion.li>
        );
      })}
    </ul>
  );
}
