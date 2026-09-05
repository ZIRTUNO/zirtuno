import { NextResponse } from "next/server";
import { Resend } from "resend";
import { contactApiSchema } from "@/lib/forms/contact";
import { validateContactDeliveryConfig } from "@/lib/forms/contact-config.mjs";
import {
  readLimitedText,
  RequestBodyTooLargeError,
} from "@/lib/http/read-limited-text";

export const runtime = "nodejs";
export const maxDuration = 15;

type ContactError =
  "invalid" | "validation" | "configuration" | "rate_limit" | "send";

type ContactResponseBody =
  | { ok: true; delivered: true }
  | { ok: true; accepted: true; delivered: false; pending: true }
  | { ok: false; delivered: false; error: ContactError };

type RateBucket = { count: number; resetAt: number };
const ipBuckets = new Map<string, RateBucket>();
let globalBucket: RateBucket = { count: 0, resetAt: 0 };

const TERMINAL_DELIVERED = new Set(["delivered", "opened", "clicked"]);
const TERMINAL_FAILED = new Set([
  "bounced",
  "canceled",
  "complained",
  "failed",
  "suppressed",
]);
const FORM_MAX_BYTES = 32_768;
const PROVIDER_DEADLINE_MS = 12_000;
const STATUS_CALL_TIMEOUT_MS = 1_500;

class ProviderDeadlineError extends Error {
  constructor() {
    super("Provider operation exceeded the request deadline.");
    this.name = "ProviderDeadlineError";
  }
}

async function beforeDeadline<T>(promise: Promise<T>, deadlineAt: number) {
  const remaining = deadlineAt - Date.now();
  if (remaining <= 0) throw new ProviderDeadlineError();

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new ProviderDeadlineError()),
          remaining,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function contactResponse(
  requestId: string,
  body: ContactResponseBody,
  status: number,
  extraHeaders: Record<string, string> = {},
) {
  return NextResponse.json(
    { ...body, requestId },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
        ...extraHeaders,
      },
    },
  );
}

function contactFormResponse(
  req: Request,
  requestId: string,
  body: ContactResponseBody,
  extraHeaders: Record<string, string> = {},
) {
  const requestUrl = new URL(req.url);
  const locale = requestUrl.searchParams.get("locale") === "pt" ? "pt" : "en";
  // The no-JS answer goes back to the FORM'S OWN PAGE. It used to redirect to
  // `/{locale}#contact`, the homepage anchor the form lived at while it was
  // S10; since 2026-09-05 the form is a route of its own, and a hash that no
  // longer resolves would have dropped a no-JS visitor at the top of the
  // homepage with a `?contact=` param nothing on that page reads — a submission
  // that silently appeared to do nothing.
  const destination = new URL(`/${locale}/contact`, requestUrl.origin);
  const state =
    body.ok && "delivered" in body && body.delivered
      ? "success"
      : body.ok && "pending" in body && body.pending
        ? "pending"
        : !body.ok && body.error === "rate_limit"
          ? "rate_limit"
          : "error";
  destination.searchParams.set("contact", state);
  return NextResponse.redirect(destination, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
      ...extraHeaders,
    },
  });
}

function takeRateLimit(req: Request): number | null {
  const now = Date.now();
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientKey = forwarded || req.headers.get("x-real-ip") || "unknown";

  let bucket = ipBuckets.get(clientKey);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + 10 * 60_000 };
    ipBuckets.set(clientKey, bucket);
  }
  if (++bucket.count > 5) {
    return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  }

  if (globalBucket.resetAt <= now) {
    globalBucket = { count: 0, resetAt: now + 60_000 };
  }
  if (++globalBucket.count > 60) {
    return Math.max(1, Math.ceil((globalBucket.resetAt - now) / 1000));
  }

  if (ipBuckets.size > 1000) {
    for (const [key, value] of ipBuckets) {
      if (value.resetAt <= now) ipBuckets.delete(key);
    }
  }
  return null;
}

function requestOriginAllowed(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const allowed = new Set([new URL(req.url).origin]);
  const canonical = process.env.NEXT_PUBLIC_SITE_URL;
  if (canonical) {
    try {
      allowed.add(new URL(canonical).origin);
    } catch {
      // The production readiness gate reports malformed canonical URLs.
    }
  }
  return allowed.has(origin);
}

async function confirmDelivery(
  resend: Resend,
  messageId: string,
  deadlineAt: number,
): Promise<"delivered" | "failed" | "pending"> {
  const waits = [0, 1_000, 1_500];
  for (const wait of waits) {
    if (Date.now() + wait >= deadlineAt - 500) return "pending";
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      const callDeadline = Math.min(
        deadlineAt - 500,
        Date.now() + STATUS_CALL_TIMEOUT_MS,
      );
      const { data, error } = await beforeDeadline(
        resend.emails.get(messageId),
        callDeadline,
      );
      if (error || !data) continue;
      if (TERMINAL_DELIVERED.has(data.last_event)) return "delivered";
      if (TERMINAL_FAILED.has(data.last_event)) return "failed";
    } catch (error) {
      if (error instanceof ProviderDeadlineError) return "pending";
      // The send was accepted. A temporary status-read failure is pending,
      // never a reason to claim delivery or encourage a duplicate submission.
    }
  }
  return "pending";
}

function logContactEvent(
  level: "info" | "warn" | "error",
  event: string,
  requestId: string,
  context: Record<string, unknown> = {},
) {
  // Structured, PII-free events can be counted and alerted on by the hosting
  // provider. Never add submitted names, addresses, companies, or copy here.
  console[level](
    JSON.stringify({ scope: "contact", event, requestId, ...context }),
  );
}

