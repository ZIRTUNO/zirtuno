import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // A verification build must not overwrite the build a dev server is serving
  // from: set NEXT_DIST_DIR to give it its own output directory.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // Next only trusts `localhost` for dev resources by default. Opening the dev
  // server on 127.0.0.1 or the LAN IP (phone testing) counts as cross-origin,
  // so it blocks the HMR socket, the Turbopack client never boots, React never
  // hydrates — and the page renders as a BLACK SCREEN, because every reveal on
  // this site is client-driven: the copy sits at opacity 0 until the entry
  // choreography runs and the canvas stays at its default 300x150. Nothing in
  // the console says "hydration failed", only a websocket error, which makes
  // this look like a rendering bug when it is a trust-list bug.
  allowedDevOrigins: ["127.0.0.1", "192.168.15.6"],
  serverExternalPackages: ["@sanity/client"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.sanity.io" },
    ],
  },
};

export default withNextIntl(nextConfig);
