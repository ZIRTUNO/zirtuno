"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  contactSchema,
  CONTACT_INTENTS,
  type ContactInput,
  type ContactIntent,
} from "@/lib/forms/contact";
import { trackEvent } from "@/lib/analytics/client";

function resolveIntent(value: string | null): ContactIntent {
  return (CONTACT_INTENTS as readonly string[]).includes(value ?? "")
    ? (value as ContactIntent)
    : "general";
}

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

type SubmissionAttempt = {
  id: string;
  fingerprint: string;
};

/**
 * S10 — contact form. The labeled submit ("Solicitar análise inicial") is the
 * canonical, always-present action (the metaball exhale is additive, Phase 2).
 * The entry-intent tag arrives via the ?intent= search param (set by the CTAs)
 * and is captured in a hidden field that reaches the team email.
 */
export function ContactForm() {
  const t = useTranslations("contact");
  const searchParams = useSearchParams();
  const intent = resolveIntent(searchParams.get("intent"));
  const [status, setStatus] = useState<
    "idle" | "success" | "pending" | "error"
  >("idle");
  const [errorKind, setErrorKind] = useState<"generic" | "rate_limit">(
    "generic",
  );
  const [website, setWebsite] = useState("");
  const [submissionAttempt, setSubmissionAttempt] =
    useState<SubmissionAttempt | null>(null);
  const started = useRef(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", company: "", message: "", intent },
  });

  useEffect(() => {
    setValue("intent", intent);
  }, [intent, setValue]);

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
        <p className="mt-3 text-body-l text-paper-mute">{t("successBody")}</p>
      </div>
    );
  }

  return (
    <form
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
      noValidate
      aria-busy={isSubmitting}
    >
      <input type="hidden" {...register("intent")} />
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

      <div className="field">
        <label htmlFor="contact-name">{t("fields.name")}</label>
        <input
          id="contact-name"
          autoComplete="name"
          placeholder={t("fields.namePlaceholder")}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? ERROR_IDS.name : undefined}
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
