/**
 * Pre-renders the OG share card to static PNGs.
 *
 * The card has exactly two variants (pt, en) and fixed copy, so generating it
 * per request meant shipping the whole @vercel/og stack — resvg.wasm, yoga.wasm
 * and a bundled font, about 1.5 MB — inside the Worker to draw two images that
 * never change. That alone pushed the Worker past Cloudflare's 3 MiB limit.
 *
 * This runs the SAME ImageResponse code the route used, so the output is the
 * image the route produced, not a re-interpretation of it. Re-run it whenever
 * the brand line or tagline changes:
 *
 *   node scripts/tools/generate-og-images.mjs
 */
import { writeFile, mkdir } from "node:fs/promises";
import { createElement as h } from "react";
import { ImageResponse } from "next/og.js";

const SIZE = { width: 1200, height: 630 };

const TAGLINE = {
  pt: "Ecossistemas digitais completos",
  en: "Complete digital ecosystems",
};

function card(locale) {
  const tagline = TAGLINE[locale] ?? TAGLINE.pt;

  return h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: "#000000",
        color: "#F2F0EB",
        fontFamily: "sans-serif",
      },
    },
    h("div", {
      style: {
        position: "absolute",
        top: 380,
        right: -80,
        width: 460,
        height: 460,
        borderRadius: "9999px",
        background:
          "radial-gradient(circle at 40% 40%, #4DECFF, #00E3FE 45%, transparent 72%)",
        filter: "blur(8px)",
        opacity: 0.85,
      },
    }),
    h(
      "div",
      {
        style: {
          fontSize: 28,
          letterSpacing: 6,
          textTransform: "uppercase",
          color: "#00E3FE",
        },
      },
      "Zirtuno",
    ),
    h(
      "div",
      {
        style: {
          marginTop: 24,
          fontSize: 84,
          fontWeight: 600,
          lineHeight: 1.05,
          maxWidth: 820,
        },
      },
      tagline,
    ),
    h(
      "div",
      { style: { marginTop: 32, fontSize: 26, color: "rgba(242,240,235,0.5)" } },
      "Discreto. Preciso. Transformador.",
    ),
  );
}

const outDir = new URL("../../public/og/", import.meta.url);
await mkdir(outDir, { recursive: true });

for (const locale of Object.keys(TAGLINE)) {
  const response = new ImageResponse(card(locale), SIZE);
  const bytes = Buffer.from(await response.arrayBuffer());
  const target = new URL(`opengraph-${locale}.png`, outDir);
  await writeFile(target, bytes);
  console.log(`opengraph-${locale}.png  ${(bytes.length / 1024).toFixed(1)} KiB`);
}
