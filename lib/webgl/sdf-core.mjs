/**
 * Pure signed-distance-field math — the SINGLE implementation shared by the app
 * (lib/webgl/sdf.ts → SdfGlassField) and the capture harness (scripts/capture-sdf,
 * which injects these functions' source into its render page via toString()).
 * Keep every function pure and self-contained (no closures, only references to the
 * other functions in this file by name) so source-injection stays valid.
 *
 * Algorithm: exact Euclidean distance transform (Felzenszwalb & Huttenlocher 2012,
 * lower envelope of parabolas) run from both sides of the mask → signed distance;
 * then a light separable box blur removes the medial-axis crease so a glass dome
 * built on the field reads as one smooth liquid (the zero-contour — the silhouette
 * — stays sub-pixel crisp under blurring of a true SDF).
 */

/** Exact 1-D squared EDT of sampled function f (length n). */
export function edt1d(f, n) {
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

/** Squared distance (px²) from every pixel to the nearest seed pixel (seed[i]=1). */
export function edt2d(seed, W, H) {
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

/** In-place separable box blur of radius r (one pass each axis). */
export function boxBlur(arr, W, H, r) {
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
 * Alpha mask (inside[i]=1) → signed distance field: negative inside, positive in
 * holes/outside, `scale` converts px → output units (e.g. 1/RES for symbol units).
 * Blurred twice at `blur` px, then Y-FLIPPED so a plain R32F upload puts v=0 at
 * the screen bottom. Returns Float32Array(W*H).
 */
export function maskToSdf(inside, W, H, blur, scale) {
  const outside = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) outside[i] = inside[i] ? 0 : 1;
  const dOut = edt2d(outside, W, H); // inside pixels → dist to boundary
  const dIn = edt2d(inside, W, H); // outside pixels → dist to boundary
  const sdf = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    sdf[i] = (inside[i] ? -Math.sqrt(dOut[i]) : Math.sqrt(dIn[i])) * scale;
  }
  if (blur > 0) { boxBlur(sdf, W, H, blur); boxBlur(sdf, W, H, blur); }
  const flip = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) flip[(H - 1 - y) * W + x] = sdf[y * W + x];
  return flip;
}

/** The function sources, for injection into a browser page (capture harness). */
export const SDF_CORE_SOURCE = [edt1d, edt2d, boxBlur, maskToSdf]
  .map((fn) => fn.toString())
  .join("\n");
