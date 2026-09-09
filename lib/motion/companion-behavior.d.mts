import type { CompanionMood } from "./companion.mjs";

export type CompanionInput = {
  status: "idle" | "busy" | "pending" | "success" | "error";
  focused: boolean;
  typing: boolean;
  longText: boolean;
  invalid: boolean;
  crowded: boolean;
  moving: boolean;
};
export declare function makeCompanionBehavior(start?: number): {
  activity(now: number): void;
  hover(on: boolean, now: number): void;
  touch(down: boolean, now: number): void;
  cancel(): void;
  stroke(distance: number, speed: number, near: boolean, now: number): void;
  event(kind: "reject" | "correct" | "choice" | "advance" | "back" | "submit" | "return" | "milestone" | "type", now: number): void;
  read(now: number, input: CompanionInput): CompanionMood;
};
