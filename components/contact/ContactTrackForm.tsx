"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import {
  DETAIL_OPTIONS,
  TRACK_DETAILS,
  detailField,
  intentForTrack,
  type ContactDetailKey,
  type ContactTrackId,
} from "@/lib/forms/contact";
import { trackEvent } from "@/lib/analytics/client";
import { Link } from "@/lib/i18n/config";
import { Membrane } from "@/components/chrome/Membrane";
import { ContactGlass } from "./ContactGlass";

/* ───────────────────────────────────────────────────────────────────────────
   ONE TRACK, ONE FORM — and that is the whole reason this file exists.

   The reference page gives each tab its own `<form>` rather than switching the
   fields inside a single one, and it is right to: the three tracks ask for
   different things, and a single form would have to carry every field of every
   track, disable the ones off-stage, and then explain to native validation why
   a required field it can see is not one it should enforce. Three forms have
   none of that. Each owns its fields, its validation, its submission id and its
   own honeypot, and the one that is on screen is the only one that can submit.

   It also keeps the NO-JS path honest without a single line of work: three real
   forms POST to `/api/contact` on their own, and the visitor who reaches a
   track with the radio switch above gets exactly the fields that track asks
   for. Nothing here is a progressive enhancement of something simpler — the
   simple thing IS what the server sends.
   ─────────────────────────────────────────────────────────────────────────── */

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

/**
 * The shape the CONTROLS have, which is not the shape the WIRE has.
 *
 * `name` is one field to the API and to the delivery email, and it stays that
 * way — nothing downstream learned a new column. On screen it is two, because
 * a first/last pair on one row is the reference card's most recognisable
 * gesture and because "Ana Ribeiro" filed as two fields is better data for the
 * studio than the same string filed as one. The join happens in `onSubmit`,
 * and the API route performs the identical join for the no-JS POST.
 */
const trackFormSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.email().max(254),
  company: z.string().trim().max(160).optional(),
  message: z.string().trim().min(10).max(4000),
});

type TrackFormInput = z.infer<typeof trackFormSchema>;
type ContactStatus = "idle" | "success" | "pending" | "error";
type SubmissionAttempt = { id: string; fingerprint: string };

const FIELD_ORDER = [
  "firstName",
  "lastName",
  "email",
  "company",
  "message",
] as const;

/** Tracks that ask for a company. A careers applicant is asked for a link. */
const WANTS_COMPANY: Record<ContactTrackId, boolean> = {
  project: true,
  advisory: true,
  other: true,
  careers: false,
};

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

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="contact-chevron">
      <path
        d="m6 9 6 6 6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Nothing here takes an "is this panel showing" prop, and that is deliberate.
 * The card hides an off-stage panel with `visibility`, which already takes
 * every control in it out of the tab order and out of the accessibility tree.
 * A `tabIndex={-1}` guard on top of that was not redundant, it was WRONG:
 * without JavaScript nothing re-renders when the radio changes, so the panel
 * the visitor switched to kept the -1 its server render was given and its
 * submit button could not be reached by keyboard at all.
 */
