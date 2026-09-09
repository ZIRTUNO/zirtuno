import { z } from "zod";

// Entry-intent tags carried from the CTAs (S1.15) into the contact form (S10).
export const CONTACT_INTENTS = [
  "analysis",
  "structure",
  "talk",
  // Applications from /careers land in the SAME delivery pipeline as every
  // other enquiry — validation, rate limit, Resend, webhook — tagged so the
  // owner can filter them out of the commercial inbox. A separate mailbox
  // would be a second thing to keep working for no gain.
  "careers",
  "general",
] as const;

export type ContactIntent = (typeof CONTACT_INTENTS)[number];

export function resolveContactIntent(
  value: string | null | undefined,
): ContactIntent {
  return (CONTACT_INTENTS as readonly string[]).includes(value ?? "")
    ? (value as ContactIntent)
    : "general";
}

/* ───────────────────────────────────────────────────────────────────────────
   TRACKS — the visible taxonomy, above the intents.
   ---------------------------------------------------------------------------
   The five intents are a HANDSHAKE: they are what the nine CTAs across the
   site put in `?intent=`, what the delivery email is tagged with, and what
   analytics buckets a conversion by. They are not a question anyone wants to
   answer, and asking a visitor to pick one of five near-synonyms before they
   have said anything is why the old first stage existed at all.

   A TRACK is the question actually worth asking — what KIND of conversation
   is this — and there are only three of them. Each track owns a different set
   of qualifying fields, because "we want to build something" and "we want to
   talk it through" need different things known before the first reply.

   Tracks map ONTO intents rather than replacing them: nothing downstream of
   this file changed. `project` carries a `focus` qualifier that resolves to
   `analysis` or `structure`, which is where the old chip group's only real
   distinction went. Careers is a track the same way it is an intent — present
   only for a visitor who arrived from /careers, never a fourth tab offered to
   someone who came to hire the studio.
   ─────────────────────────────────────────────────────────────────────────── */

export const CONTACT_TRACKS = ["project", "advisory", "other"] as const;
export type ContactTrack = (typeof CONTACT_TRACKS)[number];

/** The careers arrival adds its own track; it is never offered otherwise. */
export const CAREERS_TRACK = "careers" as const;
export type ContactTrackId = ContactTrack | typeof CAREERS_TRACK;

/**
 * Qualifying answers. Every one is OPTIONAL and every one is a closed list or
 * a short string — a contact form that refuses to send because someone would
 * not name a budget is a contact form that loses the enquiry.
 */
export const CONTACT_DETAIL_KEYS = [
  "focus",
  "scale",
  "budget",
  "horizon",
  "role",
  "org",
  "format",
  "link",
] as const;
export type ContactDetailKey = (typeof CONTACT_DETAIL_KEYS)[number];

/** Which qualifiers each track asks for, in the order they are asked. */
export const TRACK_DETAILS: Record<ContactTrackId, readonly ContactDetailKey[]> = {
  project: ["focus", "scale", "budget", "horizon"],
  advisory: ["role", "org", "format"],
  other: [],
  careers: ["role", "link"],
};

/** Closed lists. A key absent here is a free-text field. */
export const DETAIL_OPTIONS: Partial<
  Record<ContactDetailKey, readonly string[]>
> = {
  focus: ["analysis", "structure", "product", "brand"],
  scale: ["starting", "growing", "operating"],
  budget: ["exploring", "upTo50", "upTo150", "over150"],
  horizon: ["now", "quarter", "planning"],
  org: ["startup", "scaleup", "established", "public"],
  format: ["diagnostic", "ongoing", "workshop"],
};

/** The intent a track resolves to, before the `focus` qualifier refines it. */
const TRACK_INTENT: Record<ContactTrackId, ContactIntent> = {
  project: "analysis",
  advisory: "talk",
  other: "general",
  careers: "careers",
};

/**
 * THE HANDSHAKE, BOTH WAYS.
 *
 * `?intent=` arrives from a CTA and has to select a tab; the tab the visitor
 * then submits has to resolve back to an intent. Both directions live here so
 * they cannot drift apart — the failure mode is silent and only visible in the
 * owner's inbox weeks later, as enquiries tagged `general` that were not.
 */
export function trackForIntent(intent: ContactIntent): ContactTrackId {
  if (intent === "careers") return "careers";
  if (intent === "analysis" || intent === "structure") return "project";
  if (intent === "talk") return "advisory";
  return "other";
}

export function intentForTrack(
  track: ContactTrackId,
  focus?: string,
): ContactIntent {
  if (track === "project") {
    if (focus === "structure") return "structure";
    if (focus === "analysis") return "analysis";
    // `product` and `brand` are both work to be scoped, which is what
    // `structure` means downstream. Only an explicit ask for a reading is
    // `analysis`.
    return focus ? "structure" : TRACK_INTENT.project;
  }
  return TRACK_INTENT[track];
}

export function resolveContactTrack(
  value: string | null | undefined,
  fallback: ContactTrackId,
): ContactTrackId {
  return value === CAREERS_TRACK ||
    (CONTACT_TRACKS as readonly string[]).includes(value ?? "")
    ? (value as ContactTrackId)
    : fallback;
}

/** The wire name for a qualifier, so the no-JS POST carries them too. */
export function detailField(key: ContactDetailKey): string {
  return `detail_${key}`;
}

// Shared by the client form and the API route. Localized validation messages
// are applied in the component; zod's defaults are the server-side fallback.
export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  company: z.string().trim().max(160).optional(),
  message: z.string().trim().min(10).max(4000),
  // Required (the form always supplies it; defaults to "general" client-side).
  // Keeps z.infer input/output aligned for react-hook-form.
  intent: z.enum(CONTACT_INTENTS),
  /**
   * The qualifying answers, keyed by the closed list above. Optional at every
   * level: an enquiry that answered nothing is still an enquiry, and one that
   * answered two of eight is the normal case.
   *
   * `partialRecord`, NOT `record`, and the difference is the whole field. Given
   * an ENUM key schema, Zod 4's `z.record` builds an EXHAUSTIVE record — it
   * requires every key in the enum to be present, and answers a `{ focus,
   * budget }` object with six "expected string, received undefined" issues.
   * The form is incapable of producing all eight, so `z.record` here rejects
   * every enquiry that filled in a qualifier and accepts only the ones that
   * left them all blank. `partialRecord` keeps the closed key list — an unknown
   * key is still refused — and makes each value optional.
   */
  details: z
    .partialRecord(z.enum(CONTACT_DETAIL_KEYS), z.string().trim().max(200))
    .optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;

// API-only abuse trap. It stays outside ContactInput so browser autofill can
// never create an invisible client-side validation dead end.
export const contactApiSchema = contactSchema.extend({
  website: z.string().max(0).optional(),
  submissionId: z.uuid(),
});
