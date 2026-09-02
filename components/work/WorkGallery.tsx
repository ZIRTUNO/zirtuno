"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/config";
import { Reveal } from "@/components/ui/Reveal";
import { getLenis } from "@/lib/animation/lenis-store";
import { FORM_STILLS } from "@/lib/content/form-stills";
import { localize, type Project } from "@/lib/sanity/types";

/**
 * S7.5 · The work gallery — cards that OPEN rather than navigate.
 *
 * The card is a real `<a href="/work/{slug}">`. With no JS, reduced motion, or
 * before hydration it simply follows that link to the server-rendered case
 * study, so no meaning ever lives only in this file (rule #12). The panel is an
 * enhancement layered over that link.
 *
 * ── The morph ──────────────────────────────────────────────────────────────
 * The panel is not a box that fades in over the page: it IS the card, grown.
 * A single scalar `p` runs 0 → 1 on a spring and every box in the composition
 * is a lerp between where it starts (the clicked card) and where it lands (the
 * centred panel):
 *
 *   panel box   = lerp(cardRect, finalBox, p)
 *   media box   = lerp(cardRect, media slot inside finalBox, p)
 *   body scale  = panelBox.w / finalBox.w , panelBox.h / finalBox.h
 *
 * Three details are what separate this from a resize:
 *
 *  1. The source card is RE-MEASURED every frame (transform cleared, reflow
 *     forced, rect read, transform restored). The morph therefore tracks a card
 *     that is still moving — mid-hover, mid-scroll-settle, mid-resize — instead
 *     of flying to a rect that was true only on mousedown.
 *  2. The body is laid out ONCE at the panel's final size and then scaled down
 *     with the box, so the interior shrinks as one coherent unit. Laying it out
 *     at the live size would reflow the text on every frame and chop it against
 *     the morphing edges.
 *  3. Card and media slot are both SQUARE. A `cover` crop is identical at both
 *     ends, so the photograph does not shift inside its own frame while it
 *     flies — the single most expensive-looking part of the whole move.
 */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Critically damped spring, closed form.
 *
 * For ζ = 1 the solution is x(t) = (A + Bt)·e^(−ωt) with A = x₀ and
 * B = v₀ + ω·x₀ — so a frame is one exponential and two multiplies, with no
 * accumulating integration error and, by construction, NO overshoot. That last
 * property is why this is a spring and not `--ease-arrive`: the panel is
 * carrying a photograph the reader is already looking at, and a curve that
 * overshoots would push it past the edge it is about to settle on.
 *
 * ω = 10 rad/s settles in ~450ms — inside the site's `--dur-medium` (700ms)
 * envelope without ever quite reaching it.
 */
const OMEGA = 10;
/**
 * `--ease-sheet` from `globals.css`, as a literal because the Web Animations
 * API resolves no custom properties. Keep the two in step: this is the chrome
 * curve the nav sheet already rides, so the panel and the menu share a hand.
 */
const SHEET = "cubic-bezier(0.16, 1, 0.3, 1)";
/**
 * How long the close is allowed to hold the DOM.
 *
 * A critically damped spring is asymptotic: coming back from p=1 it needs
 * ~1.1s to fall inside the settle epsilon, but the panel is already fully
 * transparent at 140 + 320 = 460ms. Waiting for the maths would leave an
 * invisible fixed overlay mounted for another half second after the reader
 * believes it is gone, so the close is bounded by what the eye sees.
 */
const CLOSE_MS = 520;
const SETTLE_P = 4e-4;
const SETTLE_V = 4e-3;
const MAX_DT = 1 / 30;

type Spring = { p: number; v: number; target: number };

function stepSpring(s: Spring, dt: number): void {
  const x = s.p - s.target;
  const b = s.v + OMEGA * x;
  const decay = Math.exp(-OMEGA * dt);
  s.p = s.target + (x + b * dt) * decay;
  s.v = (b - OMEGA * (x + b * dt)) * decay;
}

const isSettled = (s: Spring): boolean =>
  Math.abs(s.p - s.target) < SETTLE_P && Math.abs(s.v) < SETTLE_V;

type Box = { x: number; y: number; w: number; h: number };

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerpBox = (a: Box, b: Box, t: number): Box => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
});

