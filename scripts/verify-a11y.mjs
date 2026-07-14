// verify-a11y (R5-E) — the accessibility + i18n regression floor, both
// locales, machine-checkable side (§4.13):
//
//   · document lang, landmarks, ONE h1, no heading-level skips
//   · every image has alt; decorative layers are aria-hidden
//   · every contact field is labelled; the submit is a real labelled button
//   · skip link is first-focusable and lands on #content; the mobile menu
//     opens/closes by keyboard with aria-expanded truth
//   · focus is VISIBLE on the interactive chrome
//   · standing text contrast vs ink ≥ 4.5:1 (small) / 3:1 (large) — the
//     token/opacity regression tripwire (composition over liquid is the
//     owner's visual call; transient veil contrast is verify-cinematics')
//   · pt.json / en.json carry EXACTLY the same key tree
//   · reduced motion keeps the whole story + conversion path
//   · no-JS keeps the authored reading order and native form action visible
//
// Dev server must be running:  node scripts/verify-a11y.mjs

import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";

let failures = 0;
const check = (ok, label, detail) => {
  console.log(
    `${ok ? "  ✓" : "  ✗ FAIL"} ${label}${detail ? ` — ${detail}` : ""}`,
  );
  if (!ok) failures++;
};

// ── i18n parity (pure node) ───────────────────────────────────────────────────
{
  console.log("i18n · message key parity");
  const walk = (o, p = "") =>
    Object.entries(o).flatMap(([k, v]) =>
      v && typeof v === "object" && !Array.isArray(v)
        ? walk(v, `${p}${k}.`)
        : [`${p}${k}`],
    );
  const pt = new Set(
    walk(JSON.parse(fs.readFileSync("lib/i18n/messages/pt.json", "utf8"))),
  );
  const en = new Set(
    walk(JSON.parse(fs.readFileSync("lib/i18n/messages/en.json", "utf8"))),
  );
  const onlyPt = [...pt].filter((k) => !en.has(k));
  const onlyEn = [...en].filter((k) => !pt.has(k));
  check(
    onlyPt.length === 0 && onlyEn.length === 0,
    `pt/en key trees identical (${pt.size} keys)`,
    [
      onlyPt.length && `pt-only: ${onlyPt.slice(0, 3)}`,
      onlyEn.length && `en-only: ${onlyEn.slice(0, 3)}`,
    ]
      .filter(Boolean)
      .join(" · "),
  );
}

const browser = await chromium.launch(LAUNCH);

