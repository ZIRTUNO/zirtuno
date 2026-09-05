"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/config";
import { useCtaIntent } from "@/components/chrome/CtaButton";
import { approvedSocials, SOCIAL_MARKS } from "@/lib/content/socials";
import { LanguageToggle } from "./LanguageToggle";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * The same three destinations the bar commits to on desktop (`TopBar`'s
 * `PRIMARY_LINKS`) and the same three the footer's column opens with. The
 * sheet used to list all nine CHAPTERS; the reference's links card carries the
 * PRIMARY nav, and a mobile menu that disagreed with the bar directly above it
 * was the older inconsistency. Contact is absent for the reason it is absent
 * from the bar: it is the CTA at the foot of this sheet, and listing it twice
 * would rank the studio's one conversion action alongside a nav item.
 */
const PRIMARY_LINKS = [
  { key: "home", href: "/" },
  { key: "services", href: "/#services" },
  { key: "work", href: "/work" },
] as const;

/**
 * How long the exit runs before the sheet is inert again — `.nav-sheet`'s
 * 0.55s opacity/visibility pair, which is the slowest thing leaving.
 */
const EXIT_MS = 560;

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

/**
 * S12 · Mobile navigation, rebuilt to the reference experience (upsunday.co —
 * the same source the top bar and the footer were drawn from).
 *
 * THE SHAPE OF IT. A full-bleed sheet carrying a STACK OF CARDS, not a popover:
 * links, then a contact card, then the commit CTA. The bar stays put and stays
 * on top; its trigger morphs from rules to a cross IN PLACE, so nothing about
 * the chrome moves and the sheet arrives underneath the object you pressed.
 * The previous version grew an island out of the button on a GSAP timeline —
 * a good idea for a popover, and the wrong one for a sheet, because a panel
 * that fills the viewport cannot plausibly be the button you touched.
 *
 * THE MOTION IS CSS, KEYED OFF ONE ATTRIBUTE, and the exit is not the entrance
 * reversed. The reference's ladder, transferred exactly (see `.nav-card` in
 * globals.css): the cards arrive top-down at 80 / 180 / 280ms on a 0.7s
 * `cubic-bezier(.16, 1, .3, 1)` from `translateY(34px) rotate(∓4deg)`, and they
 * LEAVE in a different order — contact at 0, CTA at 70, links at 140ms, over
 * 0.55s. Reversing the arrival would send the cards out in the order they came
 * in, which reads as the menu being un-drawn; this reads as it being dismissed.
 * Declaring both directions in CSS is what buys that asymmetry for free — the
 * older GSAP timeline had to spell it out per-tween with `easeReverse`.
 *
 * WHAT IS ZIRTUNO'S RATHER THAN THE REFERENCE'S:
 *   · the palette. The reference sheet is white cards on a white→ice→peach
 *     gradient; the token file opens with "cyan on black only", so the cards
 *     are ink glass with a cyan hairline over a black sheet carrying one cyan
 *     bloom. Same geometry, same radii, same shadow-as-lift, our light.
 *   · the locale switch, which the reference has no equivalent for. It rides
 *     the contact card's bottom row opposite the socials rather than becoming
 *     a fourth card, so the stack stays three tall.
 *   · the CTA is the Talk intent into `#contact`, not a scheduler — and while
 *     that destination is quarantined it renders inert (see card 3). It borrows
 *     `useCtaIntent` from the membrane button so both conversion paths tag and
 *     route identically (see CtaButton).
 *
 * SEMANTICS. This is a DISCLOSURE, not a modal dialog, and deliberately so:
 * the control that closes it is the trigger, which lives in the bar OUTSIDE
 * the sheet. `aria-modal` would hide that trigger from the reader who most
 * needs it. So: `aria-expanded`/`aria-controls` on the button, `inert` on the
 * closed sheet, Escape to dismiss, scroll locked while open, focus moved in on
 * open and returned to the trigger on close, and a Tab cycle that spans
 * [trigger + sheet] so the cross is always one stop away.
 */
