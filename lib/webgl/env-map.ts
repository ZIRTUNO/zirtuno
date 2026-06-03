"use client";

import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

/**
 * The studio HDRI (public/hdri/studio.hdr) used as the glass reflection
 * environment (backlog 5.1). Decoded ONCE and the raw half-float pixels are
 * cached; each glass instance builds its own DataTexture from that buffer
 * (textures are per-GL-context, the pixel data is not). Full tier only — the
 * lite tier keeps the cheap procedural lighting to avoid the fetch/decode.
 *
 * We sample it for highlight *structure* only and fold it to luminance in the
 * shader, so reflections stay white-on-cyan and never introduce off-brand hues
 * (palette rule: cyan on black).
 */

export type EnvData = {
  data: THREE.TypedArray;
  width: number;
  height: number;
};

let promise: Promise<EnvData> | null = null;

export function getEnvMapData(): Promise<EnvData> {
  if (promise) return promise;
  promise = new Promise<EnvData>((resolve, reject) => {
    try {
      const loader = new RGBELoader();
      loader.setDataType(THREE.HalfFloatType);
      loader.load(
        "/hdri/studio.hdr",
        (tex) => {
          const img = tex.image as {
            data: THREE.TypedArray;
            width: number;
            height: number;
          };
          resolve({ data: img.data, width: img.width, height: img.height });
          tex.dispose();
        },
        undefined,
        (err) => reject(err),
      );
    } catch (err) {
      reject(err as Error);
    }
  });
  return promise;
}

/** Build a sampler-ready equirectangular texture from the cached HDRI pixels. */
export function makeEnvTexture(env: EnvData): THREE.DataTexture {
  const t = new THREE.DataTexture(
    env.data,
    env.width,
    env.height,
    THREE.RGBAFormat,
    THREE.HalfFloatType,
  );
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.wrapS = THREE.RepeatWrapping; // longitude wraps
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}
