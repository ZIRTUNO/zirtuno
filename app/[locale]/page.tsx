import { getTranslations, setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/hero/Hero";
import { PageStage, type EcoNode } from "@/components/field/PageStage";
import { Footer } from "@/components/chrome/Footer";
import { ChapterProblem } from "@/components/chapters/ChapterProblem";
import { ChapterEcosystem } from "@/components/chapters/ChapterEcosystem";
import { ChapterServices } from "@/components/chapters/ChapterServices";
import { ChapterMethod } from "@/components/chapters/ChapterMethod";
import { ChapterWork } from "@/components/chapters/ChapterWork";
import { ChapterName } from "@/components/chapters/ChapterName";
import { ChapterStudio } from "@/components/chapters/ChapterStudio";
import { SideIndex } from "@/components/chrome/SideIndex";
import { JsonLd } from "@/components/seo/JsonLd";
import { hasPublishedProjects } from "@/lib/content/work";

// Homepage — composes the 9 chapters in business-first order (S16).
// Chapters are added incrementally; Hero (S2) first.
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tEco = await getTranslations("ecosystem");
  const ecoNodes = tEco.raw("nodes") as EcoNode[];
  // One truth for the whole page: while nothing is published, no chapter offers
  // a portfolio link that lands on an empty index (Z-AUD-001's user-facing
  // consequence). Reads the cached catalogue — no extra CMS round trip.
  const hasWork = await hasPublishedProjects();

  return (
    <main id="content">
      <JsonLd locale={locale} />
      <SideIndex />
      {/* R5: the ENTIRE page shares ONE persistent liquid renderer (PageStage —
          the conductor's shell). The hero's living mark, the pour, the
          fracture, the organism, the service melts, the method rehearsal, the
          origin beats and the studio echoes are ONE continuous fluid — the same
          48 droplets end to end, down to the footer edge. */}
      <PageStage
        nodes={ecoNodes}
        centerLabel={tEco("centerLabel")}
        ecosystemLabel={tEco("headline")}
        systems={[
          tEco("systems.identity"),
          tEco("systems.growth"),
          tEco("systems.operation"),
        ]}
      >
        <Hero />
        <ChapterProblem />
        <ChapterEcosystem />
        <ChapterServices hasWork={hasWork} />
        <ChapterMethod />
        <ChapterWork />
        <ChapterName />
        <ChapterStudio />
        <Footer />
      </PageStage>
    </main>
  );
}
