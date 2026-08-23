"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { gsap } from "gsap";
import { useReducedMotion } from "@/lib/animation/reduced-motion";

/**
 * R6 · THE DISCLOSURE, as a sheet of liquid glass drawn out of the page.
 *
 * The panel used to open at native <details> speed with a fade and a 6px lift
 * on its contents — the honest thing to build at the time, because the two
 * height-animation techniques that were tried both failed on ::details-content
 * (the failures are documented in globals.css and still worth reading). This
 * is the third technique, and the one that works: the height is animated on a
 * REAL wrapper element inside an already-open <details>, so nothing depends on
 * a pseudo-element whose subtree the UA refuses to lay out while closed.
 *
 * ── ORCHESTRATED easeReverse (GSAP 3.15) ───────────────────────────────────
 * One timeline, played forward to open and REVERSED to close — but not a
 * single tween closes on the curve it opened with. Reversing an animation
 * reverses its easing too, and a mirrored exit is almost always wrong:
 *
 *   · THE PANE swings open on the house `arrive` curve — glass has weight, it
 *     moves fast and settles. Mirrored, that becomes a quintic EASE-IN: at the
 *     midpoint of the close the panel would still be at 97% of its height,
 *     dropping only at the very end — which reads as lag on a control the user
 *     already dismissed. It withdraws on `power2.out` instead, which is at 25%
 *     by the same midpoint: it leaves the instant you ask, and eases into the
 *     closed state so the CTA below lands rather than snaps.
 *
 *   · THE SPECULAR travels down the sheet once, on `power2.inOut`. Light does
 *     not un-travel, so a mirrored return sweep would be the one thing on the
 *     panel that looks animated rather than lit. `power3.in` on the way back
 *     leaves it parked at the foot for almost the whole close, where the
 *     collapsing clip eats it — the highlight is gone, never seen retreating.
 *
 *   · THE ROWS arrive one after another on `power3.out`, and leave on one
 *     quick `power1.out`. A mirrored stagger reads as hesitation, and the pane
 *     is already closing over them.
 *
 *   · THE MARK latches shut on `back.out(2.4)` — the tiny overshoot is what
 *     makes a plus becoming a minus feel like a mechanism. Mirrored, the minus
 *     would bulge back OUT before reopening into a plus: a bounce on a
 *     dismissal, which is exactly the tic easeReverse exists to remove. It
 *     reopens on a plain `power2.inOut`.
 *
 * easeReverse also remaps from wherever the playhead actually is, not from the
 * tween's recorded endpoint — which is why closing mid-open (and reopening
 * mid-close) resumes from the current height instead of snapping to a
 * keyframe. The interruption handling below is free because of that.
 *
 * ── WHAT STAYS NATIVE ──────────────────────────────────────────────────────
 * Strictly additive, the same contract the CTA membrane keeps: `data-disclose`
 * is set only after this mounts AND motion is allowed, and every animated rule
 * in globals.css is gated on it. Without JS, before hydration, and under
 * reduced motion this is a plain <details> — keyboard-operable, announced
 * correctly, findable by in-page search, and still wearing the glass, because
 * the glass is paint rather than motion. An open this component did not
 * initiate (find-in-page expanding the panel) is not a gesture: it takes the
 * state and skips the choreography.
 *
 * aria-expanded is deliberately NOT overridden. Closing holds the `open`
 * attribute until the exit finishes, so the native state trails the user's
 * intent by the length of the close — but the alternative, announcing
 * "collapsed" while the content is still rendered, is the worse lie, and
 * unlike the mobile menu there is nothing focusable inside this panel for that
 * window to strand.
 */