/** Rect of an element with its own transform momentarily removed. */
function restingRect(el: HTMLElement): Box {
  const { transform, transition } = el.style;
  el.style.transition = "none";
  el.style.transform = "none";
  void el.offsetWidth;
  const r = el.getBoundingClientRect();
  el.style.transform = transform;
  el.style.transition = transition;
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}

/** Panel geometry at rest, in viewport coordinates. */
type Layout = {
  mobile: boolean;
  box: Box;
  padX: number;
  padTop: number;
  gap: number;
  media: number;
};

const BASE_W = 940;
const BASE_H = 540;
const BASE_PAD_X = 36;
const BASE_PAD_TOP = 40;
const BASE_PAD_BOTTOM = 32;
const BASE_GAP = 36;
const CHIP = 44;
const CHIP_INSET = 16;

function measureLayout(textEl: HTMLElement | null): Layout {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const mobile = window.matchMedia("(max-width: 639px)").matches;

  if (mobile) {
    // Portrait: the square media sits on top and the text stacks under it, so
    // the height is whatever the copy needs — measured, not guessed.
    const padX = Math.round(vw * 0.052);
    const media = Math.min(vw * 0.92 - padX * 2, vh * 0.44);
    const w = media + padX * 2;
    let h = vh * 0.9;
    if (textEl) {
      textEl.style.left = `${padX}px`;
      textEl.style.top = `${padX + media + padX}px`;
      textEl.style.width = `${w - padX * 2}px`;
      textEl.style.height = "auto";
      h = Math.min(vh * 0.92, padX + media + padX + textEl.scrollHeight + padX);
      textEl.style.height = `${h - padX - media - padX - padX}px`;
    }
    return {
      mobile,
      box: { x: (vw - w) / 2, y: (vh - h) / 2, w, h },
      padX,
      padTop: padX,
      gap: padX,
      media,
    };
  }

  // Landscape: media left, copy right. The whole panel scales with the
  // viewport off the same 1280 reference the rest of the chrome uses, with a
  // floor so it never collapses on a small laptop.
  const scale = Math.max(0.78, Math.min(vw, 1472) / 1280);
  const w = Math.min(BASE_W * scale, vw * 0.92);
  const h = Math.min(BASE_H * scale, vh * 0.86);
  const padX = BASE_PAD_X * scale;
  const padTop = BASE_PAD_TOP * scale;
  const gap = BASE_GAP * scale;
  const media = h - padTop - BASE_PAD_BOTTOM * scale;

  if (textEl) {
    textEl.style.left = `${padX + media + gap}px`;
    textEl.style.top = `${padTop}px`;
    textEl.style.width = `${w - padX * 2 - media - gap}px`;
    textEl.style.height = `${h - padTop - BASE_PAD_BOTTOM * scale}px`;
  }

  return {
    mobile,
    box: { x: (vw - w) / 2, y: (vh - h) / 2, w, h },
    padX,
    padTop,
    gap,
    media,
  };
}

