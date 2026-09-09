/** The shipped contact card. All requests are intercepted; no mail is sent.
 * Run with a dev/preview server: node scripts/verify/contact-journey.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = process.env.OUT || "captures/contact-journey";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(LAUNCH);
const report = [];
const good = text => { report.push(text); console.log("  ok " + text); };
const shot = async (page, name) => {
  await page.screenshot({ path: OUT + "/" + name + ".png" });
};
/** One panel width plus the settle the two coupled transitions share. */
const SLIDE = 700;

async function setup(options = {}, locale = "en", query = "") {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, ...options });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", err => errors.push(err.message));
  // Real page errors only. The failure cases below ASK the endpoint for a 500
  // and a 429, and the browser logs a resource error for each — counting the
  // test's own fixtures as defects would make the suite unable to test failure.
  page.on("console", m => {
    if (m.type() !== "error") return;
    if (/Failed to load resource/.test(m.text())) return;
    errors.push(m.text());
  });
  const requests = [];
  let result = { status: 200, body: { ok: true, delivered: true } };
  let release;
  await page.route("**/api/contact**", async route => {
    requests.push(route.request().postDataJSON());
    if (result.hold) await new Promise(resolve => { release = resolve; });
    await route.fulfill({ status: result.status, contentType: "application/json", body: JSON.stringify(result.body) });
  });
  await page.goto(BASE + "/" + locale + "/contact?fcap=1" + query, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".contact-card");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(SLIDE);
  return { ctx, page, errors, requests, reply(value) { result = value; }, release() { release?.(); } };
}

/** What the card is showing, read the way a reader sees it rather than from state. */
const stage = page => page.evaluate(() => {
  const view = document.querySelector(".contact-track-view");
  const track = document.querySelector(".contact-track");
  const pill = document.querySelector(".contact-tabpill");
  const slots = [...document.querySelectorAll(".contact-slot")];
  const shown = slots.filter(s => s.checkVisibility({ visibilityProperty: true }));
  return {
    translate: getComputedStyle(track).translate,
    height: Math.round(parseFloat(getComputedStyle(view).height)),
    shown: shown.map(s => s.dataset.slotTrack),
    shownHeight: shown[0] ? shown[0].offsetHeight : 0,
    pillX: Math.round(pill.getBoundingClientRect().x - pill.parentElement.getBoundingClientRect().x),
    tabX: Math.round((() => {
      const label = document.querySelector(".contact-tab:has(input:checked)");
      return label.getBoundingClientRect().x - label.parentElement.getBoundingClientRect().x;
    })()),
    // The controls' material, sampled where it is easiest to get wrong: the
    // laminate must be ONE edge. Three outline systems on one control — the
    // input's border, the rim gradient and a vector contour — is what made
    // every field look doubled and seamed.
    edges: (() => {
      const shown = [...document.querySelectorAll(".contact-slot")]
        .find(s => s.checkVisibility({ visibilityProperty: true }));
      const control = shown?.querySelector(".contact-control");
      if (!control) return null;
      const input = control.querySelector("input, textarea, select");
      return {
        vectors: document.querySelectorAll(".fl-edge, .fl-bead").length,
        controlBorder: getComputedStyle(control).borderTopWidth,
        inputBorder: getComputedStyle(input).borderTopWidth,
        radius: getComputedStyle(control).borderTopLeftRadius,
      };
    })(),
    checked: document.querySelector(".contact-tab input:checked")?.value,
  };
});

async function pick(page, track) {
  await page.locator(`.contact-tab:has(input[value="${track}"])`).click();
  await page.waitForTimeout(SLIDE);
}

async function fillCore(page, track, message) {
  await page.locator(`#contact-${track}-firstName`).fill("Form");
  await page.locator(`#contact-${track}-lastName`).fill("Review");
  await page.locator(`#contact-${track}-email`).fill("review@example.com");
  await page.locator(`#contact-${track}-message`).fill(message);
}

