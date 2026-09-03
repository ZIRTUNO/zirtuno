/**
 * The OG share card, pre-rendered to `public/og` by
 * scripts/tools/generate-og-images.mjs.
 *
 * It used to be drawn per request by `app/[locale]/opengraph-image.tsx`, but
 * its copy is fixed and it has exactly two variants, so the dynamic route only
 * bought us ~1.5 MB of @vercel/og (resvg.wasm + yoga.wasm + a bundled font)
 * inside the Worker — enough on its own to break Cloudflare's 3 MiB script
 * limit. Static files are served from the assets binding and never counted
 * against it.
 *
 * Every route needs to reference this explicitly: Next REPLACES a parent's
 * `openGraph` object when a page declares its own rather than merging into it,
 * so a page that sets `openGraph` without `images` ships no share card at all.
 * The old file convention applied itself to every route regardless, which is
 * why the page-level blocks could get away with omitting it before.
 */
export const OG_IMAGE_ALT = "Zirtuno: ecossistemas digitais completos";

export function ogImage(locale: string, alt: string = OG_IMAGE_ALT) {
  return {
    url: `/og/opengraph-${locale === "en" ? "en" : "pt"}.png`,
    width: 1200,
    height: 630,
    alt,
  };
}
