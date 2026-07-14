import { useTranslations } from "next-intl";
import { CtaTalk } from "./CtaButton";
import { LanguageToggle } from "./LanguageToggle";

// TODO(decision): omit the social link until its owner-approved URL is set.
const INSTAGRAM_URL = process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim();

/** Minimal footer on every page (S11). */
export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="footer">
      <span className="footer-copy">{t("copyright")}</span>
      <LanguageToggle />
      <div className="footer-right">
        {INSTAGRAM_URL && (
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
            data-cursor="hover"
            data-analytics-event="direct_contact"
            data-analytics-channel="instagram"
          >
            Instagram
          </a>
        )}
        <CtaTalk variant="ghost" placement="footer" />
      </div>
    </footer>
  );
}
