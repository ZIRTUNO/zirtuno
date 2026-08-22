"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/animation/reduced-motion";
import { ProofOrb, type ProofOrbHandle } from "./ProofOrb";

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

/**
 * THE ORB — `thinking-orbs`, in Zirtuno's ink. See ProofOrb.
 *
 * `composing` is the undulating multi-band sash, and 20 is the package's
 * inline-text design (64 is the other, and it is a separate tuning rather than
 * the same orb scaled). The orb owns its own animation; this row owns only
 * WHEN it is on and what happens to it as the light leaves.
 */
const ORB_STATE = "composing" as const;
const ORB_SIZE = 20 as const;

/**
 * Where in a callout's crossing the sphere starts becoming the check.
 *
 * The morph is not a fade between two drawings — it is the dots travelling —
 * so it needs room to be read. It gets the last 38% of the crossing, about
 * 220 ms at the row's pace, which is long enough to see the gather and short
 * enough that the light does not visibly wait for it.
 */
const MORPH_FROM = 0.62;

const smooth = (t: number) => t * t * (3 - 2 * t);

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The proof row.
 *
 * The reference's signature is not the checklist — it is the LIGHT that runs
 * the checklist. A single beam travels the row and everything else is derived
 * from where it is: the orb charges because the light is on it, the label
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
  // the orbs are driven, not rendered: the loop below hands each one its morph
  // every frame, so the marks share the row's single clock and React never
  // re-renders for a scroll
  const orbsRef = useRef<(ProofOrbHandle | null)[]>([]);
  const atsRef = useRef<number[]>([]);

  /** the same window the CSS derives --q from, computed for the canvases */
  const pushMorph = (sweep: number) => {
    const ats = atsRef.current;
    for (let i = 0; i < orbsRef.current.length; i++) {
      const at = ats[i];
      if (at === undefined) continue;
      const q = Math.min(1, Math.max(0, (sweep - at) / SPAN));
      orbsRef.current[i]?.setMorph((q - MORPH_FROM) / (1 - MORPH_FROM));
    }
  };

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
        // then does the orb begin to charge — the light visibly arrives before
        // anything answers it. On the mark, the orb wakes the instant the beam
        // touches it and resolves as the beam clears the label.
        const anchor = cell.querySelector(".lab-proof-mark") ?? cell;
        const anchorBox = anchor.getBoundingClientRect();
        const at = wrapped
          ? (i + 0.5) / cells.length
          : (anchorBox.left + anchorBox.width / 2 - box.left) /
            Math.max(box.width, 1);
        cell.style.setProperty("--at", at.toFixed(4));
        // the canvases cannot read a CSS custom property cheaply per frame, so
        // the same measurement is kept here for the loop to derive from
        atsRef.current[i] = at;
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
      // the orb is a motion, not a state: reduced motion gets the resolved
      // check, and ProofOrb paints itself a single static frame
      row.dataset.live = "false";
      pushMorph(TO);
      return;
    }

    const CYCLE = (RUN_MS + HOLD_MS) * 2;
    let raf = 0;
    let start = performance.now();
    let running = true;
    let last = "";

    // ONE attribute, read by CSS. The orbs park themselves (each canvas keeps
    // its own IntersectionObserver); this only tells the ROW's derivations that
    // the light has stopped.
    const setLive = (live: boolean) => {
      const next = live ? "true" : "false";
      if (row.dataset.live !== next) row.dataset.live = next;
    };
    setLive(true);

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
        pushMorph(Number(next));
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
          setLive(true);
          start = performance.now();
          raf = requestAnimationFrame(tick);
        } else if (!entry.isIntersecting) {
          running = false;
          setLive(false);
          cancelAnimationFrame(raf);
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(row);

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        setLive(false);
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        setLive(true);
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
        {items.map((item, i) => (
          <li key={item} className="lab-proof-item">
            <span className="lab-proof-mark" aria-hidden="true">
              {/* THE MARK. The orb and the check are the same object — the
                  sphere's own dots travel into the tick and back. See
                  ProofOrb; the row only says how far along that is. */}
              <span className="lab-proof-orb">
                <ProofOrb
                  ref={(node) => {
                    orbsRef.current[i] = node;
                  }}
                  state={ORB_STATE}
                  size={ORB_SIZE}
                />
              </span>

              {/* The static mark, for the reading paths that have no canvas:
                  no JS, and any browser where the orb fails to mount. CSS
                  hides it the moment the row reports a live orb, so it is a
                  fallback and never a second thing drawn over the first. */}
              <svg className="lab-proof-static" viewBox="0 0 16 16" fill="none">
                <path
                  className="lab-proof-tick"
                  d="M3.4 8.2 L6.5 11.3 L12.6 5.2"
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