try {
  /* ── arrival, and the tab it opens on ─────────────────────────────────── */
  const app = await setup();
  const { page } = app;
  let view = await stage(page);
  assert.equal(view.checked, "project", "a bare visit opens on the studio's own business");
  assert.deepEqual(view.shown, ["project"], "exactly one panel is on stage");
  assert.equal(view.height, view.shownHeight, "the window is measured to the panel");
  assert.equal(view.pillX, view.tabX, "the pill sits on the selected tab");
  assert.equal(await page.locator(".contact-tab").count(), 3, "careers is not offered to a commercial arrival");
  await shot(page, "desktop-project");
  good("bare arrival opens on Projetos, one panel on stage, window measured, pill seated");

  /* ── the switch ──────────────────────────────────────────────────────── */
  // Arrow keys, because this is a radio group and not a `role="tab"` widget
  // pretending to be one.
  await page.locator('.contact-tab input[value="project"]').focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(SLIDE);
  view = await stage(page);
  assert.equal(view.checked, "advisory");
  assert.equal(view.translate, "-100%", "the track travels exactly one panel width");
  assert.deepEqual(view.shown, ["advisory"], "the panel left behind is out of the tab order");
  assert.equal(view.height, view.shownHeight, "the window followed the incoming panel's height");
  assert.equal(view.pillX, view.tabX);
  await shot(page, "desktop-advisory");

  // ONE EDGE PER CONTROL. This card shipped with three overlapping outline
  // systems and every field came out with a doubled, seamed rim — a spline
  // through ring vertices cannot sit on a CSS rounded rectangle, and the two
  // were drawing a pixel apart. The vector layer is retired; the border now
  // lives on the same element as the glass, so there is exactly one hairline
  // and one radius and nothing left that can disagree.
  assert.deepEqual(view.edges, {
    vectors: 0,
    controlBorder: "1px",
    inputBorder: "0px",
    radius: "14px",
  }, "the control wears one border, on the element that hosts the glass");

  await pick(page, "other");
  view = await stage(page);
  assert.equal(view.translate, "-200%");
  assert.deepEqual(view.shown, ["other"]);
  assert.equal(view.height, view.shownHeight);
  // A track with nothing to qualify is a shorter card, and the window has to
  // have actually moved for the switch to read as one object reshaping.
  assert.ok(view.height < 800, "the plainest track makes the shortest card: " + view.height);
  await shot(page, "desktop-other");
  good("keyboard and pointer switching: one panel width travelled, height followed, liquid stayed on stage");

  /* ── refusal ─────────────────────────────────────────────────────────── */
  await pick(page, "project");
  await page.locator("#contact-project-firstName").fill("Form");
  await page.locator("form[data-track='project'] .contact-submit").click();
  await page.waitForSelector(".contact-error-summary");
  assert.equal(app.requests.length, 0, "an incomplete brief is never sent");
  assert.ok(await page.locator("form[data-track='project'] .contact-error-summary").evaluate(el => el === document.activeElement));
  await shot(page, "desktop-validation");
  await page.locator("form[data-track='project'] .contact-error-summary a").first().click();
  await page.waitForFunction(() => document.activeElement?.id === "contact-project-lastName");
  await fillCore(page, "project", "We want to connect our website and operations into one clear system.");
  await page.waitForFunction(() =>
    !document.querySelector('#contact-project-message[aria-invalid="true"]'));
  good("refusal focuses a linked summary, sends nothing, and correction clears without stealing focus");

  /* ── the qualifiers, and the intent they resolve to ──────────────────── */
  await page.selectOption("#contact-project-focus", "structure");
  await page.selectOption("#contact-project-budget", "upTo150");
  await page.locator("#contact-project-company").fill("Local test only");
  await shot(page, "desktop-qualified");

  app.reply({ status: 500, body: { ok: false, error: "delivery" }, hold: true });
  await page.locator("form[data-track='project'] .contact-submit").click();
  await page.waitForFunction(() =>
    document.querySelector('form[data-track="project"]').getAttribute("aria-busy") === "true");
  assert.ok(await page.locator("form[data-track='project'] .contact-submit").isDisabled());
  assert.ok(await page.locator("#contact-project-message").isDisabled());
  await shot(page, "desktop-sending");
  app.release();
  await page.waitForSelector(".contact-error");
  assert.equal(await page.locator("#contact-project-email").inputValue(), "review@example.com",
    "a failed send keeps every entry");

  const sent = app.requests[0];
  assert.equal(sent.name, "Form Review", "the two visible name fields arrive as the one field the API has");
  assert.equal(sent.intent, "structure", "the focus qualifier refines the track's intent");
  assert.deepEqual(sent.details, { focus: "structure", budget: "upTo150" },
    "only answered qualifiers travel");

  app.reply({ status: 429, body: { ok: false, error: "rate_limit" } });
  await page.locator("form[data-track='project'] .contact-submit").click();
  await page.waitForFunction(() => document.querySelector(".contact-error")?.textContent.includes("Too many"));
  assert.equal(app.requests[0].submissionId, app.requests[1].submissionId, "the same brief keeps its id");
  app.reply({ status: 200, body: { ok: true, delivered: true } });
  await page.locator("form[data-track='project'] .contact-submit").click();
  await page.waitForSelector(".contact-success");
  assert.equal(app.requests[1].submissionId, app.requests[2].submissionId);
  assert.ok(await page.locator(".contact-success").evaluate(el => el === document.activeElement));
  await page.waitForTimeout(1300);
  await shot(page, "desktop-delivered");
  assert.deepEqual(app.errors, []);
  good("joined name, resolved intent, answered qualifiers, sending lock, idempotent retry and confirmed receipt");
  await app.ctx.close();

  /* ── the careers arrival ─────────────────────────────────────────────── */
  const careers = await setup({}, "pt", "&intent=careers");
  assert.equal(await careers.page.locator(".contact-tab").count(), 4, "careers adds its own track");
  assert.equal((await stage(careers.page)).checked, "careers");
  assert.equal(await careers.page.locator("#contact-careers-company").count(), 0,
    "an applicant is asked for a link, not for their employer");
  await careers.page.locator("#contact-careers-role").fill("Design Engineer");
  await fillCore(careers.page, "careers", "I build interfaces and I want to build them here.");
  await careers.page.locator("form[data-track='careers'] .contact-submit").click();
  await careers.page.waitForSelector(".contact-success");
  assert.equal(careers.requests[0].intent, "careers");
  assert.equal(careers.requests[0].details.role, "Design Engineer");
  await shot(careers.page, "careers");
  assert.deepEqual(careers.errors, []);
  good("careers arrival adds a fourth track, asks its own questions and stays on the one pipeline");
  await careers.ctx.close();

  /* ── every width, both locales, reduced motion ───────────────────────── */
  for (const [name, width, height, locale, reducedMotion] of [
    ["phone", 390, 844, "pt", "no-preference"],
    ["small-phone", 320, 740, "pt", "reduce"],
    ["tablet", 768, 1024, "en", "reduce"],
    ["short-laptop", 1280, 720, "en", "no-preference"],
  ]) {
    const item = await setup({ viewport: { width, height }, reducedMotion, hasTouch: width < 500, isMobile: width < 500 }, locale);
    await item.page.locator(".contact-card").scrollIntoViewIfNeeded();
    await shot(item.page, name + "-project");
    await pick(item.page, "advisory");
    const shown = await stage(item.page);
    assert.deepEqual(shown.shown, ["advisory"], name + " switches under reduced motion too");
    await fillCore(item.page, "advisory", "A local verification of the advisory track at " + width + "px.");
    const overflow = await item.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert.equal(overflow, false, name + " overflow");
    // 16px is the iOS zoom floor; 44px is the touch target floor.
    const fields = await item.page.locator("form[data-track='advisory'] .field :is(input, select, textarea)")
      .evaluateAll(els => els.map(el => ({ w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height, font: parseFloat(getComputedStyle(el).fontSize) })));
    assert.ok(fields.length > 0);
    assert.ok(fields.every(f => f.w >= 130 && f.h >= 44 && f.font >= 16), name + " " + JSON.stringify(fields));
    await shot(item.page, name + "-advisory");
    item.reply({ status: 202, body: { ok: true, accepted: true, delivered: false, pending: true } });
    await item.page.locator("form[data-track='advisory'] .contact-submit").click();
    await item.page.waitForSelector(".contact-pending");
    assert.ok(await item.page.locator("form[data-track='advisory'] .contact-submit").isDisabled());
    assert.equal(await item.page.locator(".contact-success").count(), 0, "pending is not delivered");
    await shot(item.page, name + "-pending");
    assert.deepEqual(item.errors, []);
    good(name + ": switching, usable controls, no overflow, pending distinct from delivered");
    await item.ctx.close();
  }

  /* ── the REAL endpoint, unmocked ─────────────────────────────────────── */
  // Every check above intercepts `/api/contact`, which means none of them has
  // ever run the request through the actual Zod schema — `page.route` answers
  // before the handler is reached. That gap shipped a live defect once: Zod 4's
  // `z.record` over an enum key is EXHAUSTIVE, so a `details` object carrying
  // two of the eight qualifiers was rejected outright, and the whole suite
  // stayed green because the payload never left the browser.
  //
  // So one payload goes all the way in. The assertion is narrow on purpose:
  // NOT `validation`. Local runs have no delivery key and answer
  // `configuration`; a configured environment answers `delivered`. Either is a
  // schema that accepted the form. Only `validation` means it did not.
  const real = await browser.newContext();
  const probe = await real.request.post(BASE + "/api/contact", {
    headers: { "Content-Type": "application/json" },
    data: {
      name: "Schema Probe",
      email: "probe@example.com",
      company: "Local test only",
      message: "A local verification that the real schema accepts a partial qualifier set.",
      intent: "structure",
      details: { focus: "structure", budget: "upTo150" },
      submissionId: crypto.randomUUID(),
    },
  });
  const body = await probe.json();
  assert.notEqual(body.error, "validation",
    "the real schema must accept an enquiry that answered SOME qualifiers: " + JSON.stringify(body));
  // And it must still refuse a key that is not on the closed list.
  const junk = await real.request.post(BASE + "/api/contact", {
    headers: { "Content-Type": "application/json" },
    data: {
      name: "Schema Probe",
      email: "probe@example.com",
      message: "A local verification that unknown qualifier keys are refused.",
      intent: "general",
      details: { focus: "structure", smuggled: "x" },
      submissionId: crypto.randomUUID(),
    },
  });
  assert.equal((await junk.json()).error, "validation", "unknown qualifier keys are refused");
  await real.close();
  good("the real endpoint accepts a partial qualifier set and refuses an unknown key");

  /* ── the server HTML on its own ──────────────────────────────────────── */
  // Three real forms, a switch made of radios and `:has()`, and a native POST
  // that reconstructs exactly what the fetch path sends. No client runtime.
  // `reducedMotion` is the harness's business, not the page's: without
  // JavaScript there is no Lenis, so `scroll-behavior: smooth` is the browser's
  // own, and Playwright's stability check races a scroll that is still easing.
  // The site turns smooth scrolling off under reduced motion anyway.
  const native = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const nojs = await native.newPage();
  let posted = "";
  await nojs.route("**/api/contact**", async route => {
    posted = route.request().postData();
    await route.fulfill({ status: 303, headers: { location: BASE + "/pt/contact?contact=pending" }, body: "" });
  });
  await nojs.goto(BASE + "/pt/contact");
  assert.equal(await nojs.locator("form.contact-form").count(), 3);
  assert.deepEqual((await stage(nojs)).shown, ["project"]);
  await nojs.locator('.contact-tab:has(input[value="other"])').click();
  await nojs.waitForTimeout(SLIDE);
  const switched = await stage(nojs);
  assert.equal(switched.translate, "-200%", "the switch is CSS and needs no script");
  assert.deepEqual(switched.shown, ["other"]);
  await nojs.locator("#contact-other-firstName").fill("Native");
  await nojs.locator("#contact-other-lastName").fill("Review");
  await nojs.locator("#contact-other-email").fill("native@example.com");
  await nojs.locator("#contact-other-message").fill("This is a local no JavaScript form verification.");
  await nojs.locator("form[data-track='other'] .contact-submit").click();
  await nojs.waitForURL("**/contact?contact=pending");
  const fields = new URLSearchParams(posted);
  assert.equal(fields.get("firstName"), "Native");
  assert.equal(fields.get("lastName"), "Review");
  assert.equal(fields.get("track"), "other");
  assert.ok(await nojs.locator(".contact-pending").isVisible());
  await shot(nojs, "nojs");
  await native.close();
  good("no-JS: three native forms, a CSS switch, an encoded POST and a truthful redirect outcome");

  fs.writeFileSync(OUT + "/report.json", JSON.stringify({ result: "pass", checks: report }, null, 2));
  console.log("CONTACT JOURNEY: all green");
} finally { await browser.close(); }
