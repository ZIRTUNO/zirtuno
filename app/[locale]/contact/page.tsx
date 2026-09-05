import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Footer } from "@/components/chrome/Footer";
import { ContactForm } from "@/components/contact/ContactForm";
import { ContactChannels } from "@/components/contact/ContactChannels";
import { resolveContactIntent } from "@/lib/forms/contact";
import { routing } from "@/lib/i18n/config";
import { ogImage } from "@/lib/seo/og-image";
import "@/app/contact.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  const canonical = `/${locale}/contact`;

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical,
      languages: { "pt-BR": "/pt/contact", en: "/en/contact" },
    },
    openGraph: {
      type: "website",
      siteName: "Zirtuno",
      locale: locale === "pt" ? "pt_BR" : "en_US",
      url: canonical,
      title: t("metaTitle"),
      description: t("metaDescription"),
      images: [ogImage(locale, t("metaTitle"))],
    },
  };
}

type NextStep = { step: string; heading: string; body: string };

/**
 * S10 · Contato / Contact — the conversion endpoint, and THE destination the
 * intent CTAs were switched off waiting for.
 *
 * This section used to be the homepage's last chapter. It was quarantined on
 * 2026-09-04 with `INTENT_DESTINATION_READY` in `CtaButton.tsx` flipped to
 * false, which rendered nine intent placements across the site inert; that flag
 * is back on and points here. Nothing about the delivery path changed —
 * `/api/contact`, the Zod schema and the Resend pipeline were never
 * quarantined and were never edited for this.
 *
 * WHY A PAGE AND NOT A CHAPTER AGAIN
 * As a chapter the form was the ninth thing on a page whose first eight were
 * cinematic, and it inherited a scroll position, a liquid scene and a light
 * grade it had to survive rather than use. As a route it can be linked, shared,
 * measured, indexed and returned to — and the nine CTAs get a destination that
 * cannot be missed by a scroll that stopped early.
 *
 * THE SPLIT is the reference pages' (a statement holding one half, an
 * instrument holding the other), read through this site's own shell: both
 * columns sit inside `.page-x`, so they line up on the top bar's edge like
 * every other block on the site rather than on a second, private grid.
 *
 * NO WETTING FRONT ON THIS PAGE, and that is a measurement rather than a
 * preference. `lib/motion/wet-edge` drives `--wet-p` from a block's POSITION
 * against a reading line pinned at 0.48 vh, with the window opening 0.38 vh
 * below it and closing 0.38 vh above — so a block only reaches p = 1 once it
 * has been scrolled a full viewport-height PAST where it started, and it needs
 * that much document below it to do so. The homepage is ~27,000px, so every
 * chapter has the runway. This document is ~2,000px, and both ends of it fail:
 *
 *   · the h1 and the lead are above the fold at load, and measured at 1440x900
 *     they sit at p = 0.565 and p = 0.302 and STAY there for any visitor who
 *     does not scroll — which on a contact page is most of them. The page's
 *     primary message, permanently 44% dimmed.
 *   · the "what happens next" blocks are low enough to be scrolled into, and
 *     for that reason run out of page: measured at the very bottom of the
 *     document they cap at p = 0.647.
 *
 * There is no third position on a page this short. So the copy is full
 * strength, `.liquid-glass` carries the signature material on the headline
 * without it, and the page's motion is the one place it belongs on a screen
 * built for DOING rather than reading: the form itself (`FieldLiquid`, the
 * membranes, the chips). Same reasoning `.legal-doc` and `.careers-doc`
 * already apply — the devices that make the homepage feel alive are noise over
 * copy someone came here to act on.
 *
 * `searchParams` carries two things and both are load-bearing:
 *   · `?intent=`  — the CTA handshake, now PRE-SELECTING a visible chip
 *   · `?contact=` — the state the no-JS POST fallback redirects back with,
 *                   so a browser with JavaScript off still gets a real answer
 *                   instead of a form that appears to have done nothing.
 */
export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = await searchParams;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const intent = resolveContactIntent(first(query.intent));
  const status = first(query.contact) ?? null;

  const t = await getTranslations("contact");
  const steps = t.raw("nextSteps") as NextStep[];

  return (
    <>
      <main
        id="content"
        className="contact-page page-x min-h-svh pb-[var(--space-section)] pt-[calc(var(--topbar-h)+3rem)]"
      >
        <div className="contact-masthead">
          {/* THE INVITATION. Sticky from 1024 up (and only when the viewport is
              tall enough to hold it — see `app/contact.css`), so the sentence
              the visitor is answering stays in front of them while they write
              the answer. */}
          <div className="contact-aside">
            <p className="chapter-label">{t("chapterLabel")}</p>

            <h1 className="type-page-title liquid-glass contact-title">
              {t("title")}
            </h1>

            <p className="type-lead-copy contact-lead">{t("lead")}</p>

            {/* The two facts a visitor weighs before spending five minutes
                writing, stated before the form rather than under it. */}
            <dl className="contact-meta">
              <dt className="contact-meta-term">{t("responseLabel")}</dt>
              <dd className="contact-meta-value">{t("responseValue")}</dd>
              <dt className="contact-meta-term">{t("locationLabel")}</dt>
              <dd className="contact-meta-value">{t("locationValue")}</dd>
            </dl>

            <ContactChannels />
          </div>

          {/* THE INSTRUMENT. */}
          <div className="contact-panel">
            <ContactForm initialIntent={intent} initialStatus={status} />
          </div>
        </div>

        <section className="contact-next" aria-labelledby="contact-next-heading">
          <h2 id="contact-next-heading" className="chapter-label">
            {t("nextHeading")}
          </h2>
          <ol className="contact-next-list">
            {steps.map((step) => (
              <li key={step.step} className="contact-next-step">
                <p className="contact-next-num">{step.step}</p>
                <h3 className="contact-next-title">{step.heading}</h3>
                <p className="contact-next-body">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <Footer />
    </>
  );
}
