/** Types for the conductor core (conductor.mjs). Keep in sync. */

import type { SceneModule, Conductor } from "./scenes/types";

export declare const EPS_PRESENCE: number;
export declare const EPS_FORM: number;
export declare const FLASH_ATTACK_MS: number;
export declare const FLASH_DECAY_MS: number;
export declare const FLASH_GLOW_MS: number;

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
    /** false = neutral score, no veils/flash (?fcine=0); default true. */
    cine?: boolean;
  },
): Conductor;
