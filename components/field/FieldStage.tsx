"use client";

/**
 * FieldStage — the chapter-visual canvas (improvement-plan R1): ONE unified
 * liquid field (sdf-glass-shader — the same engine, shading and droplet maths
 * as the hero) driven by a pure FieldDriver (lib/webgl/field-drivers): scatter
 * (S3), converge (S4/S8), scrub-morph (S5), impulse exhale (S10).
 *
 * DEGRADATION ORDER — the glass is the LAST thing to go, not the first.
 * Measured on this shader (512², 60 balls, forced sync): going flat saves ~58%,
 * while dropping dpr 2 → 1 saves ~75% AND keeps the material. The old ladder
 * bundled both into one step (fullnofx → lite), so the first real downshift
 * surrendered the entire liquid-glass identity to buy a saving that a pure
 * resolution cut beats outright. Every rung below now spends resolution and
 * deformation first, in decreasing saving-per-unit-of-visual-harm:
 *
 *   full      glass + post, dpr ≤ 2, deformation      (the intended material)
 *   fullnofx  … post chain shed                       (bloom/dither/grain)
 *   glass1x   … dpr 1                                 (−75% fill, material intact)
 *   rigid     … deformation shed                      (−33%, discs not droplets)
 *   glasshalf … dpr 0.7                               (last glass-bearing rung)
 *   lite      FLAT CYAN, dpr 1                        (genuine last resort)
 *   half      flat, dpr 0.5                           (floor)
 *
 * Reaching flat now takes five sustained-slow episodes rather than two, which
 * is the point: it should mean "this GPU cannot do this", not "this GPU had a
 * rough second". The FPS watchdog needs SUSTAINED slowness (the counter decays
 * on smooth frames) and never freezes the liquid: a frozen scroll-choreographed
 * canvas reads as a pasted image being dragged, which is the exact failure this
 * system exists to prevent. Pauses when `play` is false (off-screen). Context
 * loss → onContextLost + rebuild on restore.
 */

import { useEffect, useReducer, useRef } from "react";
import {
  SDF_GLASS_VERT,
  SDF_GLASS_FRAG,
  SDF_GLASS_FRAG_SHAPE,
  SDF_GLASS_FRAG_TOUCH,
  SDF_GLASS_FRAG_SHAPE_TOUCH,
  SDF_FORM_SHOCKS,
  SDF_BALL_MAX,
  SDF_BALL_CAP_TILED,
  SDF_BALL_REACH,
  SDF_GRAD_MARGIN,
  SDF_GLASS_FRAG_TILED,
  SDF_GLASS_FRAG_SHAPE_TILED,
  SDF_GLASS_FRAG_TOUCH_TILED,
  SDF_GLASS_FRAG_SHAPE_TOUCH_TILED,
  SDF_THICK,
  SDF_RES,
  SDF_GRADE,
  SDF_STRAIN,
} from "@/lib/webgl/sdf-glass-shader.mjs";
import { makeLayer, makeSdfTexture, loadSdf } from "@/lib/webgl/sdf-gl";
import { makeTileBinner, TILE_LIST_W, TILE_PX } from "@/lib/webgl/tile-bin.mjs";
import { makePostChain } from "@/lib/webgl/post-chain";
import type { FieldDriver } from "@/lib/webgl/field-drivers";
import { SVG_URLS, STATE_COUNT } from "@/lib/webgl/symbols";

/** The watchdog ladder, richest first. See the degradation note in the header. */
type LiveTier =
  | "full"
  | "fullnofx"
  | "glass1x"
  | "rigid"
  | "glasshalf"
  | "lite"
  | "half";

/** Each rung's successor — the single source of truth for the descent. */
const NEXT_RUNG: Record<LiveTier, LiveTier | null> = {
  full: "fullnofx",
  fullnofx: "glass1x",
  glass1x: "rigid",
  rigid: "glasshalf",
  glasshalf: "lite",
  lite: "half",
  half: null,
};

/** Rungs that still shade the real material (iGlass=1). */
const GLASS_RUNGS = new Set<LiveTier>([
  "full",
  "fullnofx",
  "glass1x",
  "rigid",
  "glasshalf",
]);

/** Rungs that can still afford velocity-aligned deformation (~1.49× the pass). */
const DEFORM_RUNGS = new Set<LiveTier>(["full", "fullnofx", "glass1x"]);
/**
 * Rungs that still let the FORMS answer the pointer.
 *
 * Deliberately not DEFORM_RUNGS, which this borrowed at first and which was
 * wrong twice over. Deformation costs ~1.49× the glass pass; the form's domain
 * displacement measured at no detectable cost, because every fragment outside
 * the influence disc leaves on a distance test. And DEFORM_RUNGS stops at
 * glass1x, while the lite tier STARTS at rigid — so on a lite machine the forms
 * silently never answered at all, which is most of the page's interaction gone
 * on exactly the hardware least likely to have anything else going on. Only the
 * emergency half-res floor sheds it.
 */
const TOUCH_RUNGS = new Set<LiveTier>([
  "full",
  "fullnofx",
  "glass1x",
  "rigid",
  "glasshalf",
  "lite",
]);
// Uploaded in place of the live interaction whenever the forms must not answer
// (a demoted rung, reduced motion, nothing touching). Zero is the shader's
// exact-identity case, so this is the resting silhouette by construction.
const ZERO_TOUCH = new Float32Array(4);
const ZERO_SHOCK = new Float32Array(SDF_FORM_SHOCKS * 4);

/**
 * POPULATION per rung, as a share of what the conductor is simulating (R6).
 *
 * A new lever on the ladder, and a gentler one than anything already on it. The
 * old descent could only shed FEATURES (post chain, deformation, finally the
 * glass itself) or RESOLUTION — a demotion was always visible as the material
 * changing or the image softening. Droplet count degrades differently: the same
 * material, the same choreography, the same forms, just fewer beads of surface
 * texture on the body. Motes are ordered by rank, so lowering this peels the
 * OUTERMOST shell off every host first and the body thins from its surface
 * inward rather than losing whole regions.
 *
 * It is spent BEFORE the glass and after resolution, because per unit of frame
 * time saved it is the least visible thing here — and because the ball loop is
 * ~95% of the frame at 1.13 Mpx, so it is also one of the largest levers.
 */
