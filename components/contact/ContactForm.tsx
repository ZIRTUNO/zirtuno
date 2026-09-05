"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import {
  contactSchema,
  type ContactInput,
  type ContactIntent,
} from "@/lib/forms/contact";
import { trackEvent } from "@/lib/analytics/client";
import { Link } from "@/lib/i18n/config";
import { Membrane } from "@/components/chrome/Membrane";
import { FieldLiquid } from "./FieldLiquid";

function isConfirmedDelivery(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const response = value as Record<string, unknown>;
  return response.ok === true && response.delivered === true;
}

function isPendingDelivery(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const response = value as Record<string, unknown>;
  return (
    response.ok === true &&
    response.accepted === true &&
    response.delivered === false &&
    response.pending === true
  );
}

const ERROR_IDS = {
  name: "contact-name-error",
  email: "contact-email-error",
  message: "contact-message-error",
} as const;

// The summary lists errors in the form's own reading order, never in the order
// the resolver happened to report them.
const FIELD_ORDER = ["name", "email", "message"] as const;

/**
 * The intents a visitor can pick for themselves.
 *
 * `careers` is deliberately absent: applications come from `/careers`, which
 * routes here with `?intent=careers` already set, and offering "work with us"
 * as a fifth chip on a commercial enquiry page invites the wrong traffic into
 * the wrong queue. An arriving careers tag is honoured and shown (see
 * `chosenIntents` below) — it just is not on the menu.
 */
const CHOOSABLE_INTENTS = [
  "analysis",
  "structure",
  "talk",
  "general",
] as const satisfies readonly ContactIntent[];

type SubmissionAttempt = {
  id: string;
  fingerprint: string;
};

type ContactStatus = "idle" | "success" | "pending" | "error";

function resolveFallbackStatus(value: string | null): ContactStatus {
  if (value === "success" || value === "pending") return value;
  if (value === "error" || value === "rate_limit") return "error";
  return "idle";
}

/**
 * S10 — the contact form, as the instrument on its own page.
 *
 * Carried over from the quarantined homepage chapter with its delivery
 * contract intact: react-hook-form + the shared Zod schema, the honeypot, the
 * aggregate error summary, the confirmed / pending / failed states, the
 * native `action` + `method` that make it work with no JavaScript at all, and
 * the conversion tagging on every outcome. None of that was rebuilt, because a
 * conversion path rebuilt from scratch is a conversion path that has to be
 * re-verified from scratch.
 *
 * TWO THINGS ARE NEW, and both come from the page rather than the chapter.
 *
 * THE INTENT IS VISIBLE. Nine CTAs across the site carry an `?intent=` tag
 * (build-spec S1.15). In the chapter that tag landed in a hidden input and the
 * visitor never learned it had been remembered; here it arrives PRE-SELECTED
 * in a real radio group, so someone who pressed "Solicitar análise inicial"
 * sees the page agree with them, and someone who arrived cold segments
 * themselves. Same field, same enum, same email — it just stopped being a
 * secret.
 *
 * THE EXHALE IS GONE. The chapter dispatched `zirtuno:exhale` on confirmed
 * delivery and `PageStage` drove the S10 liquid scene from it. This page has
 * no `PageStage` and no WebGL stage at all (see the header of
 * `app/contact.css` for why), so the dispatch had no receiver. An event fired
 * into nothing is not a feature kept warm, it is a lie about what happens on
 * success — the received state below is the whole gesture now.
 */
