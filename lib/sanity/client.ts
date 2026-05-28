import { createClient, type SanityClient } from "@sanity/client";

// Guarded: returns null when Sanity isn't configured so the site still builds
// and renders (falling back to seeded prototype projects, see lib/content/work).
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
