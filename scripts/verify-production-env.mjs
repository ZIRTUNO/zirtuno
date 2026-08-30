import {
  extractMailbox,
  validateContactDeliveryConfig,
} from "../lib/forms/contact-config.mjs";

const conditionalBuildCheck = process.argv.includes("--if-production");
const isProductionDeploy =
  process.env.VERCEL_ENV === "production" ||
  process.env.ZIRTUNO_PRODUCTION_BUILD === "true";
if (conditionalBuildCheck && !isProductionDeploy) {
  console.log("Production environment readiness check skipped for local/preview build.");
  process.exit(0);
}

const required = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SANITY_PROJECT_ID",
  "NEXT_PUBLIC_SANITY_DATASET",
  "NEXT_PUBLIC_PLAUSIBLE_DOMAIN",
  "NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL",
  "NEXT_PUBLIC_CONTACT_EMAIL",
  "NEXT_PUBLIC_WHATSAPP_URL",
  "NEXT_PUBLIC_INSTAGRAM_URL",
  "RESEND_WEBHOOK_SECRET",
];

const errors = [];

for (const key of required) {
  if (!process.env[key]?.trim()) errors.push(`${key} is required`);
}

const siteValue = process.env.NEXT_PUBLIC_SITE_URL?.trim();
let siteHost = "";
if (siteValue) {
  try {
    const site = new URL(siteValue);
    siteHost = site.hostname.toLowerCase().replace(/^www\./, "");
    if (site.protocol !== "https:") {
      errors.push("NEXT_PUBLIC_SITE_URL must use https");
    }
    if (site.pathname !== "/" || site.search || site.hash) {
      errors.push(
        "NEXT_PUBLIC_SITE_URL must be the origin without a path, query, or hash",
      );
    }
    if (
      ["example.com", "example.org", "example.net", "localhost"].includes(
        siteHost,
      ) ||
      siteHost.endsWith(".test") ||
      siteHost.endsWith(".local")
    ) {
      errors.push(
        "NEXT_PUBLIC_SITE_URL must use the approved production domain",
      );
    }
  } catch {
    errors.push("NEXT_PUBLIC_SITE_URL must be an absolute URL");
  }
}

const emailFrom = process.env.CONTACT_EMAIL_FROM?.trim() ?? "";
const fromAddress = extractMailbox(emailFrom) ?? "";
const fromDomain = fromAddress.split("@")[1]?.toLowerCase() ?? "";
const toAddress = extractMailbox(process.env.CONTACT_EMAIL_TO) ?? "";
const toDomain = toAddress.split("@")[1]?.toLowerCase() ?? "";
const publicValue = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() ?? "";
const publicAddress =
  extractMailbox(process.env.NEXT_PUBLIC_CONTACT_EMAIL) ?? "";
const publicDomain = publicAddress.split("@")[1]?.toLowerCase() ?? "";

const contact = validateContactDeliveryConfig(process.env, { production: true });
if (!contact.ok) {
  for (const issue of contact.issues) {
    errors.push(`${issue.variable}: ${issue.reason}`);
  }
}
if (fromDomain === "resend.dev" || fromAddress.includes("onboarding@")) {
  errors.push("CONTACT_EMAIL_FROM must use a verified Zirtuno-owned domain");
}
if (["gmail.com", "hotmail.com", "outlook.com", "yahoo.com"].includes(toDomain)) {
  errors.push("CONTACT_EMAIL_TO must use an approved domain mailbox");
}
if (
  siteHost &&
  toDomain &&
  toDomain !== siteHost &&
  !toDomain.endsWith(`.${siteHost}`)
) {
  errors.push("CONTACT_EMAIL_TO must match the canonical site domain");
}
if (publicValue && !publicAddress) {
  errors.push("NEXT_PUBLIC_CONTACT_EMAIL must be a valid public mailbox");
} else if (
  ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com"].includes(publicDomain)
) {
  errors.push("NEXT_PUBLIC_CONTACT_EMAIL must use an approved domain mailbox");
}
if (
  siteHost &&
  fromDomain &&
  fromDomain !== siteHost &&
  !fromDomain.endsWith(`.${siteHost}`)
) {
  errors.push("CONTACT_EMAIL_FROM must match the canonical site domain");
}
if (
  siteHost &&
  publicDomain &&
  publicDomain !== siteHost &&
  !publicDomain.endsWith(`.${siteHost}`)
) {
  errors.push("NEXT_PUBLIC_CONTACT_EMAIL must match the canonical site domain");
}

