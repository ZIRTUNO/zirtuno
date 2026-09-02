// Conversion-path QA (S1.15 / S19): every intent CTA reaches the contact form
// with its tag captured. Lists CTA hrefs on the homepage, then loads each intent
// and reads the form's hidden intent field + shown label.
//   BASE_URL=http://localhost:PORT node scripts/verify/cta.mjs

import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch(LAUNCH);
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 } })
).newPage();

// 1) distinct CTA hrefs across the homepage
await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 40000 });
const ctas = await page.evaluate(() => {
  const seen = new Set();
  return [...document.querySelectorAll("a.cta")]
    .map((a) => ({ label: a.textContent.trim(), href: a.getAttribute("href") }))
    .filter((c) => (seen.has(c.href) ? false : (seen.add(c.href), true)));
});

// 2) each intent → the form's hidden field + label
const intents = ["analysis", "structure", "talk", "general"];
const results = {};
for (const intent of intents) {
  const url =
    intent === "general"
      ? `${BASE}/en#contact`
      : `${BASE}/en?intent=${intent}#contact`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[name="intent"]', {
    state: "attached",
    timeout: 20000,
  });
  // react-hook-form fills the hidden input after hydration — wait for a value
  await page
    .waitForFunction(
      () => (document.querySelector('input[name="intent"]')?.value ?? "") !== "",
      { timeout: 10000 },
    )
    .catch(() => {});
  const field = await page.inputValue('input[name="intent"]');
  const label = await page.evaluate(() => {
    const el = document.querySelector(".contact-intent");
    return el ? el.textContent.trim() : null;
  });
  results[intent] = { field, label };
}

// 3) end-to-end: does the intent actually reach the POST body? (intercept it)
let submitted = null;
await page.route("**/api/contact", async (route) => {
  try {
    submitted = JSON.parse(route.request().postData() || "{}");
  } catch {
    submitted = null;
  }
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, delivered: true }),
  });
});
await page.goto(`${BASE}/en?intent=analysis&qa=confirmed#contact`, {
  waitUntil: "domcontentloaded",
});
await page.waitForSelector("#contact-name", { timeout: 20000 });
await page.fill("#contact-name", "QA Test");
await page.fill("#contact-email", "qa@example.com");
await page.fill("#contact-message", "Conversion-path QA test message.");
await page.click('button[type="submit"]');
await page.waitForTimeout(1800);
const confirmed = {
  success: await page.locator(".contact-success").isVisible().catch(() => false),
  submittedIntent: submitted?.intent ?? null,
  honeypot: submitted?.website ?? null,
  submissionId: submitted?.submissionId ?? null,
};

// 4) accepted is not delivered: show a truthful pending state and retain every
// entered value. This guards the audit's false-success regression directly.
await page.unroute("**/api/contact");
await page.route("**/api/contact", (route) =>
  route.fulfill({
    status: 202,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      accepted: true,
      delivered: false,
      pending: true,
    }),
  }),
);
await page.goto(`${BASE}/en?intent=analysis&qa=pending#contact`, {
  waitUntil: "domcontentloaded",
});
await page.waitForSelector("#contact-name", { timeout: 20000 });
await page.fill("#contact-name", "Pending QA");
await page.fill("#contact-email", "pending@example.com");
await page.fill("#contact-message", "Pending delivery must retain this message.");
await page.click('button[type="submit"]');
await page.waitForSelector(".contact-pending", { timeout: 10000 });
const pending = {
  name: await page.inputValue("#contact-name"),
  email: await page.inputValue("#contact-email"),
  message: await page.inputValue("#contact-message"),
  submitDisabled: await page.isDisabled('button[type="submit"]'),
  falseSuccess: await page.locator(".contact-success").isVisible().catch(() => false),
};
await page.unroute("**/api/contact");

