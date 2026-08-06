"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, routing } from "@/lib/i18n/config";
import { rememberHashLanding } from "@/lib/animation/hash-landing";
import { cn } from "@/lib/utils";

/**
 * Switches locale while preserving the reader's PLACE (S12). PT-BR ↔ EN.
 *
 * `usePathname()` is locale-stripped and carries neither the query string nor
 * the hash, so replacing on it alone discarded three things the visitor had
 * already expressed: the contact entry-intent (`?intent=analysis`), the active
 * portfolio filter (`?category=…`), and the chapter they were reading
 * (`#contact`). The toggle now re-attaches all three and hands the hash to the
 * shared landing helper so Lenis puts the new locale down on the SAME chapter
 * instead of the Hero.
 */
export function LanguageToggle() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const switchTo = (next: string) => {
    const { search, hash } = window.location;
    if (hash) rememberHashLanding(hash);
    router.replace(`${pathname}${search}${hash}`, { locale: next });
  };

  return (
    <div className="lang-toggle" role="group" aria-label={t("languageLabel")}>
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          className={cn("lang-opt", l === locale && "is-active")}
          aria-current={l === locale ? "true" : undefined}
          data-cursor="hover"
          data-analytics-event={l === locale ? undefined : "locale_switch"}
          data-analytics-locale={l}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
