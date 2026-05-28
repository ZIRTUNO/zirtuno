/**
 * Sanity schema for the portfolio (S7.4). Authored as plain objects, which are
 * valid Studio schema types. To mount an editing Studio at /studio you'll add
 * `sanity` + `next-sanity` (NOT in the locked S0.2 deps — ask before adding)
 * and pass `schemaTypes` to defineConfig. Until then the site reads from the
 * seed in lib/content/projects.ts.
 */

const CATEGORY_OPTIONS = [
  { title: "Web Design", value: "web-design" },
  { title: "Software", value: "software" },
  { title: "AI / IA", value: "ai" },
  { title: "Automation / Automação", value: "automation" },
  { title: "Data / Dados", value: "data" },
  { title: "Branding", value: "branding" },
  { title: "Marketing", value: "marketing" },
];

export const localeString = {
  name: "localeString",
  title: "Localized string",
  type: "object",
  fields: [
    { name: "pt", title: "Português", type: "string" },
    { name: "en", title: "English", type: "string" },
  ],
};

export const localeText = {
  name: "localeText",
  title: "Localized text",
  type: "object",
  fields: [
    { name: "pt", title: "Português", type: "text", rows: 3 },
    { name: "en", title: "English", type: "text", rows: 3 },
  ],
};

export const project = {
  name: "project",
  title: "Project",
  type: "document",
  fields: [
    { name: "title", title: "Title", type: "localeString" },
    {
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title.pt", maxLength: 96 },
    },
    {
      name: "category",
      title: "Category",
      type: "array",
      of: [{ type: "string" }],
      options: { list: CATEGORY_OPTIONS },
    },
    {
      name: "servicesInvolved",
      title: "Services involved",
      type: "array",
      of: [{ type: "string" }],
    },
    { name: "challenge", title: "Challenge", type: "localeText" },
    { name: "built", title: "What was built", type: "localeText" },
    { name: "outcome", title: "Outcome", type: "localeText" },
    {
      name: "outcomeType",
      title: "Outcome type",
      type: "string",
      description:
        "Use 'metric' ONLY for real, verified numbers. Otherwise 'narrative' or 'architecture'. Never fabricate metrics.",
      options: {
        list: [
          { title: "Verified metric", value: "metric" },
          { title: "Honest narrative", value: "narrative" },
          { title: "Selected architecture", value: "architecture" },
        ],
      },
      initialValue: "architecture",
    },
    {
      name: "previewMedia",
      title: "Preview image",
      type: "image",
      options: { hotspot: true },
    },
    {
      name: "gallery",
      title: "Gallery",
      type: "array",
      of: [{ type: "image", options: { hotspot: true } }],
    },
    { name: "credits", title: "Credits", type: "localeText" },
    { name: "liveUrl", title: "Live URL", type: "url" },
    { name: "featured", title: "Featured on homepage", type: "boolean", initialValue: false },
    { name: "order", title: "Order", type: "number" },
  ],
  preview: {
    select: { title: "title.pt", subtitle: "outcomeType" },
  },
};

export const schemaTypes = [localeString, localeText, project];
