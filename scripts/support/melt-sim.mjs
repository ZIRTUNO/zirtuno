/**
 * THE OFFLINE MELT SIMULATOR — the shader's liquid field, in Node.
 *
 * sdf-glass-shader.mjs computes one number per pixel:
 *
 *   T = iFormA·formField(sdfA + eroA) + iFormB·formField(sdfB + eroB)
 *     + Σ dens_i · r_i² / max(|uv − c_i|², (0.18 r_i)²) · win_i · formShield
 *
 * and the liquid is wherever T ≥ 1. Every term is reproducible off-GPU: the SDFs
 * come from the shipped sdf-core pipeline, and the ball loop is thirty lines of
 * arithmetic. This module is that port, and it is the ONLY way to ask a question
 * like "what does melt 3→4 weigh at p = 0.5" without a three-minute browser
 * capture — which is the difference between checking two melts and checking all
 * of them at forty values of a constant.
 *
 * WHY IT IS FAITHFUL, and where it is not:
 *   • The ball field is EXACTLY scale-invariant — scaling every centre and radius
 *     by s leaves r²/d² untouched — so simulating in form-local space is not an
 *     approximation of the staged render, it is the same number. svcScale, jOx
 *     and jOy cannot change any area RATIO reported here.
 *   • Warp is off by default. It is a ±0.008 uv wobble on the form sample that
 *     moves the boundary without adding to it; `warp: true` is available to
 *     confirm that on any result that looks marginal.
 *   • Everything is measured as a RATIO against that melt's own endpoints, so the
 *     grid resolution cancels.
 *
 * The SDF cache is built once, through a browser (SVG rasterisation needs one),
 * into .melt-sim-cache/ and reused forever after.
 *
 *   import { loadForms, meltProfile } from "../support/melt-sim.mjs";
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { maskToSdf } from "../../lib/webgl/sdf-core.mjs";
import {
  SDF_RES,
  SDF_DRAW,
  SDF_BLUR,
  SDF_GOO,
  SDF_BALL_REACH,
  SDF_WARP_REST,
} from "../../lib/webgl/sdf-glass-shader.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..", "..");
const CACHE = path.join(ROOT, ".melt-sim-cache");

// mirrored from the fragment shader's constant block
const BALL_CORE = 0.18;
const SHIELD_INNER = 0.055;
const SHIELD_EDGE = 0.01;

const KEYS = ["mark", "web", "software", "ai", "automation", "data", "branding", "marketing"];
const svgFor = (k) =>
  k === "mark"
    ? path.join(ROOT, "public/brand/zirtuno-logo-mark.svg")
    : path.join(ROOT, `public/brand/forms/${k}.svg`);

/** Rasterise every form SVG → mask → SDF, exactly as lib/webgl/sdf.ts does. */
async function buildCache() {
  const { chromium } = await import("playwright");
  const { LAUNCH } = await import("./launch.mjs");
  fs.mkdirSync(CACHE, { recursive: true });
  const browser = await chromium.launch(LAUNCH);
  const page = await browser.newPage();
  await page.goto("about:blank");
  for (const k of KEYS) {
    const uri =
      "data:image/svg+xml;base64," +
      Buffer.from(fs.readFileSync(svgFor(k), "utf8"), "utf8").toString("base64");
    // verbatim rasteriseMask() from lib/webgl/sdf.ts — contain-fit probe for the
    // content bbox, then redraw so that bbox fills SDF_DRAW of the frame.
    const mask = await page.evaluate(
      async ({ src, RES, DRAW }) => {
        const img = new Image();
        await new Promise((ok, no) => {
          img.onload = ok;
          img.onerror = no;
          img.src = src;
        });
        const cnv = document.createElement("canvas");
        cnv.width = cnv.height = RES;
        const g = cnv.getContext("2d", { willReadFrequently: true });
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        const ar = iw / ih;
        let pw = RES,
          ph = RES;
        if (ar > 1) ph = RES / ar;
        else pw = RES * ar;
        const pox = (RES - pw) / 2,
          poy = (RES - ph) / 2;
        g.clearRect(0, 0, RES, RES);
        g.drawImage(img, pox, poy, pw, ph);
        const pd = g.getImageData(0, 0, RES, RES).data;
        let minx = RES,
          miny = RES,
          maxx = 0,
          maxy = 0;
        for (let y = 0; y < RES; y++)
          for (let x = 0; x < RES; x++)
            if (pd[(y * RES + x) * 4 + 3] > 40) {
              if (x < minx) minx = x;
              if (x > maxx) maxx = x;
              if (y < miny) miny = y;
              if (y > maxy) maxy = y;
            }
        if (maxx < minx) return null;
        const bw = maxx - minx + 1,
          bh = maxy - miny + 1;
        const S = (DRAW * RES) / Math.max(bw, bh);
        const fx = RES / 2 - (minx - pox + bw / 2) * S;
        const fy = RES / 2 - (miny - poy + bh / 2) * S;
        g.clearRect(0, 0, RES, RES);
        g.drawImage(img, fx, fy, pw * S, ph * S);
        const a = g.getImageData(0, 0, RES, RES).data;
        const inside = new Array(RES * RES);
        for (let i = 0; i < RES * RES; i++) inside[i] = a[i * 4 + 3] > 40 ? 1 : 0;
        return inside;
      },
      { src: uri, RES: SDF_RES, DRAW: SDF_DRAW },
    );
    if (!mask) throw new Error(`empty raster for ${k}`);
    const sdf = maskToSdf(Uint8Array.from(mask), SDF_RES, SDF_RES, SDF_BLUR, 1 / SDF_RES);
    fs.writeFileSync(path.join(CACHE, `${k}.f32`), Buffer.from(sdf.buffer));
  }
  await browser.close();
}