// 5) an ambiguous/failed attempt can be retried without creating a second
// provider operation: unchanged form content must reuse the submission id.
const retryBodies = [];
await page.route("**/api/contact", async (route) => {
  retryBodies.push(JSON.parse(route.request().postData() || "{}"));
  const firstAttempt = retryBodies.length === 1;
  await route.fulfill({
    status: firstAttempt ? 502 : 200,
    contentType: "application/json",
    body: JSON.stringify(
      firstAttempt
        ? { ok: false, delivered: false, error: "send" }
        : { ok: true, delivered: true },
    ),
  });
});
await page.goto(`${BASE}/en?intent=talk&qa=retry#contact`, {
  waitUntil: "domcontentloaded",
});
await page.waitForSelector("#contact-name", { timeout: 20000 });
await page.fill("#contact-name", "Retry QA");
await page.fill("#contact-email", "retry@example.com");
await page.fill("#contact-message", "Safe retry must reuse this exact request.");
await page.click('button[type="submit"]');
await page.waitForSelector(".contact-error", { timeout: 10000 });
await page.click('button[type="submit"]');
await page.waitForSelector(".contact-success", { timeout: 10000 });
const retry = {
  submissionIds: retryBodies.map((body) => body.submissionId ?? null),
  success: await page.locator(".contact-success").isVisible().catch(() => false),
};
await page.unroute("**/api/contact");

// 6) same-page path (R0): clicking an intent CTA on the homepage must NOT
// navigate — it sets the intent via history.replaceState and Lenis-scrolls to
// #contact. A window marker survives only if no reload happened.
await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 40000 });
// wait for HYDRATION (the CTA interception handler), not just SSR paint —
// window.__scenes is set by PageStage in an effect, a reliable post-hydration
// signal. Pre-hydration clicks fall back to the native anchor (progressive
// enhancement), which is correct behavior but not the path under test.
await page.waitForFunction(() => !!window.__scenes, { timeout: 20000 });
await page.evaluate(() => {
  window.__noReload = true;
});
await page.click('a.cta[href*="intent=structure"]');
// Lenis is lerp-based (frame-rate dependent) — software-GL frames are slow in
// the harness, so give the smooth scroll a generous settle
await page.waitForTimeout(5000);
const samePage = await page.evaluate(() => {
  const contact = document.getElementById("contact");
  const rect = contact ? contact.getBoundingClientRect() : null;
  return {
    noReload: window.__noReload === true,
    url: location.pathname + location.search + location.hash,
    intentField:
      document.querySelector('input[name="intent"]')?.value ?? null,
    intentLabel:
      document.querySelector(".contact-intent")?.textContent.trim() ?? null,
    contactInView: rect ? rect.top < window.innerHeight && rect.bottom > 0 : false,
  };
});

console.log(
  "CTA " +
    JSON.stringify(
      { ctas, results, confirmed, pending, retry, samePage },
      null,
      2,
    ),
);

const requiredIntents = ["analysis", "structure", "talk"];
const failures = [];
for (const intent of intents) {
  if (results[intent]?.field !== intent)
    failures.push(`intent ${intent} did not reach the hidden field`);
}
for (const intent of requiredIntents) {
  if (!ctas.some((cta) => cta.href?.includes(`intent=${intent}`)))
    failures.push(`missing ${intent} CTA`);
}
if (!confirmed.success || confirmed.submittedIntent !== "analysis")
  failures.push("confirmed delivery did not produce the canonical success state");
if (confirmed.honeypot !== "") failures.push("honeypot was not submitted empty");
if (
  typeof confirmed.submissionId !== "string" ||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    confirmed.submissionId,
  )
)
  failures.push("contact request did not include a valid stable submission id");
if (
  pending.name !== "Pending QA" ||
  pending.email !== "pending@example.com" ||
  pending.message !== "Pending delivery must retain this message."
)
  failures.push("pending delivery did not retain the entered values");
if (!pending.submitDisabled || pending.falseSuccess)
  failures.push("pending delivery exposed a duplicate submit or false success");
if (
  !retry.success ||
  retry.submissionIds.length !== 2 ||
  !retry.submissionIds[0] ||
  retry.submissionIds[0] !== retry.submissionIds[1]
)
  failures.push("unchanged retry did not reuse its stable submission id");
if (
  !samePage.noReload ||
  samePage.intentField !== "structure" ||
  !samePage.contactInView
)
  failures.push("same-page CTA intent/scroll contract failed");

await browser.close();
if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}
console.log("CTA and contact delivery semantics: all checks passed");
