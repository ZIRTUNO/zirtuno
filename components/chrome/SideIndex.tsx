"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CHAPTERS } from "@/lib/content/chapters";
import { makeRail, type Rail } from "@/lib/motion/rail.mjs";
import {
  registerMembrane,
  membraneMode,
  remeasurePage,
} from "@/lib/motion/membrane-runtime";

/**
 * The chapter rail — THE WATERLINE (S12).
 *
 * The rail used to be nine numbers in a column. It was legible and it was
 * anonymous: the one piece of chrome on this site that could have come from
 * any template, sitting beside a page where every other surface answers a hand
 * as liquid. It is now the page's own water line seen from the side — a dotted
 * edge the height of the viewport, in which:
 *
 *   the LIT RUN is the part of the document currently on screen. A real,
 *   proportional thumb, so the rail says how much is left as well as where you
 *   are — the scrollbar's actual job, which nine equal dots could never do.
 *
 *   the MARKS are the nine chapters, at their true document positions rather
 *   than at nine equal steps. Método is a long chapter and now looks like one.
 *
 *   the SWELL is the hand. Dots extend into dashes near the pointer and the
 *   rail is drawn taut on either side to pay for it (`rail.mjs`) — the same
 *   displacement contract the buttons keep, in one dimension.
 *
 * Extension is feedback and light is information, and they are kept on
 * separate channels on purpose: the reader already knows where their cursor
 * is, and does not know where the page is.
 *
 * There is NO NAME TAG. An earlier version opened a chapter's name beside the
 * cursor, and it was the one loud thing left on a surface whose whole argument
 * is quiet — a map does not label the ground under your finger. The name
 * survives for screen readers (`sr-only`, always) and for KEYBOARD focus,
 * where a reader lands on a deliberately invisible dot and a focus ring alone
 * cannot say which of nine it is. A pointer never sees it.
 *
 * STRICTLY ADDITIVE, on the same terms as the membrane and the form's liquid.
 * `data-rail` is set only after the kernel has mounted AND drawn, and every
 * rule that changes the rail is gated on it. Reduced motion, no-JS, a browser
 * without the pointer this depends on, and any mount failure all fall through
 * to the numbered column this replaced — complete, keyboard-navigable and
 * unchanged.
 */

/** The dot column's x inside the rail's box: 20 px in from the page edge. */
const COLUMN_X = 24;

/** How near a chapter's dot counts as being AT it (px) — the click band. */
const REACH = 44;

