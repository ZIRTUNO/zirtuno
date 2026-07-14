import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";
import { CtaTalk } from "@/components/chrome/CtaButton";

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
      className="page-x relative py-24 md:py-32"
    >
      <Reveal inView as="p" className="chapter-label">
        {t("chapterLabel")}
      </Reveal>

      <div className="mt-12 grid gap-12 md:grid-cols-[0.9fr_1.1fr] md:gap-16">
        {/* Where */}
        <Reveal inView>
          <h2 className="case-label">{t("whereLabel")}</h2>
          <p className="mt-4 text-display-m font-medium text-paper">
            {t("city")}
          </p>
          <p className="mt-2 font-mono text-mono uppercase tracking-wide text-paper-mute">
            {t("coordinates")}
          </p>
        </Reveal>

        {/* Who — anonymous role grid */}
        <Reveal inView delay={0.05}>
          <h2 className="case-label">{t("whoLabel")}</h2>
          <p className="mt-4 max-w-md text-body-l text-paper-mute">
            {t("whoLead")}
          </p>
          <ul className="studio-roles mt-6">
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
      <Reveal inView variant="blur" className="mt-20 max-w-3xl">
        <h2 className="case-label">{t("whyLabel")}</h2>
        <p className="mt-4 text-display-m font-medium text-paper">
          {t("closingStatement")}{" "}
          <span className="font-poetic text-paper-mute">
            {t("closingItalic")}
          </span>
        </p>
      </Reveal>

      <Reveal inView className="mt-14 flex">
        <CtaTalk variant="secondary" placement="studio" />
      </Reveal>
    </section>
  );
}
