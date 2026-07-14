/**
 * Sanity schema for the portfolio (S7.4). Authored as plain objects, which are
 * valid Studio schema types. To mount an editing Studio at /studio you'll add
 * `sanity` + `next-sanity` (NOT in the locked S0.2 deps — ask before adding)
 * and pass `schemaTypes` to defineConfig. Without configured Sanity content,
 * production portfolio surfaces deliberately render an honest empty state.
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

const required = (rule: { required: () => unknown }) => rule.required();

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
    {
      name: "riveExperience",
      title: "Rive case-study experience",
      type: "object",
      description:
        "Optional enhancement for the project detail page only. Publish it only with a real .riv export, localized semantic copy, and a static poster. It never replaces the written case study.",
      fields: [
        {
          name: "file",
          title: "Rive file",
          type: "file",
          options: { accept: ".riv,application/octet-stream" },
          validation: required,
          description:
            "Upload the production .riv export here. External arbitrary URLs are not accepted by the site content model.",
        },
        {
          name: "artboard",
          title: "Artboard name",
          type: "string",
          description: "Leave empty to use the file's default artboard.",
        },
        {
          name: "stateMachine",
          title: "State machine name",
          type: "string",
          description:
            "Leave empty for a non-interactive file. Prefer an idle state that stops computing when no transition is active.",
        },
        {
          name: "title",
          title: "Accessible title",
          type: "localeString",
          validation: required,
          description:
            "Required in both languages. This remains visible and server-rendered without Rive.",
        },
        {
          name: "description",
          title: "Accessible description",
          type: "localeText",
          validation: required,
          description:
            "Required in both languages. Describe the system or relationship conveyed by the animation.",
        },
        {
          name: "poster",
          title: "Static poster",
          type: "image",
          options: { hotspot: true },
          validation: required,
          description:
            "Required production fallback for reduced motion, unavailable WebGL2, loading, and runtime errors.",
        },
      ],
    },
    { name: "credits", title: "Credits", type: "localeText" },
    { name: "liveUrl", title: "Live URL", type: "url" },
    {
      name: "featured",
      title: "Featured on homepage",
      type: "boolean",
      initialValue: false,
    },
    { name: "order", title: "Order", type: "number" },
  ],
  preview: {
    select: { title: "title.pt", subtitle: "outcomeType" },
  },
};

export const schemaTypes = [localeString, localeText, project];