const RUNG_POP: Record<LiveTier, number> = {
  full: 1,
  fullnofx: 1,
  glass1x: 0.75,
  rigid: 0.5,
  glasshalf: 0.375,
  lite: 0.25,
  half: 0, // the authored 48 and nothing else — the floor is a form endpoint
};

/** Buffer scale per rung — the cheapest lever, so it is spent before the glass. */
const RUNG_SCALE: Record<LiveTier, number | "max"> = {
  full: "max",
  fullnofx: "max",
  glass1x: 1,
  rigid: 1,
  glasshalf: 0.7,
  lite: 1,
  half: 0.5,
};

type FieldStageProps = {
  driver: FieldDriver;
  play?: boolean;
  tier?: "full" | "lite";
  onReady?: () => void;
  onContextLost?: () => void;
  /** A runtime watchdog downshift happened (persist it if site-wide). */
  onTierChange?: (tier: "lite" | "none") => void;
};

export default function FieldStage({
  driver,
  play = true,
  tier = "full",
  onReady = () => {},
  onContextLost = () => {},
  onTierChange = () => {},
}: FieldStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cb = useRef({ onReady, onContextLost, onTierChange });
  useEffect(() => {
    cb.current = { onReady, onContextLost, onTierChange };
  }, [onReady, onContextLost, onTierChange]);

  const driverRef = useRef(driver);
  useEffect(() => {
    driverRef.current = driver;
  }, [driver]);

  const playRef = useRef(play);
  const api = useRef<{ setPlay: (p: boolean) => void } | null>(null);
  // bumping the epoch re-runs the setup with a fresh GL context (after a loss)
  const [epoch, rebuild] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    // THE GLASS MATERIAL IS ON — its core lighting is what gives the liquid
    // depth, and the flat branch's constant fill reads as a sticker. What is
    // OFF is the STRAIN layer below: the two were removed together when the
    // shading looked wrong, and putting the lighting back while leaving the
    // newest layer out is the actual fix. `?fglass=0` is the rollback to flat.
    const glassRequested = !/[?&]fglass=0(?:&|$)/.test(window.location.search);
    // …and the GLOSS material is OFF. Owner's call: the wet read — white-hot
    // specular, broad sheen, glassy fresnel rim, and deep-to-glow domes — pulls
    // the field away from the primary cyan and reveals each component blob.
    //
    // This is deliberately NOT `?fglass=0`. That branch paints one constant
    // colour, which is how the material was removed the first time and why it
    // came straight back: it deletes every depth cue. The clean material keeps
    // a broad shared light wash and a whisper of surface response, so the field
    // still has volume without outlining edges or dense centres. `?fgloss=1`
    // restores the complete signed-off glass material for review.
    const glossRequested = /[?&]fgloss=1(?:&|$)/.test(window.location.search);
    // DEFORMATION-RESPONSIVE OPTICS, OFF BY DEFAULT. Anisotropic specular, a
    // brightened leading edge, thinned absorption and advected striations —
    // added this session and shipped default-on without ever being judged on
    // moving liquid. Striations crawling across a surface that is already
    // stretching is precisely what reads as glitchy, and this is the newest,
    // least-proven thing in the material. The locked lighting underneath it
    // (dome, wrapped diffuse, specular, sheen, fresnel) is untouched and is
    // where the depth actually comes from. `?fstrain=1` puts it back.
    const strainRequested = /[?&]fstrain=1(?:&|$)/.test(window.location.search);
    // Velocity-aware deformation is the DEFAULT material behaviour: liquid that
    // cannot stretch under its own motion reads as sliding discs. It stays off
    // for lite/reduced paths, which cannot afford the uniforms or must not
    // move, and `?fshape=0` is the rollback.
    const shapeRequested = !/[?&]fshape=0(?:&|$)/.test(window.location.search);
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const shapeWanted =
      shapeRequested && tier === "full" && !motionQuery.matches;
    // The forms answering the pointer is a SEPARATE axis from deformation, and
    // a cheaper one: it costs 1 + SDF_FORM_SHOCKS uniform vectors and a branch
    // that most fragments skip on a distance test. It therefore survives to lite
    // — where the shader is flat cyan but the SILHOUETTE is still the thing a
    // visitor is looking at — while the live tier gates the effect per frame.
    // Its OWN flag, not the strike's. ?fstrike=0 removes the click everywhere,
    // which reaches the forms for free — no shocks are registered, so iShock
    // stays zero — while leaving hover physics alone. ?fformtouch=0 is the
    // narrower rollback: the droplets keep answering the hand and the forms
    // stop, which is also the only control that isolates the form's own share
    // of a response for measurement.
    // Only an exact 0 unlinks the variant; any other number is a gain the
  // conductor applies, so the shader still has to be there to receive it.
    const touchWanted =
      !/[?&]fformtouch=0(?:&|$)/.test(window.location.search) &&
      !motionQuery.matches;
    // Preference list, not a prediction: the driver decides whether the wider
    // uniform block links, and the plain field is always the last resort so a
    // refusal costs an interaction, never the canvas. Ordered most-capable
    // first, so a driver that refuses the widest block still gets whichever
    // half it can afford.
    // ── R6: the TILED data path ────────────────────────────────────────────
    // Droplet data in a texture instead of three uniform arrays, and a per-tile
    // index list so a fragment walks only the droplets that can reach it. The
    // shipped shader evaluated every droplet at every one of ~1.1M fragments
    // with no spatial culling at all, which is why ~95% of the frame was the
    // ball loop and why the population could not grow. Measured at 1.13 Mpx:
    //
    //   droplets    uniform array    tiled (re-binned + re-uploaded per frame)
    //         48         11.5 ms                                      6.8 ms
    //        192         44.8 ms                                      8.2 ms
    //       1536      over ceiling                                   13.8 ms
    //
    // It goes FIRST in the preference list — it is both faster and the only
    // path that can carry the population — and the uniform builds stay behind
    // it, so a driver that refuses the integer samplers renders exactly what it
    // rendered before. ?ftile=0 is the deliberate rollback to that path.
    const tileWanted = !/[?&]ftile=0(?:&|$)/.test(window.location.search);
    // The uniform-array builds, as a map, so the tiled selection below can be
    // written against the same shape. Both sets are module constants now — the
    // saturation ceiling is a UNIFORM, so nothing is rebuilt per setting and a
    // ?fsat= review reload compares two identical programs.
    const F = {
      plain: SDF_GLASS_FRAG,
      shape: SDF_GLASS_FRAG_SHAPE,
      touch: SDF_GLASS_FRAG_TOUCH,
      shapeTouch: SDF_GLASS_FRAG_SHAPE_TOUCH,
    };
    const T = {
      plain: SDF_GLASS_FRAG_TILED,
      shape: SDF_GLASS_FRAG_SHAPE_TILED,
      touch: SDF_GLASS_FRAG_TOUCH_TILED,
      shapeTouch: SDF_GLASS_FRAG_SHAPE_TOUCH_TILED,
    };
    const satParam = /[?&]fsat=([0-9]*\.?[0-9]+)(?:&|$)/.exec(window.location.search);
    const satOverride = satParam ? Number(satParam[1]) : null;
    const variants: string[] = [];
    if (tileWanted) {
      if (shapeWanted && touchWanted) variants.push(T.shapeTouch);
      if (shapeWanted) variants.push(T.shape);
      if (touchWanted) variants.push(T.touch);
      variants.push(T.plain);
    }
    const uniformFirst = variants.length;
    if (shapeWanted && touchWanted) variants.push(F.shapeTouch);
    if (shapeWanted) variants.push(F.shape);
    if (touchWanted) variants.push(F.touch);
    variants.push(F.plain);
    const layer = makeLayer(container, SDF_GLASS_VERT, variants);
    if (!layer) return; // no WebGL2 → shell's SVG fallback stays
    const linked = variants[layer.variant];
    const tiledActive = layer.variant < uniformFirst;
    const shapeShaderActive =
      linked === F.shape ||
      linked === F.shapeTouch ||
      linked === T.shape ||
      linked === T.shapeTouch;
    const touchShaderActive =
      linked === F.touch ||
      linked === F.shapeTouch ||
      linked === T.touch ||
      linked === T.shapeTouch;
    // The population the buffers are sized for. Only the tiled path can carry
    // more than the uniform arrays hold.
    const ballCap = tiledActive ? SDF_BALL_CAP_TILED : SDF_BALL_MAX;
    const gl = layer.gl;

    // §12.5: on loss the loop PARKS (no zombie GL, no fake frame counts, no
    // battery burn) while the conductor keeps its state warm in PageStage;
    // restore bumps the epoch, which rebuilds this whole instance fresh.
    let ctxLost = false;
    const onLost = (e: Event) => {
      e.preventDefault();
      ctxLost = true;
      cb.current.onContextLost();
    };
    const onRestored = () => rebuild();
    layer.canvas.addEventListener("webglcontextlost", onLost);
    layer.canvas.addEventListener("webglcontextrestored", onRestored);

    // There is NO stop state: freezing a scroll-choreographed liquid reads as a
    // pasted image being dragged — a blurrier LIVING liquid always beats a crisp
    // dead one, and a flat one is worse than either.
    //
    // A probe-"lite" machine starts at `rigid`, NOT at the flat branch. The
    // probe measures a mid-range GPU (12–55 ms at the hero's buffer); such a
    // machine can nearly always shade glass at dpr 1, and starting it flat threw
    // away the material on a guess taken during page load.
    let liveTier: LiveTier = tier === "lite" ? "rigid" : "full";
    // ?fgrade=0 — the R5-C exact optics bypass (spec §14.1): no post chain,
    // every grade uniform at its 0 identity → pre-C pixels.
    const gradeOn = !/[?&]fgrade=0/.test(window.location.search);
    // Isolated owner-review rollback for the dynamic volume shadow. The full
    // grade stays live so captures differ only by self-shadow/AO.
    // OPT-IN. The field-native AO stacks on top of the absorption shadow and
    // pulls the body off its brand value — measured at a gathering stop,
    // interior luminance 169 without it against 144 with, for the same 36%
    // shadow depth. The reference material is a body at full neon cyan with
    // dark patches under it, so the AO costs brightness for contrast that
    // absorption already provides. `?fshadow=1` puts it back for review.
    const shadowRequested = /[?&]fshadow=1(?:&|$)/.test(window.location.search);
    // Signature-visual review path only. The uniform remains exactly 0 unless
    // explicitly requested, the renderer is still at the full tier, motion is
    // allowed, and the frame is a free droplet-only composition.
    let motionReduced = motionQuery.matches;
    // the R5-C post chain (bloom/dither/grain) — full tier only; null means
    // the direct path (= full-nofx rendering) for lite starts, bypass, or
    // contexts without a renderable offscreen format
    let post = gradeOn && tier === "full" ? makePostChain(gl) : null;

    // makePostChain initializes its own shaders and leaves the composite
    // program bound. Restore the liquid program before assigning its static
    // uniforms; otherwise WebGL rejects these locations and both SDF samplers
    // remain on texture unit 0, making form A reappear during form B's landing.
    gl.useProgram(layer.prog);
    gl.uniform1f(layer.U("iThick"), SDF_THICK);
    gl.uniform2f(layer.U("iTexel"), 1 / SDF_RES, 1 / SDF_RES);
    gl.uniform1i(layer.U("iSDF"), 0);
    gl.uniform1i(layer.U("iSDF2"), 1);

    // ── R6 tiled resources ─────────────────────────────────────────────────
    // iBallTex is (x, y, r, density) on row 0 and (depth, vx, vy, —) on row 1,
    // so one droplet is two texels and the whole population is one 2-row
    // texture. iTileHead is (offset, count) per screen tile; iTileList is the
    // flat index array those offsets point into.
    const binner = tiledActive ? makeTileBinner() : null;
    let ballTex: WebGLTexture | null = null;
    let tileHeadTex: WebGLTexture | null = null;
    let tileListTex: WebGLTexture | null = null;
    // Row-major (x,y,r,d | z,vx,vy,0) staging, uploaded whole each frame.
    const ballRows = tiledActive ? new Float32Array(ballCap * 4 * 2) : null;
    let tileHeadW = 0;
    let tileHeadH = 0;
    let tileListH = 0;
    const nearestTex = () => {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    if (tiledActive) {
      gl.activeTexture(gl.TEXTURE2);
      ballTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, ballTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, ballCap, 2, 0, gl.RGBA, gl.FLOAT, null);
      nearestTex();
      gl.activeTexture(gl.TEXTURE3);
      tileHeadTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tileHeadTex);
      nearestTex();
      gl.activeTexture(gl.TEXTURE4);
      tileListTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tileListTex);
      nearestTex();
      gl.useProgram(layer.prog);
      gl.uniform1i(layer.U("iBallTex"), 2);
      gl.uniform1i(layer.U("iTileHead"), 3);
      gl.uniform1i(layer.U("iTileList"), 4);
      gl.uniform1f(layer.U("iTilePx"), TILE_PX);
    }

    const textures: (WebGLTexture | null)[] = new Array(STATE_COUNT).fill(null);
    const ballBuf = new Float32Array(ballCap * 3);
    const zBuf = new Float32Array(ballCap); // per-ball depth (iBallZ)
    // per-ball field density (iBallDensity); 1 = solid liquid, 0 = dissolved
    const dBuf = new Float32Array(ballCap).fill(1);
    const ballIds = new Int16Array(ballCap);
    ballIds.fill(-1);
    // `iBallVelocity` is packed as two xy vectors per vec4. Every history and
    // filter buffer is allocated once; the render loop only mutates them.
    // Velocity history is keyed by canonical droplet identity, never by packed
    // slot: satellites, ambient beads, and extras may enter/leave or shift the
    // packing order and must never inherit another particle's stretch.
    const ballVelocity = new Float32Array(ballCap * 2);
    const identityVelocity = new Float32Array(ballCap * 2);
    const previousIdentityBalls = new Float32Array(ballCap * 3);
    const identitySeen = new Uint8Array(ballCap);
    const identitySeenNow = new Uint8Array(ballCap);
    let lastPackedCount = 0;
    let previousVelocityTime = -1;
    const resetVelocityHistory = (count: number, tMs: number) => {
      const safeCount = Math.min(count, ballCap);
      ballVelocity.fill(0);
      identityVelocity.fill(0);
      identitySeen.fill(0);
      for (let slot = 0; slot < safeCount; slot++) {
        const id = ballIds[slot];
        if (id < 0 || id >= ballCap) continue;
        const packed = slot * 3;
        const identity = id * 3;
        previousIdentityBalls[identity] = ballBuf[packed];
        previousIdentityBalls[identity + 1] = ballBuf[packed + 1];
        previousIdentityBalls[identity + 2] = ballBuf[packed + 2];
        identitySeen[id] = 1;
      }
      lastPackedCount = safeCount;
      previousVelocityTime = tMs;
      return 0;
    };
    const sampleBallVelocity = (count: number, tMs: number) => {
      const safeCount = Math.min(count, ballCap);
      if (previousVelocityTime < 0) return resetVelocityHistory(safeCount, tMs);
      const dtMs = tMs - previousVelocityTime;
      // Resize paints can arrive almost on top of a scheduled frame; tab
      // stalls produce the opposite extreme. Neither is physical velocity.
      if (dtMs < 4) return resetVelocityHistory(safeCount, tMs);
      if (dtMs > 120) return resetVelocityHistory(safeCount, tMs);

      const dt = dtMs / 1000;
      const filter = 1 - Math.exp(-dtMs / 65);
      let peak = 0;
      identitySeenNow.fill(0);
      for (let slot = 0; slot < safeCount; slot++) {
        const packed = slot * 3;
        const packedVelocity = slot * 2;
        const id = ballIds[slot];
        if (id < 0 || id >= ballCap) {
          ballVelocity[packedVelocity] = 0;
          ballVelocity[packedVelocity + 1] = 0;
          continue;
        }
        const identity = id * 3;
        const identityV = id * 2;
        const x = ballBuf[packed];
        const y = ballBuf[packed + 1];
        const r = ballBuf[packed + 2];
        const px = previousIdentityBalls[identity];
        const py = previousIdentityBalls[identity + 1];
        const pr = previousIdentityBalls[identity + 2];
        const dx = x - px;
        const dy = y - py;
        const travel = Math.hypot(dx, dy);
        const stableSlot =
          identitySeen[id] === 1 &&
          Math.abs(r - pr) < Math.max(0.014, Math.max(r, pr) * 0.65) &&
          travel < Math.max(0.16, (r + pr) * 4.5);

        let vx = 0;
        let vy = 0;
        if (stableSlot) {
          vx = dx / dt;
          vy = dy / dt;
          const rawSpeed = Math.hypot(vx, vy);
          if (rawSpeed < 0.025) {
            vx = 0;
            vy = 0;
          } else if (rawSpeed > 1.4) {
            const limit = 1.4 / rawSpeed;
            vx *= limit;
            vy *= limit;
          }
        }

        if (stableSlot) {
          identityVelocity[identityV] +=
            (vx - identityVelocity[identityV]) * filter;
          identityVelocity[identityV + 1] +=
            (vy - identityVelocity[identityV + 1]) * filter;
        } else {
          identityVelocity[identityV] = 0;
          identityVelocity[identityV + 1] = 0;
        }
        ballVelocity[packedVelocity] = identityVelocity[identityV];
        ballVelocity[packedVelocity + 1] = identityVelocity[identityV + 1];
        const speed = Math.hypot(
          ballVelocity[packedVelocity],
          ballVelocity[packedVelocity + 1],
        );
        if (speed > peak) peak = speed;
        previousIdentityBalls[identity] = x;
        previousIdentityBalls[identity + 1] = y;
        previousIdentityBalls[identity + 2] = r;
        identitySeenNow[id] = 1;
      }
      ballVelocity.fill(0, safeCount * 2);
      for (let id = 0; id < ballCap; id++) {
        if (identitySeenNow[id] === 1) continue;
        identityVelocity[id * 2] = 0;
        identityVelocity[id * 2 + 1] = 0;
      }
      identitySeen.set(identitySeenNow);
      lastPackedCount = safeCount;
      previousVelocityTime = tMs;
      return peak;
    };
    const onMotionPreference = (event: MediaQueryListEvent) => {
      motionReduced = event.matches;
      resetVelocityHistory(lastPackedCount, performance.now());
    };
    motionQuery.addEventListener("change", onMotionPreference);
    let announced = false;
    // Shader compilation, framebuffer allocation, and the first SDF upload are
    // transient startup costs, not evidence that the steady-state field is too
    // expensive. A restored context rebuilds all three before its first valid
    // frame, so the watchdog starts only after a short clean runway.
    const WATCHDOG_READY_GRACE_MS = 2500;
    let watchdogReadyAt = Number.POSITIVE_INFINITY;

    // R5-C optics diagnostics (QA surface for verify-postfx): post/fmt/tier
    // track the live pipeline, frames counts REAL draws (the governor gate
    // measures cadence on it), demote() drives the watchdog rung in drills.
    const diag = {
      post: 0,
      fmt: (post?.fmt ?? "none") as string,
      tier: liveTier as string,
      frames: 0,
      // the melt the stage is actually drawing, for the shape gate and the
      // capture harnesses; -1 = not in one
      meltP: -1,
      formA: 0,
      formB: 0,
      sat: 0,
      gov: 0,
      glassRequested: glassRequested ? 1 : 0,
      glass: 0, // 1 only while the material is actually being shaded
      glossRequested: glossRequested ? 1 : 0,
      gloss: 0, // 1 only while the wet highlights are actually drawn
      shadowRequested: shadowRequested ? 1 : 0,
      shadow: 0, // field-native AO is actually uploaded and active
      strainRequested: strainRequested ? 1 : 0,
      strain: 0, // 1 only while the deformation optics are actually driven
      shapeRequested: shapeRequested ? 1 : 0,
      shapeShader: shapeShaderActive ? 1 : 0,
      shape: 0,
      shapeSpeed: 0,
      shapeReduced: motionReduced ? 1 : 0,
      touch: 0,
      // watchdog surface: the panel's measured vsync, the slow-frame threshold
      // derived from it, and the live strike count. Without these the ladder
      // is unfalsifiable from the outside — which is how a 60 Hz-only `dt > 34`
      // survived on a 144 Hz machine.
      vsync: 0,
      slowMs: 0,
      wdSlow: 0,
      scale: 0, // live buffer scale (CSS px → device px) after the budget
      // R6: the data path, the population it is carrying, and the binner's own
      // health. tileOver must stay 0 — a tile longer than the shader's loop
      // bound silently loses its tail, and the artefact looks like a shader bug.
      tiled: tiledActive ? 1 : 0,
      ballCap,
      pop: 0,
      count: 0, // balls actually packed last frame
      // THE BALL BUFFER, for the measurement harnesses.
      //
      // Five of them (verify-strike, verify-deformation, verify-boundaries,
      // record-liquid-motion, diagnose-s4) recover droplet positions by hooking
      // `gl.uniform3fv` and watching for `iBalls`. On the tiled path that
      // uniform does not exist — the population rides in a texture — so the tap
      // goes silent and every one of those gates would quietly measure nothing.
      // Publishing the packed buffer here keeps them measuring the SHIPPED path
      // rather than being pointed at ?ftile=0 and told it is equivalent.
      //
      // A live reference, not a copy: readers must snapshot (Array.from) if
      // they intend to keep it past the current frame.
      balls: ballBuf as Float32Array,
      /** Per-ball field density, the companion channel to `balls`. */
      dens: dBuf as Float32Array,
      motes: 0, // …of which are motes (identity ≥ the authored population)
      bindAvg: 0, // mean bind over the authored droplets — why motes are absent
      tiles: 0,
      tileEntries: 0,
      tileMax: 0,
      tileOver: 0,
      demote: () => {},
    };
    (window as unknown as { __optics?: typeof diag }).__optics = diag;

    // The "max" rungs used to spend devicePixelRatio outright, which made the
    // buffer a function of the visitor's WINDOWS DPI SETTING rather than of
    // anything this GPU can actually shade. This pass is very nearly pure
    // fill: walking the ladder on an Intel UHD at 144 Hz, the frame cost
    // tracks buffer AREA and almost nothing else —
    //
    //   1.77 Mpx → 24.3 ms   1.13 Mpx → 17.3 ms   0.55 Mpx → 10.4 ms
    //
    // — while shedding the deformation at a fixed buffer cost 0.1 ms. The
    // pixels ARE the frame time. And at dpr 1.25 on a 1436×788 stage the old
    // rule asked for 1.77 Mpx, so the machine opened on a rung it could only
    // run at 41 fps: the stutter was budgeted in at load, before the watchdog
    // had seen a single frame.
    //
    // So "max" is a BUDGET now, not a multiplier: spend dpr only until the
    // buffer would cross FULL_BUDGET_PX. Two properties matter as much as the
    // saving:
    //   · the floor is 1 CSS pixel — never below — so this can only ever give
    //     back supersampling, never take real resolution away; and
    //   · at dpr 1 it is identically 1, which is what keeps the deterministic
    //     capture path (capture-rest-forms → verify-rest-exact, both dpr 1)
    //     byte-for-byte unchanged.
    // A soft, out-of-focus glass body has no edge detail that survives
    // supersampling anyway — HeroRibbon has rendered its own stream at 0.7 CSS
    // px for exactly this reason since R4.
    // ?fbudget=0 restores the old spend-all-dpr behaviour (A/B + rollback).
    const budgetOn = !/[?&]fbudget=0/.test(window.location.search);
    const FULL_BUDGET_PX = 1_300_000;
    const maxDpr = Math.min(window.devicePixelRatio || 1, 2);
    const scaleFor = () => {
      const s = RUNG_SCALE[liveTier];
      if (s !== "max") return s;
      if (!budgetOn) return maxDpr;
      const css =
        Math.max(container.clientWidth, 1) * Math.max(container.clientHeight, 1);
      // the budget is an AREA, the scale is a linear factor → sqrt
      return Math.min(maxDpr, Math.max(1, Math.sqrt(FULL_BUDGET_PX / css)));
    };

    const drawFrame = (tMs: number) => {
      if (ctxLost) return null; // parked — every caller tolerates a skip
      const aspect =
        gl.drawingBufferHeight > 0
          ? gl.drawingBufferWidth / gl.drawingBufferHeight
          : 1;
      if (shapeShaderActive) ballIds.fill(-1);
      dBuf.fill(1); // identity for any slot the driver does not author
      const f = driverRef.current.frame(
        tMs,
        ballBuf,
        aspect,
        zBuf,
        shapeShaderActive ? ballIds : undefined,
        dBuf,
      );
      const ta = textures[f.a];
      if (!ta) return f; // the driver's form isn't built yet — fallback stays
      const tb = textures[f.b] ?? ta;
      const formBWeight = textures[f.b] ? f.fb : 0;
      // `?fglass=0` drops to the flat branch; otherwise the rung set decides,
      // exactly as before.
      const glass = glassRequested && GLASS_RUNGS.has(liveTier);
      const postChain = post;
      const usePost = postChain !== null && liveTier === "full";
      diag.post = usePost ? 1 : 0;
      diag.tier = liveTier;
      if (usePost) {
        postChain.begin(gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.disable(gl.BLEND); // store exact straight alpha in the target
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      gl.useProgram(layer.prog); // post passes (R5-C) leave their own program
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, ta);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tb);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.uniform2f(
        layer.U("iRes"),
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
      );
      gl.uniform1f(layer.U("iTime"), tMs / 1000);
      gl.uniform1f(layer.U("iFormA"), f.fa);
      gl.uniform1f(layer.U("iFormB"), formBWeight);
      gl.uniform1f(layer.U("iEroA"), f.ea);
      gl.uniform1f(layer.U("iEroB"), f.eb);
      // ?fsat=<c> overrides the uploaded ceiling for review; 0 is the exact
      // rollback to the historical sum.
      const sat = satOverride != null ? satOverride : (f.sat ?? 0);
      gl.uniform1f(layer.U("iFieldSat"), sat);
      diag.sat = sat;
      diag.meltP = f.meltP ?? -1;
      diag.formA = f.a;
      diag.formB = f.b;
      gl.uniform2f(layer.U("iFormOff"), f.ox ?? 0, f.oy ?? 0);
      gl.uniform1f(layer.U("iFormScale"), f.scale ?? 1);
      gl.uniform1f(layer.U("iWarp"), f.warp);
      gl.uniform1f(layer.U("iMute"), f.mute);
      // The forms answer the hand and the strike as a DOMAIN DISPLACEMENT (see
      // formTouch in the shader). Gated on the live rung like deformation is —
      // a demoted machine sheds the effect without losing the material — and
      // zeroed rather than skipped, because a stale iTouch would leave a dent
      // parked in the form after the pointer had gone.
      if (touchShaderActive) {
        const touchTierActive =
          !motionReduced &&
          TOUCH_RUNGS.has(liveTier) &&
          !!f.touchLive &&
          !!f.touch &&
          !!f.shock;
        gl.uniform4fv(
          layer.U("iTouch"),
          touchTierActive ? f.touch! : ZERO_TOUCH,
        );
        gl.uniform4fv(
          layer.U("iShock"),
          touchTierActive ? f.shock! : ZERO_SHOCK,
        );
        diag.touch = touchTierActive ? 1 : 0;
      }
      gl.uniform1f(layer.U("iGlass"), glass ? 1 : 0);
      gl.uniform1f(layer.U("iGloss"), glass && glossRequested ? 1 : 0);
      diag.glass = glass ? 1 : 0;
      diag.gloss = glass && glossRequested ? 1 : 0;
      gl.uniform1i(layer.U("iBallCount"), f.count);
      diag.count = f.count;
      diag.motes = f.motes ?? 0;
      diag.bindAvg = f.bindAvg ?? 0;
      if (!tiledActive) gl.uniform3fv(layer.U("iBalls"), ballBuf);
      // Deformation is its OWN rung, not a passenger of the glass. Measured at
      // ~1.49× the plain glass pass, it is the largest single lever short of
      // resolution — so `rigid` sheds it to buy headroom while the material
      // survives. Tying it to `glass` (as it was) meant this 49% was still being
      // paid on the very rungs a struggling machine had already been demoted to.
      const shapeTierActive =
        shapeShaderActive && !motionReduced && DEFORM_RUNGS.has(liveTier);
      const speed = shapeTierActive ? sampleBallVelocity(f.count, tMs) : 0;
      // Deformation is no longer fenced to droplet-only frames. It cannot
      // disturb a form: the shape branch rewrites the BALL metric only, while
      // every form silhouette comes from formOnlyField(), which it never
      // touches. What keeps a resting stage exact is physical rather than
      // administrative — stretch is gated on SHAPE_SPEED_MIN, and liquid at
      // rest is below it. So the melt's travelling droplets finally deform
      // while its endpoints stay put.
      const shape = shapeTierActive ? 1 : 0;
      if (shapeShaderActive) {
        if (!tiledActive) gl.uniform4fv(layer.U("iBallVelocity"), ballVelocity);
        // The optics ride the same gate as the geometry — liquid that is not
        // allowed to deform must not be lit as though it were — and on top of
        // that they are OFF unless asked for (see strainRequested). ?fgrade=0
        // keeps its meaning as the exact-optics bypass.
        gl.uniform1f(
          layer.U("iStrain"),
          gradeOn && shape && strainRequested ? SDF_STRAIN : 0,
        );
      }
      gl.uniform1f(layer.U("iBallShape"), shape);
      diag.shape = shape;
      diag.strain = gradeOn && shape && strainRequested ? 1 : 0;
      diag.shapeSpeed = speed;
      diag.shapeReduced = motionReduced ? 1 : 0;
      // R5-C grade: score-driven light + stage absorption/depth. All exact
      // identity at 0 — ?fgrade=0 and the flat tiers render pre-C pixels.
      const grade = gradeOn && glass;
      gl.uniform1f(layer.U("iExpo"), grade ? (f.expo ?? 0) : 0);
      gl.uniform1f(layer.U("iKey"), grade ? (f.key ?? 0) : 0);
      gl.uniform1f(layer.U("iAbsorb"), grade ? SDF_GRADE.ABSORB : 0);
      gl.uniform1f(layer.U("iDepthFx"), grade ? SDF_GRADE.DEPTH : 0);
      const shadow = grade && shadowRequested;
      gl.uniform1f(layer.U("iShadow"), shadow ? SDF_GRADE.SHADOW : 0);
      diag.shadow = shadow ? 1 : 0;
      if (tiledActive && binner && ballRows) {
        // ── the droplet texture ────────────────────────────────────────────
        // Only the live slots are written: the tail of the texture is whatever
        // the previous frame left, and no tile list can reference it, because
        // the binner only ever emits indices below f.count.
        const n = Math.min(f.count, ballCap);
        for (let i = 0; i < n; i++) {
          const b3 = i * 3;
          const r0 = i * 4;
          ballRows[r0] = ballBuf[b3];
          ballRows[r0 + 1] = ballBuf[b3 + 1];
          ballRows[r0 + 2] = ballBuf[b3 + 2];
          ballRows[r0 + 3] = dBuf[i];
          const r1 = ballCap * 4 + i * 4;
          ballRows[r1] = zBuf[i];
          ballRows[r1 + 1] = shape ? ballVelocity[i * 2] : 0;
          ballRows[r1 + 2] = shape ? ballVelocity[i * 2 + 1] : 0;
          ballRows[r1 + 3] = 0;
        }
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, ballTex);
        gl.texSubImage2D(
          gl.TEXTURE_2D, 0, 0, 0, ballCap, 2, gl.RGBA, gl.FLOAT, ballRows,
        );

        // ── the tile lists ─────────────────────────────────────────────────
        // Rebuilt from the packed buffer every frame: the droplets moved, and a
        // stale list is liquid missing from a tile rather than liquid slightly
        // in the wrong place — a seam on a tile boundary, which reads as a
        // shader bug. SDF_GRAD_MARGIN widens each droplet's footprint so the
        // four gradient taps stay inside their own fragment's list.
        binner.bin(
          ballBuf,
          n,
          gl.drawingBufferWidth,
          gl.drawingBufferHeight,
          SDF_BALL_REACH,
          SDF_GRAD_MARGIN,
        );
        const st = binner.stats;
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, tileHeadTex);
        if (st.tilesX !== tileHeadW || st.tilesY !== tileHeadH) {
          tileHeadW = st.tilesX;
          tileHeadH = st.tilesY;
          gl.texImage2D(
            gl.TEXTURE_2D, 0, gl.RG32UI, tileHeadW, tileHeadH, 0,
            gl.RG_INTEGER, gl.UNSIGNED_INT, binner.head,
          );
        } else {
          gl.texSubImage2D(
            gl.TEXTURE_2D, 0, 0, 0, tileHeadW, tileHeadH,
            gl.RG_INTEGER, gl.UNSIGNED_INT, binner.head,
          );
        }
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, tileListTex);
        // Only the rows the entries actually occupy are uploaded, so a quiet
        // page pays a fraction of a busy one instead of a fixed worst case.
        const rowsUsed = Math.max(1, Math.ceil(st.entries / TILE_LIST_W));
        const capH = Math.max(1, Math.ceil(binner.list.length / TILE_LIST_W));
        if (capH !== tileListH) {
          tileListH = capH;
          gl.texImage2D(
            gl.TEXTURE_2D, 0, gl.R32UI, TILE_LIST_W, tileListH, 0,
            gl.RED_INTEGER, gl.UNSIGNED_INT, binner.list,
          );
        } else {
          gl.texSubImage2D(
            gl.TEXTURE_2D, 0, 0, 0, TILE_LIST_W, rowsUsed,
            gl.RED_INTEGER, gl.UNSIGNED_INT, binner.list,
          );
        }
        gl.uniform2i(layer.U("iTiles"), st.tilesX, st.tilesY);
        diag.tiles = st.tilesX * st.tilesY;
        diag.tileEntries = st.entries;
        diag.tileMax = st.maxPerTile;
        diag.tileOver = st.over;
      } else {
        gl.uniform1fv(layer.U("iBallZ"), zBuf);
        gl.uniform1fv(layer.U("iBallDensity"), dBuf);
      }
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (usePost) {
        postChain.end(tMs / 1000); // bright → blur → opaque composite
        gl.enable(gl.BLEND); // the direct path composites over the page
      }
      diag.frames++;
      if (!announced) {
        announced = true;
        watchdogReadyAt = tMs + WATCHDOG_READY_GRACE_MS;
        cb.current.onReady();
      }
      return f;
    };

    // FPS watchdog — requires SUSTAINED slowness (the counter decays on good
    // frames), so scroll flicks, tab stalls or capture harnesses can never
    // demote a healthy canvas. Downshifts lower resolution only; the liquid
    // NEVER freezes.
    //
    // The slow-frame test was a hardcoded `dt > 34` — written as "two missed
    // vsyncs", which is only true at 60 Hz. It is really two things at once: a
    // RELATIVE rule (missing vsyncs) and an ABSOLUTE product bar (~30 fps is
    // the floor below which this liquid is not worth showing). Below 60 Hz the
    // relative half is wrong; the absolute half is sound and stays.
    //
    // Resist the temptation to make this strict on a fast panel. Measured on
    // Intel UHD at 144 Hz this shader costs 15–25 ms at the upper rungs, so a
    // 20 ms bar ("50 fps or it has failed") is unmeetable by construction: the
    // ladder then walks all the way down to `half` — flat cyan, no glass — and
    // trades the site's entire material for a target the GPU was never going
    // to hit. That was tried here and photographed; it is worse than the
    // stutter it was meant to cure. The frame cost is fixed by making frames
    // CHEAPER (see the buffer budget above), not by making the bar angrier.
    //
    // So: the same ~30 fps product bar for everyone, expressed relatively for
    // panels slower than 60 Hz. At 60 Hz this is 33.4 ms — what it has always
    // been — so nothing changes for the majority of visitors.
    const SLOW_FLOOR_MS = 30;
    let vsync = 16.7; // running estimate: the fastest interval yet observed
    let prevGoverned = false;

    let lastTick = 0;
    let raf = 0;
    let wdWarm = 0;
    let wdSlow = 0;

    // R5-C energy governor (§12.3): a truly idle liquid draws every OTHER
    // vsync (≈30 Hz — a floor, never a freeze). Entry needs SUSTAINED low
    // conductor energy AND no recent human input; any scene activity, scroll,
    // pointer or spray wakes it within one frame. ?fgov=0 disables (QA).
    const govOn = !/[?&]fgov=0/.test(window.location.search);
    const GOV_LOW = 0.1; // conductor energy below this counts as idle
    const GOV_SUSTAIN = 45; // ~0.75 s of consecutive idle draws to enter
    const GOV_INPUT_MS = 1200; // any input holds active cadence this long
    const GOV_FRAME_MS = 30; // idle floor ≈ 30 Hz on ANY display refresh rate
    let govLow = 0;
    let lastDraw = 0;
    let lastInput = performance.now();
    const markInput = () => {
      lastInput = performance.now();
    };
    const INPUT_EVENTS = [
      "pointermove",
      "pointerdown",
      "wheel",
      "touchmove",
      "keydown",
      "scroll",
    ] as const;
    for (const ev of INPUT_EVENTS)
      window.addEventListener(ev, markInput, { passive: true });
    // Applying a rung's population is a PACKING budget, never an allocation: the
    // conductor keeps simulating everything it was built with, so a demotion
    // strands no physics state and a recovered rung brings its motes back where
    // they would have been rather than snapping them in from their stations.
    const applyPopulation = () => {
      const set = driverRef.current.setPopulation;
      if (!set) return;
      const sim = driverRef.current.population?.simulated ?? 0;
      // Only the tiled path has room for a population; the uniform arrays stop
      // at 80 and every slot past the authored 48 is owed to the atmosphere,
      // the spray and the cursor chain.
      diag.pop = set(tiledActive ? Math.round(sim * RUNG_POP[liveTier]) : 0);
    };
    applyPopulation();
    const downshift = () => {
      wdWarm = 0;
      wdSlow = 0;
      const next = NEXT_RUNG[liveTier];
      if (!next) return; // already on the floor
      liveTier = next;
      applyPopulation();
      if (next === "fullnofx") {
        // No rung promotes this instance back to full. Release the framebuffer
        // targets now instead of retaining their GPU memory until unmount; a
        // fresh context or session will build a fresh chain.
        post?.dispose();
        post = null;
        diag.fmt = "none";
      }
      resize();
      // Only the FLAT floor is worth persisting for the session. The glass-
      // bearing rungs stay runtime-only so a fresh load retries the real
      // material — a machine that stuttered once should not be sentenced to
      // flat cyan for the rest of its visit.
      if (next === "lite") cb.current.onTierChange("lite");
    };
    diag.demote = downshift;

    const tick = (now: number) => {
      raf = 0;
      if (disposed || !playRef.current) return;
      const governed =
        govOn && govLow >= GOV_SUSTAIN && now - lastInput > GOV_INPUT_MS;
      diag.gov = governed ? 1 : 0;
      if (governed && now - lastDraw < GOV_FRAME_MS) {
        // idle: hold the ~30 Hz floor (time-based — display-rate agnostic);
        // the loop never stops, so the wake is always one vsync away
        raf = requestAnimationFrame(tick);
        return;
      }
      lastDraw = now;
      const dt = now - lastTick;
      lastTick = now;
      // rAF cannot fire faster than the display, so the smallest interval we
      // have ever seen IS the panel's vsync. Clamped at 4 ms (250 Hz) so a
      // freak sub-millisecond sample cannot latch the estimate at nonsense.
      if (dt >= 4 && dt < vsync) vsync = dt;
      const slowMs = Math.max(SLOW_FLOOR_MS, vsync * 2);
      const watchdogReady = announced && now >= watchdogReadyAt;
      // The frame that LEAVES the idle governor carries the whole governed gap
      // in its dt — an intentional ~33 ms that says nothing about this rung.
      if (watchdogReady && ++wdWarm > 5 && !governed && !prevGoverned) {
        // missing 2+ of THIS display's vsyncs counts up; smooth frames pay it
        // back down (governed frames are INTENTIONALLY ~33 ms — never counted)
        if (dt > slowMs) {
          if (++wdSlow >= 30) downshift();
        } else {
          wdSlow = Math.max(0, wdSlow - 2);
        }
      } else if (!watchdogReady) {
        wdWarm = 0;
        wdSlow = 0;
      }
      prevGoverned = governed;
      diag.vsync = +vsync.toFixed(2);
      diag.slowMs = +slowMs.toFixed(2);
      diag.wdSlow = wdSlow;
      const f = drawFrame(now);
      const e = f?.energy ?? 1;
      if (e < GOV_LOW) {
        if (govLow <= GOV_SUSTAIN) govLow++;
      } else {
        govLow = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    const startLoop = () => {
      if (raf || disposed || !playRef.current) return;
      lastTick = performance.now();
      raf = requestAnimationFrame(tick);
    };
    api.current = {
      setPlay: (p: boolean) => {
        if (p) startLoop();
      },
    };

    const resize = () => {
      const scale = scaleFor();
      diag.scale = +scale.toFixed(3);
      const w = Math.max(1, Math.round((container.clientWidth || 1) * scale));
      const h = Math.max(1, Math.round((container.clientHeight || 1) * scale));
      if (layer.canvas.width !== w || layer.canvas.height !== h) {
        layer.canvas.width = w;
        layer.canvas.height = h;
      }
      drawFrame(performance.now()); // never flash an empty canvas on resize
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();
    startLoop();

    // prefetch the driver's forms (forms[0] gates the first paint)
    (async () => {
      for (const s of driverRef.current.forms) {
        if (disposed) return;
        try {
          const data = await loadSdf(SVG_URLS[s]);
          if (disposed) return;
          textures[s] = makeSdfTexture(layer, data);
          driverRef.current.formReady?.(s); // retargeting drivers gate on this
          drawFrame(performance.now()); // paint as soon as the form exists
        } catch {
          /* missing form: the fallback stays for frames that need it */
        }
      }
    })();

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      layer.canvas.removeEventListener("webglcontextlost", onLost);
      layer.canvas.removeEventListener("webglcontextrestored", onRestored);
      motionQuery.removeEventListener("change", onMotionPreference);
      for (const ev of INPUT_EVENTS) window.removeEventListener(ev, markInput);
      post?.dispose();
      const w = window as unknown as { __optics?: typeof diag };
      if (w.__optics === diag) delete w.__optics;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      layer.canvas.remove();
      api.current = null;
    };
  }, [tier, epoch]);

  useEffect(() => {
    playRef.current = play;
    api.current?.setPlay(play);
  }, [play]);

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", height: "100%" }}
    />
  );
}