// ── live Ecosystem — stable keyboard order independent of scroll score ───────
{
  console.log("ecosystem · stable live keyboard controls");
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en?ftier=full&fgov=0`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () =>
      document.querySelector(".liquid-journey")?.dataset.liquid === "live" &&
      document.querySelector(".organism-node-trigger")?.tabIndex === 0,
    { timeout: 40000 },
  );
  await page.locator("#problem a.cta").focus();
  await page.keyboard.press("Tab");
  await page.waitForTimeout(1000);
  const first = await page.evaluate(() => ({
    trigger: document.activeElement?.classList.contains(
      "organism-node-trigger",
    ),
    label: document.activeElement?.textContent?.trim(),
    visible:
      document.activeElement instanceof HTMLElement &&
      Number(
        getComputedStyle(document.activeElement.closest(".organism-node"))
          .opacity,
      ) > 0.9,
  }));
  check(
    first.trigger && first.visible,
    "Tab from Problem reaches a visible orbit control and retains focus",
    JSON.stringify(first),
  );
  await page.keyboard.press("Tab");
  await page.waitForTimeout(600);
  const second = await page.evaluate(() => ({
    trigger: document.activeElement?.classList.contains(
      "organism-node-trigger",
    ),
    label: document.activeElement?.textContent?.trim(),
  }));
  check(
    second.trigger && second.label !== first.label,
    "orbit controls remain sequential after focus-driven scrolling",
    JSON.stringify(second),
  );
  await ctx.close();
}

for (const locale of ["pt", "en"]) {
  console.log(`${locale} · semantic + keyboard + contrast`);
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${locale}?ftier=none`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => !!document.querySelector("h1"), {
    timeout: 40000,
  });
  await page.waitForTimeout(1500);

  const sem = await page.evaluate(() => {
    const hs = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(
      (h) => {
        const cs = getComputedStyle(h);
        return cs.display !== "none" && cs.visibility !== "hidden";
      },
    );
    let skip = "";
    let prev = 0;
    for (const h of hs) {
      const lv = +h.tagName[1];
      if (prev && lv > prev + 1)
        skip = `${h.tagName} after h${prev}: "${h.textContent.slice(0, 30)}"`;
      prev = lv;
    }
    const imgs = [...document.querySelectorAll("img")];
    const fields = [
      ...document.querySelectorAll(
        "#contact input, #contact textarea, #contact select",
      ),
    ].filter((f) => f.type !== "hidden");
    const unlabelled = fields.filter(
      (f) =>
        !f.labels?.length &&
        !f.getAttribute("aria-label") &&
        !f.getAttribute("aria-labelledby"),
    );
    const submit = document.querySelector('#contact button[type="submit"]');
    return {
      lang: document.documentElement.lang,
      mains: document.querySelectorAll("main#content").length,
      navs: document.querySelectorAll("nav, [role=navigation]").length,
      footers: document.querySelectorAll("footer").length,
      h1s: hs.filter((h) => h.tagName === "H1").length,
      headingSkip: skip,
      noAlt: imgs.filter((i) => !i.hasAttribute("alt")).length,
      canvasHidden: ![...document.querySelectorAll(".journey-canvas")].some(
        (c) => c.getAttribute("aria-hidden") !== "true",
      ),
      fieldCount: fields.length,
      unlabelled: unlabelled.map((f) => f.name || f.id).join(","),
      submitLabelled: !!submit && submit.textContent.trim().length > 3,
    };
  });
  check(
    sem.lang.startsWith(locale),
    "document lang matches the locale",
    sem.lang,
  );
  check(sem.mains === 1, "exactly one main#content landmark", `${sem.mains}`);
  check(sem.navs >= 1 && sem.footers >= 1, "nav + footer landmarks present");
  check(sem.h1s === 1, "exactly one h1", `${sem.h1s}`);
  check(!sem.headingSkip, "no heading-level skips", sem.headingSkip);
  check(sem.noAlt === 0, "every image carries alt", `${sem.noAlt} missing`);
  check(sem.canvasHidden, "liquid canvas is aria-hidden");
  check(
    sem.fieldCount >= 3 && sem.unlabelled === "",
    `all ${sem.fieldCount} contact fields labelled`,
    sem.unlabelled,
  );
  check(sem.submitLabelled, "contact submit is a real labelled button");

  // keyboard: skip link first, lands on content
  await page.keyboard.press("Tab");
  const first = await page.evaluate(() => ({
    cls: document.activeElement?.className,
    text: document.activeElement?.textContent?.trim(),
  }));
  check(
    first.cls?.includes("skip-link"),
    "skip link is the first tab stop",
    JSON.stringify(first),
  );
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  const skipped = await page.evaluate(
    () =>
      location.hash === "#content" || document.activeElement?.id === "content",
  );
  check(skipped, "skip link lands on #content");

  // focus visibility on the chrome (first CTA)
  const focusVisible = await page.evaluate(() => {
    const el = document.querySelector("a.cta, button.cta, .topbar a");
    if (!el) return "no-cta";
    el.focus();
    const cs = getComputedStyle(el);
    return cs.outlineStyle !== "none" || cs.boxShadow !== "none";
  });
  check(
    focusVisible === true,
    "focus is visible on the chrome",
    String(focusVisible),
  );

  // standing contrast — token/opacity regression tripwire. Text color is
  // alpha-composited onto the element's EFFECTIVE background (nearest opaque
  // ancestor, itself composited onto ink); decorative aria-hidden content
  // (watermarks, canvas labels) is out of scope by definition.
  const contrast = await page.evaluate(() => {
    const parse = (rgb) => {
      const m = rgb.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
      return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 };
    };
    const over = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    });
    const lum = (c) => {
      const ch = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
    };
    const bgOf = (el) => {
      let bg = { r: 0, g: 0, b: 0, a: 1 }; // ink at the root
      const chain = [];
      for (let n = el; n && n !== document.documentElement; n = n.parentElement)
        chain.unshift(n);
      for (const n of chain) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c.a > 0) bg = over(c, bg);
      }
      return bg;
    };
    let worstSmall = Infinity;
    let worstLarge = Infinity;
    let at = "";
    let atL = "";
    for (const el of document.querySelectorAll(
      "h1,h2,h3,h4,p,li,a,span,button,label,dt,dd",
    )) {
      if (!el.textContent?.trim() || el.children.length > 0) continue;
      if (el.closest('[aria-hidden="true"]')) continue;
      const cs = getComputedStyle(el);
      if (
        cs.display === "none" ||
        cs.visibility === "hidden" ||
        +cs.opacity === 0
      )
        continue;
      const bg = bgOf(el);
      const fg = over(parse(cs.color), bg);
      const l1 = lum(fg);
      const l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const size = parseFloat(cs.fontSize);
      const bold = +cs.fontWeight >= 600;
      const large = size >= 24 || (size >= 18.66 && bold);
      const tag = `${el.tagName}.${String(el.className).slice(0, 40)} "${el.textContent.slice(0, 24)}"`;
      if (large) {
        if (ratio < worstLarge) {
          worstLarge = ratio;
          atL = tag;
        }
      } else if (ratio < worstSmall) {
        worstSmall = ratio;
        at = tag;
      }
    }
    return { worstSmall, worstLarge, at, atL };
  });
  check(
    contrast.worstSmall >= 4.5,
    "small text ≥ 4.5:1 on its effective background",
    `worst=${contrast.worstSmall.toFixed(2)} at ${contrast.at}`,
  );
  check(
    contrast.worstLarge >= 3,
    "large text ≥ 3:1 on its effective background",
    `worst=${contrast.worstLarge.toFixed(2)} at ${contrast.atL}`,
  );
  await ctx.close();
}

