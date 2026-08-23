"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { prefersReducedMotion } from "@/lib/animation/reduced-motion";
import { makeMembrane } from "@/lib/motion/membrane.mjs";
import type { Membrane } from "@/lib/motion/membrane.mjs";
import {
  buildIntroTimeline,
  curtainAmp,
  curtainClip,
  edgeD,
  INTRO_MAX_N,
  SCORE,
  type IntroEls,
} from "@/lib/animation/intro-sequence";
import { INTRO_VIEW, RING } from "@/lib/animation/intro-trace.data.mjs";
import { IntroRive, INTRO_RIVE_SRC } from "./IntroRive";
import { cn } from "@/lib/utils";

/**
 * Has the intro already run in THIS document?
 *
 * Not `document.documentElement.dataset` — measured, not assumed: a locale
 * switch is a SOFT navigation (the JS realm survives) but it crosses the root
 * layout, so React re-renders `<html>` and an imperatively-set attribute on it
 * does not survive the reconciliation. The intro replayed on every language
 * toggle. A module binding dies with the document and survives everything
 * inside it, which is exactly the line wanted:
 *
 *   reload / fresh visit  → module re-evaluated, flag false  → PLAYS
 *   locale switch, SPA nav→ same module, flag true           → suppressed
 *   Strict Mode re-invoke → set on RELEASE, so still false   → PLAYS
 *
 * The last row is why this is set in `release()` and not at the top of the
 * effect: React invokes effects twice on the same instance in development, and
 * a flag claimed up front would cancel the second run.
 */
let playedInThisDocument = false;

/**
 * S1.10 — the loading moment. The FIRST brand touch is the mark drawing itself
 * and then coming alive: two lines meet, the silhouette floods, the surface
 * breathes, and the whole thing pours off the bottom of the screen onto a hero
 * that has been running underneath the whole time.
 *
 * The choreography lives in `lib/animation/intro-sequence.ts` — read that for
 * the score and the reasoning. This file owns only the parts a timeline cannot:
 * whether the intro is allowed to play at all, the DOM it plays on, the one
 * ticker that steps the liquid, and the guarantees that it can never strand the
 * page.
 *
 * ── once per document, never seen late ─────────────────────────────────────
 * The intro plays on EVERY document load, reloads included — it is the brand's
 * first frame and the owner wants it to be the brand's first frame every time.
 * It does NOT replay inside a document that has already shown it — see
 * `playedInThisDocument` above for why that guard is a module binding and not
 * an attribute on `<html>`.
 *
 * Skipped with NO flash for: QA/capture contexts (any `?f*` param, the
 * repo-wide convention — an inline pre-paint script in the layout sets the
 * attribute before the veil can paint) and reduced motion (CSS media query +
 * JS). A hard cap always releases it. In-app navigations are covered by the
 * cyan page wipe in app/[locale]/template.tsx; there is deliberately no route
 * `loading.tsx` — its Suspense boundary flushed a 200 before `notFound()` could
 * run, turning every unmatched path into a soft 404.
 *
 * ── the liquid is stepped by GSAP, not by its own rAF ───────────────────────
 * `membrane-runtime.ts` owns the shared loop for every membrane on a PAGE. The
 * intro deliberately does not join it: this surface has to be frame-locked to a
 * timeline that is also being scrubbed by a skip, and a second independent loop
 * is exactly the "separate effects layered together" failure the whole design
 * is trying to avoid. One ticker, added and removed with the veil.
 */
