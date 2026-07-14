import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { Link } from "@/lib/i18n/config";
import { localize, type Project } from "@/lib/sanity/types";
import { FORM_STILLS } from "@/lib/content/form-stills";

/**
 * Project card (S7.2). Full anatomy: preview · category · name · challenge ·
 * what was built · services · outcome · ghost CTA. The outcome respects the
 * no-invented-metrics rule: "architecture" → the Selected-architecture label,
 * otherwise the honest narrative/metric text.
 *
 * Preview (R3): real media when it exists; otherwise the category's baked
 * SDF-glass form still — consistent, on-brand placeholder ART (never a bare
 * word in a box), with the category as a small corner tag.
 */
export function ProjectCard({ project }: { project: Project }) {
  const t = useTranslations("work");
  const locale = useLocale();

  const title = localize(project.title, locale);
  const categories = project.category.map((c) => t(`categories.${c}`));
  const isSelectedArchitecture =
    project.prototype || project.outcomeType === "architecture";

  return (
    <Link
      href={`/work/${project.slug}`}
      data-cursor="hover"
      data-analytics-event="case_open"
      data-analytics-project={project.slug}
      className="project-card"
      aria-label={
        isSelectedArchitecture
          ? t("architectureCardLabel", { title })
          : title
      }
    >
      <div className="project-preview">
        {project.previewImage ? (
          <Image
            src={project.previewImage}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        ) : (
          <>
            <Image
              src={FORM_STILLS[project.category[0]]}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="project-preview-form"
              aria-hidden="true"
            />
            <span className="project-preview-cat" aria-hidden="true">
              {categories[0]}
            </span>
          </>
        )}
        {isSelectedArchitecture && (
          <span className="project-arch project-preview-status">
            {t("architectureLabel")}
          </span>
        )}
      </div>

      <div className="project-body">
        <p className="project-cats">{categories.join(" · ")}</p>
        <h3 className="project-name text-display-m">{title}</h3>
        <p className="project-line">{localize(project.challenge, locale)}</p>
        <p className="project-built">{localize(project.built, locale)}</p>

        {project.servicesInvolved.length > 0 && (
          <p className="project-services">
            {project.servicesInvolved.join(" · ")}
          </p>
        )}

        <div className="project-outcome">
          <p>{localize(project.outcome, locale)}</p>
        </div>

        <span className="project-cta cta cta-ghost">
          <span className="cta-label">
            {t(isSelectedArchitecture ? "ctaArchitecture" : "ctaCard")}
          </span>
          <span className="cta-arrow" aria-hidden="true">
            →
          </span>
        </span>
      </div>
    </Link>
  );
}
