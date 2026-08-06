"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CHAPTERS } from "@/lib/content/chapters";

/**
 * Desktop chapter rail with scrollspy (S12). Homepage only.
 *
 * The rail's RESTING footprint is a column of chapter numbers — the same
 * numbering every chapter label carries ("08 — O Studio"), so the reader always
 * knows where they are without the rail borrowing content space. Full names
 * reveal together on hover or keyboard focus, over a short ink scrim so they
 * stay legible above the liquid.
 *
 * Two problems this shape solves: the always-open active LABEL used to sit on
 * top of the Studio role grid, and dots-only inactive states gave no clue what
 * the rail contained until you pointed at it.
 */
export function SideIndex() {
  const t = useTranslations("nav");
  const [active, setActive] = useState<string>("hero");

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

  return (
    <nav className="side-index" aria-label={t("chapterNavigation")}>
      <ul>
        {CHAPTERS.map((c, i) => {
          // the authored label is "NN Name" in both locales — the rail shows the
          // number at rest and the name on reveal, from that single source
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
