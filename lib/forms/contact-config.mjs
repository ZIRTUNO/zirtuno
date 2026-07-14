const API_KEY_PATTERN = /^re_[A-Za-z0-9_-]{8,}$/;
const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const NON_PRODUCTION_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "localhost",
]);

/**
 * Extract an email address from either `person@example.com` or
 * `Display name <person@example.com>`. Returns null for ambiguous values.
 *
 * @param {string | undefined} input
 */
export function extractMailbox(input) {
  const value = input?.trim();
  if (!value) return null;

  const bracketed = value.match(/^[^<>]*<\s*([^<>\s]+)\s*>$/);
  const mailbox = bracketed?.[1] ?? value;
  return EMAIL_PATTERN.test(mailbox) ? mailbox.toLowerCase() : null;
}

/**
 * Central contact-delivery validation, shared by the route and the deployment
 * readiness gate. It deliberately returns only variable names and reason
 * codes so configuration logs cannot expose secrets or recipient addresses.
 *
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 * @param {{ production?: boolean }} [options]
 */
export function validateContactDeliveryConfig(env, options = {}) {
  const production = options.production ?? env.NODE_ENV === "production";
  const issues = [];
  const apiKey = env.RESEND_API_KEY?.trim() ?? "";
  const to = env.CONTACT_EMAIL_TO?.trim() ?? "";
  const from = env.CONTACT_EMAIL_FROM?.trim() ?? "";
  const toMailbox = extractMailbox(to);
  const fromMailbox = extractMailbox(from);

  if (!apiKey) {
    issues.push({ variable: "RESEND_API_KEY", reason: "missing" });
  } else if (!API_KEY_PATTERN.test(apiKey)) {
    issues.push({ variable: "RESEND_API_KEY", reason: "invalid_format" });
  }

  if (!to) {
    issues.push({ variable: "CONTACT_EMAIL_TO", reason: "missing" });
  } else if (!toMailbox) {
    issues.push({ variable: "CONTACT_EMAIL_TO", reason: "invalid_mailbox" });
  }

  if (!from) {
    issues.push({ variable: "CONTACT_EMAIL_FROM", reason: "missing" });
  } else if (!fromMailbox) {
    issues.push({ variable: "CONTACT_EMAIL_FROM", reason: "invalid_mailbox" });
  }

  if (production && fromMailbox) {
    const fromDomain = fromMailbox.split("@")[1];
    if (
      fromDomain === "resend.dev" ||
      fromDomain.endsWith(".resend.dev") ||
      NON_PRODUCTION_DOMAINS.has(fromDomain)
    ) {
      issues.push({
        variable: "CONTACT_EMAIL_FROM",
        reason: "verified_domain_required",
      });
    }
  }

  if (production && toMailbox) {
    const toDomain = toMailbox.split("@")[1];
    if (NON_PRODUCTION_DOMAINS.has(toDomain)) {
      issues.push({
        variable: "CONTACT_EMAIL_TO",
        reason: "production_recipient_required",
      });
    }
  }

  if (production && env.CONTACT_DELIVERY_READY !== "true") {
    issues.push({
      variable: "CONTACT_DELIVERY_READY",
      reason: "end_to_end_verification_required",
    });
  }

  if (issues.length > 0 || !toMailbox || !fromMailbox) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    config: { apiKey, to, from, toMailbox, fromMailbox },
  };
}