// ── mobile menu keyboard (one locale suffices — shared chrome) ────────────────
{
  console.log("menu · keyboard open/close");
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en?ftier=none`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector("h1"), {
    timeout: 40000,
  });
  await page.waitForTimeout(1000);
  const burger = page.locator(".burger");
  if ((await burger.count()) === 1) {
    await burger.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    const open = await page.evaluate(() => ({
      expanded: document
        .querySelector(".burger")
        ?.getAttribute("aria-expanded"),
      menu: !!document.querySelector(".mobile-menu"),
    }));
    check(
      open.expanded === "true" && open.menu,
      "menu opens by keyboard",
      JSON.stringify(open),
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    const closed = await page.evaluate(() =>
      document.querySelector(".burger")?.getAttribute("aria-expanded"),
    );
    check(
      closed === "false",
      "menu closes on Escape",
      `aria-expanded=${closed}`,
    );
  } else {
    check(false, "burger control present on mobile");
  }
  await ctx.close();
}

// ── reduced motion — the whole story + the conversion path ────────────────────
{
  console.log("reduced motion · complete reading path");
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/pt`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector("h1"), {
    timeout: 40000,
  });
  await page.waitForTimeout(2000);
  const rm = await page.evaluate(() => ({
    static: document.querySelector(".liquid-journey")?.dataset.liquid,
    missing: [
      "hero",
      "problem",
      "ecosystem",
      "services",
      "method",
      "work",
      "name",
      "studio",
      "contact",
    ]
      .filter((id) => !document.getElementById(id))
      .join(","),
    submit: !!document.querySelector('#contact button[type="submit"]'),
    veils: document.querySelectorAll(".cine-veils").length,
  }));
  check(rm.static === "static", "liquid takes the static path", rm.static);
  check(rm.missing === "", "all nine chapters readable", rm.missing);
  check(rm.submit, "conversion path intact");
  check(rm.veils === 0, "no cinematic veils under reduced motion");
  await ctx.close();
}

// ── no JavaScript — progressive enhancement never hides the business case ───
{
  console.log(
    "no JavaScript · complete static reading and native contact path",
  );
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    javaScriptEnabled: false,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en?intent=structure`, { waitUntil: "load" });
  const noJs = await page.evaluate(() => {
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0
      );
    };
    const form = document.querySelector("#contact form");
    return {
      h1: visible(document.querySelector("h1")),
      veil: getComputedStyle(document.querySelector(".entry-veil")).display,
      wipe: getComputedStyle(document.querySelector(".page-wipe")).display,
      hiddenReveals: [...document.querySelectorAll("[data-reveal]")].filter(
        (element) => !visible(element),
      ).length,
      missing: [
        "hero",
        "problem",
        "ecosystem",
        "services",
        "method",
        "work",
        "name",
        "studio",
        "contact",
      ]
        .filter((id) => !document.getElementById(id))
        .join(","),
      canvases: document.querySelectorAll(".journey-canvas canvas").length,
      action: form?.getAttribute("action"),
      method: form?.getAttribute("method"),
      intent: form?.querySelector('input[name="intent"]')?.value,
      required: document.querySelectorAll(
        "#contact input[required], #contact textarea[required]",
      ).length,
      submit: visible(document.querySelector('#contact button[type="submit"]')),
    };
  });
  check(
    noJs.h1 && noJs.veil === "none" && noJs.wipe === "none",
    "entry and route motion cannot strand the no-JS page",
    JSON.stringify(noJs),
  );
  check(
    noJs.hiddenReveals === 0 && noJs.missing === "" && noJs.canvases === 0,
    "all nine authored chapters render visibly without JavaScript or WebGL",
    JSON.stringify(noJs),
  );
  check(
    noJs.action === "/api/contact?locale=en" &&
      noJs.method === "post" &&
      noJs.intent === "structure" &&
      noJs.required >= 3 &&
      noJs.submit,
    "native contact form has a constrained POST fallback",
    JSON.stringify(noJs),
  );
  const fallback = await ctx.request.post(`${BASE}/api/contact?locale=en`, {
    form: {
      name: "x",
      email: "invalid",
      company: "",
      message: "short",
      intent: "general",
      website: "",
    },
    maxRedirects: 0,
  });
  check(
    fallback.status() === 303 &&
      fallback.headers().location?.endsWith("/en?contact=error#contact"),
    "form-encoded fallback returns to an honest localized status",
    `${fallback.status()} ${fallback.headers().location}`,
  );
  await ctx.close();
}

await browser.close();
console.log(
  failures === 0 ? "A11Y/I18N: all green" : `A11Y FAILURES: ${failures}`,
);
process.exit(failures === 0 ? 0 : 1);
