import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/config";
import { LogoMark } from "@/components/hero/LogoMark";
import { CtaButton } from "./CtaButton";
import { LanguageToggle } from "./LanguageToggle";
import { MobileMenu } from "./MobileMenu";
import { TopBarShell } from "./TopBarShell";

/**
 * The three destinations the chrome commits to, and the same three the footer's
 * `COMPANY_LINKS` opens with — a reader who meets "Serviços" at the top of the
 * page must land where "Serviços" at the bottom of it lands. Contact is absent
 * on purpose: it is the CTA, and listing it twice would rank the studio's one
 * conversion action alongside a nav item.
 */
const PRIMARY_LINKS = [
  { key: "home", href: "/" },
  { key: "services", href: "/#services" },
  { key: "work", href: "/work" },
] as const;

/**
 * Persistent top bar (S12), rebuilt to the reference chrome's geometry
 * (upsunday.co — the same source the footer was drawn from): a FLOATING bar,
 * inset from all three edges, rather than a full-bleed strip welded to the top
 * of the viewport. Three zones — brand · centred nav · action — where the
 * middle one is centred on the BAR, not on what is left over between its
 * neighbours (see `.topbar-nav` in globals.css).
 *
 * What is Zirtuno's rather than the reference's:
 *   · the plate is ink glass, not white glass (AGENTS.md §4.8 — cyan on black),
 *     and it densifies on scroll instead of merely gaining a shadow, because
 *     over a live canvas the resting state has to stay see-through;
 *   · the mark leads the wordmark, so the chrome carries the brand form the
 *     whole page is built out of;
 *   · the link underline wipes in cyan, on `--ease-arrive`, which is the same
 *     curve the reference uses (0.22, 1, 0.36, 1) — it was already ours;
 *   · the action is the MEMBRANE CTA, and it stays a sharp rectangle inside the
 *     rounded bar. That is not an oversight: `lib/motion/membrane.mjs` fixes the
 *     rest contour as an engineered rectangle by art direction, and rounding it
 *     here would both contradict that and desync the vector outline from the
 *     CSS box it traces.
 *   · no entry stagger. The reference fades its nav in behind the hero; this
 *     site already has `EntryVeil` for arrival, and fade reveals are not the
 *     house language.
 *
 * The city label the bar used to carry moved out — the footer's colophon is
 * where the studio says where it is. The locale switch stays: it is the only
 * route to the other language from a page's top.
 */
export function TopBar() {
  const t = useTranslations("nav");

  return (
    <TopBarShell>
      <Link href="/" className="topbar-brand" data-cursor="hover">
        <LogoMark className="topbar-mark" />
        <span className="wordmark">Zirtuno</span>
      </Link>

      <nav className="topbar-nav" aria-label={t("primaryNavigation")}>
        {PRIMARY_LINKS.map((link) => (
          <Link
            key={link.key}
            href={link.href}
            className="topbar-link"
            data-cursor="hover"
          >
            {t(`links.${link.key}`)}
          </Link>
        ))}
      </nav>

      <div className="topbar-actions">
        <LanguageToggle />
        {/* The Talk intent with the compact label: same destination, same
            tagging, a chip that fits the bar (see `talkShort` in CtaButton). */}
        <CtaButton intent="talk" labelKey="talkShort" placement="topbar" />
      </div>

      <MobileMenu />
    </TopBarShell>
  );
}
