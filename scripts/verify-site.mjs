// Run the site on the SVG path (what an integrated GPU sees) and check it's
// healthy: no console/page errors through a full scroll, all chapters present,
// the contact form + CTAs intact, and a full-page screenshot to eyeball.
//   BASE_URL=http://localhost:PORT node scripts/verify-site.mjs

import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:65138";
fs.mkdirSync("captures/verify", { recursive: true });

const browser = await chromium.launch({ headless: true, chromiumSandbox: false });
const page = await (
  await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
).newPage();

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("requestfailed", (r) => {
  const u = r.url();
  if (!u.includes("favicon")) errors.push("REQFAIL: " + u + " " + (r.failure()?.errorText ?? ""));
});

for (const loc of ["pt", "en"]) {
  await page.goto(`${BASE}/${loc}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 40000 });
  for (let i = 0; i <= 12; i++) {
    await page.evaluate((f) => window.scrollTo(0, document.body.scrollHeight * f), i / 12);
    await page.waitForTimeout(250);
  }
}

// structural health on EN
await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 40000 });
const struct = await page.evaluate(() => ({
  chapters: document.querySelectorAll("[data-chapter]").length,
  ctas: document.querySelectorAll("a.cta").length,
  heroMark: !!document.querySelector("[data-hero-metaball]"),
  ecoNodes: document.querySelectorAll(".organism-node").length,
  h1: (document.querySelector("h1")?.textContent || "").slice(0, 60),
}));

// contact form present + submit button labeled
await page.goto(`${BASE}/en#contact`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#contact-name", { timeout: 20000 });
const contact = await page.evaluate(() => ({
  name: !!document.querySelector("#contact-name"),
  email: !!document.querySelector("#contact-email"),
  message: !!document.querySelector("#contact-message"),
  submit: (document.querySelector('button[type="submit"]')?.textContent || "").trim().slice(0, 40),
}));

await page.screenshot({ path: "captures/verify/site-full.png", fullPage: true });

console.log("STRUCT " + JSON.stringify(struct));
console.log("CONTACT " + JSON.stringify(contact));
console.log("ERRORS(" + errors.length + ") " + JSON.stringify(errors.slice(0, 8)));
await browser.close();