for (const key of ["NEXT_PUBLIC_WHATSAPP_URL", "NEXT_PUBLIC_INSTAGRAM_URL"]) {
  const value = process.env[key]?.trim();
  if (!value) continue;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") errors.push(`${key} must use https`);
    if (
      key === "NEXT_PUBLIC_WHATSAPP_URL" &&
      !["wa.me", "api.whatsapp.com", "www.whatsapp.com"].includes(url.hostname)
    ) {
      errors.push("NEXT_PUBLIC_WHATSAPP_URL must use an approved WhatsApp host");
    }
    if (key === "NEXT_PUBLIC_WHATSAPP_URL") {
      const directNumber = url.hostname === "wa.me" ? url.pathname.slice(1) : "";
      const queryNumber = url.searchParams.get("phone") ?? "";
      if (!/^\d{8,15}$/.test(directNumber || queryNumber)) {
        errors.push("NEXT_PUBLIC_WHATSAPP_URL must include the approved phone number");
      }
    }
    if (
      key === "NEXT_PUBLIC_INSTAGRAM_URL" &&
      url.hostname !== "instagram.com" &&
      url.hostname !== "www.instagram.com"
    ) {
      errors.push("NEXT_PUBLIC_INSTAGRAM_URL must use instagram.com");
    }
    if (key === "NEXT_PUBLIC_INSTAGRAM_URL" && url.pathname === "/") {
      errors.push("NEXT_PUBLIC_INSTAGRAM_URL must include the approved handle");
    }
  } catch {
    errors.push(`${key} must be an absolute URL when provided`);
  }
}

const analyticsDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim() ?? "";
if (
  analyticsDomain &&
  (/^https?:\/\//i.test(analyticsDomain) || analyticsDomain.includes("/"))
) {
  errors.push("NEXT_PUBLIC_PLAUSIBLE_DOMAIN must be a hostname, not a URL");
}
if (
  analyticsDomain &&
  siteHost &&
  analyticsDomain.toLowerCase().replace(/^www\./, "") !== siteHost
) {
  errors.push("NEXT_PUBLIC_PLAUSIBLE_DOMAIN must match the canonical site domain");
}
const analyticsScript = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL?.trim();
if (analyticsScript) {
  try {
    const url = new URL(analyticsScript);
    if (url.protocol !== "https:") {
      errors.push("NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL must use https");
    }
    const analyticsHost = url.hostname.toLowerCase().replace(/^www\./, "");
    if (
      analyticsHost !== "plausible.io" &&
      analyticsHost !== siteHost &&
      !analyticsHost.endsWith(`.${siteHost}`)
    ) {
      errors.push(
        "NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL must use plausible.io or the canonical site domain",
      );
    }
  } catch {
    errors.push("NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL must be an absolute URL");
  }
}

const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim() ?? "";
if (webhookSecret && (!webhookSecret.startsWith("whsec_") || webhookSecret.length < 24)) {
  errors.push("RESEND_WEBHOOK_SECRET must be the signing secret from Resend");
}
for (const key of [
  "CONTACT_WEBHOOK_READY",
  "CONTACT_RATE_LIMIT_READY",
  "PUBLIC_IDENTITY_READY",
  // The footer links to /legal/{terms,privacy,cookies} from every page. The
  // shipped copy is an honest scaffold, not reviewed legal text, and the pages
  // fail closed on their own (visible notice + noindex) — but a public site
  // whose Terms of Service is a placeholder is the same class of unapproved
  // public fact this gate exists to stop.
  "LEGAL_COPY_APPROVED",
]) {
  if (process.env[key] !== "true") errors.push(`${key} must be true`);
}

if (errors.length > 0) {
  console.error("Production readiness check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Production environment readiness check passed.");
