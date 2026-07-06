import { useTranslations } from "next-intl";
import { PILLARS } from "@/lib/content/services";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zirtuno.com";
const INSTAGRAM =
  process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "https://www.instagram.com/zirtuno/";
const escapeJsonForScript = (value: string) =>
  value
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

/**
 * Structured data (S15): Organization + a Service entry per pillar. Server-
 * rendered into the page so it's crawlable.
 */
export function JsonLd({ locale }: { locale: string }) {
  const ts = useTranslations("services");
  const tm = useTranslations("meta");

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Zirtuno",
    url: `${SITE_URL}/${locale}`,
    description: tm("description"),
    sameAs: [INSTAGRAM],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Curitiba",
      addressCountry: "BR",
    },
  };

  const services = PILLARS.map((p) => ({
    "@context": "https://schema.org",
    "@type": "Service",
    name: ts(`pillars.${p.key}.name`),
    description: ts(`pillars.${p.key}.is`),
    provider: { "@type": "Organization", name: "Zirtuno" },
    areaServed: "BR",
  }));

  const json = escapeJsonForScript(JSON.stringify([organization, ...services]));

  return (
    <div
      aria-hidden="true"
      data-structured-data=""
      dangerouslySetInnerHTML={{
        __html:
          `<script id="zirtuno-jsonld-${locale}" ` +
          `type="application/ld+json">${json}</script>`,
      }}
    />
  );
}
