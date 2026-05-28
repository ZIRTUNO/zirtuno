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
import "../globals.css";

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
  return {
    title: { default: t("title"), template: "%s · Zirtuno" },
    description: t("description"),
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
