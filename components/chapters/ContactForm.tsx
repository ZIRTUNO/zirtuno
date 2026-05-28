"use client";

import { useEffect, useState } from "react";
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

function resolveIntent(value: string | null): ContactIntent {
  return (CONTACT_INTENTS as readonly string[]).includes(value ?? "")
    ? (value as ContactIntent)
    : "general";
}

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
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

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
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        reset();
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
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
    <form onSubmit={handleSubmit(onSubmit)} className="contact-form" noValidate>
      <input type="hidden" {...register("intent")} />

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
          {...register("name")}
        />
        {errors.name && <span className="field-error">{t("validation.name")}</span>}
      </div>

      <div className="field">
        <label htmlFor="contact-email">{t("fields.email")}</label>
        <input
          id="contact-email"
          type="email"
          autoComplete="email"
          placeholder={t("fields.emailPlaceholder")}
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && (
          <span className="field-error">{t("validation.email")}</span>
        )}
      </div>

      <div className="field">
        <label htmlFor="contact-company">{t("fields.company")}</label>
        <input
          id="contact-company"
          autoComplete="organization"
          placeholder={t("fields.companyPlaceholder")}
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
          {...register("message")}
        />
        {errors.message && (
          <span className="field-error">{t("validation.message")}</span>
        )}
      </div>

      <button
        type="submit"
        className="cta cta-primary"
        disabled={isSubmitting}
        data-cursor="hover"
      >
        <span className="cta-fill" aria-hidden="true" />
        <span className="cta-label">
          {isSubmitting ? t("sending") : t("submit")}
        </span>
      </button>

      {status === "error" && (
        <p className="contact-error" role="alert">
          {t("errorBody")}
        </p>
      )}
    </form>
  );
}
