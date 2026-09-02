"use client";

/**
 * Build a signed-distance field from a form SVG, for the SDF-glass rest renderer
 * (metaball-morph-spec v1.2 §6.1). Rasterises the image to an alpha mask normalised
 * to its content bbox (so every form fills the frame consistently), then runs the
 * shared exact-EDT pipeline (lib/webgl/sdf-core — the same code the capture harness
 * injects, so the sign-off sheet and the live hero are bit-identical in math).
 *
 * `buildSdfAsync` runs the expensive EDT+blur (~100 ms per form on a weak CPU) in
 * a Blob WORKER spun from the sdf-core source — no bundler-specific worker magic,
 * no main-thread jank at hero mount, and Phase 3's 8 forms can build in the
 * background. Falls back to the synchronous path where workers are unavailable
 * (strict CSP, ancient browsers). Rasterisation itself stays on the main thread
 * (needs the DOM canvas; it's a couple of drawImage/getImageData calls — cheap).
 */

import { maskToSdf, SDF_CORE_SOURCE } from "./sdf-core.mjs";

/** Rasterise + content-bbox-normalise → alpha mask (1 = inside), or null if empty. */
function rasteriseMask(
  img: HTMLImageElement | ImageBitmap,
  RES: number,
  draw: number,
): Uint8Array | null {
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
  if (maxx < minx) return null; // empty image

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
  return inside;
}

const EMPTY_OUTSIDE = 1; // all-positive SDF = everything outside (nothing renders)

/**
 * Synchronous build (also the no-worker fallback).
 * @returns Float32Array(RES*RES) of signed distance in symbol units, Y-flipped for
 *          a no-flip R32F texture upload (texture v=0 = screen bottom).
 */
export function buildSdf(
  img: HTMLImageElement | ImageBitmap,
  RES: number,
  draw: number,
  blur: number,
): Float32Array {
  const inside = rasteriseMask(img, RES, draw);
  if (!inside) return new Float32Array(RES * RES).fill(EMPTY_OUTSIDE);
  return maskToSdf(inside, RES, RES, blur, 1 / RES) as Float32Array;
}

// ── worker plumbing — one shared Blob worker, requests dispatched by id ────────
type Pending = { resolve: (f: Float32Array) => void; reject: (e: unknown) => void };
let sdfWorker: Worker | null | undefined; // undefined = untried · null = unavailable
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (sdfWorker !== undefined) return sdfWorker;
  try {
    const src = `${SDF_CORE_SOURCE}
self.onmessage = (e) => {
  const { id, inside, W, H, blur, scale } = e.data;
  const out = maskToSdf(new Uint8Array(inside), W, H, blur, scale);
  self.postMessage({ id, out: out.buffer }, [out.buffer]);
};`;
    const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    sdfWorker = new Worker(url);
    URL.revokeObjectURL(url); // the worker holds the script; the URL can go
    sdfWorker.onmessage = (e: MessageEvent<{ id: number; out: ArrayBuffer }>) => {
      const p = pending.get(e.data.id);
      if (p) {
        pending.delete(e.data.id);
        p.resolve(new Float32Array(e.data.out));
      }
    };
    sdfWorker.onerror = () => {
      // fail every in-flight request over to the sync path and stop using the worker
      const all = [...pending.values()];
      pending.clear();
      sdfWorker?.terminate();
      sdfWorker = null;
      for (const p of all) p.reject(new Error("sdf worker failed"));
    };
  } catch {
    sdfWorker = null;
  }
  return sdfWorker;
}

/**
 * Async build: rasterise on the main thread (cheap, needs DOM), EDT+blur in the
 * shared worker (the ~100 ms part). Falls back to the sync path without a worker.
 */
export async function buildSdfAsync(
  img: HTMLImageElement | ImageBitmap,
  RES: number,
  draw: number,
  blur: number,
): Promise<Float32Array> {
  const inside = rasteriseMask(img, RES, draw);
  if (!inside) return new Float32Array(RES * RES).fill(EMPTY_OUTSIDE);

  const worker = getWorker();
  if (!worker) return maskToSdf(inside, RES, RES, blur, 1 / RES) as Float32Array;

  const id = nextId++;
  try {
    return await new Promise<Float32Array>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage(
        { id, inside: inside.buffer, W: RES, H: RES, blur, scale: 1 / RES },
        [inside.buffer],
      );
    });
  } catch {
    // worker died mid-request → recompute synchronously (mask was transferred,
    // so rebuild it)
    const again = rasteriseMask(img, RES, draw);
    if (!again) return new Float32Array(RES * RES).fill(EMPTY_OUTSIDE);
    return maskToSdf(again, RES, RES, blur, 1 / RES) as Float32Array;
  }
}

