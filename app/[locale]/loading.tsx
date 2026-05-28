import { useTranslations } from "next-intl";

/**
 * Loading screen (S1.10) — wordmark on ink. Phase 2 adds the letter-assembly
 * animation; Phase 1 uses a calm pulse.
 */
export default function Loading() {
  const t = useTranslations("common");
  return (
    <div className="loading-screen" role="status" aria-label={t("loading")}>
      <span className="loading-word">{t("loading")}</span>
    </div>
  );
}
