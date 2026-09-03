/** Types for the Origin's score (origin-score.mjs). Keep in sync. */

export type OriginBeat = {
  id: "ideas" | "tension" | "mark" | "hold" | "resolve";
  from: number;
  span: number;
  until: number;
  exit: number;
};

export declare const ORIGIN_BEATS: readonly OriginBeat[];

export declare function copyWindow(
  beat: OriginBeat,
  p: number,
): { inN: number; outN: number };

export type Window = readonly [number, number];

export declare const ORIGIN_ARC: {
  readonly MEET: Window;
  readonly FUSE: Window;
  readonly GROW: Window;
  readonly PURPOSE_IN: Window;
  readonly PURPOSE_OUT: Window;
  readonly ECHO: Window;
  readonly DRAIN: Window;
  readonly POLES_ON: Window;
  readonly POLES_OFF: Window;
  readonly PULL_ON: Window;
  readonly PULL_REST: Window;
  readonly PULL_OFF: Window;
  readonly CONDENSE_ON: Window;
  readonly CONDENSE_OFF: Window;
  readonly RELEASE_ON: Window;
  readonly RELEASE_OFF: Window;
  readonly SPELL: Window;
  readonly FADE: Window;
};

export declare const ramp: (p: number, w: Window) => number;
export declare const easeRamp: (
  name: "calm" | "arrive" | "depart" | "breath",
  p: number,
  w: Window,
) => number;

export type OriginEnvelopes = {
  q1: number;
  q2: number;
  q4: number;
  q5: number;
  grow: number;
  purpose: number;
  formIn: number;
  formOut: number;
  evap: number;
  poles: number;
  pull: number;
  condense: number;
  release: number;
  spell: number;
  fade: number;
  curl: number;
  floorOn: number;
  key: number;
  vignette: number;
  exposure: number;
  update(p: number, lead: number, wide: number): OriginEnvelopes;
};

export declare function makeOriginEnvelopes(): OriginEnvelopes;
