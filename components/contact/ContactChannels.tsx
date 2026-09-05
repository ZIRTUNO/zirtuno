import { useTranslations } from "next-intl";
import { approvedSocials, SOCIAL_MARKS } from "@/lib/content/socials";

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

/**
 * The envelope, drawn to the same 24-box and 1.8 stroke weight as the
 * Instagram mark in `lib/content/socials.tsx` so the row reads as one set.
 * It lives here rather than in `SOCIAL_MARKS` because email is not a social
 * channel and does not belong in a list keyed by `SocialKey` — the footer and
 * the nav sheet both iterate that list and neither wants a mailto in it.
 */
const MAIL_MARK = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2.5" y="4.5" width="19" height="15" rx="2.4" />
    <path d="M3.2 6.4 12 12.8l8.8-6.4" />
  </svg>
);

/**
 * THE PARALLEL PATH.
 *
 * A form is not the only way to open a conversation, and a page that pretends
 * otherwise loses the visitor who would rather send one line on WhatsApp than
 * compose four fields. The row is offered BESIDE the form rather than under
 * it, so it reads as an alternative and not as a fallback for a form that
 * failed.
 *
 * Every channel here is owner-approved by construction: `approvedSocials()`
 * returns only the ones with a published URL in the environment, and the email
 * line renders only when `NEXT_PUBLIC_CONTACT_EMAIL` is set. An unset channel
 * is absent, never a dead icon — the same gate the footer and the nav sheet
 * keep, and the reason all three read from one list.
 *
 * `data-analytics-event="direct_contact"` matches the footer's tagging, so a
 * direct line opened from this page and one opened from the colophon land in
 * the same conversion bucket instead of two that have to be added up by hand.
 */
export function ContactChannels() {
  const t = useTranslations("contact");
  const socials = approvedSocials();

  if (!CONTACT_EMAIL && socials.length === 0) return null;

  return (
    <div className="contact-channels">
      <h2 className="contact-channels-heading">{t("channelsHeading")}</h2>
      <p className="contact-channels-hint">{t("channelsHint")}</p>
      <ul className="contact-channels-list">
        {CONTACT_EMAIL && (
          <li>
            <a
              className="contact-channel"
              href={`mailto:${CONTACT_EMAIL}`}
              data-cursor="hover"
              data-analytics-event="direct_contact"
              data-analytics-placement="contact_page"
            >
              {MAIL_MARK}
              {t("emailLabel")}
            </a>
          </li>
        )}
        {socials.map((social) => (
          <li key={social.key}>
            <a
              className="contact-channel"
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor="hover"
              data-analytics-event="direct_contact"
              data-analytics-placement="contact_page"
            >
              {SOCIAL_MARKS[social.key]}
              {social.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
