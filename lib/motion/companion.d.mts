/** Types for the companion kernel (companion.mjs). Keep in sync by hand. */

/**
 * The parameter vector's channel names. Every expression is a point in this
 * space, and there is no channel that is not listed here.
 *
 * IN PARTICULAR THERE IS NO WARM COLOUR CHANNEL. The three that touch light are
 * `chill` (cyan -> cyan-deep), `glow` (cyan -> cyan-glow) and `lumen` (how much
 * of itself the droplet is spending, which is not a hue at all). All three
 * tokens are in AGENTS.md 6's palette; `--color-warn` belongs to the form's
 * error copy and is not reachable from the kernel.
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
  | "chill"
  | "wide"
  | "iris"
  | "slant"
  | "lift"
  | "glow"
  | "lumen"
  | "rate";

/**
 * The named expressions — the LIFE CYCLE it runs on its own, and the REACTIONS
 * it has to a visitor.
 *
 * `doubt` is skepticism while a value is still being typed; `angry` is the
 * state a REJECTED SUBMIT puts it in. `fail` is a delivery failure, which is
 * deflation rather than anger — that one is not the visitor's fault, and `sad`
 * is its quieter, longer form. `startled` is being touched; `surprised` is
 * something appearing; `scared` is the one with the shrunken iris.
 */
export type CompanionExpression =
  // the life cycle
  | "rest"
  | "bored"
  | "drowsy"
  | "sleeping"
  | "waking"
  | "notice"
  | "attend"
  | "searching"
  | "read"
  | "working"
  | "ponder"
  // reactions
  | "doubt"
  | "suspicious"
  | "angry"
  | "approve"
  | "happy"
  | "proud"
  | "excited"
  | "effort"
  | "hold"
  | "fail"
  | "sad"
  | "delivered"
  | "celebrate"
  | "laughing"
  | "curious"
  | "confused"
  | "surprised"
  | "startled"
  | "scared"
  | "shy"
  | "playful"
  | "dodge";

/** The reference lab's names for poses this file already had one for. */
export type CompanionAlias = "idle" | "listening" | "thinking" | "waiting";

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
   * visibility. Not to be confused with the `sleeping` EXPRESSION, which is a
   * pose with a slow deep chest and is still drawn every frame.
   */
  readonly asleep: boolean;
  /** The body's radius toward an angle, read off the drawn contour. */
  radiusAt(a: number): number;
  /** Look at a point in normalized units; anything outside the unit disc is clamped. */
  aim(nx: number, ny: number): void;
  /** Switch expression. An unknown name falls through to `rest` rather than throwing. */
  express(next: CompanionExpression | CompanionAlias | string): void;
  /** A press arriving from direction (nx, ny). Squashes the body along that axis. */
  poke(nx: number, ny: number, amount?: number): void;
  /** A keystroke. Adds to the nod without resetting its decay. */
  tick(amount?: number): void;

  // ── gestures: decaying impulses that compose with any expression ──────────
  //
  // All four TOP UP rather than restart, so re-triggering one mid-swing makes
  // it bigger instead of resetting it to the start of its animation.

  /** A refusal — the head shake, on `tilt`. */
  shake(amount?: number): void;
  /** A bounce. Read back through `offset`; it never displaces the ring. */
  hop(amount?: number): void;
  /** Mirth. Drives the chest, the eye-squeeze and part of the bounce. */
  laugh(amount?: number): void;
  /** ONE lid (-1 left, +1 right) — slower and deeper than a blink. */
  wink(side?: -1 | 1): void;
  /** Blink now, if one is not already running. Both lids. */
  blink(): void;

  /** Advance to `tMs` on a fixed internal step. True if anything moved. */
  step(tMs: number): boolean;
  /** The body contour as SVG path data. */
  bodyPath(): string;
  /** One pupil (-1 left, +1 right), or "" once the aperture has closed. */
  pupilPath(side: -1 | 1): string;
  /** 0 -> --color-cyan, 1 -> --color-cyan-deep. Cold. */
  readonly chill: number;
  /** 0 -> --color-cyan, 1 -> --color-cyan-glow. Bright. */
  readonly glow: number;
  /** How much of itself it is spending: under 1 recedes, over 1 burns. */
  readonly lumen: number;
  /**
   * The bounce, in viewBox units, for the caller to add to its own transform.
   * Never folded into the ring — `VIEW` is sized for the widest SHAPE this
   * kernel can reach, not for that shape plus a translation.
   */
  readonly offset: { x: number; y: number };
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
  readonly WINK_MS: number;
  readonly WINK_DOWN: number;
  readonly WINK_HOLD: number;
  readonly FLINCH_TAU: number;
  readonly NOD_TAU: number;
  readonly FLINCH_A: number;
  readonly NOD_A: number;
  readonly SHAKE_A: number;
  readonly SHAKE_MS: number;
  readonly SHAKE_TAU: number;
  readonly HOP_A: number;
  readonly HOP_MS: number;
  readonly HOP_TAU: number;
  readonly MIRTH_A: number;
  readonly MIRTH_MS: number;
  readonly MIRTH_TAU: number;
  readonly MIRTH_SQUEEZE: number;
  readonly MIRTH_HOP: number;
  readonly EPS_V: number;
  readonly EPS_I: number;
};

export declare const EXPRESSIONS: Record<CompanionExpression, Float64Array>;
export declare const EXPRESSION_NAMES: readonly CompanionExpression[];
export declare const ALIASES: Readonly<Record<CompanionAlias, CompanionExpression>>;
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
 * `reach` is the aperture's MEASURED largest radius about its own centre, not
 * its nominal one: `wide`, `open`, `iris`, `slant` and a bowed `squint` all
 * move the true extent away from the nominal, and a clamp given the wrong
 * number is a clamp that lets a pupil sit outside the body.
 *
 * `radiusAt` must be the DRAWN contour — a companion's own `radiusAt`, not a
 * model of it. Once the membrane can dent the surface, an analytic radius is no
 * longer the truth about where the edge is.
 */
export declare function containPupil(
  cx: number,
  cy: number,
  reach: number,
  v: Float64Array,
  radiusAt: (a: number) => number,
  out: { x: number; y: number },
): { x: number; y: number };

export declare function makeCompanion(seed?: number): Companion;