export function EntryVeil({ label, skipLabel }: { label: string; skipLabel: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const edgeSvgRef = useRef<SVGSVGElement>(null);
  const edgeRef = useRef<SVGPathElement>(null);
  const bodyRef = useRef<SVGPathElement>(null);
  const traceRef = useRef<SVGPathElement>(null);
  const floodRef = useRef<SVGPathElement>(null);
  const seedRef = useRef<SVGCircleElement>(null);
  const ringRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const dropRefs = useRef<(SVGCircleElement | null)[]>([]);

  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const riveProgress = useRef<(p: number) => void>(() => {});

  const [gone, setGone] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const maskRectRef = useRef<SVGRectElement>(null);
  /** null = undecided; see the guard in the effect below. */
  const allowedRef = useRef<boolean | null>(null);

  /**
   * Fast-forward to the exit rather than cutting: a skip should still leave
   * through the door, so the visitor gets the handoff instead of a jump cut.
   *
   * `tweenTo` scrubs the playhead and PARKS the timeline there — it does not
   * hand playback back. Without the `onComplete` the sequence stalls at the top
   * of the drain and the hard cap releases the page a second and a half later,
   * which looks exactly like a skip that did nothing. The gate now measures
   * this rather than accepting any release as a pass.
   */
  const skip = useCallback(() => {
    const tl = tlRef.current;
    if (!tl || tl.time() >= SCORE.drain) return;
    setCanSkip(false);
    tl.tweenTo(SCORE.drain, {
      duration: 0.32,
      ease: "power2.inOut",
      onComplete: () => tl.play(),
    });
  }, []);

  useEffect(() => {
    // ── may this play at all? ───────────────────────────────────────────────
    // Decided ONCE per instance and cached, because the decision MUTATES its
    // own condition: playing marks the document as seen. React's Strict Mode
    // invokes effects twice on the same instance in development, so a guard
    // that re-reads `data-zveil` cancels the sequence on the second run and
    // the intro never plays in dev — which is also exactly when it is being
    // designed. The ref makes the answer stable across re-invocation while
    // still skipping a genuine remount or reload.
    if (allowedRef.current === null) {
      // QA / capture contexts (?ftier, ?fstate, ?feco, …) must render the page
      // deterministically — the veil never plays under any f* param.
      const qa = [...new URLSearchParams(window.location.search).keys()].some(
        (k) => /^f/.test(k),
      );
      // Set by `release()` earlier in THIS document, or by the pre-paint script
      // for a capture context. Not persisted anywhere: a reload is meant to
      // play the intro again.
      const seen = document.documentElement.dataset.zveil === "seen";
      allowedRef.current =
        !seen && !playedInThisDocument && !qa && !prefersReducedMotion();
    }
    if (!allowedRef.current) {
      setGone(true);
      return;
    }

    const root = rootRef.current;
    const stage = stageRef.current;
    const curtain = curtainRef.current;
    if (!root || !stage || !curtain) return;

    const timers: number[] = [];
    let membrane: Membrane | null = null;
    let onTick: (() => void) | null = null;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      playedInThisDocument = true;
      document.documentElement.dataset.zveil = "seen";
      setGone(true);
    };

    // ── geometry ────────────────────────────────────────────────────────────
    // Measured before anything in this effect touches the document: layout
    // reads are only as true as the state they are taken in.
    const S = Math.round(stage.getBoundingClientRect().width);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!S) {
      release();
      return;
    }

    // Every geometric attribute in this subtree is set HERE, imperatively, and
    // none of them appear as JSX props. `canSkip` flips a fraction of a second
    // into the sequence; if React owned `viewBox`, `r` or `d`, that render
    // would reconcile them back to their authored values and reset the running
    // animation mid-flight. React owns the tree; GSAP and the kernel own the
    // numbers, and the two never touch the same attribute.
    svgRef.current?.setAttribute("viewBox", `0 0 ${S} ${S}`);
    maskRectRef.current?.setAttribute("width", `${S}`);
    maskRectRef.current?.setAttribute("height", `${S}`);

    // The black plane is TALLER than the viewport by the wave's full swing, so
    // the shaped edge can rest entirely above the screen and still reach the
    // bottom. Its clip is set once; only `transform` moves (intro-sequence
    // §the curtain).
    const amp = curtainAmp(vw);
    curtain.style.height = `${vh + amp * 2}px`;
    curtain.style.clipPath = curtainClip(vw, vh, amp);
    edgeRef.current?.setAttribute("d", edgeD(vw, amp));
    edgeSvgRef.current?.setAttribute("viewBox", `0 0 ${vw} ${amp * 2}`);
    edgeSvgRef.current?.setAttribute("height", `${amp * 2}`);
    edgeSvgRef.current?.setAttribute("width", `${vw}`);

    // The kernel runs in REAL PIXELS — membrane.mjs is tuned in px/ms from top
    // to bottom, so the ring is scaled here rather than left in viewBox units.
    const k = S / INTRO_VIEW;
    const ring = {
      n: RING.n,
      x: RING.x.map((v) => v * k),
      y: RING.y.map((v) => v * k),
      nx: RING.nx,
      ny: RING.ny,
    };
    membrane = makeMembrane(S, S, { ring, maxN: INTRO_MAX_N });

    const els: IntroEls = {
      stage,
      curtain,
      body: bodyRef.current!,
      trace: traceRef.current!,
      flood: floodRef.current!,
      seed: seedRef.current!,
      ring: ringRef.current!,
      dot: dotRef.current!,
      edge: edgeRef.current!,
      drops: dropRefs.current.filter(Boolean) as SVGCircleElement[],
    };
    if (Object.values(els).some((v) => !v)) {
      release();
      return;
    }

    // ── the held clock (QA) ─────────────────────────────────────────────────
    // `?zintro=hold` builds the sequence paused and drives the liquid off the
    // TIMELINE's clock rather than the wall's, so `scripts/capture-intro.mjs`
    // can seek to a beat and photograph exactly that beat — surface
    // deformation included. Deliberately not an `?f*` flag: those disable the
    // veil outright (the repo-wide capture convention), and this one needs it
    // to exist. Live visitors never touch either branch.
    const hold =
      new URLSearchParams(window.location.search).get("zintro") === "hold";
    // `now` has to exist before the timeline it reads from, so the reference
    // goes through a box rather than a `let` the linter would rather see const.
    const box: { tl?: gsap.core.Timeline } = {};
    const now = () =>
      hold && box.tl ? box.tl.time() * 1000 : performance.now();

    const tl = buildIntroTimeline(els, membrane, S, { w: vw, h: vh }, {
      onProgress: (p) => riveProgress.current(p),
      onDone: hold ? () => {} : release,
      now,
    });
    box.tl = tl;
    tlRef.current = tl;

    // ── the one ticker ──────────────────────────────────────────────────────
    // Step the surface on GSAP's clock so the liquid and the score can never
    // disagree about what time it is. Writing `d` only when the kernel reports
    // movement keeps a sleeping surface free.
    const mem = membrane;
    onTick = () => {
      if (mem.step(now())) {
        const d = mem.path();
        els.body.setAttribute("d", d);
        els.trace.setAttribute("d", d);
      }
    };
    gsap.ticker.add(onTick);

    // The pointer deforms the mark while it is liquid — the same hand the rest
    // of the site answers. Before the flood there is no body to push, so the
    // kernel is simply not told about it.
    const onMove = (e: PointerEvent) => {
      if (tl.time() < SCORE.flood) return;
      const r = stage.getBoundingClientRect();
      mem.hand(e.clientX - r.left, e.clientY - r.top, 0, 0);
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    if (hold) {
      // The harness owns the playhead. Advancing it in frame-sized steps —
      // rather than jumping — is what keeps the capture honest: the strikes are
      // timeline CALLBACKS, so they have to be crossed to fire, and each one
      // has to be crossed at its own `now()` or every impulse in the sequence
      // lands with the same timestamp. Seeks must therefore be monotonic; to
      // rewind, reload the page.
      gsap.ticker.remove(onTick!);
      let at = 0;
      const advance = (t: number) => {
        for (let s = at; s < t; s = Math.min(t, s + 1 / 60)) {
          tl.time(s, false);
          mem.step(s * 1000);
        }
        tl.time(t, false);
        mem.step(t * 1000);
        at = t;
        const d = mem.path();
        els.body.setAttribute("d", d);
        els.trace.setAttribute("d", d);
      };
      (window as unknown as { __zintro?: unknown }).__zintro = {
        seek: advance,
        duration: SCORE.end,
        score: SCORE,
      };
      tl.pause(0);
    } else {
      tl.play();
      timers.push(window.setTimeout(() => setCanSkip(true), SCORE.skip * 1000));
      // hard cap — the veil must NEVER strand the page (hidden tab, stalled
      // ticker, a plugin that failed to register). 1.2 s of grace over the score.
      timers.push(window.setTimeout(release, (SCORE.end + 1.2) * 1000));
    }

    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("pointermove", onMove);
      if (onTick) gsap.ticker.remove(onTick);
      tl.kill();
      tlRef.current = null;
    };
    // Runs once per mount. The reduced-motion answer is read synchronously in
    // the guard rather than subscribed to: a visitor who changes the OS setting
    // mid-sequence is not a case worth re-running a 3.4 s intro for, and making
    // it a dependency reintroduces the double-run this guard exists to survive.
  }, []);

  // Escape skips, wherever focus happens to be.
  useEffect(() => {
    if (gone || !canSkip) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gone, canSkip, skip]);

  if (gone) return null;

  return (
    <div className="entry-veil" ref={rootRef} role="status" aria-label={label}>
      {/* The black plane and the mark are SIBLINGS, not parent and child. The
          plane is clipped and the mark is not: the mark has its own fall curve
          and leads the sheet out, passing over the revealed page on its way. */}
      <div className="entry-veil-curtain" ref={curtainRef}>
        {/* the meniscus on the draining sheet's leading edge */}
        <svg
          className="entry-veil-edge"
          ref={edgeSvgRef}
          aria-hidden="true"
          preserveAspectRatio="none"
        >
          <path ref={edgeRef} fill="none" stroke="var(--color-cyan)" strokeWidth={1.5} />
        </svg>
      </div>

      <div className="entry-veil-mark">
        <div className="entry-veil-stage" ref={stageRef}>
          <svg className="entry-veil-svg" ref={svgRef} aria-hidden="true">
            <defs>
              {/* The flood. Black hides, white shows; the white shape grows out
                  of the meeting point, so the body arrives with a FRONT rather
                  than by becoming gradually less transparent. */}
              <mask id="zi-flood" maskUnits="userSpaceOnUse">
                <rect ref={maskRectRef} x="0" y="0" fill="#000" />
                <path ref={floodRef} fill="#fff" />
              </mask>
              {/* A flat 520 px field of one cyan reads as a sticker. This is
                  the site's LOCKED key light — normalize(-0.42, 0.72, 0.55),
                  upper-left (sdf-glass-shader.mjs §L) — expressed in the two
                  brand cyans, so the body has a lit side and a shaded side
                  without a new hue entering the palette. The glow rim on top
                  is then a highlight rather than a duplicate of the fill. */}
              <linearGradient id="zi-lit" x1="0.12" y1="0" x2="0.88" y2="1">
                <stop offset="0" stopColor="var(--color-cyan-glow)" />
                <stop offset="0.42" stopColor="var(--color-cyan)" />
                <stop offset="1" stopColor="var(--color-cyan-deep)" />
              </linearGradient>
            </defs>

            <g mask="url(#zi-flood)">
              <path ref={bodyRef} className="zi-body" fill="url(#zi-lit)" />
            </g>

            {/* vector line first, the body's rim light afterwards */}
            <path
              ref={traceRef}
              className="zi-trace"
              fill="none"
              stroke="var(--color-cyan-glow)"
              strokeLinecap="round"
            />

            <circle ref={dotRef} className="zi-dot" fill="var(--color-cyan)" />
            <circle ref={seedRef} className="zi-seed" fill="var(--color-cyan-glow)" />
            <path
              ref={ringRef}
              className="zi-ring"
              fill="none"
              stroke="var(--color-cyan-glow)"
            />
            <g className="zi-drops">
              {[0, 1, 2].map((i) => (
                <circle
                  key={i}
                  ref={(el) => {
                    dropRefs.current[i] = el;
                  }}
                  fill="var(--color-cyan)"
                />
              ))}
            </g>
          </svg>

          {INTRO_RIVE_SRC ? (
            <IntroRive
              bind={(set) => {
                riveProgress.current = set;
              }}
            />
          ) : null}
        </div>
      </div>

      <button
        type="button"
        className={cn("entry-veil-skip", canSkip && "is-ready")}
        onClick={skip}
        tabIndex={canSkip ? 0 : -1}
        aria-hidden={!canSkip}
      >
        {skipLabel}
      </button>
    </div>
  );
}
