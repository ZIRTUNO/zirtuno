"use client";

/**
 * Build a signed-distance field from a form SVG, for the SDF-glass rest renderer
 * (metaball-morph-spec v1.2 §6.1). Rasterises the image to an alpha mask normalised
 * to its content bbox, computes an EXACT signed Euclidean distance (Felzenszwalb &
 * Huttenlocher), lightly blurs it (removes the medial-axis crease so the glass dome
 * reads smooth), and returns a Float32Array (Y-flipped, symbol units) ready to
 * upload as an R32F texture. Mirrors scripts/capture-sdf.mjs exactly.
 */

// exact 1-D squared EDT — lower envelope of parabolas
function edt1d(f: Float64Array, n: number): Float64Array {
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  let k = 0;
  v[0] = 0;
  z[0] = -1e20;
  z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const dx = q - v[k];
    d[q] = dx * dx + f[v[k]];
  }
  return d;
}

// squared distance (px²) to the nearest seed pixel (seed[i] = 1)
function edt2d(seed: Uint8Array, W: number, H: number): Float64Array {
  const f = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) f[i] = seed[i] ? 0 : 1e20;
  const col = new Float64Array(H);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) col[y] = f[y * W + x];
    const r = edt1d(col, H);
    for (let y = 0; y < H; y++) f[y * W + x] = r[y];
  }
  const row = new Float64Array(W);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) row[x] = f[y * W + x];
    const r = edt1d(row, W);
    for (let x = 0; x < W; x++) f[y * W + x] = r[x];
  }
  return f;
}

function boxBlur(arr: Float32Array, W: number, H: number, r: number) {
  const tmp = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0, c = 0;
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx;
        if (xx >= 0 && xx < W) { s += arr[y * W + xx]; c++; }
      }
      tmp[y * W + x] = s / c;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0, c = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy >= 0 && yy < H) { s += tmp[yy * W + x]; c++; }
      }
      arr[y * W + x] = s / c;
    }
}

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

  const inside = new Uint8Array(RES * RES), outside = new Uint8Array(RES * RES);
  for (let i = 0; i < RES * RES; i++) {
    const f = a[i * 4 + 3] > 40 ? 1 : 0;
    inside[i] = f;
    outside[i] = f ? 0 : 1;
  }
  const dOut = edt2d(outside, RES, RES); // inside pixels → dist to boundary
  const dIn = edt2d(inside, RES, RES); // outside pixels → dist to boundary
  const k = 1 / RES; // px → symbol units (frame = 1)
  const sdf = new Float32Array(RES * RES);
  for (let i = 0; i < RES * RES; i++) {
    sdf[i] = (inside[i] ? -Math.sqrt(dOut[i]) : Math.sqrt(dIn[i])) * k;
  }
  if (blur > 0) { boxBlur(sdf, RES, RES, blur); boxBlur(sdf, RES, RES, blur); }

  // flip Y so texture v=0 = screen bottom (uploaded with no UNPACK_FLIP_Y)
  const flip = new Float32Array(RES * RES);
  for (let y = 0; y < RES; y++)
    for (let x = 0; x < RES; x++) flip[(RES - 1 - y) * RES + x] = sdf[y * RES + x];
  return flip;
}
