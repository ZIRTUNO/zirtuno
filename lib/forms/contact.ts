import { z } from "zod";

// Entry-intent tags carried from the CTAs (S1.15) into the contact form (S10).
export const CONTACT_INTENTS = [
  "analysis",
  "structure",
  "talk",
  "general",
] as const;

export type ContactIntent = (typeof CONTACT_INTENTS)[number];

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
});

export type ContactInput = z.infer<typeof contactSchema>;

// API-only abuse trap. It stays outside ContactInput so browser autofill can
// never create an invisible client-side validation dead end.
export const contactApiSchema = contactSchema.extend({
  website: z.string().max(0).optional(),
  submissionId: z.uuid(),
});
