import type { ReactNode } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/**
 * Title fallback for unpublished case-study slugs (R5-E).
 *
 * When the page calls `notFound()` its own metadata is discarded, so a missing
 * slug used to render the localized 404 under the generic site title. A layout
 * does not throw, so its metadata always resolves: this supplies the 404 title,
 * and a published project overrides it from the page. Nothing else is declared
 * here — `robots` in particular stays with the page, so real case studies keep
 * being indexable while Next's own not-found response emits its noindex.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "notFound" });
  return { title: t("metaTitle") };
}

export default function CaseStudyLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
