"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { CHAPTERS } from "@/lib/content/chapters";
import { CtaAnalysis } from "@/components/chrome/CtaButton";
import { LanguageToggle } from "./LanguageToggle";

/**
 * Mobile navigation (S12): burger → full-screen menu with the 9-chapter index
 * and a pinned primary CTA. Links route to the homepage anchors from any page.
 */
export function MobileMenu() {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        className="burger"
        aria-expanded={open}
        aria-label={open ? t("menuClose") : t("menuOpen")}
        onClick={() => setOpen((v) => !v)}
        data-cursor="hover"
      >
        <span />
        <span />
      </button>

      <div
        className={cn("mobile-menu", open && "is-open")}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <nav className="mobile-menu-nav" aria-label={t("menuOpen")}>
          {CHAPTERS.map((c) => (
            <Link
              key={c.id}
              href={`/#${c.id}`}
              className="mobile-menu-link"
              onClick={() => setOpen(false)}
              data-cursor="hover"
            >
              {t(`chapters.${c.key}`)}
            </Link>
          ))}
        </nav>

        <div className="mobile-menu-footer">
          <LanguageToggle />
          <div onClick={() => setOpen(false)}>
            <CtaAnalysis />
          </div>
        </div>
      </div>
    </div>
  );
}
