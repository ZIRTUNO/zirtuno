"use client";

/**
 * Sample a rendered wordmark into glyph points (R7) — the letters THE MIST
 * spells at the Origin's resolution.
 *
 * The DOM text is the truth: the same family, weight, style, letter-spacing
 * and transform the crisp wordmark renders with are read from its computed
 * style and drawn to an offscreen canvas whose box has the element's own
 * aspect, with the baseline placed where the DOM actually placed it — read
 * from a zero-size inline probe sitting on the baseline, not inferred from
 * font metrics (canvas and CSS do not agree on which ascender a font has,
 * and the first cut of this landed the vapour half a cap-height above the
 * type). The filled pixels come back in BOX SPACE — [-1, 1] on both axes,
 * y up — so the scene can map them through the element's measured rect every
 * frame and the vapour lands on the glyphs the type will take over from.
 *
 * Returns null when the text cannot be rasterised (no 2D context, an empty
 * box); the mist then simply never spells and the DOM wordmark fades in on
 * its own, which is the fallback every other path already takes.
 */
export function sampleWordmarkGlyphs(
  el: HTMLElement,
  text: string,
  maxPoints = 3200,
): Float32Array | null {
  const rect = el.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4 || !text) return null;
  // THE BASELINE, measured. An inline-block of zero size sits on the line's
  // baseline by default (vertical-align: baseline), so its top edge IS the
  // baseline's y in the element's box. Appended for one measurement and
  // removed, so it never enters the reading path.
  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "display:inline-block;width:0;height:0;padding:0;margin:0;border:0;vertical-align:baseline;";
  el.appendChild(probe);
  const probeRect = probe.getBoundingClientRect();
  el.removeChild(probe);
  const baselineFrac = (probeRect.top - rect.top) / rect.height;
  const W = 1024;
  const H = Math.max(16, Math.round((W * rect.height) / rect.width));
  const k = W / rect.width;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const cs = getComputedStyle(el);
  const fontSize = (parseFloat(cs.fontSize) || 16) * k;
  const family = cs.fontFamily || "sans-serif";
  const weight = cs.fontWeight || "400";
  const style = cs.fontStyle || "normal";
  const transform = cs.textTransform;
  const shown =
    transform === "uppercase"
      ? text.toUpperCase()
      : transform === "lowercase"
        ? text.toLowerCase()
        : text;
  ctx.font = `${style} ${weight} ${fontSize}px ${family}`;
  const ls = parseFloat(cs.letterSpacing);
  const c2 = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if (Number.isFinite(ls) && "letterSpacing" in c2) c2.letterSpacing = `${ls * k}px`;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  // the measured baseline, in canvas pixels — with the metric-derived
  // placement as the fallback for a probe that could not be laid out
  let baseline = baselineFrac * H;
  if (!Number.isFinite(baseline) || baseline <= 0 || baseline >= H) {
    const m = ctx.measureText(shown);
    const asc = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? fontSize * 0.8;
    const desc = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? fontSize * 0.2;
    baseline = (H - (asc + desc)) / 2 + asc;
  }
  // the DOM box is the text's own inline box, so the glyph run starts at 0
  ctx.fillText(shown, 0, baseline);
  const data = ctx.getImageData(0, 0, W, H).data;
  const pts: number[] = [];
  const step = 3;
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      if (data[(y * W + x) * 4 + 3] > 110) {
        pts.push((x / W) * 2 - 1, ((H - y) / H) * 2 - 1);
      }
    }
  }
  const total = pts.length >> 1;
  if (total < 8) return null;
  const skip = total > maxPoints ? total / maxPoints : 1;
  const out = new Float32Array(Math.min(total, maxPoints) * 2);
  let n = 0;
  for (let f = 0; f < total && n < out.length; f += skip) {
    const s = Math.floor(f);
    out[n++] = pts[s * 2];
    out[n++] = pts[s * 2 + 1];
  }
  return n < out.length ? out.subarray(0, n) : out;
}
