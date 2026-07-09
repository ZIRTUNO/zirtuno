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
import { ChapterContact } from "@/components/chapters/ChapterContact";
import { SideIndex } from "@/components/chrome/SideIndex";
import { JsonLd } from "@/components/seo/JsonLd";

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
  const tName = await getTranslations("name");
  const ecoNodes = tEco.raw("nodes") as EcoNode[];
  const pillars = tName.raw("pillars") as string[];

  return (
    <main id="content">
      <JsonLd locale={locale} />
      <SideIndex />
      {/* R5: the ENTIRE page shares ONE persistent liquid renderer (PageStage —
          the conductor's shell). The hero's living mark, the pour, the
          fracture, the organism, the service melts, the method rehearsal, the
          origin beats and the contact mark are ONE continuous fluid — the same
          48 droplets end to end, down to the footer edge. */}
      <PageStage
        nodes={ecoNodes}
        centerLabel={tEco("centerLabel")}
        ecosystemLabel={tEco("headline")}
        pillars={pillars}
      >
        <Hero />
        <ChapterProblem />
        <ChapterEcosystem />
        <ChapterServices />
        <ChapterMethod />
        <ChapterWork />
        <ChapterName />
        <ChapterStudio />
        <ChapterContact />
        <Footer />
      </PageStage>
    </main>
  );
}
