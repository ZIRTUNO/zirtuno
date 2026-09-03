"use client";

import { Component, lazy, Suspense, type ReactNode } from "react";

/**
 * S7's SIGILS — an OPTIONAL, CLOCK-DRIVEN Rive slot beside each idea (R7).
 *
 * The same contract as the intro's Rive layer (components/chrome/IntroRive):
 * Rive is the right tool for authored vector expression — a small symbolic
 * sequence for each idea, the west wind's line for Zéfiro, a heading found
 * for Ventura — and the wrong tool for a second clock. So the artboard is
 * SCRUBBED: the only thing that moves it is a number input the chapter's
 * director writes from the runway's own p, and the file must expose no
 * self-advancing state. It is never the particle system; that is the mist.
 *
 * ── the authoring contract ─────────────────────────────────────────────────
 * Set `NEXT_PUBLIC_ORIGIN_RIVE` to the file's public path (for example
 * `/brand/origin.riv`) and both sigils mount. Leave it unset — the shipped
 * default — and neither the chunk nor the request exists; the chapter reads
 * complete without them. The file must provide:
 *
 *   artboard        "Origin"
 *   state machine   "Origin"
 *   number input    "idea",     0 = Zéfiro · 1 = Ventura (set once)
 *   number input    "progress", 0 → 100, the chapter's p across the ideas
 *                   beat, mapped through a 1-D BLEND STATE
 *
 * Every visual must be a function of `progress` alone: no loops, no triggers,
 * no time-based transitions. The layer is decorative and aria-hidden; the
 * idea's name, gloss and line are the reading path (AGENTS.md §4.12).
 */

/** Statically replaced at build time — unset means the slots do not exist. */
export const ORIGIN_RIVE_SRC = process.env.NEXT_PUBLIC_ORIGIN_RIVE ?? "";

const Runtime = lazy(() => import("./OriginRiveRuntime"));

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// The sigils' setters, module-scoped so the director (which mounts once per
// chapter) can drive every mounted sigil without a context or a render.
const setters = new Set<(p: number) => void>();

/** Runtime side: register a progress setter; returns the unregister. */
export function bindOriginRive(set: (p: number) => void): () => void {
  setters.add(set);
  return () => {
    setters.delete(set);
  };
}

/** Director side: the ideas beat's local progress, 0..1, to every sigil. */
export function driveOriginRive(local: number): void {
  if (setters.size === 0) return;
  const v = local < 0 ? 0 : local > 1 ? 1 : local;
  for (const set of setters) set(v);
}

export function OriginRive({ idea }: { idea: 0 | 1 }) {
  if (!ORIGIN_RIVE_SRC) return null;
  return (
    <span className="origin-idea-sigil" aria-hidden="true">
      <Boundary>
        <Suspense fallback={null}>
          <Runtime src={ORIGIN_RIVE_SRC} idea={idea} />
        </Suspense>
      </Boundary>
    </span>
  );
}
