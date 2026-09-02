import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";

/**
 * S9 · The Studio. Where (Curitiba + coordinates) · Who (anonymous role grid,
 * the chosen default) · Why (sans statement + serif-italic closing clause).
 * No process block — that lives in Método (S6).
 */
export function ChapterStudio() {
  const t = useTranslations("studio");
  const roles = t.raw("roles") as string[];

  return (
    <section
      id="studio"
      data-chapter
      className="page-x relative py-[var(--space-section)]"
    >
      <Reveal inView as="p" className="chapter-label">
        {t("chapterLabel")}
      </Reveal>

      <div className="mt-[var(--space-block)] grid gap-[var(--space-block)] md:grid-cols-[0.9fr_1.1fr]">
        {/* Where */}
        <Reveal inView>
          <h2 className="case-label">{t("whereLabel")}</h2>
          <p className="type-feature-title mt-[var(--space-group)] text-paper">
            {t("city")}
          </p>
          <p className="mt-[var(--space-tight)] font-mono text-mono uppercase text-paper-mute">
            {t("coordinates")}
          </p>
        </Reveal>

        {/* Who — anonymous role grid */}
        <Reveal inView delay={0.05}>
          <h2 className="case-label">{t("whoLabel")}</h2>
          <p className="studio-lead mt-[var(--space-group)] max-w-[38ch] text-body-l text-paper-lead">
            {t("whoLead")}
          </p>
          <ul className="studio-roles mt-[var(--space-group)]">
            {roles.map((role, i) => (
              <li key={role} className="studio-role">
                <span>{String(i + 1).padStart(2, "0")}</span>
                {role}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      {/* Why — closing line */}
      <Reveal inView variant="blur" className="mt-[var(--space-span)] max-w-3xl">
        <h2 className="case-label">{t("whyLabel")}</h2>
        <p className="type-feature-title mt-[var(--space-group)] text-paper">
          {t("closingStatement")}{" "}
          <span className="font-poetic text-paper-mute">
            {t("closingItalic")}
          </span>
        </p>
      </Reveal>

    </section>
  );
}
