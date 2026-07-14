import Link from "next/link";
import {
  bricolage,
  geist,
  instrument,
  jetbrains,
} from "@/lib/typography/fonts";
import ptMessages from "@/lib/i18n/messages/pt.json";

const copy = ptMessages.notFound;

// Root fallback 404 for unmatched non-locale paths. The root layout is a
// passthrough, so this provides its own <html>/<body>. Locale-aware 404s live
// in app/[locale]/not-found.tsx.
export default function RootNotFound() {
  return (
    <html
      lang="pt-BR"
      className={`${geist.variable} ${bricolage.variable} ${instrument.variable} ${jetbrains.variable}`}
    >
      <body>
        <main
          id="content"
          className="page-x grid min-h-svh place-items-center text-center"
        >
          <div className="max-w-xl">
            <p className="font-mono text-mono uppercase text-cyan">
              {copy.code}
            </p>
            <h1 className="type-page-title mx-auto mt-4 text-paper">
              {copy.title}
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-body-l text-paper-mute">
              {copy.body}
            </p>
            <Link
              href="/pt"
              className="cta cta-secondary mt-8"
              data-cursor="hover"
            >
              <span className="cta-label">{copy.cta}</span>
              <span className="cta-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
