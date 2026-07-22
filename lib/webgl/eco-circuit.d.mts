// Types for eco-circuit.mjs — THE CIRCULATION's shared geometry.

export const ECO_ORDER: number[];
export const ECO_N: number;
export const ECO_SYSTEMS: { id: string; slots: number[] }[];
export const ARTERY_SLOTS: number[];

export function ringRadii(aspect: number): { rx: number; ry: number };
export function socketPos(s: number, aspect: number): { x: number; y: number };
export function socketNormal(s: number): { x: number; y: number };
export function ringPoint(u: number, aspect: number): { x: number; y: number };
export function arteryPoint(
  a: number,
  f: number,
  aspect: number,
): { x: number; y: number };

export function nodeTiming(s: number): { d: number; w: number };
export function arteryTiming(a: number): { d: number; w: number };
export function edgeTiming(s: number): { d: number; w: number };
export function env(grow: number, t: { d: number; w: number }): number;
export function closurePulse(grow: number, u: number): number;

export function DOCK_OF(i: number): number;
export function ARTERY_OF(i: number): number;
export const RING_BEADS: number;
export function RING_PHASE(i: number): number;
export const RING_SPEED: number;
export const ARTERY_PERIOD: number;

export function pulseDistances(origin: number): number[];
