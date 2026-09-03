import { useTranslations } from "next-intl";
import { LoneDroplet } from "@/components/chrome/LoneDroplet";
import { Footer } from "@/components/chrome/Footer";

/**
 * Localized 404 (S1.11) — the lone, dispersed droplet (R3): one living
 * droplet that stayed, two fragments drifting away. "This page has
 * dispersed." Rendered within the locale layout, so it keeps the chrome;
 * static tiers keep the fractured mark.
 */
export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <>
      <main
        id="content"
        className="page-x grid min-h-svh place-items-center pt-[var(--topbar-h)] text-center"
      >
        <div className="max-w-xl">
          <LoneDroplet />
          <p className="mt-[var(--space-group)] font-mono text-mono uppercase text-cyan">
            {t("code")}
          </p>
          <h1 className="type-poetic-title mx-auto mt-[var(--space-tight)] text-paper">
            {t("title")}
          </h1>
          <p className="mt-[var(--space-tight)] text-body-l text-paper-lead">{t("body")}</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
