"use client";

import { createContext } from "react";

/** The hero's liquid is rendered by the PAGE canvas (components/field/
 *  PageStage). This context lets the hero shell (MetaballCanvas) hide its
 *  static fallback, forward keyboard retargets and read the active pillar —
 *  without owning a canvas. */
export type HeroLiquid = {
  live: boolean; // the page canvas owns the hero visual
  ready: boolean; // the hero form has painted (hide the fallback)
  active: number; // -1 = mark, 0-6 = pillars
  setManual: (n: number | null) => void;
  registerStage: (el: HTMLElement | null) => void;
};
export const HeroLiquidContext = createContext<HeroLiquid | null>(null);
