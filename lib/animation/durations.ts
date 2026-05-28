// Durations — build-spec S1.4.

/** Milliseconds (CSS / DOM APIs). */
export const DURATIONS = {
  micro: 200,
  short: 400,
  medium: 700,
  long: 1200,
  morph: 1400,
  autocycle: 9000,
  breath: 8000,
} as const;

/** Seconds (GSAP / Motion take seconds). */
export const SECONDS = {
  micro: 0.2,
  short: 0.4,
  medium: 0.7,
  long: 1.2,
  morph: 1.4,
  autocycle: 9,
  breath: 8,
} as const;

export type DurationName = keyof typeof DURATIONS;
