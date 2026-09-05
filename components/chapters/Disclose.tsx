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
import { SplitText } from "gsap/SplitText";
import {
  prefersReducedMotion,
  useReducedMotion,
} from "@/lib/animation/reduced-motion";

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
 * ── THE LINE SPLIT ─────────────────────────────────────────────────────────
 * The copy inside the sheet does not fade in and it does not wipe in as three
 * blocks. It is split into its REAL LINES — the ones the browser just laid
 * out, at this width, in the fonts that actually loaded — each line clipped by
 * a mask of its own line box, and each rises into that box from below on a
 * short overlapping stagger. It is the GSAP "responsive line splits on scroll"
 * figure, moved off the scroll and onto the disclosure's own timeline, which
 * is the only clock in this component (§ easeReverse, below).
 *
 * The line is the right unit here and the block was the wrong one. A block
 * wipe treats "O QUE RESOLVE" and its three-line answer as one object that
 * arrives at one instant; the panel then reads as four slabs appearing, which
 * is the vocabulary of a MENU. Lines arrive the way a reader takes them — top
 * to bottom, one measure at a time — so the sheet reads as being POURED, and
 * the reader's eye is already travelling in the direction the copy wants it to.
 *
 * Four things this split deliberately does:
 *
 *   · IT IS COMPUTED AT THE MOMENT OF THE PRESS. Nothing is split at render
 *     time, on mount, or on a resize listener. The panel is opened, the
 *     browser lays the copy out, and only then are the resulting line boxes
 *     wrapped — so the split is by construction correct for the current
 *     width and the fonts that have landed. That is what `autoSplit` buys the
 *     scroll demo (whose split is made once at load and has to survive
 *     everything after); here it is free. `autoSplit` is still ON, to cover
 *     the one window this cannot: a resize or a late font DURING the ~600ms
 *     the panel is in motion, which re-splits and re-assembles the timeline
 *     around the fresh lines at the same playhead (see `onSplitLines`).
 *
 *   · IT DOES NOT SURVIVE THE ANIMATION. The instant the open settles the
 *     split is reverted and the pane's height is released to `auto`. The
 *     panel a reader actually reads is therefore the plain server-rendered
 *     one: no wrapper divs between a <dd> and its sentence, nothing for a
 *     screen reader to chunk line by line, no clip box cutting the standing
 *     text-shadow, and — because the height is no longer a pinned pixel
 *     value — a panel that simply REFLOWS when the window changes instead of
 *     holding the height it was opened at. The masks exist only while
 *     something is moving, which is the only time a mask is doing any work.
 *
 *   · IT KEEPS THE COPY IN THE ACCESSIBILITY TREE THROUGHOUT. `aria: "none"`,
 *     not the plugin's default: the default puts `aria-hidden` on every line
 *     and an `aria-label` on the block, and `aria-label` on a <dd> or a <p>
 *     names an element whose role prohibits naming — it is dropped, and the
 *     copy would be announced as nothing at all for the length of the open.
 *
 *   · IT LEAVES THE CAPABILITY CHIPS WHOLE. `ignore: ".pillar-cap"` — a chip
 *     and its separator are one atomic unit by design (the 390px overflow
 *     drill), and splitting inside one would let the plugin's deep-slice
 *     clone it at an internal wrap and mint a second separator mid-chip. The
 *     chips still ride the split: they are wrapped into LINES like everything
 *     else, just never opened up.
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
 *   · THE LINES rise into their masks on `power3.out` and leave on one quick
 *     `power1.out`. Mirrored, the pour would run BACKWARDS at reading speed —
 *     a cascade is a direction, and a dismissal has no direction to give. The
 *     reversed stagger (last line out first) is kept, because that one IS
 *     right: the sheet is closing from the bottom and the bottom lines are
 *     the ones it reaches first.
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
 * the glass is paint rather than motion. Nothing is ever split on those paths.
 * An open this component did not initiate (find-in-page expanding the panel)
 * is not a gesture: it takes the state and skips the choreography.
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
  const splitRef = useRef<SplitText | null>(null);
  const closingRef = useRef(false);
  /** True only for the split that `build()` is itself in the middle of making,
   *  so `onSplitLines` can tell it apart from a re-split fired later by the
   *  plugin's own resize / font-load watchers. */
  const buildingRef = useRef(false);
  /** The open state THIS component just wrote, so the `toggle` listener can
   *  tell its own writes apart from a find-in-page expansion. */
  const selfSetRef = useRef<boolean | null>(null);

  /** Put the copy back the way it was rendered. Everything the split added —
   *  the line boxes, the masks and their clip — exists only for the length of
   *  a movement, so every exit from a movement runs through here. */
  const unsplit = useCallback(() => {
    splitRef.current?.revert();
    splitRef.current = null;
  }, []);

  /** Drop the timeline and every inline value it wrote. The resting DOM must
   *  be indistinguishable from the no-JS one, or the next native open renders
   *  a panel still clamped to a stale height. */
  const teardown = useCallback(() => {
    tlRef.current?.kill();
    tlRef.current = null;
    closingRef.current = false;
    unsplit();

    const pane = paneRef.current;
    const details = detailsRef.current;
    if (pane) {
      gsap.set(pane.querySelectorAll("[data-disclose-row], .disclose-sheen"), {
        clearProps: "all",
      });
      gsap.set(pane, { clearProps: "all" });
      pane.style.removeProperty("height");
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
  }, [unsplit]);

  /** The open has landed. Hand the panel back to the document: drop the split,
   *  and release the height the tween pinned so the panel is free to reflow
   *  for as long as it stays open. Skipped while closing — `close()` seeks
   *  this timeline to its end to reverse from, and a seek fires `onComplete`
   *  (gsap-core `progress()` does not suppress events). */
  const settle = useCallback(() => {
    if (closingRef.current) return;
    unsplit();
    paneRef.current?.style.setProperty("height", "auto");
  }, [unsplit]);

  /** Build the choreography around one set of line boxes. Returns the
   *  timeline, paused at 0 with its start values already rendered. */
  const assemble = useCallback(
    (lines: Element[]) => {
      const pane = paneRef.current;
      const body = bodyRef.current;
      const details = detailsRef.current;
      if (!pane || !body || !details) return null;

      // The split is the vocabulary; the row wipe is what is left if there is
      // nothing to split (a caller that marked no copy, a block that laid out
      // no line boxes). Never leave the panel with an un-animated interior.
      const rows = body.querySelectorAll<HTMLElement>("[data-disclose-row]");
      const masked = lines.length > 0;
      const units: Element[] = masked ? lines : Array.from(rows);
      const sheen = body.querySelector<HTMLElement>(".disclose-sheen");
      const tl = gsap.timeline({
        paused: true,
        defaults: { overwrite: "auto" },
        onComplete: settle,
      });

      // ── THE PIN ──────────────────────────────────────────────────────────
      // The stage centres this copy column, so growing it levers the headline
      // upward by half the growth (165.7px on a 900px stage). Compensate with
      // a transform: layout keeps doing exactly what it did, the pillar's box
      // is untouched — which matters, because the Services scene schedules the
      // melt off `.pillar` rects — and the column visually holds its line.
      //
      // MEASURED per frame, not interpolated. The layout's response to the
      // pane height is piecewise linear: the column stops moving once it
      // outgrows the stage track, and a straight ramp between the two
      // endpoints was 51px out at that knee — a visible wobble, headline
      // drifting away and back.
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
      // solves `p → D − p`, which oscillates between 0 and the full offset
      // every frame instead of settling. Subtracting what we applied recovers
      // the LAYOUT position, which is the only thing the compensation may be a
      // function of. (offsetTop is transform-immune and would sidestep this,
      // but it rounds to whole pixels and this wants the sub-pixel.)
      let anchor: number | null = null;
      let applied = 0;
      const layoutTop = () =>
        copy && pillar
          ? copy.getBoundingClientRect().top -
            pillar.getBoundingClientRect().top -
            applied
          : 0;

      const pin = () => {
        if (anchor === null || !copy) return;
        // Clamped to [0, anchor], which is the whole range the compensation
        // can legitimately occupy: the column only ever rises as it grows, and
        // it cannot rise past the slack it had. The clamp is also what keeps a
        // browser that does not match the :has() rule from diverging — with
        // the transform never applying, the correction would otherwise re-add
        // itself every frame and run away (observed: 2972px before this was
        // bounded).
        applied = Math.min(Math.max(anchor - layoutTop(), 0), anchor);
        copy.style.setProperty("--copy-pin", `${applied.toFixed(2)}px`);
      };

      // ── 1 · THE PANE — a window cut in the page that the sheet rises into ─
      // The height is a function value so `invalidate()` can re-measure it: a
      // panel left open across a resize or a font swap must collapse from the
      // height it actually has, not the one it opened to.
      //
      // `power4.out` is GSAP's spelling of the house `arrive` curve
      // (cubic-bezier(0.22,1,0.36,1) — both are quintic-out). The pane is also
      // the LONGEST tween on this timeline, and that is load-bearing rather
      // than incidental: a reversed timeline plays back from its own end, so
      // any tween finishing after the height leaves a dead zone at the head of
      // the close where the panel just sits there. The first build had 87ms of
      // it and it read as exactly the lag easeReverse is here to remove.
      // Nothing below may be scheduled to end later than this.
      copy?.style.removeProperty("--copy-pin");
      pane.style.removeProperty("height");
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
      // `fromTo` renders its start values on creation, so the pane is at 0
      // RIGHT NOW and the column is sitting exactly where it sits when closed.
      // That is the line to hold, and this is the only moment it can be read
      // without either a second forced collapse or a frame of the closed panel
      // on screen.
      anchor = layoutTop();

      // ── 2 · THE SPECULAR — one pass of light down the forming sheet ───────
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

      // ── 3 · THE POUR — every line rising into its own mask ────────────────
      // 110% of the line's own height, so a line starts fully clear of the box
      // that clips it and there is never a frame where a glyph is half-parked
      // on the boundary. No opacity: the mask is doing the concealing, and
      // fading a line that is already hidden only makes it arrive grey.
      //
      // THE STAGGER IS AN `amount`, NOT A PER-UNIT DELAY, and that is the
      // whole reason this survives being responsive. A block wipe had four
      // units at any width; lines do not — this panel lays out ~15 of them at
      // 1280px and ~22 at 390px, and the same figure has to fit the same
      // 620ms either way. `amount` divides one fixed spread among however many
      // lines there are, so the pour keeps its LENGTH and only changes its
      // density; a per-unit `stagger: 0.03` would have run 660ms past the end
      // of the pane on a phone.
      //
      // Landing at 0.57 against the pane's 0.62 is deliberate, and the margin
      // was measured rather than guessed. `power4.out` spends its last 40% of
      // time on its last 5% of height, so the sheet looks finished early — and
      // with copy still arriving after that it reads as an empty box filling
      // in, which is the vocabulary of LOADING, not of material. The type
      // lands first and the sheet settles around it.
      tl.fromTo(
        units,
        masked
          ? { yPercent: 110 }
          : { clipPath: "inset(0% 0% 100% 0%)", y: 12 },
        {
          ...(masked
            ? { yPercent: 0 }
            : { clipPath: "inset(0% 0% 0% 0%)", y: 0 }),
          duration: 0.3,
          stagger: { amount: 0.24 },
          ease: "power3.out",
          easeReverse: "power1.out",
        },
        0.03,
      );

      // ── 4 · THE MARK — the plus latching into a minus ─────────────────────
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

      tlRef.current = tl;
      return tl;
    },
    [settle],
  );

  /** Runs once per split — including the one `build()` asks for. A LATER call
   *  is the plugin telling us the line boxes it handed out are stale (the
   *  block changed width, or a webfont landed): the old timeline is animating
   *  nodes that no longer exist in the document, so it is replaced by one
   *  built on the new lines and moved to the same playhead, in the same
   *  direction, in the same task. The panel keeps moving; only its cast
   *  changes. */
  const onSplitLines = useCallback(
    (lines: Element[]) => {
      if (buildingRef.current) {
        assemble(lines);
        return;
      }

      const prev = tlRef.current;
      const time = prev ? prev.time() : 0;
      const scale = prev ? prev.timeScale() : 1;
      const running = prev ? prev.isActive() : false;
      const backwards = prev ? prev.reversed() : false;
      prev?.kill();

      const tl = assemble(lines);
      if (!tl) return;
      tl.timeScale(scale).time(Math.min(time, tl.duration()));
      if (running) {
        if (backwards) tl.reverse();
        else tl.play();
      }
    },
    [assemble],
  );

  const build = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return null;

    gsap.registerPlugin(SplitText);

    // Any previous split is measured against a layout that no longer applies.
    // Drop it before anything reads a rect.
    unsplit();

    const targets = body.querySelectorAll<HTMLElement>("[data-disclose-lines]");
    if (!targets.length) return assemble([]);

    buildingRef.current = true;
    try {
      // `onSplit` fires synchronously from here, and again from the plugin's
      // own watchers for as long as this instance lives. Both land in
      // `onSplitLines`; only this first one is the build.
      splitRef.current = SplitText.create(targets, {
        type: "lines",
        mask: "lines",
        linesClass: "disclose-line",
        aria: "none",
        ignore: ".pillar-cap",
        autoSplit: true,
        onSplit: (self) => onSplitLines(self.lines),
      });
    } finally {
      buildingRef.current = false;
    }

    return tlRef.current;
  }, [assemble, onSplitLines, unsplit]);

  const open = useCallback(() => {
    const details = detailsRef.current;
    if (!details) return;

    // Open the element FIRST and synchronously: the content has to be laid out
    // before it can be split or the pane measured, and `fromTo` renders its
    // start values immediately on creation, so the collapsed state is written
    // in this same task — there is no frame where the panel paints at full
    // height, and no frame where an unsplit panel paints at all.
    selfSetRef.current = true;
    details.open = true;

    closingRef.current = false;
    tlRef.current?.kill();
    tlRef.current = null;
    build()?.play(0);
  }, [build]);

  const close = useCallback(() => {
    const details = detailsRef.current;
    if (!details) return;

    // Set before anything below: `build()` seeks the fresh timeline to its end
    // to reverse from, that seek fires `onComplete`, and `settle()` reading
    // this flag is what stops the panel from tearing its own split down half a
    // millisecond before the close needs it.
    closingRef.current = true;

    let tl = tlRef.current;

    // A panel that has been sitting open has no split and no pinned height —
    // `settle()` gave both back to the document — and one that is mid-flight
    // may have crossed a resize or a late font. Either way a settled timeline
    // is REBUILT, which re-splits at the width the panel actually has and
    // re-measures the height it actually reached. Do not reach for
    // `invalidate()`, which does not compose with easeReverse:
    // Tween.invalidate() resets `ratio` to 0, and the reverse remap anchors on
    // exactly that field (`_invRatio = this.ratio; _invScale = -this.ratio`),
    // so the whole close computes `0 + -0 * ease(t)` and the panel snaps shut
    // in a single frame. Measured: a 413ms collapse became 17ms.
    //
    // Rebuilding is safe because `fromTo` renders its start values on
    // creation and `progress(1)` seeks back to the end in the SAME task —
    // nothing paints in between, so neither the collapsed state nor the
    // freshly split copy is ever seen. Only a settled panel is rebuilt;
    // mid-flight, the playhead is the thing easeReverse is about to remap from
    // and must not be discarded.
    if (!tl || tl.progress() === 1) {
      tl?.kill();
      tl = build();
      tl?.progress(1);
    }

    if (!tl) {
      closingRef.current = false;
      selfSetRef.current = false;
      details.open = false;
      teardown();
      return;
    }

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
        // caught mid-close — resume forward from the current height, on the
        // split that is still standing from the close
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
  //
  // The one-shot read is not redundant with the hook. `useReducedMotion`
  // starts at `false` — it must, or it would render a different tree on the
  // server than in the browser — and only corrects itself in an effect of its
  // own. This effect runs in the same commit with the pre-correction value, so
  // arming on `!reduced` alone armed all seven panels for a frame on exactly
  // the setting that says not to. Asking the media query directly, here, is
  // free: effects are client-only, so there is nothing for it to mismatch.
  useEffect(() => {
    setLive(!reduced && !prefersReducedMotion());
  }, [reduced]);

  // Reduced motion switched on mid-session — drop everything and leave the
  // panel in whatever state it is in. Never strand content behind a timeline,
  // and never leave a reader reading a split.
  useEffect(() => {
    if (reduced) teardown();
  }, [reduced, teardown]);

  // unmount — a killed timeline that left inline styles behind would clamp the
  // panel at a stale height if React ever remounts this subtree, and a live
  // SplitText would leave a resize observer running over detached nodes
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
