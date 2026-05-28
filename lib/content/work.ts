import { sanityClient } from "@/lib/sanity/client";
import {
  allProjectsQuery,
  featuredProjectsQuery,
  projectBySlugQuery,
  projectSlugsQuery,
} from "@/lib/sanity/queries";
import { SEED_PROJECTS } from "./projects";
import type { Project, ProjectCategory } from "@/lib/sanity/types";

// Data-access layer for the portfolio. Tries Sanity; falls back to the local
// seed so the site is fully functional and deployable without a CMS connected.

async function fromSanity<T>(
  query: string,
  params: Record<string, unknown> = {},
): Promise<T | null> {
  if (!sanityClient) return null;
  try {
    return await sanityClient.fetch<T>(query, params);
  } catch {
    return null;
  }
}

export async function getAllProjects(): Promise<Project[]> {
  const remote = await fromSanity<Project[]>(allProjectsQuery);
  return remote && remote.length ? remote : SEED_PROJECTS;
}

export async function getFeaturedProjects(limit = 4): Promise<Project[]> {
  const remote = await fromSanity<Project[]>(featuredProjectsQuery);
  const list =
    remote && remote.length
      ? remote
      : SEED_PROJECTS.filter((p) => p.featured);
  return list.slice(0, limit);
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
  const remote = await fromSanity<Project | null>(projectBySlugQuery, { slug });
  if (remote) return remote;
  return SEED_PROJECTS.find((p) => p.slug === slug) ?? null;
}

export async function getAllProjectSlugs(): Promise<string[]> {
  const remote = await fromSanity<string[]>(projectSlugsQuery);
  return remote && remote.length ? remote : SEED_PROJECTS.map((p) => p.slug);
}

/** Next project for the case-study footer (wraps around). */
export async function getNextProject(slug: string): Promise<Project | null> {
  const all = await getAllProjects();
  const idx = all.findIndex((p) => p.slug === slug);
  if (idx === -1 || all.length < 2) return null;
  return all[(idx + 1) % all.length] ?? null;
}
