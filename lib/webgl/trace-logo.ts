// Client-only. Rasterizes the Zirtuno mark (public/brand/zirtuno-logo-mark.svg)
// and bakes a smooth 2D signed distance field of the silhouette into a half-float
// texture (inside < 0, normalized so the plane spans [-1,1]). The hero raymarcher
// samples this, extrudes it in-shader, and renders it as morphable glass (S2.3).

export interface SdfResult {
  /** size×size half-float; value = normalized signed distance (inside < 0). */
  data: Uint16Array;
  size: number;
}

interface SdfOptions {
  size?: number; // texture resolution (square)
  fit?: number; // mark's larger dimension as a fraction of the texture
  src?: string;
}

const SVG_SRC = "/brand/zirtuno-logo-mark.svg";

export async function traceLogoSDF(opts: SdfOptions = {}): Promise<SdfResult> {
  const N = opts.size ?? 512;
  const FIT = opts.fit ?? 0.82;
  const src = opts.src ?? SVG_SRC;

  const svg = await (await fetch(src)).text();

  const vbRaw = (svg.match(/viewBox="([\d.\-eE\s,]+)"/)?.[1] ?? "0 0 2950 3200")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const [vbMinX, vbMinY, vbW, vbH] =
    vbRaw.length === 4 ? vbRaw : [0, 0, 2950, 3200];
  const trMatch = svg.match(/translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/);
  const tx = trMatch ? parseFloat(trMatch[1]) : 0;
  const ty = trMatch ? parseFloat(trMatch[2]) : 0;

  const ds: string[] = [];
  const dRe = /\bd="([^"]+)"/g;
  let dm: RegExpExecArray | null;
  while ((dm = dRe.exec(svg))) ds.push(dm[1]);

  const cv = document.createElement("canvas");
  cv.width = N;
  cv.height = N;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas unavailable");

  const taller = vbH >= vbW;
  const drawnH = taller ? FIT * N : FIT * N * (vbH / vbW);
  const drawnW = taller ? FIT * N * (vbW / vbH) : FIT * N;
  const offX = (N - drawnW) / 2;
  const offY = (N - drawnH) / 2;

  ctx.fillStyle = "#fff";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, N, N);
  ctx.translate(offX, offY);
  ctx.scale(drawnW / vbW, drawnH / vbH);
  ctx.translate(-vbMinX, -vbMinY);
  ctx.translate(tx, ty);
  for (const d of ds) ctx.fill(new Path2D(d));

  const px = ctx.getImageData(0, 0, N, N).data;
  const inside = new Uint8Array(N * N);
  let area = 0;
  for (let i = 0; i < N * N; i++) {
    const on = px[i * 4 + 3] > 128 ? 1 : 0;
    inside[i] = on;
    area += on;
  }
  if (area === 0) return { data: new Uint16Array(N * N), size: N };

  const inDT = chamfer(inside, N, N);
  const outside = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) outside[i] = inside[i] ? 0 : 1;
  const outDT = chamfer(outside, N, N);

  const half = N / 2; // px per normalized unit
  const signed = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    signed[i] = (inside[i] ? -inDT[i] : outDT[i]) / half;
  }
  const sm = boxBlur(boxBlur(signed, N, N, 2), N, N, 2);

  const data = new Uint16Array(N * N);
  for (let i = 0; i < N * N; i++) data[i] = toHalf(sm[i]);
  return { data, size: N };
}

function chamfer(mask: Uint8Array, W: number, H: number): Float32Array {
  const D1 = 1;
  const D2 = Math.SQRT2;
  const BIG = 1e9;
  const dt = new Float32Array(W * H);
  for (let i = 0; i < dt.length; i++) dt[i] = mask[i] ? BIG : 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!mask[i]) continue;
      let m = dt[i];
      if (x > 0) m = Math.min(m, dt[i - 1] + D1);
      if (y > 0) m = Math.min(m, dt[i - W] + D1);
      if (x > 0 && y > 0) m = Math.min(m, dt[i - W - 1] + D2);
      if (x < W - 1 && y > 0) m = Math.min(m, dt[i - W + 1] + D2);
      dt[i] = m;
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      if (!mask[i]) continue;
      let m = dt[i];
      if (x < W - 1) m = Math.min(m, dt[i + 1] + D1);
      if (y < H - 1) m = Math.min(m, dt[i + W] + D1);
      if (x < W - 1 && y < H - 1) m = Math.min(m, dt[i + W + 1] + D2);
      if (x > 0 && y < H - 1) m = Math.min(m, dt[i + W - 1] + D2);
      dt[i] = m;
    }
  }
  return dt;
}

function boxBlur(src: Float32Array, W: number, H: number, r: number): Float32Array {
  const tmp = new Float32Array(W * H);
  const out = new Float32Array(W * H);
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(W - 1, Math.max(0, x + k));
        s += src[y * W + xx];
      }
      tmp[y * W + x] = s * norm;
    }
  }
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      let s = 0;
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(H - 1, Math.max(0, y + k));
        s += tmp[yy * W + x];
      }
      out[y * W + x] = s * norm;
    }
  }
  return out;
}

// IEEE-754 float32 → float16 bit pattern (for a RedFormat / HalfFloatType texture).
const _f32 = new Float32Array(1);
const _i32 = new Int32Array(_f32.buffer);
function toHalf(val: number): number {
  _f32[0] = val;
  const x = _i32[0];
  let bits = (x >> 16) & 0x8000;
  let m = (x >> 12) & 0x07ff;
  const e = (x >> 23) & 0xff;
  if (e < 103) return bits;
  if (e > 142) {
    bits |= 0x7c00;
    bits |= (e === 255 ? 0 : 1) && x & 0x007fffff;
    return bits;
  }
  if (e < 113) {
    m |= 0x0800;
    bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1);
    return bits;
  }
  bits |= ((e - 112) << 10) | (m >> 1);
  bits += m & 1;
  return bits;
}
