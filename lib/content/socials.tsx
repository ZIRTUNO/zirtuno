import type { ReactNode } from "react";

export type SocialKey = "instagram" | "linkedin" | "x" | "facebook" | "whatsapp";

export type SocialChannel = {
  key: SocialKey;
  label: string;
  url: string | undefined;
};

/**
 * The studio's public channels, and the marks that stand for them.
 *
 * TODO(decision): only owner-approved public channels render, the same gate the
 * contact chapter keeps. An unset channel is absent, never a dead icon.
 *
 * This lives outside `Footer` because the colophon is no longer the only place
 * that offers a direct line: the mobile nav sheet's contact card carries the
 * same row, and two copies of five inline SVGs would drift apart the first time
 * one of them was retouched. The env reads stay literal member expressions so
 * Next still inlines them into both the server and the client bundle.
 */
export const SOCIALS: readonly SocialChannel[] = [
  {
    key: "instagram",
    label: "Instagram",
    url: process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim(),
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    url: process.env.NEXT_PUBLIC_LINKEDIN_URL?.trim(),
  },
  {
    key: "x",
    label: "X",
    url: process.env.NEXT_PUBLIC_X_URL?.trim(),
  },
  {
    key: "facebook",
    label: "Facebook",
    url: process.env.NEXT_PUBLIC_FACEBOOK_URL?.trim(),
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    url: process.env.NEXT_PUBLIC_WHATSAPP_URL?.trim(),
  },
];

/** The channels the owner has actually published, in declaration order. */
export function approvedSocials(): SocialChannel[] {
  return SOCIALS.filter((social): social is SocialChannel & { url: string } =>
    Boolean(social.url),
  );
}

/**
 * The marks, drawn to the reference chrome's own geometry (upsunday.co,
 * `.foot__social-link svg` and `.nav-block__social svg` — the same artwork at
 * two sizes): Instagram as a 1.8-weight outline, everything else as the
 * platform's official solid glyph. That mix is the reference's, not an
 * oversight — the solid marks are each brand's supplied artwork and only
 * Instagram publishes an outline form.
 *
 * Each entry is a COMPLETE <svg>, because the set is not stylistically
 * uniform: Instagram needs `fill: none` + a stroke, the solid marks need
 * `fill: currentColor` and no stroke, and LinkedIn carries its own padded
 * viewBox. A single shared wrapper could not express that.
 */
export const SOCIAL_MARKS: Record<SocialKey, ReactNode> = {
  instagram: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.2" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="-3 -3 30 30" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 110-4.13 2.07 2.07 0 010 4.13zm1.78 13.02H3.55V9h3.57v11.45zM22.22 0H1.77C.8 0 0 .78 0 1.73v20.53C0 23.22.8 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.74V1.73C24 .78 23.2 0 22.22 0z" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  ),
};
