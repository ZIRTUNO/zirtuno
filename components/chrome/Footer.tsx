import { useTranslations } from "next-intl";
import { CtaTalk } from "./CtaButton";
import { LanguageToggle } from "./LanguageToggle";

const INSTAGRAM_URL =
  process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "https://www.instagram.com/zirtuno/";

/** Minimal footer on every page (S11). */
export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="footer">
      <span className="footer-copy">{t("copyright")}</span>
      <LanguageToggle />
      <div className="footer-right">
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="footer-link"
          data-cursor="hover"
        >
          Instagram
        </a>
        <CtaTalk variant="ghost" />
      </div>
    </footer>
  );
}
