import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { Link } from "@/lib/i18n/config";
import { localize, type Project } from "@/lib/sanity/types";

/**
 * Project card (S7.2). Full anatomy: preview · category · name · challenge ·
 * what was built · services · outcome · ghost CTA. The outcome respects the
 * no-invented-metrics rule: "architecture" → the Selected-architecture label,
 * otherwise the honest narrative/metric text.
 */
export function ProjectCard({ project }: { project: Project }) {
  const t = useTranslations("work");
  const locale = useLocale();

  const title = localize(project.title, locale);
  const categories = project.category.map((c) => t(`categories.${c}`));

  return (
    <Link
      href={`/work/${project.slug}`}
      data-cursor="hover"
      className="project-card"
      aria-label={title}
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
          <span className="project-preview-cat" aria-hidden="true">
            {categories[0]}
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
          {project.outcomeType === "architecture" ? (
            <span className="project-arch">{t("architectureLabel")}</span>
          ) : (
            <p>{localize(project.outcome, locale)}</p>
          )}
        </div>

        <span className="project-cta cta cta-ghost">
          <span className="cta-label">{t("ctaCard")}</span>
          <span className="cta-arrow" aria-hidden="true">
            →
          </span>
        </span>
      </div>
    </Link>
  );
}
