import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/config";
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
          <p className="mt-8 font-mono text-mono uppercase text-cyan">
            {t("code")}
          </p>
          <h1 className="type-poetic-title mx-auto mt-4 text-paper">
            {t("title")}
          </h1>
          <p className="mt-4 text-body-l text-paper-mute">{t("body")}</p>
          <div className="mt-8 flex justify-center">
            <Link href="/" data-cursor="hover" className="cta cta-secondary">
              <span className="cta-label">{t("cta")}</span>
              <span className="cta-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
