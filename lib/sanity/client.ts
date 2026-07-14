import { createClient, type SanityClient } from "@sanity/client";

// Guarded: a missing client leaves portfolio surfaces empty in production.
// Explicit local concept mode is selected in lib/content/work.ts and is never
// used as a production CMS fallback.
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

export const sanityClient: SanityClient | null = projectId
  ? createClient({
      projectId,
      dataset,
      apiVersion: "2024-10-01",
      useCdn: true,
      token: process.env.SANITY_API_TOKEN,
    })
  : null;

export const isSanityConfigured = Boolean(projectId);
