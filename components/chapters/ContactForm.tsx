"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import {
  contactSchema,
  resolveContactIntent,
  type ContactInput,
  type ContactIntent,
} from "@/lib/forms/contact";
import { trackEvent } from "@/lib/analytics/client";
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
 * S10 — contact form. The labeled submit ("Solicitar análise inicial") is the
 * canonical, always-present action (the metaball exhale is additive, Phase 2).
 * The entry-intent tag arrives via the ?intent= search param (set by the CTAs)
 * and is captured in a hidden field that reaches the team email.
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
  const [intent, setIntent] = useState(initialIntent);
  const fallbackStatus = initialStatus ?? null;
  const [status, setStatus] = useState<ContactStatus>(() =>
    resolveFallbackStatus(fallbackStatus),
  );
  const [errorKind, setErrorKind] = useState<"generic" | "rate_limit">(
    fallbackStatus === "rate_limit" ? "rate_limit" : "generic",
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
    reset,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    // The aggregate summary — not the first offending input — is what receives
    // focus, so a screen reader hears the COMPLETE error state as one event
    // instead of a single field's message.
    shouldFocusError: false,
    defaultValues: { name: "", email: "", company: "", message: "", intent },
  });

  const invalidFields = FIELD_ORDER.filter((field) => errors[field]);
  const invalidCount = invalidFields.length;

  // Every rejected submit moves the reader to the summary, so the complete
  // error state is announced as ONE event. Driven by submitCount rather than by
  // the resolver callback: a second attempt with the same failures must
  // re-announce, and the summary has to exist in the DOM before it is focused.
  useEffect(() => {
    if (submitCount > 0 && invalidCount > 0) summaryRef.current?.focus();
  }, [submitCount, invalidCount]);

  useEffect(() => {
    setValue("intent", intent);
  }, [intent, setValue]);

  useEffect(() => {
    const syncFromUrl = () => {
      setIntent(
        resolveContactIntent(
          new URLSearchParams(window.location.search).get("intent"),
        ),
      );
    };
    const onIntent = (event: Event) => {
      const next = (event as CustomEvent<{ intent?: string }>).detail?.intent;
      setIntent(resolveContactIntent(next));
    };
    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener("zirtuno:intent", onIntent);
    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener("zirtuno:intent", onIntent);
    };
  }, []);

  // Native constraints protect the no-JS form. Once enhanced, React/Zod own
  // localized validation and error announcements instead of browser bubbles.
  useEffect(() => {
    if (formRef.current) formRef.current.noValidate = true;
  }, []);

  async function onSubmit(values: ContactInput) {
    setStatus("idle");
    setErrorKind("generic");
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
        // Additive success gesture only after confirmed delivery;
        // the labeled button remains the canonical action.
        window.dispatchEvent(new CustomEvent("zirtuno:exhale"));
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
        <p className="mt-3 text-body-l text-paper-lead">{t("successBody")}</p>
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
          intent,
        });
      })}
      onFocusCapture={() => {
        if (started.current) return;
        started.current = true;
        trackEvent("contact_start", { intent });
      }}
      className="contact-form"
      aria-busy={isSubmitting}
    >
      {/* The vector liquid over the controls (S10). Purely additive: it draws
          outlines, sets `data-fieldliquid` only once it has drawn, and every
          rule that changes a field is gated on that — so the bordered form
          below survives reduced motion, no-JS and any mount failure intact. */}
      <FieldLiquid />
      <input type="hidden" defaultValue={intent} {...register("intent")} />
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

      {intent !== "general" && (
        <p className="contact-intent">
          {t("intentLabel")}: {t(`intents.${intent}`)}
        </p>
      )}

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

      <div className="field">
        <label htmlFor="contact-name">{t("fields.name")}</label>
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
        <label htmlFor="contact-email">{t("fields.email")}</label>
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
        <label htmlFor="contact-message">{t("fields.message")}</label>
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

      {status === "error" && (
        <p className="contact-error" role="alert">
          {t(errorKind === "rate_limit" ? "rateLimitBody" : "errorBody")}
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
