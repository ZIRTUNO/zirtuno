import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link, routing } from "@/lib/i18n/config";
import { LabHero } from "@/components/lab/LabHero";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LabPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");

  return (
    <div className="lab-page">
      <header className="lab-chrome">
        <Link href="/" className="lab-wordmark">
          Zirtuno<sup>®</sup>
        </Link>
        <button type="button" className="lab-burger" aria-label={t("menuOpen")}>
          <span />
          <span />
        </button>
      </header>

      <main id="content">
        <LabHero />
      </main>
    </div>
  );
}
