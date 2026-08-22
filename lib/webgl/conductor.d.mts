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
    /** Opt-in area-weighted/viscous review path (?fphysv3=1). */
    physicsV3?: boolean;
    /** Opt-in cached typography/card flow; requires physicsV3 (?fobstacles=1). */
    obstacleFlow?: boolean;
    /** false = no click strike and no press gain (?fstrike=0); default true. */
    strike?: boolean;
    /** false = neutral score and no veils (?fcine=0); default true. */
    cine?: boolean;
  },
): Conductor;
