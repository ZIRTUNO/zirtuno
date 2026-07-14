import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import {
  setRequestLocale,
  getTranslations,
  getMessages,
} from "next-intl/server";
import { routing } from "@/lib/i18n/config";
import {
  bricolage,
  geist,
  instrument,
  jetbrains,
} from "@/lib/typography/fonts";
import CustomCursor from "@/components/chrome/CustomCursor";
import LenisProvider from "@/components/motion/LenisProvider";
import { BreathLayer } from "@/components/ui/BreathLayer";
import { TopBar } from "@/components/chrome/TopBar";
import { EntryVeil } from "@/components/chrome/EntryVeil";
import { SiteAnalytics } from "@/components/analytics/SiteAnalytics";

// Pre-paint skip for the entry veil (S1.10): return visitors in the same
// session must never see it flash — the attribute lands BEFORE the veil
// element parses, so CSS hides it at first paint.
const VEIL_SKIP =
  'try{if(sessionStorage.getItem("zveil"))document.documentElement.dataset.zveil="seen"}catch(e){}';
const VEIL_SKIP_MARKUP = `<script>${VEIL_SKIP}</script>`;
const NO_SCRIPT_CSS = `
  .entry-veil,
  .page-wipe,
  .custom-cursor { display: none !important; }
  .page-transition-content,
  [data-reveal] {
    opacity: 1 !important;
    transform: none !important;
    filter: none !important;
  }
`;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zirtuno.com";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const title = t("title");
  const description = t("description");

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: "%s · Zirtuno" },
    description,
    alternates: {
      canonical: `/${locale}`,
      languages: { "pt-BR": "/pt", en: "/en" },
    },
    openGraph: {
      type: "website",
      siteName: "Zirtuno",
      locale: locale === "pt" ? "pt_BR" : "en_US",
      url: `/${locale}`,
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const messages = await getMessages();
  const tCommon = await getTranslations({ locale, namespace: "common" });

  return (
    <html
      lang={locale === "pt" ? "pt-BR" : "en"}
      className={`${geist.variable} ${bricolage.variable} ${instrument.variable} ${jetbrains.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body>
        <noscript>
          <style>{NO_SCRIPT_CSS}</style>
        </noscript>
        {/* must precede EntryVeil in DOM order (pre-paint skip) */}
        <div
          aria-hidden="true"
          data-prepaint-script=""
          dangerouslySetInnerHTML={{ __html: VEIL_SKIP_MARKUP }}
        />
        <EntryVeil label={tCommon("loading")} />
        <BreathLayer />
        <SiteAnalytics />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <a href="#content" className="skip-link">
            {tCommon("skipToContent")}
          </a>
          <CustomCursor />
          {/* Footer renders inside each page (R5: on the homepage it lives
              INSIDE PageStage so the liquid reaches the true page bottom) */}
          <LenisProvider>
            <TopBar />
            {children}
          </LenisProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
