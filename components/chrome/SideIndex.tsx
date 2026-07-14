"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CHAPTERS } from "@/lib/content/chapters";

/**
 * Desktop chapter rail with scrollspy (S12). Homepage only. Dots always
 * visible; labels reveal on hover; the active chapter is cyan.
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
        {CHAPTERS.map((c) => (
          <li key={c.id}>
            <a
              href={`#${c.id}`}
              className={cn("side-index-link", active === c.id && "is-active")}
              aria-current={active === c.id ? "location" : undefined}
              data-cursor="hover"
            >
              <span className="side-index-label">{t(`chapters.${c.key}`)}</span>
              <span className="side-index-dot" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
