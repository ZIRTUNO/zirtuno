import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// The Cloudflare adapter turns the Next build into a Worker bundle. Defaults
// are deliberate here: no R2 incremental cache and no self-reference service
// binding, so the first deploy needs no pre-provisioned resources. Both are
// additive later — see docs/decisions if either becomes necessary for ISR.
// Build with webpack, NOT Turbopack, and only here: `npm run build` is
// untouched, so nobody's local flow changes.
//
// The adapter already drops @vercel/og when the app does not use it, aliasing
// the edge entry to a throwing shim so resvg.wasm (~516 KiB gzipped) and
// yoga.wasm (~28 KiB) stay out of the Worker. It decides with `useOg`, read
// from the Next trace files, and our traces are clean since the share card was
// pre-rendered. But the Turbopack path (patches/plugins/turbopack.ts) adds the
// @vercel/og rewrite UNCONDITIONALLY, dragging both blobs back in and holding
// the Worker at 3395 KiB against Cloudflare's 3 MiB limit.
//
// `buildCommand` is a TOP-LEVEL OpenNext option, not a Cloudflare override:
// defineCloudflareConfig() destructures only its six known keys and silently
// discards the rest, so passing it inside that call is a no-op.
const config = {
  ...defineCloudflareConfig(),
  buildCommand: "npm run build:webpack",
};

export default config;
