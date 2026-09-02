/**
 * TILE BINNING (R6) — the reason the droplet count is no longer the frame cost.
 *
 * ── the finding this exists to answer ────────────────────────────────────────
 *
 * The engine's recorded perf fact was that the field is fill-bound: frame time
 * tracks buffer AREA and the rollback flags each change it by nothing
 * measurable. True, and incomplete, because it was established at a FIXED ball
 * count. Measured on the real shader at 1.13 Mpx (scripts/probe-ball-budget.mjs,
 * system Chrome, Intel UHD):
 *
 *     0 balls  0.80 ms      48 balls  11.9 ms      192 balls  44.8 ms
 *    24 balls  6.70 ms      80 balls  19.1 ms      256 balls  57.1 ms
 *
 * ~95% of the frame is the ball loop. Buffer area and droplet count were never
 * two findings — the cost is their PRODUCT, because every fragment on screen
 * walked every droplet on the page. There was no spatial culling anywhere in
 * the path, and 77-90% of those fragments paint nothing at all.
 *
 * ── what this does ───────────────────────────────────────────────────────────
 *
 * Bins every droplet index into a screen tile grid, conservatively: a droplet is
 * written to every tile its INFLUENCE circle touches, widened by the gradient
 * taps' reach so the four dAt() samples stay legal. A fragment then walks only
 * its own tile's list. Per-fragment work stops tracking the GLOBAL droplet count
 * and starts tracking LOCAL density, which is bounded by how much liquid can
 * physically occupy one tile — so the curve flattens:
 *
 *     droplets      uniform array      tiled (live: re-bin + re-upload)
 *           48            11.5 ms                            6.8 ms
 *           96            22.5 ms                            6.8 ms
 *          192            44.8 ms                            8.2 ms
 *          768         over ceiling                         11.1 ms
 *         1536         over ceiling                         13.8 ms
 *
 * Verified pixel-identical against the uniform-array path by summed alpha.
 *
 * ── the layout, and why it is not one fixed-slot texture ─────────────────────
 *
 * The obvious layout is one texture of [count, i0, i1 … iK] per tile. It works,
 * and it costs 1.45 MB of upload per frame at 64×44 tiles with 128 slots — and
 * it caps each tile at K droplets, so a crowded tile SILENTLY DROPS liquid. The
 * first prototype did exactly that: at 24×16 tiles and 64 slots, 768 droplets
 * lost 1159 entries and the render visibly changed.
 *
 * So the shipped layout is offset+count into one flat list:
 *
 *   head  RG32UI, one texel per tile   = (offset, count)      ~22 KB
 *   list  R32UI,  a flat index array   = the entries          ~160 KB
 *
 * 8× less upload, and no per-tile ceiling — a crowded tile just takes more of
 * the shared list. The only capacity left is the list as a whole, which grows.
 *
 * PURITY CONTRACT (the sdf-core convention): no DOM, no GL, no timers, no
 * allocation in the hot path. Node-runnable, so the binner can be asserted
 * off-GPU against a brute-force reference.
 */

/**
 * Tile edge in device pixels. 20 px is the size the ladder was measured at
 * (64×44 tiles on a 1280×880 buffer). Smaller tiles cull harder and cost more
 * head texels plus more per-droplet writes; larger tiles do the opposite. The
 * measured spread between 32×22 and 64×44 was under 2 ms at 768 droplets, so
 * this is a shallow optimum and not worth a per-device probe.
 */
export const TILE_PX = 20;

/**
 * The fragment loop's compile-time bound. GLSL ES 3.00 permits a dynamic bound,
 * but the shipped ball loop uses a constant bound with a dynamic `break` and
 * this matches it — some drivers still refuse to unroll otherwise.
 *
 * The real occupancy is far below it: measured max-per-tile was 76 at 1536
 * droplets spread across the field. A tile that exceeds this loses its tail,
 * so binForFrame reports it and the caller asserts on it rather than trusting.
 */
export const TILE_MAX_ITER = 256;

/** Flat-list texture width. Height grows; 2048 keeps both dimensions well
 *  inside every MAX_TEXTURE_SIZE this renderer will meet. */
export const TILE_LIST_W = 2048;

const ceilDiv = (a, b) => Math.ceil(a / b);

/**
 * @param {object} [opts]
 * @param {number} [opts.tilePx]  tile edge in device px
 * @param {number} [opts.listCap] initial flat-list capacity (grows on demand)
 */
