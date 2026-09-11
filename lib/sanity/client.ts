import { createClient, type SanityClient } from "@sanity/client";

// Missing or unavailable CMS falls back to the committed, verified portfolio
// in lib/content/work.ts. Never let optional CMS reads hold a page for the
// SDK's default five-minute timeout, or multiply that delay with retries.
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

export const sanityClient: SanityClient | null = projectId
  ? createClient({
      projectId,
      dataset,
      apiVersion: "2024-10-01",
      useCdn: true,
      token: process.env.SANITY_API_TOKEN,
      timeout: 3_000,
      maxRetries: 0,
    })
  : null;

export const isSanityConfigured = Boolean(projectId);
