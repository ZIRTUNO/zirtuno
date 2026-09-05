import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/config";
import { LogoMark } from "@/components/hero/LogoMark";
import { LEGAL_DOCS } from "@/lib/content/legal";
import { approvedSocials, SOCIAL_MARKS } from "@/lib/content/socials";

/** The homepage chapters worth a direct line from the page's end. */
const COMPANY_LINKS = [
  { key: "home", href: "/" },
  { key: "services", href: "/#services" },
  { key: "work", href: "/work" },
  // `/careers`, not `/work-with-us`: `/work` is already the PORTFOLIO, and two
  // routes whose names both start "work" would be a coin flip for anyone
  // scanning the column. The label carries the meaning; the slug stays plain.
  { key: "careers", href: "/careers" },
  // Last in the column and untagged. Every OTHER route to the form carries an
  // `?intent=`; this one is the colophon's plain door, and a visitor who takes
  // it lands on `general` and picks for themselves.
  { key: "contact", href: "/contact" },
] as const;

/**
 * S11 · The footer — the page's colophon, and the last thing the liquid
 * touches. ONE raised glass panel on the shell column, running flush off the
 * bottom of the document with only its top corners rounded, so the page
 * visibly ends ON an object rather than floating above a last strip of black.
 *
 * The structure is a direct port of the reference footer's — brand stack ·
 * two link columns · rule · base row — and so is its geometry, because both
 * sit on the same 75.24vw column (see the FOOTER block in `app/globals.css`
 * for what is and is not carried over). The `.footer-logo` wrapper is part of
 * that port and not incidental markup: the reference sets a different gap
 * between mark and wordmark than between wordmark and tagline, which needs
 * the two to be their own flex box.
 *
 * The element keeps its `.footer` class because two things read it:
 * `lib/webgl/scenes/footer.ts` anchors the closing exposure/vignette curve on
 * its rect, and `TopBarShell` watches it to raise `data-footer-coda`. Neither
 * depends on the panel's padding — the scene is `forms: []` and detaches
 * nothing over the footer. It was written when contact's held mark WAS the
 * coda; S10 left the homepage on 2026-09-04 and came back as its own route on
 * 2026-09-05, so the footer's only liquid is still that closing light grade —
 * but the column carries a contact line again, pointing at `/contact` rather
 * than at a homepage anchor.
 *
 * Content answers build-spec 6.10 (Zirtuno/copyright, language, approved
 * social paths, Talk CTA) and adds the two link columns the colophon needs to
 * be navigable from the page's end.
 */
export function Footer() {
  const t = useTranslations("footer");
  const socials = approvedSocials();

  return (
    <footer className="footer">
      <div className="footer-panel">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="footer-logo">
              <LogoMark className="footer-mark" />
              {/* The signature glass fill, at colophon scale — the same
                  treatment the section titles wear, so the sign-off is
                  recognisably the same voice that opened the page. */}
              <p className="footer-wordmark liquid-glass">Zirtuno</p>
            </div>
            <p className="footer-tagline">
              {t("taglineLead")}
              <br />
              {t("tagline")}
            </p>
          </div>

          <nav className="footer-columns" aria-label={t("navLabel")}>
            <div className="footer-col">
              <h2 className="footer-col-title">{t("company")}</h2>
              <ul className="footer-col-list">
                {COMPANY_LINKS.map((link) => (
                  <li key={link.key}>
                    <Link
                      href={link.href}
                      className="footer-link"
                      data-cursor="hover"
                    >
                      {t(`links.${link.key}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="footer-col">
              <h2 className="footer-col-title">{t("legal")}</h2>
              <ul className="footer-col-list">
                {LEGAL_DOCS.map((doc) => (
                  <li key={doc.slug}>
                    <Link
                      href={`/legal/${doc.slug}`}
                      className="footer-link"
                      data-cursor="hover"
                    >
                      {t(`links.${doc.key}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>

        <hr className="footer-rule" />

        <div className="footer-base">
          <span className="footer-copy">{t("copyright")}</span>
          {socials.length > 0 && (
            <ul className="footer-socials">
              {socials.map((social) => (
                <li key={social.key}>
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-social"
                    aria-label={social.label}
                    data-cursor="hover"
                    data-analytics-event="direct_contact"
                    data-analytics-channel={social.key}
                  >
                    {SOCIAL_MARKS[social.key]}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </footer>
  );
}
