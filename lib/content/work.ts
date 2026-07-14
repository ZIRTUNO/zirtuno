import { sanityClient } from "@/lib/sanity/client";
import {
  allProjectsQuery,
  featuredProjectsQuery,
  projectBySlugQuery,
  projectSlugsQuery,
} from "@/lib/sanity/queries";
import { SEED_PROJECTS } from "./projects";
import type { Project, ProjectCategory } from "@/lib/sanity/types";
import { unstable_cache } from "next/cache";

// Portfolio source policy:
// - production always reads Sanity and fails closed to empty content;
// - local concept data is available only through an explicit, non-production
//   demo mode. It is never a silent fallback for CMS failures.
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
      console.error(
        "[portfolio] Sanity is not configured; publishing no project content.",
      );
    }
    return null;
  }
  try {
    return (await fetchSanityCached(query, params)) as T;
  } catch (error) {
    console.error(
      "[portfolio] Sanity request failed; publishing no project content.",
      error,
    );
    return null;
  }
}

export async function getAllProjects(): Promise<Project[]> {
  if (isDemoPortfolio) return SEED_PROJECTS;
  const remote = await fromSanity<Project[]>(allProjectsQuery);
  return remote ?? [];
}

export async function getFeaturedProjects(limit = 4): Promise<Project[]> {
  if (isDemoPortfolio) {
    return SEED_PROJECTS.filter((project) => project.featured).slice(0, limit);
  }
  const remote = await fromSanity<Project[]>(featuredProjectsQuery);
  return (remote ?? []).slice(0, limit);
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
  return remote ?? null;
}

export async function getAllProjectSlugs(): Promise<string[]> {
  if (isDemoPortfolio) return SEED_PROJECTS.map((project) => project.slug);
  const remote = await fromSanity<string[]>(projectSlugsQuery);
  return remote ?? [];
}

/** Next project for the case-study footer (wraps around). */
export async function getNextProject(slug: string): Promise<Project | null> {
  const all = await getAllProjects();
  const idx = all.findIndex((p) => p.slug === slug);
  if (idx === -1 || all.length < 2) return null;
  return all[(idx + 1) % all.length] ?? null;
}
