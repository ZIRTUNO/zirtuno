"use client";

import { Component, lazy, Suspense, type ReactNode } from "react";

/**
 * The intro's Rive layer — an OPTIONAL, TIMELINE-DRIVEN slot.
 *
 * Rive is the right tool for authored vector expression that would be tedious
 * or dishonest to fake in code: ink bleed at the meeting point, a hand-drawn
 * grain on the flood front, character in the droplets. What it must NOT be
 * here is a second clock. An artboard that autoplays beside a GSAP sequence
 * drifts within a frame or two, and drift is precisely what makes a composition
 * read as "several effects at once" rather than as one move — which is the
 * failure this whole intro is designed against.
 *
 * So the runtime is scrubbed: `autoplay` exists only to let the state machine
 * evaluate, and the ONLY thing that moves the artboard is a number input this
 * component writes from the master timeline's progress.
 *
 * ── the authoring contract ─────────────────────────────────────────────────
 * Set `NEXT_PUBLIC_INTRO_RIVE` to the file's public path (for example
 * `/brand/intro.riv`) and the layer mounts. Leave it unset — the shipped
 * default — and neither the chunk nor the request exists, and the sequence
 * plays complete without it. The file must provide:
 *
 *   artboard        "Intro"
 *   state machine   "Intro"
 *   number input    "progress", 0 → 100, mapped through a 1-D BLEND STATE
 *
 * The blend state is the load-bearing part: every visual must be a function of
 * `progress` alone. No self-advancing timeline states, no loops, no triggers,
 * no time-based transitions — if the artboard can move while `progress` is
 * held still, it is a second clock again and a skip will tear it.
 *
 * Compose against the SAME square design box the SVG uses (the artboard is
 * laid over the mark's stage, `Fit.Contain`, centred), so a mark-relative
 * effect lands where the mark actually is. The layer is decorative and
 * aria-hidden: it may never be the only carrier of anything (AGENTS.md §4.12).
 */

/** Statically replaced at build time — unset means the layer does not exist. */
export const INTRO_RIVE_SRC = process.env.NEXT_PUBLIC_INTRO_RIVE ?? "";

const Runtime = lazy(() => import("./IntroRiveRuntime"));

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * `bind` hands the parent a setter for 0..1 timeline progress. It is a callback
 * rather than a prop so the timeline can drive the artboard on GSAP's ticker
 * without a React render per frame — 200 renders in 3.4 s on the one surface
 * that is competing with the page's first paint is not a trade worth making.
 */
export function IntroRive({ bind }: { bind: (set: (p: number) => void) => void }) {
  if (!INTRO_RIVE_SRC) return null;
  return (
    <Boundary>
      <Suspense fallback={null}>
        <Runtime src={INTRO_RIVE_SRC} bind={bind} />
      </Suspense>
    </Boundary>
  );
}
