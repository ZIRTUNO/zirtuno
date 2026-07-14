"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, routing } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Switches locale while preserving the current path (S12). PT-BR ↔ EN.
 */
export function LanguageToggle() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="lang-toggle" role="group" aria-label={t("languageLabel")}>
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => router.replace(pathname, { locale: l })}
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