export function WorkGallery({
  projects,
  className,
}: {
  projects: Project[];
  className?: string;
}) {
  const t = useTranslations("work");
  const locale = useLocale();
  const titleId = useId();

  const [active, setActive] = useState<Project | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const chipRef = useRef<HTMLButtonElement | null>(null);

  /** Everything the rAF loop needs, kept off React so no frame re-renders. */
  const flight = useRef<{
    source: HTMLElement;
    photo: HTMLElement | null;
    spring: Spring;
    layout: Layout;
    raf: number;
    last: number;
    closing: boolean;
    reduced: boolean;
    closeTimer: number;
  } | null>(null);

  // ── one frame of the morph ────────────────────────────────────────────────
  const applyFrame = useCallback(() => {
    const f = flight.current;
    const panel = panelRef.current;
    const body = bodyRef.current;
    if (!f || !panel || !body) return;

    const p = f.spring.p;
    const from = restingRect(f.source);
    const to = f.layout.box;
    const box = lerpBox(from, to, p);

    panel.style.transform = `translate3d(${box.x}px, ${box.y}px, 0)`;
    panel.style.width = `${box.w}px`;
    panel.style.height = `${box.h}px`;

    // The body is laid out at `to` and scaled to `box`. Anchoring it to the
    // near edge — right when the card sits on the right half of the screen —
    // keeps the copy from sliding across the whole panel as it grows.
    const sx = box.w / to.w;
    const sy = box.h / to.h;
    if (!f.layout.mobile && from.x + from.w / 2 > window.innerWidth / 2) {
      body.style.transformOrigin = "100% 0";
      body.style.transform = `translateX(${box.w - to.w}px) scale(${sx}, ${sy})`;
    } else {
      body.style.transformOrigin = "0 0";
      body.style.transform = `scale(${sx}, ${sy})`;
    }

    // The flying media, expressed panel-local so it rides the panel's own
    // translate instead of fighting it.
    const media = mediaRef.current;
    if (media) {
      const slot: Box = {
        x: to.x + f.layout.padX,
        y: to.y + f.layout.padTop,
        w: f.layout.media,
        h: f.layout.media,
      };
      const m = lerpBox(from, slot, p);
      media.style.left = `${m.x - box.x}px`;
      media.style.top = `${m.y - box.y}px`;
      media.style.width = `${m.w}px`;
      media.style.height = `${m.h}px`;
    }

    const chip = chipRef.current;
    if (chip) {
      if (f.layout.mobile) {
        chip.style.left = `${box.x + box.w / 2}px`;
        chip.style.top = `${box.y + box.h + CHIP_INSET}px`;
        chip.style.transform = "translateX(-50%)";
      } else {
        chip.style.left = `${box.x + box.w - CHIP - CHIP_INSET}px`;
        chip.style.top = `${box.y + CHIP_INSET}px`;
        chip.style.transform = "none";
      }
      chip.style.opacity = `${Math.min(1, Math.max(0, p))}`;
    }

    // The card's own photograph walks the same path in its own local space, so
    // the grid never shows a full-bleed still sitting under a media panel that
    // has already left it.
    if (f.photo) {
      const local: Box = {
        x: (f.layout.padX / to.w) * from.w,
        y: (f.layout.padTop / to.h) * from.h,
        w: (f.layout.media / to.w) * from.w,
        h: (f.layout.media / to.h) * from.h,
      };
      const g = lerpBox({ x: 0, y: 0, w: from.w, h: from.h }, local, p);
      f.photo.style.transition = "none";
      f.photo.style.transformOrigin = "0 0";
      f.photo.style.transform = `translate(${g.x}px, ${g.y}px) scale(${
        g.w / from.w
      }, ${g.h / from.h})`;
    }
  }, []);

  const teardown = useCallback(() => {
    const f = flight.current;
    if (!f) return;
    cancelAnimationFrame(f.raf);
    window.clearTimeout(f.closeTimer);
    if (f.photo) {
      f.photo.style.transition = "";
      f.photo.style.transform = "";
      f.photo.style.transformOrigin = "";
      f.photo.style.opacity = "";
    }
    flight.current = null;
    setActive(null);
  }, []);

  const tick = useCallback(
    (now: number) => {
      const f = flight.current;
      if (!f) return;
      const dt = Math.min((now - f.last) / 1000, MAX_DT);
      f.last = now;
      stepSpring(f.spring, dt);
      applyFrame();
      if (isSettled(f.spring)) {
        f.spring.p = f.spring.target;
        f.spring.v = 0;
        applyFrame();
        if (f.closing) teardown();
        return;
      }
      f.raf = requestAnimationFrame(tick);
    },
    [applyFrame, teardown],
  );

  const close = useCallback(() => {
    const f = flight.current;
    if (!f || f.closing) return;
    f.closing = true;

    const root = rootRef.current;
    root?.classList.remove("is-open");

    if (f.reduced) {
      teardown();
      return;
    }

    // The card's photo comes back before the flight ends, so the grid is whole
    // again by the time the panel finishes shrinking onto it.
    if (f.photo) f.photo.style.opacity = "1";
    chipRef.current?.animate(
      [{ opacity: 0, transform: chipRef.current.style.transform }],
      { duration: 180, easing: "ease", fill: "forwards" },
    );
    // The panel holds its shape for a beat before dissolving — fading it from
    // frame zero would hide the very move the reader is meant to read.
    panelRef.current?.animate([{ opacity: 0 }], {
      duration: 320,
      delay: 140,
      easing: "ease-in-out",
      fill: "forwards",
    });
    backdropRef.current?.animate([{ opacity: 0 }], {
      duration: 340,
      easing: SHEET,
      fill: "forwards",
    });

    f.spring.target = 0;
    cancelAnimationFrame(f.raf);
    f.last = performance.now();
    f.raf = requestAnimationFrame(tick);
    f.closeTimer = window.setTimeout(teardown, CLOSE_MS);
  }, [teardown, tick]);

  const open = useCallback(
    (project: Project, source: HTMLElement) => {
      if (flight.current) return;
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      flight.current = {
        source,
        photo: source.querySelector<HTMLElement>("[data-card-photo]"),
        spring: { p: reduced ? 1 : 0, v: 0, target: 1 },
        layout: {
          mobile: false,
          box: { x: 0, y: 0, w: 0, h: 0 },
          padX: 0,
          padTop: 0,
          gap: 0,
          media: 0,
        },
        raf: 0,
        last: performance.now(),
        closing: false,
        reduced,
        closeTimer: 0,
      };
      setActive(project);
    },
    [],
  );

  // ── the panel's life: measure, lock, trap, fly ────────────────────────────
  useEffect(() => {
    const f = flight.current;
    const root = rootRef.current;
    const panel = panelRef.current;
    if (!active || !f || !root || !panel) return;

    const trigger = f.source;
    f.layout = measureLayout(textRef.current);
    const body = bodyRef.current;
    if (body) {
      body.style.width = `${f.layout.box.w}px`;
      body.style.height = `${f.layout.box.h}px`;
    }
    root.classList.add("is-open");
    applyFrame();

    // Scroll lock with ZERO reflow. Setting `overflow: hidden` would drop the
    // scrollbar and shift the whole document sideways — and this morph is
    // measuring the grid live, so it would visibly jump. Stopping Lenis and
    // swallowing the raw wheel/touch instead leaves layout untouched.
    const lenis = getLenis();
    lenis?.stop();
    const swallow = (event: Event) => {
      if (panel.contains(event.target as Node)) return;
      event.preventDefault();
    };
    window.addEventListener("wheel", swallow, { passive: false });
    window.addEventListener("touchmove", swallow, { passive: false });

    if (!f.reduced) {
      panel.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 180,
        easing: "ease-out",
        fill: "forwards",
      });
      backdropRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 420,
        easing: SHEET,
        fill: "forwards",
      });
      if (f.photo) {
        f.photo.style.opacity = "0";
        f.photo.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 180,
          easing: "ease-out",
        });
      }
      // The copy arrives after the box has stopped travelling, one line at a
      // time, out of a short blur — the same "settles into focus" beat the
      // chapter reveals use, so the panel reads as part of the site.
      textRef.current
        ?.querySelectorAll<HTMLElement>(":scope > *")
        .forEach((el, i) => {
          el.animate(
            [
              { opacity: 0, filter: "blur(8px)", transform: "translateY(18px)" },
              { opacity: 1, filter: "blur(0px)", transform: "translateY(0)" },
            ],
            {
              duration: 700,
              delay: 240 + i * 130,
              easing: SHEET,
              fill: "both",
            },
          );
        });
      f.last = performance.now();
      f.raf = requestAnimationFrame(tick);
    } else {
      // Reduced motion: no flight, no blur, no stagger. The panel is simply
      // there, and the copy is readable from the first frame.
      panel.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 120,
        easing: "linear",
        fill: "forwards",
      });
      if (backdropRef.current) backdropRef.current.style.opacity = "1";
      textRef.current
        ?.querySelectorAll<HTMLElement>(":scope > *")
        .forEach((el) => {
          el.style.opacity = "1";
        });
    }

    const focusFrame = requestAnimationFrame(() =>
      panel.focus({ preventScroll: true }),
    );

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const stops = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.getClientRects().length > 0);
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const current = document.activeElement as HTMLElement | null;
      const outside = !current || !stops.includes(current);
      if (event.shiftKey && (current === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    let resizeFrame = 0;
    const onResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        const live = flight.current;
        if (!live || live.closing) return;
        live.layout = measureLayout(textRef.current);
        if (body) {
          body.style.width = `${live.layout.box.w}px`;
          body.style.height = `${live.layout.box.h}px`;
        }
        applyFrame();
      });
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(focusFrame);
      cancelAnimationFrame(resizeFrame);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("wheel", swallow);
      window.removeEventListener("touchmove", swallow);
      lenis?.start();
      if (trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [active, applyFrame, close, tick]);

  const panel = active
    ? createPortal(
        <div
          ref={rootRef}
          className="zw-root"
          onClick={close}
          role="presentation"
        >
          <div ref={backdropRef} className="zw-backdrop" />
          <div
            ref={panelRef}
            className="zw-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <div ref={bodyRef} className="zw-body">
              <div ref={textRef} className="zw-copy">
                <p className="zw-copy-cats">
                  {active.category.map((c) => t(`categories.${c}`)).join(" · ")}
                </p>
                <h3 id={titleId} className="zw-copy-title">
                  {localize(active.title, locale)}
                </h3>
                <p className="zw-copy-lead">
                  {localize(active.summary ?? active.challenge, locale)}
                </p>
                <div className="zw-copy-actions">
                  {active.liveUrl && (
                    <a
                      className="cta cta-primary zw-visit"
                      href={active.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-cursor="hover"
                      data-analytics-event="case_visit"
                      data-analytics-project={active.slug}
                    >
                      <span className="cta-fill" aria-hidden="true" />
                      <span className="cta-label">
                        {t("gallery.visit")}
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                          <path
                            d="M3.5 12.5 12.5 3.5M6 3.5h6.5V10"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </a>
                  )}
                  <Link
                    className="zw-case"
                    href={`/work/${active.slug}`}
                    data-cursor="hover"
                    data-analytics-event="case_open"
                    data-analytics-project={active.slug}
                  >
                    {t("gallery.case")}
                  </Link>
                </div>
              </div>
            </div>

            <div ref={mediaRef} className="zw-media">
              {active.previewImage ? (
                <Image
                  src={active.previewImage}
                  alt=""
                  fill
                  sizes="(max-width: 639px) 84vw, 40vw"
                  className="zw-media-img"
                />
              ) : (
                <Image
                  src={FORM_STILLS[active.category[0]]}
                  alt=""
                  fill
                  sizes="(max-width: 639px) 84vw, 40vw"
                  className="zw-media-form"
                />
              )}
            </div>
          </div>

          <button
            ref={chipRef}
            type="button"
            className="zw-chip"
            aria-label={t("gallery.close")}
            data-cursor="hover"
            onClick={(event) => {
              event.stopPropagation();
              close();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <ul className={className ? `zw-grid ${className}` : "zw-grid"}>
        {projects.map((project, index) => {
          const title = localize(project.title, locale);
          return (
            <Reveal
              as="li"
              inView
              key={project.slug}
              className="zw-cell"
              delay={Math.min(index, 3) * 0.06}
            >
              <a
                className="zw-card"
                href={`/${locale}/work/${project.slug}`}
                data-cursor="hover"
                data-analytics-event="case_open"
                data-analytics-project={project.slug}
                // `TransitionProvider` intercepts internal links in the CAPTURE
                // phase — ahead of this handler — and routes them itself. Without
                // the opt-out both would win: the panel would open AND the page
                // would navigate out from under it. Opting out leaves the plain
                // href intact, so a pre-hydration or modifier click still reaches
                // the case study, just without the exit animation.
                data-no-transition=""
                onClick={(event) => {
                  // Let every deliberate "open in a new tab" through.
                  if (
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey ||
                    event.button !== 0
                  ) {
                    return;
                  }
                  event.preventDefault();
                  open(project, event.currentTarget);
                }}
              >
                <span className="zw-card-frame">
                  <span className="zw-card-photo" data-card-photo>
                    {project.previewImage ? (
                      <Image
                        src={project.previewImage}
                        alt={title}
                        fill
                        sizes="(max-width: 639px) 92vw, 46vw"
                        className="zw-card-img"
                      />
                    ) : (
                      <Image
                        src={FORM_STILLS[project.category[0]]}
                        alt={title}
                        fill
                        sizes="(max-width: 639px) 92vw, 46vw"
                        className="zw-card-form"
                      />
                    )}
                  </span>
                </span>

                <span className="zw-caption">
                  {project.markImage && (
                    <span className="zw-mark">
                      <Image
                        src={project.markImage}
                        alt=""
                        width={128}
                        height={128}
                        sizes="72px"
                      />
                    </span>
                  )}
                  <span className="zw-label">
                    <span className="zw-name">{title}</span>
                    <span className="zw-cats">
                      {project.category
                        .map((c) => t(`categories.${c}`))
                        .join(", ")}
                    </span>
                  </span>
                </span>
              </a>
            </Reveal>
          );
        })}
      </ul>
      {mounted && panel}
    </>
  );
}
