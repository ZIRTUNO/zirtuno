"use client";

import { useEffect, useRef } from "react";
import { HeroSphere, type HeroSphereHandle } from "./HeroSphere";
import { SPHERE_REST, type SphereState } from "@/lib/lab/sphere-shader";
import { useReducedMotion } from "@/lib/animation/reduced-motion";

/**
 * The sphere's workbench.
 *
 * The renderer is `HeroSphere` and the vocabulary is lib/lab/sphere-shader.ts.
 * All this adds is the two things you lose the moment an object stops being
 * mounted somewhere: A PLACE TO SEE IT, and THE ENTRY IT USED TO RUN.
 *
 * ── the entry, preserved verbatim ───────────────────────────────────────────
 *
 * This is the Hero's `useEffect`, moved rather than rewritten. It CONDENSES;
 * it does not fade. `gather` is staged at 0 before the first frame — a loose
 * shell of dust with no sphere in it yet — and released a beat later. The
 * driver's own tau (1.1 s, the slowest in the table, because assembling is the
 * one thing the sphere does whose whole job is to be watched) is the entire
 * easing: there is no keyframe and nothing to keep in sync with the CSS.
 *
 * Putting the sphere back on a page is this effect plus a `<HeroSphere />`.
 *
 * ── freezing a state ────────────────────────────────────────────────────────
 *
 * `overrides` snaps drivers before the first frame and suppresses the entry,
 * so `/lab/sphere?d=gather:0.35` is a still of the assembly a third of the way
 * in rather than an animation you have to catch. Same reason `/lab/forms`
 * takes `?fpair=` — a frozen frame is the only thing two runs can be compared
 * across.
 */

/** the beat the assembly is released on */
const GATHER_RELEASE_MS = 900;

export interface LabSphereStageProps {
  /** Drivers (or clocks) to snap before the first frame. Suppresses the entry. */
  overrides?: Partial<SphereState>;
  /** Cloud size. Omit to let the stage width decide, as the Hero did. */
  dots?: number;
  /** Whether the sphere leans to the pointer. */
  pointer?: boolean;
}

export function LabSphereStage({
  overrides,
  dots,
  pointer = true,
}: LabSphereStageProps) {
  const sphereRef = useRef<HeroSphereHandle>(null);
  const reduced = useReducedMotion();
  const frozen = overrides !== undefined && Object.keys(overrides).length > 0;

  useEffect(() => {
    const sphere = sphereRef.current;
    if (!sphere || reduced) return;

    // A frozen frame is not a moment in an animation — it is the state itself.
    // Snap what was asked for, leave the rest at rest, and run no entry.
    if (frozen) {
      sphere.snap({ ...SPHERE_REST, ...overrides });
      return;
    }

    sphere.snap({ gather: 0 });
    const id = window.setTimeout(
      () => sphere.set({ gather: 1 }),
      GATHER_RELEASE_MS,
    );
    return () => window.clearTimeout(id);
  }, [reduced, frozen, overrides]);

  return (
    <HeroSphere
      ref={sphereRef}
      className="lab-sphere-solo"
      dots={dots}
      pointer={pointer}
    />
  );
}
