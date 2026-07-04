import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import {
  setRequestLocale,
  getTranslations,
  getMessages,
} from "next-intl/server";
import {
  Bricolage_Grotesque,
  Instrument_Serif,
  JetBrains_Mono,
} from "next/font/google";
import { routing } from "@/lib/i18n/config";
import CustomCursor from "@/components/chrome/CustomCursor";
import LenisProvider from "@/components/motion/LenisProvider";
import { BreathLayer } from "@/components/ui/BreathLayer";
import { TopBar } from "@/components/chrome/TopBar";
import { Footer } from "@/components/chrome/Footer";
import { EntryVeil } from "@/components/chrome/EntryVeil";
import "../globals.css";

// Pre-paint skip for the entry veil (S1.10): return visitors in the same
// session must never see it flash — the attribute lands BEFORE the veil
// element parses, so CSS hides it at first paint.
const VEIL_SKIP =
  'try{if(sessionStorage.getItem("zveil"))document.documentElement.dataset.zveil="seen"}catch(e){}';

// Self-hosted at build time by next/font (no runtime third-party requests).
// sans = business/UI · serif = poetry ONLY · mono = labels/numbers/CTAs.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});
const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

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
      lang={locale}
      className={`${bricolage.variable} ${instrument.variable} ${jetbrains.variable}`}
    >
      <body>
        {/* must precede EntryVeil in DOM order (pre-paint skip) */}
        <script dangerouslySetInnerHTML={{ __html: VEIL_SKIP }} />
        <EntryVeil label={tCommon("loading")} />
        <BreathLayer />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <a href="#content" className="skip-link">
            {tCommon("skipToContent")}
          </a>
          <CustomCursor />
          <LenisProvider>
            <TopBar />
            {children}
            <Footer />
          </LenisProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
