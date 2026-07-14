import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { ContactForm } from "./ContactForm";
import { ContactMetaball } from "./ContactMetaball";

// TODO(decision): only owner-approved public channels render. The public
// mailbox remains separate from the private delivery recipient by design.
const WHATSAPP_URL = process.env.NEXT_PUBLIC_WHATSAPP_URL?.trim();
const INSTAGRAM_URL = process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim();
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

/**
 * S10 · Contact — the conversion endpoint. Artistic but unmistakably usable:
 * the metaball (placeholder; Phase 2 "exhale") is decoration above a clear,
 * labeled form. Submit is always the canonical labeled button.
 */
export function ChapterContact() {
  const t = useTranslations("contact");
  const hasDirectChannel = Boolean(
    WHATSAPP_URL || CONTACT_EMAIL || INSTAGRAM_URL,
  );

  return (
    <section
      id="contact"
      data-chapter
      className="page-x relative py-24 md:py-32"
    >
      <div className="mx-auto max-w-2xl text-center">
        <ContactMetaball />

        <div className="flex justify-center">
          <Reveal inView as="p" className="chapter-label">
            {t("chapterLabel")}
          </Reveal>
        </div>

        <Reveal inView delay={0.05} variant="blur">
          <p className="font-poetic mt-6 text-display-l text-paper">
            {t("prompt")}
          </p>
        </Reveal>

        <Reveal inView delay={0.1}>
          <p className="mt-4 text-body-l text-paper-mute">{t("subPrompt")}</p>
        </Reveal>
      </div>

      <div className="mx-auto mt-14 max-w-xl">
        <Suspense fallback={null}>
          <ContactForm />
        </Suspense>

        {hasDirectChannel && (
          <div className="contact-secondary">
            <span>{t("secondaryLead")}</span>
            {WHATSAPP_URL && (
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-cursor="hover"
                data-analytics-event="direct_contact"
                data-analytics-channel="whatsapp"
              >
                {t("whatsapp")}
              </a>
            )}
            {CONTACT_EMAIL && (
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                data-cursor="hover"
                data-analytics-event="direct_contact"
                data-analytics-channel="email"
              >
                {t("email")}
              </a>
            )}
            {INSTAGRAM_URL && (
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-cursor="hover"
                data-analytics-event="direct_contact"
                data-analytics-channel="instagram"
              >
                {t("instagram")}
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
