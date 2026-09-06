/** Types for the companion kernel (companion.mjs). Keep in sync by hand. */

/**
 * The parameter vector's channel names. Every expression is a point in this
 * space; there is no channel that is not listed here, and in particular there
 * is no warm colour channel — `chill` runs cyan -> cyan-deep and nowhere else.
 */
export type CompanionParam =
  | "open"
  | "squint"
  | "brow"
  | "askew"
  | "crest"
  | "tension"
  | "swell"
  | "lean"
  | "tilt"
  | "jitter"
  | "sag"
  | "spread"
  | "gaze"
  | "pulse"
  | "chill";

/**
 * The named expressions, one per thing a visitor can do to the contact form.
 *
 * `doubt` is skepticism while a value is still being typed; `angry` is the
 * state a REJECTED SUBMIT puts it in. `fail` is a delivery failure, which is
 * deflation rather than anger — that one is not the visitor's fault.
 */
export type CompanionExpression =
  | "rest"
  | "notice"
  | "attend"
  | "read"
  | "ponder"
  | "doubt"
  | "angry"
  | "approve"
  | "effort"
  | "hold"
  | "fail"
  | "delivered"
  | "curious"
  | "startled"
  | "dodge";

/**
 * The companion satisfies `membrane-runtime`'s `Driven` contract, so the shared
 * scheduler drives it exactly as it drives a CTA: same pointer, same hand, same
 * tide, same visibility. That is not an imitation of the button behaviour — the
 * droplet runs `makeMembrane` on its own ring.
 */
export type Companion = {
  /** The pointer, in the membrane's space (viewBox units, centred on the body). */
  hand(x: number | null, y?: number, vx?: number, vy?: number): void;
  press(down: boolean): void;
  /** A travelling shock from a point — the wave a pressed CTA runs. */
  strike(x: number, y: number, tMs: number, strength?: number): void;
  arrive(fromBelow: boolean, tMs: number): void;
  setTide(on: number): void;
  scroll(pxPerSec: number): void;
  /** Stop aiming; the gaze returns to its idle wander. */
  release(): void;
  /** 0..1 proximity wake, straight off the membrane. */
  readonly aware: number;
  /** 0..1 — how much strike energy is still in the surface. */
  readonly charge: number;
  /**
   * The runtime's sleep signal, and always false: the breath runs on an 8 s
   * clock and the liquid does not freeze. Parking is the caller's job, through
   * visibility.
   */
  readonly asleep: boolean;
  /** The body's radius toward an angle, read off the drawn contour. */
  radiusAt(a: number): number;
  /** Look at a point in normalized units; anything outside the unit disc is clamped. */
  aim(nx: number, ny: number): void;
  /** Switch expression. An unknown name falls through to `rest` rather than throwing. */
  express(next: CompanionExpression | string): void;
  /** A press arriving from direction (nx, ny). Squashes the body along that axis. */
  poke(nx: number, ny: number, amount?: number): void;
  /** A keystroke. Adds to the nod without resetting its decay. */
  tick(amount?: number): void;
  /** Blink now, if one is not already running. */
  blink(): void;
  /** Advance to `tMs` on a fixed internal step. True if anything moved. */
  step(tMs: number): boolean;
  /** The body contour as SVG path data. */
  bodyPath(): string;
  /** One pupil (-1 left, +1 right), or "" once the aperture has closed. */
  pupilPath(side: -1 | 1): string;
  /** 0 -> --color-cyan, 1 -> --color-cyan-deep. The only colour emitted. */
  readonly chill: number;
  readonly expression: CompanionExpression;
  /** Integrated milliseconds. Deterministic for a given call sequence. */
  readonly time: number;
  /** Arithmetically finished — the sleep signal for a rAF loop. */
  readonly settled: boolean;
  /** Live parameter vector, indexed by `PARAM`. Read-only in practice. */
  readonly params: Float64Array;
  readonly gaze: { x: number; y: number };
};

export declare const COMP: {
  readonly R: number;
  readonly RING_N: number;
  readonly PUPIL_N: number;
  readonly PR: number;
  readonly SPREAD: number;
  readonly EYE_Y: number;
  readonly GAZE_R: number;
  readonly CLEAR: number;
  readonly VIEW: number;
  readonly LOBE: number;
  readonly WANDER_MS: number;
  readonly WANDER_A: number;
  readonly LEAN_K: number;
  readonly TREM: number;
  readonly TREM_MS: number;
  readonly DT: number;
  readonly MAX_STEPS: number;
  readonly OMEGA_E: number;
  readonly ZETA_E: number;
  readonly OMEGA_G: number;
  readonly ZETA_G: number;
  readonly BREATH_MS: number;
  readonly BREATH_A: number;
  readonly BLINK_MS: number;
  readonly BLINK_DOWN: number;
  readonly BLINK_HOLD: number;
  readonly BLINK_MIN_MS: number;
  readonly BLINK_MAX_MS: number;
  readonly FLINCH_TAU: number;
  readonly NOD_TAU: number;
  readonly FLINCH_A: number;
  readonly NOD_A: number;
  readonly EPS_V: number;
  readonly EPS_I: number;
};

export declare const EXPRESSIONS: Record<CompanionExpression, Float64Array>;
export declare const EXPRESSION_NAMES: readonly CompanionExpression[];
export declare const PARAM: Readonly<Record<CompanionParam, number>>;

/** Radius multiplier at angle `a` — the lobe, smoothed by tension. */
export declare function bodyLobe(
  a: number,
  seed: number,
  tension: number,
): number;

/**
 * Clamp a pupil centre so the whole aperture stays inside the body with
 * `COMP.CLEAR` of liquid to spare. Writes into `out` and returns it.
 *
 * `radiusAt` must be the DRAWN contour — a companion's own `radiusAt`, not a
 * model of it. Once the membrane can dent the surface, an analytic radius is no
 * longer the truth about where the edge is.
 */
export declare function containPupil(
  cx: number,
  cy: number,
  pr: number,
  v: Float64Array,
  radiusAt: (a: number) => number,
  out: { x: number; y: number },
): { x: number; y: number };

export declare function makeCompanion(seed?: number): Companion;