export function ContactForm({
  initialIntent,
  initialStatus,
}: {
  initialIntent: ContactIntent;
  initialStatus?: string | null;
}) {
  const t = useTranslations("contact");
  const locale = useLocale();
  const fallbackStatus = initialStatus ?? null;
  const [status, setStatus] = useState<ContactStatus>(() =>
    resolveFallbackStatus(fallbackStatus),
  );
  const [errorKind, setErrorKind] = useState<"generic" | "rate_limit">(
    fallbackStatus === "rate_limit" ? "rate_limit" : "generic",
  );
  // DID THE FIELDS SURVIVE? The error and rate-limit copy promises "your
  // details were kept", which is true on the enhanced path — React still holds
  // every value and the visitor only has to press the button again — and FALSE
  // on the native one, where the route answers with a 303 and the browser
  // arrives at an empty form. Same status, opposite advice, and the visitor who
  // gets the wrong version is the one with no JavaScript to recover with.
  //
  // A status that came from the URL is by definition the redirect path. Any
  // client submit clears this, because from then on React owns the values.
  const [statusFromRedirect, setStatusFromRedirect] = useState(
    () => resolveFallbackStatus(fallbackStatus) !== "idle",
  );
  const [website, setWebsite] = useState("");
  const [submissionAttempt, setSubmissionAttempt] =
    useState<SubmissionAttempt | null>(null);
  const started = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    // The aggregate summary — not the first offending input — is what receives
    // focus, so a screen reader hears the COMPLETE error state as one event
    // instead of a single field's message.
    shouldFocusError: false,
    defaultValues: {
      name: "",
      email: "",
      company: "",
      message: "",
      intent: initialIntent,
    },
  });

  // NO `watch("intent")` HERE, and nothing is lost by that.
  //
  // The selected chip is styled by `.contact-choice-option input:checked + span`
  // — pure CSS off the radio's own state — so the render does not need to know
  // which intent is current, and the two places that DO need it are both event
  // handlers that can read it at the moment they fire. React Hook Form's
  // `watch()` returns a function the React Compiler cannot memoize, so a render
  // -time subscription would opt this whole component out of compilation to
  // buy a value only handlers use.
  //
  // An arriving `careers` tag gets a chip of its own so the group can show the
  // state it is actually in. Without this the radio group would render with
  // nothing checked while a hidden value said otherwise, which is the one
  // failure mode a visible chooser exists to prevent.
  const chosenIntents: readonly ContactIntent[] =
    initialIntent === "careers"
      ? (["careers", ...CHOOSABLE_INTENTS] as const)
      : CHOOSABLE_INTENTS;

  const invalidFields = FIELD_ORDER.filter((field) => errors[field]);
  const invalidCount = invalidFields.length;

  // Every rejected submit moves the reader to the summary, so the complete
  // error state is announced as ONE event. Driven by submitCount rather than by
  // the resolver callback: a second attempt with the same failures must
  // re-announce, and the summary has to exist in the DOM before it is focused.
  useEffect(() => {
    if (submitCount > 0 && invalidCount > 0) summaryRef.current?.focus();
  }, [submitCount, invalidCount]);

  // THE CHOOSER HAS TO FOLLOW THE URL, and `defaultValues` alone cannot make
  // it. On `/contact` the intent CTAs are same-route navigations — the top
  // bar's chip from `/contact?intent=analysis` goes to `/contact?intent=talk`
  // — and Next re-renders the server component without remounting this one, so
  // a new `initialIntent` would arrive as a prop while the form still showed
  // the chip it mounted with. Keying on the prop rather than listening for
  // `popstate` covers back/forward too: the App Router handles popstate itself
  // and re-renders the page, which is the same signal arriving the same way.
  //
  // The dependency is the VALUE, so a re-render for any other reason does not
  // fire this and cannot overwrite a chip the visitor picked by hand.
  useEffect(() => {
    setValue("intent", initialIntent);
  }, [initialIntent, setValue]);

  // Native constraints protect the no-JS form. Once enhanced, React/Zod own
  // localized validation and error announcements instead of browser bubbles.
  useEffect(() => {
    if (formRef.current) formRef.current.noValidate = true;
  }, []);

  async function onSubmit(values: ContactInput) {
    setStatus("idle");
    setErrorKind("generic");
    setStatusFromRedirect(false);
    trackEvent("contact_submit", { intent: values.intent, outcome: "attempt" });
    const fingerprint = JSON.stringify(values);
    const attempt =
      submissionAttempt?.fingerprint === fingerprint
        ? submissionAttempt
        : { id: crypto.randomUUID(), fingerprint };
    setSubmissionAttempt(attempt);
    const submissionId = attempt.id;
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, website, submissionId }),
      });
      const json: unknown = await res.json();
      if (res.ok && isConfirmedDelivery(json)) {
        trackEvent("contact_submit", {
          intent: values.intent,
          outcome: "delivered",
        });
        setSubmissionAttempt(null);
        reset();
        setStatus("success");
      } else if (res.status === 202 && isPendingDelivery(json)) {
        trackEvent("contact_submit", {
          intent: values.intent,
          outcome: "pending",
        });
        setStatus("pending");
      } else {
        const reason =
          json && typeof json === "object" && "error" in json
            ? String((json as { error: unknown }).error)
            : `http_${res.status}`;
        trackEvent("contact_submit", {
          intent: values.intent,
          outcome: "failed",
          reason,
        });
        setErrorKind(reason === "rate_limit" ? "rate_limit" : "generic");
        setStatus("error");
      }
    } catch {
      trackEvent("contact_submit", {
        intent: values.intent,
        outcome: "failed",
        reason: "network",
      });
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="contact-success" role="status">
        <p className="contact-success-title">{t("successTitle")}</p>
        <p className="contact-success-body">{t("successBody")}</p>
        <Link href="/" className="contact-success-return" data-cursor="hover">
          {t("successReturn")}
        </Link>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={`/api/contact?locale=${locale}`}
      method="post"
      onSubmit={handleSubmit(onSubmit, (fieldErrors) => {
        trackEvent("contact_validation_failed", {
          fields: Object.keys(fieldErrors).sort().join(","),
          intent: getValues("intent"),
        });
      })}
      onFocusCapture={() => {
        if (started.current) return;
        started.current = true;
        trackEvent("contact_start", { intent: getValues("intent") });
      }}
      className="contact-form"
      aria-busy={isSubmitting}
    >
      {/* The vector liquid over the controls (S10). Purely additive: it draws
          outlines, sets `data-fieldliquid` only once it has drawn, and every
          rule that changes a field is gated on that — so the bordered form
          below survives reduced motion, no-JS and any mount failure intact. */}
      <FieldLiquid />

      <div className="contact-honeypot" aria-hidden="true">
        <label htmlFor="contact-website">{t("fields.websiteTrap")}</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.currentTarget.value)}
        />
      </div>

      {/* THE CHOOSER. A real `<fieldset>` with a real `<legend>` and real
          radios, so the group announces as a group, arrow keys move through it,
          and the browser restores the selection on a back navigation with no
          JavaScript involved. */}
      <fieldset className="contact-choice">
        <legend className="contact-choice-legend">{t("intentHeading")}</legend>
        <p className="contact-choice-hint">{t("intentHint")}</p>
        <div className="contact-choice-list">
          {chosenIntents.map((option) => (
            <label key={option} className="contact-choice-option">
              {/* `defaultChecked` puts the selection in the SERVER HTML.
                  Without it the only thing choosing a chip is react-hook-form's
                  `defaultValues`, which cannot run until hydration — so the
                  markup shipped with no radio checked at all. Two real
                  consequences, not just a flash of unselected chips: the no-JS
                  native POST would have submitted no `intent` and the tag would
                  have been silently downgraded to "general" by the route's
                  fallback, and the `?intent=` handshake the whole CTA system
                  spends would have been invisible to anything reading the
                  document before hydration. RHF still owns the value after it
                  mounts; this only makes the first paint agree with it. */}
              <input
                type="radio"
                value={option}
                defaultChecked={option === initialIntent}
                data-cursor="hover"
                {...register("intent")}
              />
              <span>{t(`intents.${option}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="contact-form-heading">{t("formHeading")}</p>

      {/* The aggregate error announcement (R5-E). Per-field `aria-describedby`
          messages stay exactly where they are — this adds the ONE event that
          was missing: the complete error state, announced and focused, with a
          direct route to each offending field. */}
      {invalidCount > 0 && (
        <div
          ref={summaryRef}
          role="alert"
          tabIndex={-1}
          className="contact-error-summary"
        >
          <p className="contact-error-summary-title">
            {t("errorSummaryTitle", { count: invalidCount })}
          </p>
          <ul>
            {invalidFields.map((field) => (
              <li key={field}>
                <a
                  href={`#contact-${field}`}
                  onClick={(event) => {
                    event.preventDefault();
                    document.getElementById(`contact-${field}`)?.focus();
                  }}
                >
                  {t(`validation.${field}`)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Name and email paired, the reference's own grouping. The asterisk is
          `aria-hidden` over a real `required` — a screen reader should hear the
          field's required state once, from the field, not the word "asterisk"
          after every label. */}
      <div className="contact-row">
        <div className="field">
          <label htmlFor="contact-name">
            {t("fields.name")}
            <span className="field-required" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="contact-name"
            autoComplete="name"
            placeholder={t("fields.namePlaceholder")}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? ERROR_IDS.name : undefined}
            required
            minLength={2}
            maxLength={120}
            {...register("name")}
          />
          {errors.name && (
            <span id={ERROR_IDS.name} className="field-error">
              {t("validation.name")}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor="contact-email">
            {t("fields.email")}
            <span className="field-required" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="contact-email"
            type="email"
            autoComplete="email"
            placeholder={t("fields.emailPlaceholder")}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? ERROR_IDS.email : undefined}
            required
            maxLength={254}
            {...register("email")}
          />
          {errors.email && (
            <span id={ERROR_IDS.email} className="field-error">
              {t("validation.email")}
            </span>
          )}
        </div>
      </div>

      <div className="field">
        <label htmlFor="contact-company">{t("fields.company")}</label>
        <input
          id="contact-company"
          autoComplete="organization"
          placeholder={t("fields.companyPlaceholder")}
          maxLength={160}
          {...register("company")}
        />
      </div>

      <div className="field">
        <label htmlFor="contact-message">
          {t("fields.message")}
          <span className="field-required" aria-hidden="true">
            *
          </span>
        </label>
        <textarea
          id="contact-message"
          rows={5}
          placeholder={t("fields.messagePlaceholder")}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? ERROR_IDS.message : undefined}
          required
          minLength={10}
          maxLength={4000}
          {...register("message")}
        />
        {errors.message && (
          <span id={ERROR_IDS.message} className="field-error">
            {t("validation.message")}
          </span>
        )}
      </div>

      <button
        type="submit"
        className="cta cta-primary"
        disabled={isSubmitting || status === "pending"}
        data-cursor="hover"
      >
        <span className="cta-fill" aria-hidden="true" />
        <Membrane filled />
        <span className="cta-label cta-label-ink" aria-hidden="true">
          {isSubmitting
            ? t("sending")
            : status === "pending"
              ? t("receivedPending")
              : t("submit")}
        </span>
        <span className="cta-label">
          {isSubmitting
            ? t("sending")
            : status === "pending"
              ? t("receivedPending")
              : t("submit")}
        </span>
      </button>

      <p className="contact-privacy">
        {t("privacyNote")}{" "}
        <Link href="/legal/privacy" data-cursor="hover">
          {t("privacyLink")}
        </Link>
      </p>

      {status === "error" && (
        <p className="contact-error" role="alert">
          {t(
            errorKind === "rate_limit"
              ? statusFromRedirect
                ? "rateLimitBodyLost"
                : "rateLimitBody"
              : statusFromRedirect
                ? "errorBodyLost"
                : "errorBody",
          )}
        </p>
      )}
      {status === "pending" && (
        <p className="contact-pending" role="status">
          {t("pendingBody")}
        </p>
      )}
    </form>
  );
}