function providerErrorContext(error: unknown) {
  if (!error || typeof error !== "object") return {};
  const value = error as Record<string, unknown>;
  return {
    providerError:
      typeof value.name === "string" ? value.name : "unknown_provider_error",
    providerStatus:
      typeof value.statusCode === "number" ? value.statusCode : undefined,
  };
}

// Success is returned only after Resend reports confirmed delivery. Accepted
// but unconfirmed messages return a pending response so the client preserves
// the lead; missing configuration and provider failures are explicit errors.
export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  const providerDeadlineAt = Date.now() + PROVIDER_DEADLINE_MS;
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  const isJson = contentType.startsWith("application/json");
  const isForm = contentType.startsWith("application/x-www-form-urlencoded");
  if (!isJson && !isForm) {
    logContactEvent("warn", "request_content_type_rejected", requestId);
    return contactResponse(
      requestId,
      { ok: false, delivered: false, error: "invalid" },
      415,
    );
  }
  const respond = (
    body: ContactResponseBody,
    status: number,
    extraHeaders: Record<string, string> = {},
  ) =>
    isForm
      ? contactFormResponse(req, requestId, body, extraHeaders)
      : contactResponse(requestId, body, status, extraHeaders);
  if (!requestOriginAllowed(req)) {
    logContactEvent("warn", "request_origin_rejected", requestId);
    return respond({ ok: false, delivered: false, error: "invalid" }, 403);
  }
  const retryAfter = takeRateLimit(req);
  if (retryAfter !== null) {
    logContactEvent("warn", "request_rate_limited", requestId);
    return respond({ ok: false, delivered: false, error: "rate_limit" }, 429, {
      "Retry-After": String(retryAfter),
    });
  }
  let body: unknown;
  try {
    const raw = await readLimitedText(req, FORM_MAX_BYTES);
    if (isJson) {
      body = JSON.parse(raw);
    } else {
      const fields = new URLSearchParams(raw);
      body = {
        name: fields.get("name") ?? "",
        email: fields.get("email") ?? "",
        company: fields.get("company") ?? "",
        message: fields.get("message") ?? "",
        intent: fields.get("intent") ?? "general",
        website: fields.get("website") ?? "",
        submissionId: crypto.randomUUID(),
      };
    }
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      logContactEvent("warn", "request_too_large", requestId);
      return respond({ ok: false, delivered: false, error: "invalid" }, 413);
    }
    logContactEvent("warn", "request_invalid_payload", requestId, {
      encoding: isJson ? "json" : "form",
    });
    return respond({ ok: false, delivered: false, error: "invalid" }, 400);
  }

  const parsed = contactApiSchema.safeParse(body);
  if (!parsed.success) {
    logContactEvent("warn", "request_validation_failed", requestId, {
      fields: [
        ...new Set(
          parsed.error.issues
            .map((issue) => issue.path[0])
            .filter((field): field is string => typeof field === "string"),
        ),
      ],
    });
    return respond({ ok: false, delivered: false, error: "validation" }, 422);
  }

  const { name, email, company, message, intent, submissionId } = parsed.data;
  const delivery = validateContactDeliveryConfig(process.env);
  if (!delivery.ok || !delivery.config) {
    logContactEvent("error", "delivery_configuration_invalid", requestId, {
      issues: delivery.issues,
      production: process.env.NODE_ENV === "production",
      intent,
    });
    return respond(
      { ok: false, delivered: false, error: "configuration" },
      503,
    );
  }

  try {
    const { apiKey, to, from } = delivery.config;
    const resend = new Resend(apiKey);
    const subject = `Website contact · ${intent} · ${submissionId.slice(0, 8)}`;
    const text = [
      `Submission: ${submissionId}`,
      `Intent: ${intent}`,
      `Nome: ${name}`,
      `Email: ${email}`,
      `Empresa: ${company || "Não informado"}`,
      "",
      message,
    ].join("\n");

    const { data, error } = await beforeDeadline(
      resend.emails.send(
        {
          from,
          to,
          replyTo: email,
          subject,
          text,
          tags: [
            { name: "source", value: "website-contact" },
            { name: "intent", value: intent },
          ],
        },
        { idempotencyKey: `contact/${submissionId}` },
      ),
      providerDeadlineAt,
    );

    if (error) {
      logContactEvent("error", "delivery_provider_rejected", requestId, {
        intent,
        ...providerErrorContext(error),
      });
      return respond({ ok: false, delivered: false, error: "send" }, 502);
    }

    if (!data?.id) {
      logContactEvent(
        "error",
        "delivery_provider_response_invalid",
        requestId,
        {
          intent,
        },
      );
      return respond({ ok: false, delivered: false, error: "send" }, 502);
    }

    logContactEvent("info", "delivery_accepted", requestId, {
      intent,
      providerMessageId: data.id,
    });

    const deliveryState = await confirmDelivery(
      resend,
      data.id,
      providerDeadlineAt,
    );
    if (deliveryState === "delivered") {
      logContactEvent("info", "delivery_confirmed", requestId, {
        intent,
        providerMessageId: data.id,
      });
      return respond({ ok: true, delivered: true }, 200);
    }
    if (deliveryState === "failed") {
      logContactEvent("error", "delivery_terminal_failure", requestId, {
        intent,
        providerMessageId: data.id,
      });
      return respond({ ok: false, delivered: false, error: "send" }, 502);
    }

    logContactEvent("warn", "delivery_confirmation_pending", requestId, {
      intent,
      providerMessageId: data.id,
    });
    return respond(
      { ok: true, accepted: true, delivered: false, pending: true },
      202,
    );
  } catch (error) {
    logContactEvent("error", "delivery_exception", requestId, {
      intent,
      ...providerErrorContext(error),
    });
    return respond({ ok: false, delivered: false, error: "send" }, 502);
  }
}