export function ContactTrackForm({
  track,
  initialStatus,
  onDelivered,
}: {
  track: ContactTrackId;
  initialStatus: ContactStatus;
  onDelivered: () => void;
}) {
  const t = useTranslations("contact");
  const locale = useLocale();
  const [status, setStatus] = useState<ContactStatus>(initialStatus);
  const [errorKind, setErrorKind] = useState<"generic" | "rate_limit">(
    "generic",
  );
  const [statusFromRedirect, setStatusFromRedirect] = useState(
    initialStatus !== "idle",
  );
  const [website, setWebsite] = useState("");
  const [details, setDetails] = useState<Partial<Record<ContactDetailKey, string>>>(
    {},
  );
  const [submissionAttempt, setSubmissionAttempt] =
    useState<SubmissionAttempt | null>(null);
  /**
   * A counter nobody reads. A repeated refusal changes no error and no value,
   * so without a state change React would not re-render and the effect below
   * would never get its chance to spend the armed flag. The count itself is
   * not information — only the render it forces is.
   */
  const [, refuse] = useReducer((count: number) => count + 1, 0);
  const started = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    trigger,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TrackFormInput>({
    resolver: zodResolver(trackFormSchema),
    shouldFocusError: false,
    /**
     * NOTHING COMPLAINS UNTIL YOU TRY TO SEND.
     *
     * This was `onTouched`, which validates a field the moment focus leaves
     * it. The effect on a card whose first row is two required fields: a
     * visitor who simply TABBED THROUGH to see what was being asked — typing
     * nothing, which is the most ordinary thing anyone does on a contact form —
     * collected three red refusals and watched the card grow 235px under them.
     * The form scolded people for reading it.
     *
     * `onSubmit` asks first and objects second. `reValidateMode: onChange`
     * keeps the good half of the old behaviour: once a refusal HAS happened,
     * the message clears as soon as the field is right, rather than making
     * somebody submit again to find out.
     */
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      company: "",
      message: "",
    },
  });

  const message = useWatch({ control, name: "message" });
  const invalidFields = FIELD_ORDER.filter((field) => errors[field]);
  const invalidCount = invalidFields.length;
  const locked = isSubmitting || status === "pending";
  const qualifiers = TRACK_DETAILS[track];
  const id = (field: string) => `contact-${track}-${field}`;
  const errorId = (field: string) => `${id(field)}-error`;

  // Native constraints stay in force until the localized Zod messages exist.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    form.noValidate = true;
    return () => {
      form.noValidate = false;
    };
  }, []);

  /**
   * THE REFUSAL IS FOCUSED ONCE, AND ONLY ONCE IT EXISTS.
   *
   * Keyed on `rejection` alone this silently did nothing. The refusal counter
   * and react-hook-form's `errors` are two separate pieces of state, and the
   * commit that carries the incremented counter is not the one that carries
   * the errors — so the effect ran with the summary not yet mounted,
   * `summaryRef.current` still null, and no second run to catch it, because
   * `rejection` had already settled. A form that announced nothing, from a
   * component that looked like it did.
   *
   * So the trigger is an ARMED FLAG rather than a dependency: a refusal arms
   * it, and the first commit in which the summary is actually on the page
   * spends it. The refusal counter stays because a repeated refusal changes no
   * error and would otherwise not re-render at all. Correcting one field never
   * steals focus, because a correction arms nothing.
   */
  const refusalPending = useRef(false);
  useEffect(() => {
    if (!refusalPending.current || !summaryRef.current) return;
    refusalPending.current = false;
    summaryRef.current.focus();
  });

  async function onSubmit(values: TrackFormInput) {
    setStatus("idle");
    setErrorKind("generic");
    setStatusFromRedirect(false);
    const intent = intentForTrack(track, details.focus);
    trackEvent("contact_submit", { intent, outcome: "attempt" });

    const payload = {
      name: `${values.firstName} ${values.lastName}`.trim(),
      email: values.email,
      company: values.company || undefined,
      message: values.message,
      intent,
      details: Object.keys(details).length ? details : undefined,
      website,
    };
    const fingerprint = JSON.stringify(payload);
    const attempt =
      submissionAttempt?.fingerprint === fingerprint
        ? submissionAttempt
        : { id: crypto.randomUUID(), fingerprint };
    setSubmissionAttempt(attempt);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, submissionId: attempt.id }),
      });
      const json: unknown = await res.json();
      if (res.ok && isConfirmedDelivery(json)) {
        trackEvent("contact_submit", { intent, outcome: "delivered" });
        setSubmissionAttempt(null);
        onDelivered();
      } else if (res.status === 202 && isPendingDelivery(json)) {
        trackEvent("contact_submit", { intent, outcome: "pending" });
        setStatus("pending");
      } else {
        const reason =
          json && typeof json === "object" && "error" in json
            ? String((json as { error: unknown }).error)
            : `http_${res.status}`;
        trackEvent("contact_submit", { intent, outcome: "failed", reason });
        setErrorKind(reason === "rate_limit" ? "rate_limit" : "generic");
        setStatus("error");
      }
    } catch {
      trackEvent("contact_submit", {
        intent,
        outcome: "failed",
        reason: "network",
      });
      setStatus("error");
    }
  }

  const textInput = (
    field: "firstName" | "lastName" | "email" | "company",
    required: boolean,
  ) => (
    <div className="field" key={field}>
      <label htmlFor={id(field)}>
        {t(`fields.${field}`)}
        {!required && <span className="field-optional"> {t("optional")}</span>}
      </label>
      <div className="contact-control">
        <ContactGlass />
        <input
          id={id(field)}
          type={field === "email" ? "email" : "text"}
          autoComplete={
            field === "firstName"
              ? "given-name"
              : field === "lastName"
                ? "family-name"
                : field === "email"
                  ? "email"
                  : "organization"
          }
          placeholder={t(`fields.${field}Placeholder`)}
          aria-invalid={errors[field] ? true : undefined}
          aria-describedby={errors[field] ? errorId(field) : undefined}
          required={required}
          maxLength={field === "email" ? 254 : field === "company" ? 160 : 60}
          disabled={locked}
          {...register(field, {
            onChange: () => {
              if (errors[field]) void trigger(field);
            },
          })}
        />
      </div>
      {errors[field] && (
        <span id={errorId(field)} className="field-error">
          {t(`validation.${field}`)}
        </span>
      )}
    </div>
  );

  /**
   * A qualifier is a NATIVE `<select>` wherever it has a closed list.
   *
   * The reference builds a button-plus-`ul` combobox with a hidden input behind
   * it, and its opened list carries no animation at all — so the custom control
   * buys nothing a styled native select does not already have, and costs the
   * keyboard model, the mobile picker, and the no-JS path. `appearance: none`
   * plus the chevron below reproduces the closed state exactly, which is the
   * state anyone is actually looking at.
   */
  const qualifier = (key: ContactDetailKey) => {
    const options = DETAIL_OPTIONS[key];
    const value = details[key] ?? "";
    const set = (next: string) =>
      setDetails((current) => {
        const draft = { ...current };
        if (next) draft[key] = next;
        else delete draft[key];
        return draft;
      });

    return (
      <div className="field" key={key}>
        <label htmlFor={id(key)}>
          {t(`details.${key}.label`)}
          <span className="field-optional"> {t("optional")}</span>
        </label>
        <div className="contact-control" data-select={options ? "" : undefined}>
          <ContactGlass />
          {options ? (
            <>
              <select
                id={id(key)}
                name={detailField(key)}
                value={value}
                disabled={locked}
                onChange={(event) => set(event.currentTarget.value)}
                data-empty={value ? undefined : ""}
              >
                <option value="">{t("selectPlaceholder")}</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {t(`details.${key}.options.${option}`)}
                  </option>
                ))}
              </select>
              <Chevron />
            </>
          ) : (
            <input
              id={id(key)}
              name={detailField(key)}
              type={key === "link" ? "url" : "text"}
              placeholder={t(`details.${key}.placeholder`)}
              value={value}
              maxLength={200}
              disabled={locked}
              onChange={(event) => set(event.currentTarget.value)}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <form
      ref={formRef}
      action={`/api/contact?locale=${locale}&track=${track}`}
      method="post"
      className="contact-form"
      data-track={track}
      aria-busy={isSubmitting || undefined}
      onSubmit={(event) => {
        if (locked) {
          event.preventDefault();
          return;
        }
        void handleSubmit(onSubmit, (fieldErrors) => {
          refusalPending.current = true;
          refuse();
          trackEvent("contact_validation_failed", {
            fields: Object.keys(fieldErrors).sort().join(","),
            intent: intentForTrack(track, details.focus),
          });
        })(event);
      }}
      onFocusCapture={() => {
        if (started.current) return;
        started.current = true;
        trackEvent("contact_start", {
          intent: intentForTrack(track, details.focus),
        });
      }}
    >
      <div className="contact-honeypot" aria-hidden="true">
        <label htmlFor={id("website")}>{t("fields.websiteTrap")}</label>
        <input
          id={id("website")}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.currentTarget.value)}
        />
      </div>

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
                  href={`#${id(field)}`}
                  onClick={(event) => {
                    event.preventDefault();
                    document.getElementById(id(field))?.focus();
                  }}
                >
                  {t(`validation.${field}`)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="contact-row">
        {textInput("firstName", true)}
        {textInput("lastName", true)}
      </div>

      {textInput("email", true)}
      {WANTS_COMPANY[track] && textInput("company", false)}

      {qualifiers.map((key, index) =>
        // Two short qualifiers side by side, the way the reference pairs
        // Project Scale with Approximate Budget. An odd trailing one runs full
        // width rather than leaving a hole beside it.
        index % 2 === 0 ? (
          <div
            className="contact-row"
            data-single={qualifiers[index + 1] ? undefined : ""}
            key={key}
          >
            {qualifier(key)}
            {qualifiers[index + 1] && qualifier(qualifiers[index + 1])}
          </div>
        ) : null,
      )}

      <div className="field contact-message-field">
        <label htmlFor={id("message")}>{t(`messageLabels.${track}`)}</label>
        <div className="contact-control">
          <ContactGlass />
          <textarea
            id={id("message")}
            rows={5}
            placeholder={t(`messagePlaceholders.${track}`)}
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={errors.message ? errorId("message") : undefined}
            required
            minLength={10}
            maxLength={4000}
            disabled={locked}
            {...register("message", {
              onChange: () => {
                if (errors.message) void trigger("message");
              },
            })}
          />
        </div>
        <div className="contact-field-foot">
          {errors.message ? (
            <span id={errorId("message")} className="field-error">
              {t("validation.message")}
            </span>
          ) : (
            <span />
          )}
          <span className="contact-count" aria-hidden="true">
            {(message?.length ?? 0).toLocaleString(locale)} / 4.000
          </span>
        </div>
      </div>

      <div className="contact-actions">
        <button
          type="submit"
          className="cta cta-primary contact-submit"
          disabled={locked}
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
            <Arrow />
          </span>
          <span className="cta-label">
            {isSubmitting
              ? t("sending")
              : status === "pending"
                ? t("receivedPending")
                : t("submit")}
            <Arrow />
          </span>
        </button>
      </div>

      <p className="contact-privacy">
        {t("privacyNote")}{" "}
        <Link href="/legal/privacy">{t("privacyLink")}</Link>
      </p>

      <div className="contact-delivery" aria-live="polite" aria-atomic="true">
        {isSubmitting && (
          <p className="contact-sending">
            <span aria-hidden="true" />
            {t("sendingDetail")}
          </p>
        )}
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
      </div>

      <input type="hidden" name="track" value={track} />
    </form>
  );
}
