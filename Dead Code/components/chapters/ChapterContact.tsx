import { useTranslations } from "next-intl";
import type { ContactIntent } from "@/lib/forms/contact";
import { Reveal } from "@/components/ui/Reveal";
import { ContactForm } from "./ContactForm";
import { ContactMetaball } from "./ContactMetaball";

/**
 * S10 · Contact — the conversion endpoint. Artistic but unmistakably usable:
 * the metaball (placeholder; Phase 2 "exhale") is decoration above a clear,
 * labeled form. Submit is always the canonical labeled button.
 */
export function ChapterContact({
  initialIntent,
  initialStatus,
}: {
  initialIntent: ContactIntent;
  initialStatus?: string;
}) {
  const t = useTranslations("contact");

  return (
    <section
      id="contact"
      data-chapter
      className="page-x relative py-[var(--space-section)]"
    >
      <div className="mx-auto max-w-2xl text-center">
        <ContactMetaball />

        <div className="flex justify-center">
          <Reveal inView as="p" className="chapter-label">
            {t("chapterLabel")}
          </Reveal>
        </div>

        <Reveal inView delay={0.05} variant="blur">
          <h2 className="type-section-title mx-auto mt-[var(--type-space-label-title)] text-paper">
            {t("prompt")}
          </h2>
        </Reveal>

        <Reveal inView delay={0.1}>
          <p className="mx-auto mt-[var(--type-space-title-lead)] max-w-[42ch] text-body-l text-paper-lead">
            {t("subPrompt")}
          </p>
        </Reveal>
      </div>

      <div className="mx-auto mt-[var(--space-block)] max-w-xl">
        <ContactForm
          initialIntent={initialIntent}
          initialStatus={initialStatus}
        />
      </div>
    </section>
  );
}