export function makeTileBinner(opts = {}) {
  const tilePx = Math.max(4, opts.tilePx ?? TILE_PX);

  let tilesX = 0;
  let tilesY = 0;
  let head = new Uint32Array(0); // (offset, count) per tile
  let counts = new Uint32Array(0); // scratch: per-tile tally, then write cursor
  let listCap = Math.max(1 << 14, opts.listCap ?? 0);
  let list = new Uint32Array(listCap);
  // Per-droplet tile rectangle, cached between the count pass and the fill pass
  // so the geometry is computed once. Grown with the population, never per frame.
  let boxCap = 0;
  let box = new Int32Array(0);

  const stats = {
    tilesX: 0,
    tilesY: 0,
    listW: TILE_LIST_W,
    listH: 0,
    entries: 0,
    maxPerTile: 0,
    /** Tiles whose list is longer than the shader will walk. Must stay 0. */
    over: 0,
    culled: 0,
  };

  const resize = (w, h) => {
    const tx = Math.max(1, ceilDiv(w, tilePx));
    const ty = Math.max(1, ceilDiv(h, tilePx));
    if (tx === tilesX && ty === tilesY) return false;
    tilesX = tx;
    tilesY = ty;
    head = new Uint32Array(tx * ty * 2);
    counts = new Uint32Array(tx * ty);
    return true;
  };

  const growList = (need) => {
    if (need <= listCap) return;
    let cap = listCap;
    while (cap < need) cap *= 2;
    listCap = cap;
    list = new Uint32Array(cap);
  };

  const growBox = (n) => {
    if (n <= boxCap) return;
    boxCap = Math.max(n, boxCap * 2, 64);
    box = new Int32Array(boxCap * 4);
  };

  /**
   * Bin one frame's packed ball buffer.
   *
   * @param {Float32Array} buf    packed [x, y, r] triples, in field uv
   * @param {number} count        active balls in `buf`
   * @param {number} w            drawing buffer width  (device px)
   * @param {number} h            drawing buffer height (device px)
   * @param {number} reach        influence window, × radius (SDF_BALL_REACH)
   * @param {number} margin       extra uv the gradient taps sample (softEps)
   */
  const bin = (buf, count, w, h, reach, margin) => {
    const resized = resize(w, h);
    const nTiles = tilesX * tilesY;
    counts.fill(0);
    growBox(count);

    // The shader's own domain: min-dimension-normalised and centred, so
    // uv = (frag − 0.5·res)/md + 0.5  ⇒  frag = (uv − 0.5)·md + 0.5·res.
    const md = Math.min(w, h);
    let culled = 0;
    let entries = 0;

    // pass 1 — tile rectangle per droplet, and the per-tile tally
    for (let i = 0; i < count; i++) {
      const b = i * 3;
      const r = buf[b + 2];
      const bx = i * 4;
      if (!(r > 0)) {
        box[bx + 2] = -1; // marks "no rows" for pass 2
        culled++;
        continue;
      }
      const rp = (reach * r + margin) * md;
      const px = (buf[b] - 0.5) * md + 0.5 * w;
      const py = (buf[b + 1] - 0.5) * md + 0.5 * h;
      // Off-screen droplets are dropped outright rather than clamped into the
      // edge tiles — clamping would charge every edge fragment for liquid that
      // cannot reach it, which is the exact cost this module exists to remove.
      if (px + rp < 0 || py + rp < 0 || px - rp > w || py - rp > h) {
        box[bx + 2] = -1;
        culled++;
        continue;
      }
      const x0 = Math.max(0, Math.floor((px - rp) / tilePx));
      const x1 = Math.min(tilesX - 1, Math.floor((px + rp) / tilePx));
      const y0 = Math.max(0, Math.floor((py - rp) / tilePx));
      const y1 = Math.min(tilesY - 1, Math.floor((py + rp) / tilePx));
      box[bx] = x0;
      box[bx + 1] = y0;
      box[bx + 2] = x1;
      box[bx + 3] = y1;
      for (let ty = y0; ty <= y1; ty++)
        for (let tx = x0; tx <= x1; tx++) counts[ty * tilesX + tx]++;
      entries += (x1 - x0 + 1) * (y1 - y0 + 1);
    }

    growList(entries);

    // pass 2 — prefix sum into head, and reuse counts as the write cursor
    let off = 0;
    let maxPerTile = 0;
    let over = 0;
    for (let c = 0; c < nTiles; c++) {
      const n = counts[c];
      head[c * 2] = off;
      head[c * 2 + 1] = n;
      counts[c] = off; // cursor
      off += n;
      if (n > maxPerTile) maxPerTile = n;
      if (n > TILE_MAX_ITER) over++;
    }

    // pass 3 — scatter. Ascending droplet order per tile, which is what makes
    // the field sum's accumulation order match the uniform-array loop exactly.
    for (let i = 0; i < count; i++) {
      const bx = i * 4;
      const x1 = box[bx + 2];
      if (x1 < 0) continue;
      const x0 = box[bx];
      const y0 = box[bx + 1];
      const y1 = box[bx + 3];
      for (let ty = y0; ty <= y1; ty++) {
        const row = ty * tilesX;
        for (let tx = x0; tx <= x1; tx++) list[counts[row + tx]++] = i;
      }
    }

    stats.tilesX = tilesX;
    stats.tilesY = tilesY;
    stats.listH = Math.max(1, ceilDiv(entries, TILE_LIST_W));
    stats.entries = entries;
    stats.maxPerTile = maxPerTile;
    stats.over = over;
    stats.culled = culled;
    return resized;
  };

  return {
    bin,
    stats,
    get head() {
      return head;
    },
    get list() {
      return list;
    },
    get tilesX() {
      return tilesX;
    },
    get tilesY() {
      return tilesY;
    },
  };
}
