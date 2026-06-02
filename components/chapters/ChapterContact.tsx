import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { ContactForm } from "./ContactForm";
import { ContactMetaball } from "./ContactMetaball";

// Secondary contact paths (S10.5). TODO(content): the defaults below are
// PLACEHOLDERS until the real WhatsApp number, email, and social handles are
// supplied — override via env (NEXT_PUBLIC_WHATSAPP_URL, CONTACT_EMAIL_TO,
// NEXT_PUBLIC_INSTAGRAM_URL) or replace here once confirmed.
const WHATSAPP_URL =
  process.env.NEXT_PUBLIC_WHATSAPP_URL ?? "https://wa.me/5532991641200";
const INSTAGRAM_URL =
  process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "https://www.instagram.com/zirtuno/";
const CONTACT_EMAIL = process.env.CONTACT_EMAIL_TO ?? "zirtuno@gmail.com";

/**
 * S10 · Contact — the conversion endpoint. Artistic but unmistakably usable:
 * the metaball (placeholder; Phase 2 "exhale") is decoration above a clear,
 * labeled form. Submit is always the canonical labeled button.
 */
export function ChapterContact() {
  const t = useTranslations("contact");

  return (
    <section
      id="contact"
      data-chapter
      className="page-x relative border-t border-paper-faint py-24 md:py-32"
    >
      <div className="mx-auto max-w-2xl text-center">
        <ContactMetaball />

        <div className="flex justify-center">
          <Reveal inView as="p" className="chapter-label">
            {t("chapterLabel")}
          </Reveal>
        </div>

        <Reveal inView delay={0.05}>
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

        <div className="contact-secondary">
          <span>{t("secondaryLead")}</span>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="hover"
          >
            {t("whatsapp")}
          </a>
          <a href={`mailto:${CONTACT_EMAIL}`} data-cursor="hover">
            {t("email")}
          </a>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="hover"
          >
            {t("instagram")}
          </a>
        </div>
      </div>
    </section>
  );
}
