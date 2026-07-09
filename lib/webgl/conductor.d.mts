/** Types for the conductor core (conductor.mjs). Keep in sync. */

import type { SceneModule, Conductor } from "./scenes/types";

export declare const EPS_PRESENCE: number;
export declare const EPS_FORM: number;

export declare function makeConductor(
  scenes: SceneModule[],
  opts?: {
    ballMax?: number;
    /** false = the legacy low-pass integrator (?fphys=0); default true. */
    physics?: boolean;
  },
): Conductor;
