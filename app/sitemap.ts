import type { MetadataRoute } from "next";
import { routing } from "@/lib/i18n/config";
import { getAllProjectSlugs } from "@/lib/content/work";
import { LEGAL_DOCS } from "@/lib/content/legal";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zirtuno.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getAllProjectSlugs();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    entries.push({
      url: `${SITE_URL}/${locale}`,
      changeFrequency: "monthly",
      priority: 1,
    });
    entries.push({
      url: `${SITE_URL}/${locale}/work`,
      changeFrequency: "monthly",
      priority: 0.8,
    });
    // The conversion endpoint, and the only page on the site that exists to be
    // acted on rather than read. Listed WITHOUT a query: `?intent=` is a
    // handshake spent by the CTAs, not a set of pages — nine indexed variants
    // of one form would be nine near-duplicates competing with each other, and
    // the canonical in `generateMetadata` already points every one of them
    // back here.
    entries.push({
      url: `${SITE_URL}/${locale}/contact`,
      changeFrequency: "monthly",
      priority: 0.8,
    });
    entries.push({
      url: `${SITE_URL}/${locale}/careers`,
      changeFrequency: "monthly",
      priority: 0.5,
    });
    for (const slug of slugs) {
      entries.push({
        url: `${SITE_URL}/${locale}/work/${slug}`,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
    for (const doc of LEGAL_DOCS) {
      entries.push({
        url: `${SITE_URL}/${locale}/legal/${doc.slug}`,
        changeFrequency: "yearly",
        priority: 0.3,
      });
    }
  }

  return entries;
}
