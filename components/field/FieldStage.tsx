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
  SDF_BALL_MAX,
  SDF_THICK,
  SDF_RES,
  SDF_GRADE,
  SDF_STRAIN,
} from "@/lib/webgl/sdf-glass-shader.mjs";
import { makeLayer, makeSdfTexture, loadSdf } from "@/lib/webgl/sdf-gl";
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
    // Preference list, not a prediction: the driver decides whether the wider
    // uniform block links, and the plain field is always the last resort so a
    // refusal costs deformation, never the canvas.
    const layer = makeLayer(
      container,
      SDF_GLASS_VERT,
      shapeWanted ? [SDF_GLASS_FRAG_SHAPE, SDF_GLASS_FRAG] : SDF_GLASS_FRAG,
    );
    if (!layer) return; // no WebGL2 → shell's SVG fallback stays
    const shapeShaderActive = shapeWanted && layer.variant === 0;
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

    const textures: (WebGLTexture | null)[] = new Array(STATE_COUNT).fill(null);
    const ballBuf = new Float32Array(SDF_BALL_MAX * 3);
    const zBuf = new Float32Array(SDF_BALL_MAX); // per-ball depth (iBallZ)
    // per-ball field density (iBallDensity); 1 = solid liquid, 0 = dissolved
    const dBuf = new Float32Array(SDF_BALL_MAX).fill(1);
    const ballIds = new Int16Array(SDF_BALL_MAX);
    ballIds.fill(-1);
    // `iBallVelocity` is packed as two xy vectors per vec4. Every history and
    // filter buffer is allocated once; the render loop only mutates them.
    // Velocity history is keyed by canonical droplet identity, never by packed
    // slot: satellites, ambient beads, and extras may enter/leave or shift the
    // packing order and must never inherit another particle's stretch.
    const ballVelocity = new Float32Array(SDF_BALL_MAX * 2);
    const identityVelocity = new Float32Array(SDF_BALL_MAX * 2);
    const previousIdentityBalls = new Float32Array(SDF_BALL_MAX * 3);
    const identitySeen = new Uint8Array(SDF_BALL_MAX);
    const identitySeenNow = new Uint8Array(SDF_BALL_MAX);
    let lastPackedCount = 0;
    let previousVelocityTime = -1;
    const resetVelocityHistory = (count: number, tMs: number) => {
      const safeCount = Math.min(count, SDF_BALL_MAX);
      ballVelocity.fill(0);
      identityVelocity.fill(0);
      identitySeen.fill(0);
      for (let slot = 0; slot < safeCount; slot++) {
        const id = ballIds[slot];
        if (id < 0 || id >= SDF_BALL_MAX) continue;
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
      const safeCount = Math.min(count, SDF_BALL_MAX);
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
        if (id < 0 || id >= SDF_BALL_MAX) {
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
      for (let id = 0; id < SDF_BALL_MAX; id++) {
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
      demote: () => {},
    };
    (window as unknown as { __optics?: typeof diag }).__optics = diag;

    const maxDpr = Math.min(window.devicePixelRatio || 1, 2);
    const scaleFor = () => {
      const s = RUNG_SCALE[liveTier];
      return s === "max" ? maxDpr : s;
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
      gl.uniform2f(layer.U("iFormOff"), f.ox ?? 0, f.oy ?? 0);
      gl.uniform1f(layer.U("iFormScale"), f.scale ?? 1);
      gl.uniform1f(layer.U("iWarp"), f.warp);
      gl.uniform1f(layer.U("iMute"), f.mute);
      gl.uniform1f(layer.U("iGlass"), glass ? 1 : 0);
      gl.uniform1f(layer.U("iGloss"), glass && glossRequested ? 1 : 0);
      diag.glass = glass ? 1 : 0;
      diag.gloss = glass && glossRequested ? 1 : 0;
      gl.uniform3fv(layer.U("iBalls"), ballBuf);
      gl.uniform1i(layer.U("iBallCount"), f.count);
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
        gl.uniform4fv(layer.U("iBallVelocity"), ballVelocity);
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
      gl.uniform1fv(layer.U("iBallZ"), zBuf);
      gl.uniform1fv(layer.U("iBallDensity"), dBuf);
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
    const downshift = () => {
      wdWarm = 0;
      wdSlow = 0;
      const next = NEXT_RUNG[liveTier];
      if (!next) return; // already on the floor
      liveTier = next;
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
      const watchdogReady = announced && now >= watchdogReadyAt;
      if (watchdogReady && ++wdWarm > 5 && !governed) {
        // missing 2+ vsyncs counts up; smooth frames pay it back down
        // (governed frames are INTENTIONALLY ~33 ms — never counted)
        if (dt > 34) {
          if (++wdSlow >= 30) downshift();
        } else {
          wdSlow = Math.max(0, wdSlow - 2);
        }
      } else if (!watchdogReady) {
        wdWarm = 0;
        wdSlow = 0;
      }
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
