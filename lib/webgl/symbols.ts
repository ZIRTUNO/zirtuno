// Circle-field symbol targets for the LEGACY hero paths (the raymarched
// MetaballScene + the morph-target mesh in mesh-states) — typed loader + GLSL
// generator over the FROZEN snapshot in ./symbols-legacy.data.mjs.
//
// Frozen on purpose: the legacy scenes were visually verified against that exact
// data, while ./symbols.data.mjs now evolves as the NEW field hero's morph
// endpoints (metaball-morph-spec v1.2). This whole module retires with
// MetaballScene in Phase 5.

import { MARK_RAW, PILLARS_RAW, ALL_RAW } from "./symbols-legacy.data.mjs";

export type MetaballSymbolKey =
  | "web"
  | "software"
  | "ai"
  | "automation"
  | "data"
  | "branding"
  | "marketing";

export type SymbolBall = readonly [x: number, y: number, radius: number];

export type MetaballSymbol = {
  key: MetaballSymbolKey;
  label?: string;
  balls: readonly SymbolBall[];
};

/** The resting mark (handled separately from the morphing pillars). */
export const MARK_SYMBOL = MARK_RAW as unknown as MetaballSymbol & { key: "mark" };

/** The seven service pillars, in registry order (web → marketing). */
export const METABALL_SYMBOLS: readonly MetaballSymbol[] =
  PILLARS_RAW as unknown as readonly MetaballSymbol[];

/** Mark + the seven pillars (the full morph set, for previews). */
export const ALL_SYMBOLS: readonly MetaballSymbol[] =
  ALL_RAW as unknown as readonly MetaballSymbol[];

const GLSL_NAME: Record<MetaballSymbolKey, string> = {
  web: "Web",
  software: "Software",
  ai: "AI",
  automation: "Automation",
  data: "Data",
  branding: "Branding",
  marketing: "Marketing",
};

function glslNumber(value: number): string {
  return value.toFixed(4);
}

function glslBall([x, y, radius]: SymbolBall): string {
  return `d = smin(d, sdSymbolCircle(q.xy, vec2(${glslNumber(x)}, ${glslNumber(y)}), ${glslNumber(radius)}), 0.1450);`;
}

export function makeSymbolSdfGlsl(): string {
  const stateFunctions = METABALL_SYMBOLS.map((symbol) => {
    const [first, ...rest] = symbol.balls;
    const body = [
      `    float d = sdSymbolCircle(q.xy, vec2(${glslNumber(first[0])}, ${glslNumber(first[1])}), ${glslNumber(first[2])});`,
      ...rest.map((ball) => `    ${glslBall(ball)}`),
    ].join("\n");
    return `
  float sdfSymbol${GLSL_NAME[symbol.key]}(vec3 p, float br) {
    vec3 q = p / br;
${body}
    return sdfMetaballSilhouette(q, d) * br;
  }`;
  }).join("\n");

  return `
  float smoother01(float x) {
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
  }

  float sdSymbolCircle(vec2 p, vec2 c, float r) {
    return length(p - c) - r;
  }

  float sdfMetaballSilhouette(vec3 q, float d2) {
    float t = clamp(-d2 / DOME, 0.0, 1.0);
    float td = THICK * smoother01(t);
    float dz = abs(q.z) - td;
    float ox = max(d2, 0.0);
    float oz = max(dz, 0.0);
    float outside = sqrt(ox * ox + oz * oz);
    float inside = min(max(d2, dz), 0.0);
    return outside + inside - ROUND + ERODE;
  }
${stateFunctions}
`;
}
