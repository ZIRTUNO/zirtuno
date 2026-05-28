import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

// build-spec S0: PT-BR primary, EN secondary. Both ship, both prefixed.
export const routing = defineRouting({
  locales: ["pt", "en"],
  defaultLocale: "pt",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

// Locale-aware navigation helpers (use these instead of next/link & next/navigation).
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
