"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/config";
import { CHAPTERS } from "@/lib/content/chapters";
import { CtaAnalysis } from "@/components/chrome/CtaButton";
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
 * Mobile navigation (S12): burger → full-viewport modal with the 9-chapter
 * index and the canonical analysis CTA. The dialog is portalled out of the
 * blurred TopBar so its fixed positioning is relative to the viewport.
 */
export function MobileMenu() {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const reactId = useId();
  const menuId = `${reactId}-mobile-menu`;
  const titleId = `${reactId}-mobile-menu-title`;
  const closeMenu = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) closeMenu();
    };

    desktopQuery.addEventListener("change", closeAtDesktop);
    return () => desktopQuery.removeEventListener("change", closeAtDesktop);
  }, [closeMenu]);

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    if (!dialog) return;
    const returnFocus = triggerRef.current;

    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const getFocusableElements = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.getClientRects().length > 0,
      );

    const focusFrame = window.requestAnimationFrame(() => {
      (closeRef.current ?? dialog).focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      const focusIsOutside = !dialog.contains(activeElement);

      if (event.shiftKey && (activeElement === first || focusIsOutside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || focusIsOutside)) {
        event.preventDefault();
        first.focus();
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) {
        (closeRef.current ?? dialog).focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn);
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;

      if (returnFocus?.isConnected) {
        returnFocus.focus({ preventScroll: true });
      }
    };
  }, [closeMenu, open]);

  const dialog =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={dialogRef}
            id={menuId}
            className="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            data-lenis-prevent
          >
            <h2 id={titleId} className="sr-only">
              {t("chapterNavigation")}
            </h2>

            <div className="mobile-menu-header">
              <span className="mobile-menu-wordmark" aria-hidden="true">
                Zirtuno
              </span>
              <button
                ref={closeRef}
                type="button"
                className="mobile-menu-close"
                aria-label={t("menuClose")}
                onClick={closeMenu}
                data-cursor="hover"
              >
                <span className="mobile-menu-close-icon" aria-hidden="true">
                  <span />
                  <span />
                </span>
              </button>
            </div>

            <div className="mobile-menu-scroll" data-lenis-prevent>
              <nav className="mobile-menu-nav" aria-labelledby={titleId}>
                {CHAPTERS.map((chapter) => (
                  <Link
                    key={chapter.id}
                    href={`/#${chapter.id}`}
                    className="mobile-menu-link"
                    onClick={closeMenu}
                    data-cursor="hover"
                  >
                    {t(`chapters.${chapter.key}`)}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="mobile-menu-footer">
              <LanguageToggle />
              <div className="mobile-menu-cta" onClick={closeMenu}>
                <CtaAnalysis placement="mobile_menu" />
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        className="burger"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? menuId : undefined}
        aria-label={t("menuOpen")}
        onClick={() => setOpen(true)}
        data-cursor="hover"
      >
        <span />
        <span />
      </button>
      {dialog}
    </div>
  );
}
