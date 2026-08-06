import type { ReactNode } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/**
 * Metadata carrier for the localized 404 (R5-E).
 *
 * `not-found.tsx` cannot export `generateMetadata` — the segment threw before
 * its own metadata ran — so every unmatched path used to inherit the generic
 * site title. This layout does not throw, so its metadata resolves normally and
 * gives the 404 the localized title (and the noindex) it should always have
 * carried, while the catch-all page below still calls `notFound()` and the
 * response keeps its real 404 status.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "notFound" });
  return {
    title: t("metaTitle"),
    description: t("body"),
    robots: { index: false, follow: true },
  };
}

export default function CatchAllLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
