// Conversion-path QA (S1.15 / S19): every intent CTA reaches the contact form
// with its tag captured. Lists CTA hrefs on the homepage, then loads each intent
// and reads the form's hidden intent field + shown label.
//   BASE_URL=http://localhost:PORT node scripts/verify-cta.mjs

import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

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
    body: JSON.stringify({ ok: true }),
  });
});
await page.goto(`${BASE}/en?intent=analysis#contact`, {
  waitUntil: "domcontentloaded",
});
await page.fill("#contact-name", "QA Test");
await page.fill("#contact-email", "qa@example.com");
await page.fill("#contact-message", "Conversion-path QA test message.");
await page.click('button[type="submit"]');
await page.waitForTimeout(1800);

// 4) same-page path (R0): clicking an intent CTA on the homepage must NOT
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
      { ctas, results, submittedIntent: submitted?.intent, samePage },
      null,
      2,
    ),
);
await browser.close();
