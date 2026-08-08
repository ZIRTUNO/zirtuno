"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/animation/reduced-motion";

const RUN_MS = 3200; // one pass across the row
const HOLD_MS = 1000; // the rest at each end

/**
 * The saber's length, as a fraction of the row.
 *
 * ONE number: the beam element is this wide and every callout's fill window is
 * this long, so the light can never be a different size than the window it
 * opens. It is written to the DOM rather than duplicated in CSS.
 */
const SPAN = 0.18;

/** the light starts and finishes fully outside the row, so it ENTERS and
 *  LEAVES instead of materialising on the first callout and blinking out on
 *  the last. The extra travel at the far end is what lets the final callout
 *  actually complete — its window closes a full beam-length past its centre. */
const FROM = -SPAN * 0.6;
const TO = 1 + SPAN * 1.1;

const smooth = (t: number) => t * t * (3 - 2 * t);

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The proof row.
 *
 * The reference's signature is not the checklist — it is the LIGHT that runs
 * the checklist. A single beam travels the row and everything else is derived
 * from where it is: the ring fills because the light is on it, the label
 * brightens because the light is on it, the trace exists because the light drew
 * it. Nothing is keyframed, which is why running back costs nothing — the beam
 * reverses and every derivation unwinds with it.
 *
 * One driver, one variable. The loop writes `--sweep` on the row and each
 * callout derives its own `--q` from that number against its own `--at`, so a
 * frame costs four CSS calc()s instead of four React renders.
 */
export function ProofRow({ items }: { items: string[] }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // ── where each callout actually sits ──────────────────────────────────────
  // Measured, never assumed. "One partner, one system" is barely half the width
  // of "From diagnosis to evolution", so an even 1/n split would light every
  // callout at a moment the beam is nowhere near it.
  useIsomorphicLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const measure = () => {
      const cells = Array.from(
        row.querySelectorAll<HTMLLIElement>(".lab-proof-item"),
      );
      if (cells.length === 0) return;

      const box = row.getBoundingClientRect();
      const firstTop = cells[0].getBoundingClientRect().top;
      // A wrapped row cannot share one beam — the light would have to jump
      // lines. Narrow stages fall back to a rule under each callout.
      const wrapped = cells.some(
        (cell) => Math.abs(cell.getBoundingClientRect().top - firstTop) > 1,
      );

      row.dataset.wrapped = wrapped ? "true" : "false";
      row.style.setProperty("--row-w", `${box.width.toFixed(1)}px`);

      cells.forEach((cell, i) => {
        // Anchored to the MARK, not to the callout. Anchored to the callout's
        // centre the light crosses the mark, travels half the label, and only
        // then does the ring begin to fill — the light visibly arrives before
        // anything answers it. On the mark, the ring starts the instant the
        // beam touches it and finishes as the beam clears the label.
        const anchor = cell.querySelector(".lab-proof-mark") ?? cell;
        const anchorBox = anchor.getBoundingClientRect();
        const at = wrapped
          ? (i + 0.5) / cells.length
          : (anchorBox.left + anchorBox.width / 2 - box.left) /
            Math.max(box.width, 1);
        cell.style.setProperty("--at", at.toFixed(4));
      });
    };

    measure();
    let alive = true;
    // the mono face changes every label's width — measure again once it lands
    document.fonts?.ready.then(() => {
      if (alive) measure();
    });
    const observer = new ResizeObserver(measure);
    observer.observe(row);

    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [items]);

  // ── the light ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    if (reduced) {
      row.style.setProperty("--sweep", String(TO));
      row.dataset.phase = "held";
      return;
    }

    const CYCLE = (RUN_MS + HOLD_MS) * 2;
    let raf = 0;
    let start = performance.now();
    let running = true;
    let last = "";

    const tick = (now: number) => {
      if (!running) return;
      const e = (now - start) % CYCLE;
      let travel: number;
      let phase: string;
      if (e < RUN_MS) {
        travel = smooth(e / RUN_MS);
        phase = "forward";
      } else if (e < RUN_MS + HOLD_MS) {
        travel = 1;
        phase = "held";
      } else if (e < RUN_MS * 2 + HOLD_MS) {
        travel = 1 - smooth((e - RUN_MS - HOLD_MS) / RUN_MS);
        phase = "reverse";
      } else {
        travel = 0;
        phase = "empty";
      }
      // Only write when the value actually moved. Through the two rests the
      // sweep is a constant, and writing it anyway forced a style recalc of the
      // whole row every frame for no visible change.
      const next = (FROM + travel * (TO - FROM)).toFixed(4);
      if (next !== last) {
        last = next;
        row.style.setProperty("--sweep", next);
      }
      // the phase turns the beam around and rests it — see lab.css
      if (row.dataset.phase !== phase) row.dataset.phase = phase;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // never burn frames off-screen or on a hidden tab
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true;
          start = performance.now();
          raf = requestAnimationFrame(tick);
        } else if (!entry.isIntersecting) {
          running = false;
          cancelAnimationFrame(raf);
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(row);

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        start = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced]);

  return (
    <div
      className="lab-proof"
      ref={rowRef}
      data-wrapped="false"
      style={{ "--span": String(SPAN) } as React.CSSProperties}
    >
      <ul className="lab-proof-items">
        {items.map((item) => (
          <li key={item} className="lab-proof-item">
            <span className="lab-proof-mark" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none">
                {/* the mark at rest — quiet until the light finds it */}
                <circle className="lab-proof-track" cx="8" cy="8" r="6" />
                {/* the loading ring — draws from 12 o'clock as the beam crosses */}
                <circle className="lab-proof-ring" cx="8" cy="8" r="6" />
                {/* and resolves into the check as the beam leaves */}
                <path
                  className="lab-proof-tick"
                  d="M4.4 8.3 L6.9 10.8 L11.7 5.6"
                />
              </svg>
            </span>
            <span className="lab-proof-label">{item}</span>
            {/* only used when the row wraps and the shared track is dropped */}
            <span className="lab-proof-rule" aria-hidden="true">
              <span className="lab-proof-rule-fill" />
            </span>
          </li>
        ))}
      </ul>

      {/* the track the light runs, and the light itself */}
      <span className="lab-proof-line" aria-hidden="true">
        <span className="lab-proof-rail" />
        <span className="lab-proof-trace" />
        <span className="lab-proof-beam" />
      </span>
    </div>
  );
}
