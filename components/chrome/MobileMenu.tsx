"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { gsap } from "gsap";
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

/** The collapsed island IS the button: same 44px circle, same place. */
const SEED = 44;

/**
 * Navigation (S12): a circular control that EXPANDS INTO the menu it opens.
 *
 * The button and the panel are one object. Closed, the island is a 44px circle
 * sitting exactly under the trigger; opening grows it into the panel, so the
 * menu arrives from the thing you pressed rather than appearing somewhere else
 * — there is no second element to explain.
 *
 * ORCHESTRATED easeReverse (GSAP 3.15). One timeline, played forward to open
 * and REVERSED to close, but every tween declares its own exit curve. Without
 * that, reversing an animation also reverses its easing — a back.out expansion
 * would retract by first bulging further out, which reads as a bounce the user
 * did not ask for. Here the island swells open on `back.out` and withdraws on a
 * plain `power2.in`, and the contents leave faster than they arrived, so the
 * close feels decisive rather than like the opening played backwards.
 *
 * The dialog keeps its own semantics throughout: role/aria-modal, focus trap,
 * Escape, scroll lock, and focus returned to the trigger on close.
 */
export function MobileMenu() {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const islandRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const reactId = useId();
  const menuId = `${reactId}-mobile-menu`;
  const titleId = `${reactId}-mobile-menu-title`;

  /** Reverse the open timeline, THEN unmount — never cut the exit short. */
  const closeMenu = useCallback(() => {
    const tl = tlRef.current;
    if (!tl) {
      setOpen(false);
      setClosing(false);
      return;
    }
    setClosing(true);
    tl.eventCallback("onReverseComplete", () => {
      setOpen(false);
      setClosing(false);
    });
    // leaving is quicker than arriving — an exit that takes as long as the
    // entrance makes the whole control feel heavy
    tl.timeScale(1.45).reverse();
  }, []);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        // a breakpoint change is not a gesture — drop it, do not play an exit
        tlRef.current = null;
        setOpen(false);
        setClosing(false);
      }
    };
    desktopQuery.addEventListener("change", closeAtDesktop);
    return () => desktopQuery.removeEventListener("change", closeAtDesktop);
  }, []);

  // ── the orchestrated open ──────────────────────────────────────────────────
  useEffect(() => {
    const island = islandRef.current;
    if (!open || !island) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // No expansion, no stagger — the menu is simply THERE. Reduced motion is
      // not "the same animation, faster"; the close path below still works
      // because a null timeline unmounts immediately.
      tlRef.current = null;
      return;
    }

    const ctx = gsap.context(() => {
      // measure the panel at its natural size before collapsing it to the seed
      const w = island.offsetWidth;
      const h = island.offsetHeight;
      const rows = island.querySelectorAll<HTMLElement>("[data-island-row]");

      const tl = gsap.timeline({ paused: true, defaults: { overwrite: "auto" } });

      tl.fromTo(
        island,
        { width: SEED, height: SEED, borderRadius: SEED / 2, opacity: 0 },
        {
          width: w,
          height: h,
          borderRadius: 24,
          opacity: 1,
          duration: 0.58,
          ease: "back.out(1.35)",
          // Withdraw on power2.out, not on a mirrored back.out: reversing the
          // entry curve would make the panel bulge OUTWARD before closing, and
          // an ease-in start makes a dismissal feel like lag. Out-easing leaves
          // immediately and settles into the button.
          easeReverse: "power2.out",
        },
      );

      tl.fromTo(
        rows,
        { autoAlpha: 0, y: 14 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.42,
          stagger: 0.045,
          ease: "power3.out",
          // the rows arrive one after another but leave on one quick curve — a
          // mirrored exit reads as hesitation, and the island is already
          // closing over them
          easeReverse: "power1.out",
        } as gsap.TweenVars,
        0.16,
      );

      tlRef.current = tl;
      tl.play();
    }, island);

    return () => {
      ctx.revert();
      tlRef.current = null;
    };
  }, [open]);

  // ── dialog semantics: focus trap, Escape, scroll lock, focus return ────────
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

            {/* the scrim is a plate for the island, and the outside click */}
            <button
              type="button"
              className="mobile-menu-scrim"
              tabIndex={-1}
              aria-hidden="true"
              onClick={closeMenu}
            />

            <div ref={islandRef} className="mobile-menu-island">
              <div className="mobile-menu-header" data-island-row>
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
                      data-island-row
                    >
                      {t(`chapters.${chapter.key}`)}
                    </Link>
                  ))}
                </nav>
              </div>

              <div className="mobile-menu-footer" data-island-row>
                <LanguageToggle />
                <div className="mobile-menu-cta" onClick={closeMenu}>
                  <CtaAnalysis placement="mobile_menu" />
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  // aria-expanded flips the moment the close is REQUESTED, not when the exit
  // animation finishes — the control's state is what the user just chose.
  const expanded = open && !closing;

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        className="burger"
        aria-expanded={expanded}
        aria-haspopup="dialog"
        aria-controls={expanded ? menuId : undefined}
        aria-label={expanded ? t("menuClose") : t("menuOpen")}
        onClick={() => (expanded ? closeMenu() : setOpen(true))}
        data-cursor="hover"
      >
        <span />
        <span />
      </button>
      {dialog}
    </div>
  );
}
