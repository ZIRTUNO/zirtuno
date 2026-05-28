import { setRequestLocale, getTranslations } from "next-intl/server";

// Temporary S0 homepage — proves /pt and /en render localized copy.
// Replaced by the full chapter composition starting in S2.
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("hero");

  return (
    <main className="page-x grid min-h-svh place-items-center">
      <div className="max-w-3xl">
        <p className="font-mono text-mono uppercase text-paper-mute">
          {t("chapterLabel")}
        </p>
        <p className="font-poetic mt-6 text-poetic text-paper-mute">
          {t("eyebrow")}
        </p>
        <h1 className="mt-4 text-hero font-medium text-paper">
          {t("headline")}
        </h1>
        <p className="mt-6 max-w-xl text-body-l text-paper-mute">
          {t("subline")}
        </p>
      </div>
    </main>
  );
}
