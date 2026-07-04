import { getTranslations, setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/hero/Hero";
import { LiquidSite, type EcoNode } from "@/components/field/LiquidSite";
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
  const ecoNodes = tEco.raw("nodes") as EcoNode[];

  return (
    <main id="content">
      <JsonLd locale={locale} />
      <SideIndex />
      {/* Hero → S3 → S4 → S5 share ONE persistent liquid renderer (LiquidSite):
          the hero's living mark, the pour into The Problem, the ecosystem
          organism and the service melts are one continuous fluid. */}
      <LiquidSite
        nodes={ecoNodes}
        centerLabel={tEco("centerLabel")}
        ecosystemLabel={tEco("headline")}
      >
        <Hero />
        <ChapterProblem />
        <ChapterEcosystem />
        <ChapterServices />
      </LiquidSite>
      <ChapterMethod />
      <ChapterWork />
      <ChapterName />
      <ChapterStudio />
      <ChapterContact />
    </main>
  );
}
