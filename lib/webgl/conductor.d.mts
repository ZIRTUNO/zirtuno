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
    /** Multiplier on what the FORMS feel (?fformtouch=<n>); default 1. */
    formGain?: number;
    /** false = neutral score and no veils (?fcine=0); default true. */
    cine?: boolean;
    /** R6 — the SIMULATED droplet count. N (48) is the authored population and
     *  the floor; anything above it is motes (lib/webgl/motes.mjs), which are
     *  ordinary droplets whose targets are derived from a host's. Default N. */
    pop?: number;
    /** R6 — per-droplet temperament master, 0…1. 0 is a neutral bypass
     *  (?ftemper=0): pre-R6 motion, without a second code path. Default 1. */
    temper?: number;
    /** R6-B — multiplier on THE LEASH, the neighbourhood a free droplet may
     *  wander inside instead of being sprung to a point. 0 restores the
     *  pre-R6-B stiff spring exactly (?fleash=0). Default 1. */
    leash?: number;
  },
): Conductor;
