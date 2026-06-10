"use client";

/**
 * Build a signed-distance field from a form SVG, for the SDF-glass rest renderer
 * (metaball-morph-spec v1.2 §6.1). Rasterises the image to an alpha mask normalised
 * to its content bbox (so every form fills the frame consistently), then runs the
 * shared exact-EDT pipeline (lib/webgl/sdf-core — the same code the capture harness
 * injects, so the sign-off sheet and the live hero are bit-identical in math).
 */

import { maskToSdf } from "./sdf-core.mjs";

/**
 * @param img decoded image (the form SVG)
 * @param RES square SDF resolution
 * @param draw fraction of the frame the content fills (leave margin for the rim)
 * @param blur SDF smoothing radius in px (0 = none)
 * @returns Float32Array(RES*RES) of signed distance in symbol units, Y-flipped for
 *          a no-flip R32F texture upload (texture v=0 = screen bottom).
 */
export function buildSdf(
  img: HTMLImageElement | ImageBitmap,
  RES: number,
  draw: number,
  blur: number,
): Float32Array {
  const cnv = document.createElement("canvas");
  cnv.width = cnv.height = RES;
  const g = cnv.getContext("2d", { willReadFrequently: true })!;
  const iw = (img as HTMLImageElement).naturalWidth || img.width;
  const ih = (img as HTMLImageElement).naturalHeight || img.height;

  // probe: contain-fit, find the content bbox
  const ar = iw / ih;
  let pw = RES, ph = RES;
  if (ar > 1) ph = RES / ar; else pw = RES * ar;
  const pox = (RES - pw) / 2, poy = (RES - ph) / 2;
  g.clearRect(0, 0, RES, RES);
  g.drawImage(img, pox, poy, pw, ph);
  const pd = g.getImageData(0, 0, RES, RES).data;
  let minx = RES, miny = RES, maxx = 0, maxy = 0;
  for (let y = 0; y < RES; y++)
    for (let x = 0; x < RES; x++)
      if (pd[(y * RES + x) * 4 + 3] > 40) {
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
  if (maxx < minx) return new Float32Array(RES * RES).fill(1); // empty → all outside

  // final: redraw whole image scaled + offset so the content bbox fills draw·RES
  const bw = maxx - minx + 1, bh = maxy - miny + 1;
  const S = (draw * RES) / Math.max(bw, bh);
  const fw = pw * S, fh = ph * S;
  const fx = RES / 2 - (minx - pox + bw / 2) * S;
  const fy = RES / 2 - (miny - poy + bh / 2) * S;
  g.clearRect(0, 0, RES, RES);
  g.drawImage(img, fx, fy, fw, fh);
  const a = g.getImageData(0, 0, RES, RES).data;

  const inside = new Uint8Array(RES * RES);
  for (let i = 0; i < RES * RES; i++) inside[i] = a[i * 4 + 3] > 40 ? 1 : 0;

  return maskToSdf(inside, RES, RES, blur, 1 / RES) as Float32Array;
}
