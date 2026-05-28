import { setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/hero/Hero";
import { ChapterProblem } from "@/components/chapters/ChapterProblem";
import { ChapterEcosystem } from "@/components/chapters/ChapterEcosystem";
import { ChapterServices } from "@/components/chapters/ChapterServices";
import { ChapterMethod } from "@/components/chapters/ChapterMethod";

// Homepage — composes the 9 chapters in business-first order (S16).
// Chapters are added incrementally; Hero (S2) first.
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main id="content">
      <Hero />
      <ChapterProblem />
      <ChapterEcosystem />
      <ChapterServices />
      <ChapterMethod />
    </main>
  );
}