export function Disclose({
  label,
  summaryLabel,
  className,
  children,
}: {
  /** Visible summary text. */
  label: string;
  /** Full accessible name — summaries are heard out of context in a rotor. */
  summaryLabel: string;
  className?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const [live, setLive] = useState(false);

  const detailsRef = useRef<HTMLDetailsElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const closingRef = useRef(false);
  /** The open state THIS component just wrote, so the `toggle` listener can
   *  tell its own writes apart from a find-in-page expansion. */
  const selfSetRef = useRef<boolean | null>(null);

  /** Drop the timeline and every inline value it wrote. The resting DOM must
   *  be indistinguishable from the no-JS one, or the next native open renders
   *  a panel still clamped to a stale height. */
  const teardown = useCallback(() => {
    tlRef.current?.kill();
    tlRef.current = null;
    closingRef.current = false;

    const pane = paneRef.current;
    const details = detailsRef.current;
    if (pane) {
      gsap.set(pane.querySelectorAll("[data-disclose-row], .disclose-sheen"), {
        clearProps: "all",
      });
      gsap.set(pane, { clearProps: "all" });
    }
    if (details) {
      gsap.set(details, { clearProps: "all" });
      // the pin is written on an ancestor's sibling, so it does not come back
      // with the timeline's own clearProps — a stale one would hold the column
      // off its line for as long as the panel stayed shut
      details
        .closest(".pillar")
        ?.querySelector<HTMLElement>(".pillar-copy")
        ?.style.removeProperty("--copy-pin");
    }
  }, []);

  const build = useCallback(() => {
    const pane = paneRef.current;
    const body = bodyRef.current;
    const details = detailsRef.current;
    if (!pane || !body || !details) return null;

    const rows = body.querySelectorAll<HTMLElement>("[data-disclose-row]");
    const sheen = body.querySelector<HTMLElement>(".disclose-sheen");
    const tl = gsap.timeline({ paused: true, defaults: { overwrite: "auto" } });

    // ── THE PIN ────────────────────────────────────────────────────────────
    // The stage centres this copy column, so growing it levers the headline
    // upward by half the growth (165.7px on a 900px stage). Compensate with a
    // transform: layout keeps doing exactly what it did, the pillar's box is
    // untouched — which matters, because the Services scene schedules the melt
    // off `.pillar` rects — and the column visually holds its line.
    //
    // MEASURED per frame, not interpolated. The layout's response to the pane
    // height is piecewise linear: the column stops moving once it outgrows the
    // stage track, and a straight ramp between the two endpoints was 51px out
    // at that knee — a visible wobble, headline drifting away and back.
    //
    // Reading the rect in onUpdate costs nothing extra: the height write has
    // already dirtied layout, so this only forces the reflow the frame owed
    // anyway, and the transform written afterwards is compositor-only and
    // dirties nothing. One layout per frame, no thrash.
    const pillar = details.closest<HTMLElement>(".pillar");
    const copy = pillar?.querySelector<HTMLElement>(".pillar-copy") ?? null;

    // `applied` is not bookkeeping for its own sake. getBoundingClientRect()
    // reports the VISUAL box, so it includes the compensation this function
    // wrote on the previous frame — feed that straight back in and the pin
    // solves `p → D − p`, which oscillates between 0 and the full offset every
    // frame instead of settling. Subtracting what we applied recovers the
    // LAYOUT position, which is the only thing the compensation may be a
    // function of. (offsetTop is transform-immune and would sidestep this, but
    // it rounds to whole pixels and this wants the sub-pixel.)
    let anchor: number | null = null;
    let applied = 0;
    const layoutTop = () =>
      copy && pillar
        ? copy.getBoundingClientRect().top - pillar.getBoundingClientRect().top - applied
        : 0;

    const pin = () => {
      if (anchor === null || !copy) return;
      // Clamped to [0, anchor], which is the whole range the compensation can
      // legitimately occupy: the column only ever rises as it grows, and it
      // cannot rise past the slack it had. The clamp is also what keeps a
      // browser that does not match the :has() rule from diverging — with the
      // transform never applying, the correction would otherwise re-add itself
      // every frame and run away (observed: 2972px before this was bounded).
      applied = Math.min(Math.max(anchor - layoutTop(), 0), anchor);
      copy.style.setProperty("--copy-pin", `${applied.toFixed(2)}px`);
    };

    // ── 1 · THE PANE — a window cut in the page that the sheet rises into ──
    // The height is a function value so `invalidate()` can re-measure it: a
    // panel left open across a resize or a font swap must collapse from the
    // height it actually has, not the one it opened to.
    //
    // `power4.out` is GSAP's spelling of the house `arrive` curve
    // (cubic-bezier(0.22,1,0.36,1) — both are quintic-out). The pane is also
    // the LONGEST tween on this timeline, and that is load-bearing rather than
    // incidental: a reversed timeline plays back from its own end, so any
    // tween finishing after the height leaves a dead zone at the head of the
    // close where the panel just sits there. The first build had 87ms of it
    // and it read as exactly the lag easeReverse is here to remove. Nothing
    // below may be scheduled to end later than this.
    copy?.style.removeProperty("--copy-pin");
    tl.fromTo(
      pane,
      { height: 0, "--pane-open": 0 },
      {
        height: () => body.offsetHeight,
        "--pane-open": 1,
        duration: 0.62,
        ease: "power4.out",
        easeReverse: "power2.out",
        onUpdate: pin,
      },
      0,
    );
    // `fromTo` renders its start values on creation, so the pane is at 0 RIGHT
    // NOW and the column is sitting exactly where it sits when closed. That is
    // the line to hold, and this is the only moment it can be read without
    // either a second forced collapse or a frame of the closed panel on screen.
    anchor = layoutTop();

    // ── 2 · THE SPECULAR — one pass of light down the forming sheet ────────
    // A translated band, not animated gradient stops: the band composites,
    // the stops would repaint the whole panel every frame over a canvas that
    // is already asking for the GPU. Its opacity is CSS's job (tied to
    // --pane-open), so this tween owns nothing but the travel.
    if (sheen) {
      tl.fromTo(
        sheen,
        { yPercent: -110 },
        {
          yPercent: 195,
          duration: 0.54,
          ease: "power2.inOut",
          easeReverse: "power3.in",
        },
        0.04,
      );
    }

    // ── 3 · THE ROWS — poured in, not faded in ─────────────────────────────
    // A clip wipe plus the house 12px rise. The reveal edge travels DOWN while
    // the type travels UP: that counter-motion is what makes a row read as
    // material being drawn out rather than as opacity being turned up.
    //
    // The whole set is DONE by 0.47, well inside the pane's 0.62, and that
    // ordering was measured rather than guessed. The first build let the rows
    // run the full length of the pane, and the filmstrip showed why that is
    // wrong: `power4.out` spends its last 40% of time on its last 5% of
    // height, so the panel looks finished early — and with the rows still
    // arriving it read as an empty box filling in, which is the vocabulary of
    // LOADING, not of material. Landing the type first and letting the sheet
    // settle around it is the right way round.
    tl.fromTo(
      rows,
      { clipPath: "inset(0% 0% 100% 0%)", y: 12 },
      {
        clipPath: "inset(0% 0% 0% 0%)",
        y: 0,
        duration: 0.3,
        stagger: 0.03,
        ease: "power3.out",
        easeReverse: "power1.out",
      },
      0.05,
    );

    // ── 4 · THE MARK — the plus latching into a minus ──────────────────────
    // On the timeline's clock, not the [open] attribute's: the attribute now
    // outlives the close by the length of the exit, and an icon that changed
    // state 400ms after the press would be the tell.
    tl.fromTo(
      details,
      { "--mark-turn": 0 },
      {
        "--mark-turn": 1,
        duration: 0.42,
        ease: "back.out(2.4)",
        easeReverse: "power2.inOut",
      },
      0,
    );

    return tl;
  }, []);

  const open = useCallback(() => {
    const details = detailsRef.current;
    if (!details) return;

    // Open the element FIRST and synchronously: the content has to be laid out
    // before the pane can be measured, and `fromTo` renders its start values
    // immediately on creation, so the collapsed state is written in this same
    // task — there is no frame where the panel paints at full height.
    selfSetRef.current = true;
    details.open = true;

    tlRef.current?.kill();
    const tl = build();
    tlRef.current = tl;
    tl?.play(0);
  }, [build]);

  const close = useCallback(() => {
    const details = detailsRef.current;
    if (!details) return;

    let tl = tlRef.current;

    // A panel that has been sitting open may have crossed a resize or a late
    // font swap, so its recorded height is stale. REBUILD to re-measure — do
    // not reach for `invalidate()`, which does not compose with easeReverse:
    // Tween.invalidate() resets `ratio` to 0, and the reverse remap anchors on
    // exactly that field (`_invRatio = this.ratio; _invScale = -this.ratio`),
    // so the whole close computes `0 + -0 * ease(t)` and the panel snaps shut
    // in a single frame. Measured: a 413ms collapse became 17ms.
    //
    // Rebuilding is safe because `fromTo` renders its start values on
    // creation and `progress(1)` seeks back to the end in the SAME task —
    // nothing paints in between, so the collapsed state is never seen. Only a
    // fully-open panel is rebuilt; mid-flight, the playhead is the thing
    // easeReverse is about to remap from and must not be discarded.
    if (tl && tl.progress() === 1) {
      tl.kill();
      tl = build();
      tlRef.current = tl;
      tl?.progress(1);
    }

    if (!tl) {
      selfSetRef.current = false;
      details.open = false;
      return;
    }

    closingRef.current = true;

    tl.eventCallback("onReverseComplete", () => {
      closingRef.current = false;
      selfSetRef.current = false;
      details.open = false;
      teardown();
    });
    // Leaving is quicker than arriving. An exit that takes as long as the
    // entrance makes the whole control feel heavy.
    tl.timeScale(1.5).reverse();
  }, [build, teardown]);

  const onSummaryPress = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const details = detailsRef.current;
      if (!live || !details) return; // the native path owns it

      event.preventDefault(); // this component owns the `open` attribute now

      const tl = tlRef.current;
      if (tl && closingRef.current) {
        // caught mid-close — resume forward from the current height
        closingRef.current = false;
        selfSetRef.current = null;
        tl.eventCallback("onReverseComplete", null);
        tl.timeScale(1).play();
        return;
      }

      if (details.open) close();
      else open();
    },
    [close, live, open],
  );

  // Additive contract: the choreography exists only once the client half is
  // mounted and the user has not asked for less motion.
  useEffect(() => {
    setLive(!reduced);
  }, [reduced]);

  // Reduced motion switched on mid-session — drop everything and leave the
  // panel in whatever state it is in. Never strand content behind a timeline.
  useEffect(() => {
    if (reduced) teardown();
  }, [reduced, teardown]);

  // unmount — a killed timeline that left inline styles behind would clamp the
  // panel at a stale height if React ever remounts this subtree
  useEffect(() => teardown, [teardown]);

  // Anything that opened this panel without going through the summary press —
  // find-in-page, a devtools poke — is not a gesture. Take the state, drop any
  // stale inline height, and let the content simply be there.
  useEffect(() => {
    const details = detailsRef.current;
    if (!details) return;

    const onToggle = () => {
      if (selfSetRef.current === details.open) {
        selfSetRef.current = null;
        return;
      }
      selfSetRef.current = null;
      teardown();
    };

    details.addEventListener("toggle", onToggle);
    return () => details.removeEventListener("toggle", onToggle);
  }, [teardown]);

  return (
    <details
      ref={detailsRef}
      className={className ? `disclose ${className}` : "disclose"}
      data-disclose={live ? "live" : undefined}
    >
      <summary
        className="disclose-summary"
        aria-label={summaryLabel}
        onClick={onSummaryPress}
        data-cursor="hover"
      >
        {label}
        <span className="disclose-mark" aria-hidden="true" />
      </summary>

      <div ref={paneRef} className="disclose-pane">
        <div ref={bodyRef} className="disclose-body">
          <span className="disclose-sheen" aria-hidden="true" />
          {children}
        </div>
      </div>
    </details>
  );
}
