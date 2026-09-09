"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CONTACT_TRACKS, type ContactTrackId } from "@/lib/forms/contact";
import { Link } from "@/lib/i18n/config";
import { ContactGlass } from "./ContactGlass";
import { ContactTrackForm } from "./ContactTrackForm";

/* ───────────────────────────────────────────────────────────────────────────
   THE CARD — one instrument, three faces.
   ---------------------------------------------------------------------------
   The reference page's contact card does two things at once when a tab is
   picked, and doing BOTH is what makes it read as one object reshaping rather
   than as content being swapped:

     · a track of full-width panels slides by exactly one panel width, and
     · the window they sit in animates its HEIGHT to the incoming panel's,

   on the same 500 ms `cubic-bezier(.4, 0, .2, 1)`. Nothing fades. That last
   part is the reason this composition suits this site at all — the house rule
   is that a reveal is never an opacity ramp, and there is not one in here.

   ── Why radios and not `role="tab"` ──────────────────────────────────────
   The reference uses buttons with `role="tab"` driven by React state, so with
   JavaScript off it is a card showing one hard-coded panel and two tabs that
   do nothing. Here the switch is a real radio group: the slide, the pill and
   which panel is reachable are all CSS reading `:checked`, so the whole card
   works before hydration and without JavaScript at all. It is also the more
   truthful control — these are three DIFFERENT forms, not three views of one,
   and a radio group is what "pick one of these" means natively.

   JavaScript adds exactly one thing on top: the animated height. Without it
   the window is `auto`, which is the tallest panel — correct, just not as
   quiet. The `data-measured` flag is what hands the height over, and it is set
   only once a measurement has actually been written.
   ─────────────────────────────────────────────────────────────────────────── */

type ContactStatus = "idle" | "success" | "pending" | "error";

function resolveFallbackStatus(value: string | null): ContactStatus {
  if (value === "success" || value === "pending") return value;
  return value === "error" || value === "rate_limit" ? "error" : "idle";
}

function Arrow() {
  return (
    <svg viewBox="0 0 32 16" aria-hidden="true" className="contact-arrow">
      <path
        d="M1 8h28M22 1l7 7-7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

export function ContactForm({
  initialTrack,
  initialStatus,
}: {
  initialTrack: ContactTrackId;
  initialStatus?: string | null;
}) {
  const t = useTranslations("contact");
  const group = `contact-track-${useId().replace(/:/g, "")}`;
  const arrival = initialTrack;

  /**
   * A careers arrival adds its own track, and only then. Someone who came to
   * hire the studio is not offered a job application as a fourth tab; someone
   * who came from /careers still gets the three commercial ones, because the
   * link that brought them may simply have been the nearest way to reach a
   * form.
   */
  const tracks: readonly ContactTrackId[] =
    arrival === "careers" ? [...CONTACT_TRACKS, "careers"] : CONTACT_TRACKS;

  const [active, setActive] = useState<ContactTrackId>(arrival);
  const [status, setStatus] = useState<ContactStatus>(() =>
    resolveFallbackStatus(initialStatus ?? null),
  );
  const viewRef = useRef<HTMLDivElement>(null);
  const outcomeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "success") outcomeRef.current?.focus();
  }, [status]);

  /**
   * THE WINDOW'S HEIGHT — measured, never guessed.
   *
   * `ResizeObserver` on the active panel rather than a one-off read, because
   * the panel grows on its own: a validation message appears, the textarea is
   * dragged taller, a font swaps. Each of those has to move the card's bottom
   * edge with it or the panel is clipped by the very `overflow: hidden` that
   * makes the slide possible.
   */
  useEffect(() => {
    const view = viewRef.current;
    const slot = view?.querySelector<HTMLElement>(
      `[data-slot-track="${active}"]`,
    );
    if (!view || !slot) return;
    const apply = () => {
      view.style.height = `${slot.offsetHeight}px`;
      view.dataset.measured = "";
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(slot);
    return () => ro.disconnect();
  }, [active]);

  if (status === "success") {
    return (
      <div
        className="contact-success"
        role="status"
        tabIndex={-1}
        ref={outcomeRef}
      >
        <div className="contact-receipt-seal" aria-hidden="true">
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="46" />
            <path d="M39 61l14 14 29-31" />
          </svg>
        </div>
        <p className="contact-overline">{t("receipt")}</p>
        <h2 className="contact-success-title">{t("successTitle")}</h2>
        <p className="contact-success-body">{t("successBody")}</p>
        <p className="contact-receipt-next">{t("receiptNext")}</p>
        <Link href="/" className="contact-success-return" data-cursor="hover">
          {t("successReturn")} <Arrow />
        </Link>
      </div>
    );
  }

  return (
    <div className="contact-card" style={{ ["--tabs" as string]: tracks.length }}>
      <fieldset className="contact-tabbar">
        <legend className="sr-only">{t("tabsLabel")}</legend>
        {/* The travelling pill. It is one element that moves, not a background
            that lights up per tab — the same reason the old chip group used a
            single lens: two surfaces cross-fading is a fade, and one surface
            moving is a machine. */}
        <span className="contact-tabpill" aria-hidden="true">
          <ContactGlass />
        </span>
        {tracks.map((track) => (
          <label className="contact-tab" key={track} data-cursor="hover">
            <input
              type="radio"
              name={group}
              value={track}
              checked={active === track}
              onChange={() => setActive(track)}
            />
            <span>{t(`tracks.${track}`)}</span>
          </label>
        ))}
      </fieldset>

      <div className="contact-track-view" ref={viewRef}>
        <div className="contact-track">
          {tracks.map((track) => (
            <div
              className="contact-slot"
              data-slot-track={track}
              // THE COMPANION READS THIS to know which of the three forms the
              // visitor is actually in — see `Companion.tsx`, which resolves
              // `.contact-slot[data-active] form`. It is not what makes a panel
              // visible: the hiding is CSS on `:checked`, so the no-JS path
              // never depended on an attribute React writes.
              data-active={active === track ? "" : undefined}
              key={track}
            >
              <ContactTrackForm
                track={track}
                initialStatus={
                  // A no-JS POST redirects back with `?contact=` and no way to
                  // say which form sent it. The arrival track is the only
                  // honest guess, and it is the one the visitor was looking at.
                  track === arrival ? resolveFallbackStatus(initialStatus ?? null) : "idle"
                }
                onDelivered={() => setStatus("success")}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
