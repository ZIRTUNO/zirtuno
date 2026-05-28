import { notFound } from "next/navigation";

// Catch-all so unmatched paths under a locale render the LOCALIZED 404
// (app/[locale]/not-found.tsx) instead of the root fallback. Standard
// next-intl App Router pattern.
export default function CatchAll() {
  notFound();
}