let FORMS = null;
/** Float32Array(512²) per state, indexed like METABALL_STATES (0 = mark). */
export async function loadForms() {
  if (FORMS) return FORMS;
  if (!KEYS.every((k) => fs.existsSync(path.join(CACHE, `${k}.f32`)))) await buildCache();
  FORMS = KEYS.map((k) => {
    const b = fs.readFileSync(path.join(CACHE, `${k}.f32`));
    return new Float32Array(b.buffer, b.byteOffset, b.length / 4);
  });
  return FORMS;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
/** THE COMBINATION LAW, mirroring satCombine in sdf-glass-shader: the
 *  strongest source in full, everything it overlaps on a curve that flattens
 *  toward a ceiling of `c`. `null` is the historical plain sum. */
const sat = (sum, mx, c) =>
  !(c > 0) ? sum : mx + c * (1 - Math.exp(-(sum - mx) / c));

/** signed distance → metaball profile; S = 1 exactly at the silhouette. */
const formField = (d) => {
  const x = Math.max(1 + d / SDF_GOO, 0.04);
  return 1 / (x * x);
};

/** The SDF texture is stored Y-flipped for a no-flip R32F upload; undo that here. */
function sampleSdf(tex, u, v) {
  const x = Math.min(SDF_RES - 1, Math.max(0, Math.round(clamp01(u) * (SDF_RES - 1))));
  const y = Math.min(SDF_RES - 1, Math.max(0, Math.round(clamp01(v) * (SDF_RES - 1))));
  return tex[y * SDF_RES + x];
}

/**
 * Rasterise one frame of the liquid in FORM-LOCAL space and return the lit cell
 * count plus the field grid. `balls` are [x, y, r, density] in cloud coordinates
 * (i.e. exactly what CLOUDS holds), which is form-local by construction.
 */
export function renderFrame(o) {
  const { T, shield, res } = prepareForms(o);
  return addBalls(T, shield, res, o.balls ?? []);
}

/**
 * The FORM half of a frame: T from the two weighted SDFs, plus the formShield
 * that gates every droplet. Depends only on melt progress — never on the cloud —
 * so a parameter search over presence/swell prepares this once per p and reuses
 * it for every candidate. That is what makes an exhaustive search affordable.
 */
export function prepareForms({
  forms,
  a = 0,
  b = 0,
  fa = 0,
  fb = 0,
  ea = 0,
  eb = 0,
  res = 384,
  warp = 0,
  time = 0,
  n = 0,
}) {
  const T = new Float32Array(res * res);
  const texA = forms[a],
    texB = forms[b];
  const shield = new Float32Array(res * res);
  const hasForm = fa > 1e-6 || fb > 1e-6;
  for (let yi = 0; yi < res; yi++) {
    const fv = (yi + 0.5) / res;
    for (let xi = 0; xi < res; xi++) {
      const fu = (xi + 0.5) / res;
      let wu = fu,
        wv = fv;
      if (warp > 0) {
        wu = clamp01(
          fu + warp * (Math.sin(fv * 9.2 + time * 0.7) + 0.6 * Math.sin(fv * 17 - time * 1.1)),
        );
        wv = clamp01(
          fv + warp * (Math.cos(fu * 8.1 - time * 0.6) + 0.6 * Math.sin(fu * 15 + time * 0.9)),
        );
      }
      // the two form slots combine among themselves; their RESULT then enters
      // the droplet accumulation as one source (the shader nests it the same way)
      const av = fa > 1e-6 ? fa * formField(sampleSdf(texA, wu, wv) + ea) : 0;
      const bv = fb > 1e-6 ? fb * formField(sampleSdf(texB, wu, wv) + eb) : 0;
      const t = sat(av + bv, Math.max(av, bv), n);
      const i = yi * res + xi;
      T[i] = t;
      shield[i] = hasForm
        ? smoothstep(-SHIELD_INNER, -SHIELD_EDGE, SDF_GOO * (1 / Math.sqrt(Math.max(t, 1e-6)) - 1))
        : 1;
    }
  }
  return { T, shield, res };
}

/**
 * The DROPLET half: add a cloud to a prepared form field and count the liquid.
 * Non-destructive — `T` is copied — so one prepared frame serves any number of
 * candidate clouds.
 */
export function addBalls(T0, shield, res, balls, n = 0) {
  // The prepared form field enters as ONE source, so a frame with no droplets
  // renders exactly what prepareForms produced, for any law.
  const sum = T0.slice();
  const mx = T0.slice();
  // ── the ball loop, scattered over each ball's bounded influence window ───────
  for (const [bx, by, br, bd = 1] of balls) {
    if (!(br > 0) || !(bd > 1e-6)) continue;
    const reach = SDF_BALL_REACH * br;
    const cut2 = reach * reach;
    const core2 = Math.max(br * BALL_CORE, 1e-4) ** 2;
    const x0 = Math.max(0, Math.floor((bx - reach) * res));
    const x1 = Math.min(res - 1, Math.ceil((bx + reach) * res));
    const y0 = Math.max(0, Math.floor((by - reach) * res));
    const y1 = Math.min(res - 1, Math.ceil((by + reach) * res));
    const rr = br * br;
    for (let yi = y0; yi <= y1; yi++) {
      const dy = (yi + 0.5) / res - by;
      for (let xi = x0; xi <= x1; xi++) {
        const dx = (xi + 0.5) / res - bx;
        const d2 = Math.max(dx * dx + dy * dy, core2);
        if (d2 >= cut2) continue;
        const win = 1 - smoothstep(0.3 * cut2, cut2, d2);
        const i = yi * res + xi;
        const f = ((bd * rr) / d2) * win * shield[i];
        sum[i] += f;
        if (f > mx[i]) mx[i] = f;
      }
    }
  }

  const T = new Float32Array(sum.length);
  let lit = 0;
  for (let i = 0; i < T.length; i++) {
    T[i] = sat(sum[i], mx[i], n);
    if (T[i] >= 1) lit++;
  }
  return { T, lit, res };
}

/** Lit-cell count only (the common case). */
export const litArea = (o) => renderFrame(o).lit;
export { clamp01, smoothstep, SDF_WARP_REST, sat };