export function MobileMenu() {
  const t = useTranslations("nav");
  const tc = useTranslations("cta");
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const exitTimer = useRef<number | null>(null);
  const openedOnce = useRef(false);
  const reactId = useId();
  const menuId = `${reactId}-nav-sheet`;

  const socials = approvedSocials();
  const cta = useCtaIntent({ intent: "talk", placement: "mobile_menu" });

  // The portal needs a document; rendering it only after mount also means the
  // server never ships a sheet that would flash before the attribute lands.
  useEffect(() => setMounted(true), []);

  const closeMenu = useCallback(() => setOpen(false), []);

  // ── the one piece of state, published to the document ─────────────────────
  // `data-nav-open` is what the sheet, the bar's raised stacking order and the
  // trigger's cross all read. `data-nav-closing` outlives it by the length of
  // the exit — the reference's `.nav-closing` — keeping the bar above the
  // sheet while the sheet is still fading out from under it. Without it the
  // bar drops back to z-index 50 on the first frame of the exit and the
  // dissolving sheet paints over the trigger the user just pressed.
  useEffect(() => {
    const root = document.documentElement;
    if (exitTimer.current) window.clearTimeout(exitTimer.current);

    if (open) {
      openedOnce.current = true;
      root.dataset.navOpen = "";
      delete root.dataset.navClosing;
      return;
    }

    delete root.dataset.navOpen;
    // never opened: this is the first render, not a dismissal
    if (!openedOnce.current) return;
    root.dataset.navClosing = "";
    exitTimer.current = window.setTimeout(() => {
      delete root.dataset.navClosing;
    }, EXIT_MS);
  }, [open]);

  useEffect(
    () => () => {
      const root = document.documentElement;
      if (exitTimer.current) window.clearTimeout(exitTimer.current);
      delete root.dataset.navOpen;
      delete root.dataset.navClosing;
    },
    [],
  );

  // A breakpoint change is not a gesture: drop the menu, do not play an exit.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  // ── disclosure behaviour: scroll lock, Escape, focus in / cycle / return ───
  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    const trigger = triggerRef.current;
    if (!sheet) return;

    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    // The trigger IS the close button, and it lives outside the sheet — so the
    // Tab cycle is the trigger followed by the sheet's own stops, not the
    // sheet alone. Trapping inside the sheet would strand a keyboard reader in
    // a menu whose only exit is a key they cannot see.
    const cycle = () => {
      const inSheet = Array.from(
        sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.getClientRects().length > 0);
      return trigger ? [trigger, ...inSheet] : inSheet;
    };

    // Focus the SHEET, not its first link. Both fix the reading order for a
    // screen reader — the sheet is portalled to <body>, so without this it does
    // not follow the trigger in DOM order — but focusing a link also paints its
    // `:focus-visible` ring, and a thumb-opened menu that lights up a 2px cyan
    // box around HOME is not what the reference does and not what the user
    // asked for. A `tabindex="-1"` container takes programmatic focus without
    // matching `:focus-visible`, so the reading order is fixed and nothing is
    // drawn. Tab from here enters the cycle at the trigger — the cross — which
    // is exactly where the reference's close button sits.
    const focusFrame = window.requestAnimationFrame(() => {
      sheet.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "Tab") return;

      const stops = cycle();
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;
      const outside = !stops.includes(active as HTMLElement);

      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [closeMenu, open]);

  const sheet = (
    <div
      ref={sheetRef}
      id={menuId}
      className="nav-sheet"
      tabIndex={-1}
      aria-hidden={!open}
      // `inert` is what actually removes the closed sheet from the tab order
      // and the a11y tree while it stays in the DOM — and it has to stay in
      // the DOM, because an unmounted element cannot play an exit transition.
      inert={!open}
      data-lenis-prevent
    >
      <div className="nav-sheet-inner" data-lenis-prevent>
        {/* Card 1 — where to go */}
        <nav
          className="nav-card nav-card-links"
          aria-label={t("primaryNavigation")}
        >
          {PRIMARY_LINKS.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className="nav-sheet-link"
              onClick={closeMenu}
              data-cursor="hover"
            >
              {t(`links.${link.key}`)}
            </Link>
          ))}
        </nav>

        {/* Card 2 — the direct line */}
        <section className="nav-card nav-card-contact" aria-label={t("talk")}>
          <h2 className="nav-card-title">{t("talk")}</h2>

          {CONTACT_EMAIL ? (
            <a
              className="nav-mail"
              href={`mailto:${CONTACT_EMAIL}`}
              data-cursor="hover"
              data-analytics-event="direct_contact"
              data-analytics-channel="email"
            >
              <span className="nav-mail-addr">{CONTACT_EMAIL}</span>
              <span className="nav-mail-send" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h13M13 6l6 6-6 6" />
                </svg>
              </span>
            </a>
          ) : null}

          <div className="nav-card-base">
            {socials.length > 0 ? (
              <ul className="nav-socials">
                {socials.map((social) => (
                  <li key={social.key}>
                    <a
                      className="nav-social"
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
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
            ) : null}
            <LanguageToggle />
          </div>
        </section>

        {/* Card 3 — the commit. Live again since 2026-09-05: it routes to
            `/contact` with the `talk` tag and closes the sheet behind it.

            The inert branch below is retained, not dead weight — it is what
            `INTENT_DESTINATION_READY` (in CtaButton) renders if the endpoint
            is ever switched off again, and it must NOT close the sheet on tap,
            because a sheet that dismisses itself and lands nowhere reads as a
            swallowed action. The rule already sets `border: 0`, its own
            background and font, so the button and the anchor are
            pixel-identical either way. */}
        {cta.pending ? (
          <button
            type="button"
            aria-disabled="true"
            data-cta-pending=""
            className="nav-sheet-cta"
            data-cursor="hover"
            {...cta.analytics}
          >
            <span className="nav-sheet-cta-label">{tc("talk")}</span>
            <span className="nav-sheet-cta-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
            </span>
          </button>
        ) : (
        <Link
          href={cta.href}
          className="nav-sheet-cta"
          data-cursor="hover"
          {...cta.analytics}
          onClick={(event) => {
            cta.onClick(event);
            closeMenu();
          }}
        >
          <span className="nav-sheet-cta-label">{tc("talk")}</span>
          <span className="nav-sheet-cta-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h13M13 6l6 6-6 6" />
            </svg>
          </span>
        </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        className="burger"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? t("menuClose") : t("menuOpen")}
        onClick={() => setOpen((was) => !was)}
        data-cursor="hover"
      >
        {/*
          THE TRIGGER MORPHS IN PLACE — one path, a travelling dash window.

          `.burger-curl` is a single continuous stroke: the top rule (26,10) →
          (12,10), a 270° loop up and over, the SPINE straight down (16,6) →
          (16,26), a second 270° loop, then the bottom rule out to (6,22).
          Arc length runs 14 + 6π + 20 + 6π + 14 ≈ 85.7, so the spine occupies
          exactly [32.85, 52.85] along it.

          At rest the dash window shows the first 12 units, which lie under the
          top rule and are therefore invisible — you see three plain bars. Open,
          the window becomes 20 long at offset -32.85: precisely the spine, and
          nothing else. Because the window SLIDES, the stroke appears to travel
          around the loop to get there. Then the whole icon rotates -45°, the
          two straight bars fade, and the static middle rule plus the revealed
          spine — both 20 long, both centred on (16,16) — cross into an X.

          Nothing is morphed and no path data is interpolated; it is one dash
          offset and one rotation. See `.burger-curl` in globals.css.
        */}
        <svg
          className="burger-icon"
          viewBox="0 0 32 32"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path
            className="burger-curl"
            d="M26 10 H12 A4 4 0 1 1 16 6 V26 A4 4 0 1 0 20 22 H6"
          />
          <line className="burger-bar" x1="6" y1="10" x2="26" y2="10" />
          <path d="M6 16 H26" />
          <line className="burger-bar" x1="6" y1="22" x2="26" y2="22" />
        </svg>
      </button>
      {mounted ? createPortal(sheet, document.body) : null}
    </div>
  );
}
