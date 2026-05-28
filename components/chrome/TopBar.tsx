import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/config";
import { CtaTalk } from "./CtaButton";
import { LanguageToggle } from "./LanguageToggle";
import { MobileMenu } from "./MobileMenu";

/**
 * Persistent top bar (S12): wordmark · location · language toggle · talk CTA
 * (ghost). Burger menu on mobile.
 */
export function TopBar() {
  const t = useTranslations("nav");

  return (
    <header className="topbar">
      <Link href="/" className="wordmark" data-cursor="hover">
        Zirtuno
      </Link>

      <div className="topbar-desktop">
        <span className="topbar-location">{t("location")}</span>
        <LanguageToggle />
        <CtaTalk variant="ghost" />
      </div>

      <MobileMenu />
    </header>
  );
}