export function SideIndex() {
  const t = useTranslations("nav");
  const host = useRef<HTMLElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const rail = useRef<Rail | null>(null);
  const [active, setActive] = useState<string>("hero");
  // the same fact, readable from inside the mount effect's closure
  const activeId = useRef<string>("hero");
  // The rail is desktop-only chrome (`display: none` below lg, where the mobile
  // menu carries the chapters). Mounting the kernel there would register a
  // surface with the shared runtime whose rect is 0x0 — harmless and pointless,
  // and it would answer every pointermove on a device that cannot hover.
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const sections = CHAPTERS.map((c) => document.getElementById(c.id)).filter(
      (el): el is HTMLElement => Boolean(el),
    );

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  // ONE answer to "which chapter is this". The observer above already owns it
  // for `aria-current`; the rail is told rather than allowed to work out its
  // own, because two derivations of the same fact disagree at exactly the
  // boundaries a reader is looking at.
  useEffect(() => {
    activeId.current = active;
    rail.current?.setLive(CHAPTERS.findIndex((c) => c.id === active));
  }, [active]);

  useEffect(() => {
    // Reduced motion keeps the numbers: a reader who asked for stillness gets
    // the plain column, which is complete on its own.
    if (!wide || membraneMode() === "off") return;

    const nav = host.current;
    const svgEl = svg.current;
    if (!nav || !svgEl) return;

    const paths = {
      ink: svgEl.querySelector(".rail-ink") as SVGPathElement | null,
      taut: svgEl.querySelector(".rail-taut") as SVGPathElement | null,
      mark: svgEl.querySelector(".rail-mark") as SVGPathElement | null,
      flow: svgEl.querySelector(".rail-flow") as SVGPathElement | null,
      live: svgEl.querySelector(".rail-live") as SVGPathElement | null,
    };
    if (!paths.ink || !paths.taut || !paths.mark || !paths.flow || !paths.live)
      return;

    const links = Array.from(
      nav.querySelectorAll<HTMLAnchorElement>(".side-index-link"),
    );
    const line = makeRail(
      Math.min(nav.getBoundingClientRect().height, window.innerHeight),
      COLUMN_X,
    );
    rail.current = line;

    /**
     * Where the chapters actually are.
     *
     * Their DOCUMENT fraction, not their index — the whole point of the marks
     * is that they are a map. Measured on mount and whenever the document
     * changes shape, never per frame.
     */
    const measure = () => {
      // The rail is FIXED chrome: it can never be taller than the viewport.
      // It can MEASURE taller. `position: fixed` resolves against the nearest
      // ancestor carrying a transform, and the route transition animates `y`
      // on a wrapper that contains the whole page — so for the half second of
      // a client-side navigation the rail's own box is the DOCUMENT's height.
      // Measured there it came back ~29 000 px, and because the dots keep
      // their pitch the visible top of the rail still looked correct while
      // every mark, the lit run and the live chapter sat thousands of pixels
      // below the fold. The rail did not break; it stopped saying anything.
      const box = nav.getBoundingClientRect();
      line.layout(Math.min(box.height, window.innerHeight), COLUMN_X);
      const doc = Math.max(document.documentElement.scrollHeight, 1);
      const marks = CHAPTERS.map((c) => {
        const el = document.getElementById(c.id);
        if (!el) return 0;
        return (el.getBoundingClientRect().top + window.scrollY) / doc;
      });
      line.setMarks(marks);
      line.setLive(CHAPTERS.findIndex((c) => c.id === activeId.current));
      // Park each link on its own dot, and give it the BAND that dot owns:
      // the midpoints to its neighbours, capped at REACH. The marks sit at
      // true document positions, so Selected Work and The Origin are 900 px
      // apart in a 29 000 px page — 21 px of rail. With a fixed 44 px target
      // their hit areas overlapped and the later one in the DOM won, so a
      // click near one chapter's dot navigated to its neighbour.
      const at = CHAPTERS.map((_, i) => line.markY(i));
      links.forEach((a, i) => {
        const top = Math.max(
          i > 0 ? (at[i] + at[i - 1]) / 2 : -Infinity,
          at[i] - REACH,
        );
        const bottom = Math.min(
          i < at.length - 1 ? (at[i] + at[i + 1]) / 2 : Infinity,
          at[i] + REACH,
        );
        a.style.top = `${top.toFixed(1)}px`;
        a.style.height = `${Math.max(bottom - top, 6).toFixed(1)}px`;
      });
      remeasurePage();
    };
    measure();

    const lastD: Record<string, string> = {};

    const draw = () => {
      for (const kind of ["ink", "taut", "mark", "flow", "live"] as const) {
        const d = line.path(kind);
        if (d === lastD[kind]) continue;
        lastD[kind] = d;
        paths[kind]!.setAttribute("d", d);
      }

      // The rail wakes as the hand approaches rather than at the moment it
      // arrives — a column of dots you have to hit to discover is a column of
      // dots nobody discovers.
      nav.style.setProperty("--rail-wake", line.aware.toFixed(3));

    };

    const driven = {
      hand: (x: number | null, y = 0) => line.hand(x, y),
      step: (tMs: number) => line.step(tMs),
      travel: (y: number, vh: number, docH: number, v: number) =>
        line.travel(y, vh, docH, v),
      get asleep() {
        return line.asleep;
      },
    };

    const unregister = registerMembrane({
      el: nav,
      mem: driven,
      draw,
      rect: null,
      visible: true,
    });

    // Draw once before announcing: `data-rail` is the promise that there is
    // something to see, and the numbers are hidden on the strength of it.
    line.step(performance.now());
    draw();
    nav.dataset.rail = "on";

    // The homepage keeps growing after mount as chapters stream in and the
    // liquid stage measures itself, which walks every mark out of place.
    const ro = new ResizeObserver(measure);
    ro.observe(document.documentElement);
    // …and the rail's OWN box, which the clamp above is not enough to cover:
    // a rail measured during a route transition has to be re-measured after
    // it, and the document has usually stopped changing size by then. This is
    // the observation that actually ends the stale layout — the moment the
    // transform is removed the box snaps back and this fires.
    ro.observe(nav);
    window.addEventListener("resize", measure, { passive: true });

    return () => {
      unregister();
      ro.disconnect();
      window.removeEventListener("resize", measure);
      delete nav.dataset.rail;
      rail.current = null;
    };
  }, [wide]);

  return (
    <nav className="side-index" aria-label={t("chapterNavigation")} ref={host}>
      {/* No viewBox on purpose: one user unit is one CSS pixel, which is the
          frame the kernel and the pointer both already work in. */}
      <svg className="rail-canvas" aria-hidden="true" ref={svg}>
        <path className="rail-line rail-ink" />
        <path className="rail-line rail-taut" />
        <path className="rail-line rail-mark" />
        <path className="rail-line rail-flow" />
        <path className="rail-line rail-live" />
      </svg>
      <ul>
        {CHAPTERS.map((c, i) => {
          // the authored label is "NN Name" in both locales — the rail shows
          // the number at rest and the name on reveal, from that single source
          const label = t(`chapters.${c.key}`);
          const parts = label.match(/^(\d+)\s+(.*)$/);
          const num = parts?.[1] ?? String(i + 1).padStart(2, "0");
          const name = parts?.[2] ?? label;
          return (
            <li key={c.id}>
              <a
                href={`#${c.id}`}
                className={cn("side-index-link", active === c.id && "is-active")}
                aria-current={active === c.id ? "location" : undefined}
                data-cursor="hover"
              >
                {/* one accessible name; the split below is purely visual, so
                    screen readers never hear "08 08 Studio" */}
                <span className="sr-only">{label}</span>
                <span className="side-index-label" aria-hidden="true">
                  <i className="side-index-label-num">{num}</i>
                  {name}
                </span>
                <span className="side-index-num" aria-hidden="true">
                  {num}
                </span>
                <span className="side-index-dot" aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
