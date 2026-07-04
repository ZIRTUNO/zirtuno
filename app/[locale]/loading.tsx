import { useTranslations } from "next-intl";

/**
 * Route-segment loading screen — a calm pulse for in-app navigations. The
 * S1.10 loading MOMENT (the wordmark particle assembly on first paint) is the
 * EntryVeil in the locale layout; this only bridges route-level suspense.
 */
export default function Loading() {
  const t = useTranslations("common");
  return (
    <div className="loading-screen" role="status" aria-label={t("loading")}>
      <span className="loading-word">{t("loading")}</span>
    </div>
  );
}
