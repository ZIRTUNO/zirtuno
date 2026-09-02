import { sanityClient } from "@/lib/sanity/client";
import {
  allProjectsQuery,
  featuredProjectsQuery,
  projectBySlugQuery,
  projectSlugsQuery,
} from "@/lib/sanity/queries";
import { SEED_PROJECTS } from "./projects";
import { VERIFIED_PROJECTS } from "./portfolio";
import type { Project, ProjectCategory } from "@/lib/sanity/types";
import { unstable_cache } from "next/cache";

// Portfolio source policy — three sources, ranked, never blended by accident:
//
//   1. Sanity, when it is configured and answers. Approved edits win.
//   2. `VERIFIED_PROJECTS` — the committed selection of REAL, delivered work
//      with public URLs. This is the floor, not a fallback: it is authored
//      content in the repo, exactly like the services and legal copy, and it
//      is what ships while the CMS is still unconfigured.
//   3. `SEED_PROJECTS` — unverified concept studies, reachable ONLY through an
//      explicit non-production demo flag. Never proof, never a CMS fallback.
//
// The rule that matters (#9) is that nothing unverifiable is presented as
// proof. A failed or unconfigured CMS therefore falls back to (2), which every
// visitor can check by opening the live site, and never to (3).
const isDemoPortfolio =
  process.env.NODE_ENV !== "production" &&
  process.env.PORTFOLIO_DEMO_MODE === "true";
let hasReportedMissingClient = false;

// Sanity-backed proof may update without a deploy, but it should not add a CMS
// round trip to every page request. Query + params are part of the cache key;
// approved edits become visible within five minutes (or an explicit tag purge).
const fetchSanityCached = unstable_cache(
  async (query: string, params: Record<string, unknown>) =>
    sanityClient ? sanityClient.fetch<unknown>(query, params) : null,
  ["zirtuno-portfolio"],
  { revalidate: 300, tags: ["portfolio"] },
);

async function fromSanity<T>(
  query: string,
  params: Record<string, unknown> = {},
): Promise<T | null> {
  if (!sanityClient) {
    if (process.env.NODE_ENV === "production" && !hasReportedMissingClient) {
      hasReportedMissingClient = true;
      console.warn(
        "[portfolio] Sanity is not configured; serving the committed selection.",
      );
    }
    return null;
  }
  try {
    return (await fetchSanityCached(query, params)) as T;
  } catch (error) {
    console.error(
      "[portfolio] Sanity request failed; falling back to the committed selection.",
      error,
    );
    return null;
  }
}

export async function getAllProjects(): Promise<Project[]> {
  if (isDemoPortfolio) return SEED_PROJECTS;
  const remote = await fromSanity<Project[]>(allProjectsQuery);
  return remote?.length ? remote : VERIFIED_PROJECTS;
}

/**
 * Is there ANY published proof right now?
 *
 * Reads the same cached catalogue every other query uses, so asking costs
 * nothing extra. Chapters use it to keep the portfolio CTAs honest: while the
 * selection is empty, "see the portfolio" is a dead end, and the visitor is
 * offered the conversation instead.
 */
export async function hasPublishedProjects(): Promise<boolean> {
  return (await getAllProjects()).length > 0;
}

export async function getFeaturedProjects(limit = 4): Promise<Project[]> {
  if (isDemoPortfolio) {
    return SEED_PROJECTS.filter((project) => project.featured).slice(0, limit);
  }
  const remote = await fromSanity<Project[]>(featuredProjectsQuery);
  const source = remote?.length
    ? remote
    : VERIFIED_PROJECTS.filter((project) => project.featured);
  return source.slice(0, limit);
}

export async function getProjectsByCategory(
  category?: string,
): Promise<Project[]> {
  const all = await getAllProjects();
  if (!category || category === "all") return all;
  return all.filter((p) =>
    p.category.includes(category as ProjectCategory),
  );
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  if (isDemoPortfolio) {
    return SEED_PROJECTS.find((project) => project.slug === slug) ?? null;
  }
  const remote = await fromSanity<Project | null>(projectBySlugQuery, { slug });
  return (
    remote ?? VERIFIED_PROJECTS.find((project) => project.slug === slug) ?? null
  );
}

export async function getAllProjectSlugs(): Promise<string[]> {
  if (isDemoPortfolio) return SEED_PROJECTS.map((project) => project.slug);
  const remote = await fromSanity<string[]>(projectSlugsQuery);
  return remote?.length
    ? remote
    : VERIFIED_PROJECTS.map((project) => project.slug);
}

/** Next project for the case-study footer (wraps around). */
export async function getNextProject(slug: string): Promise<Project | null> {
  const all = await getAllProjects();
  const idx = all.findIndex((p) => p.slug === slug);
  if (idx === -1 || all.length < 2) return null;
  return all[(idx + 1) % all.length] ?? null;
}
