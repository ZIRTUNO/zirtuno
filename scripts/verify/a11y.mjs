// verify-a11y (R5-E) — the accessibility + i18n regression floor, both
// locales, machine-checkable side (§4.13):
//
//   · document lang, landmarks, ONE h1, no heading-level skips
//   · every image has alt; decorative layers are aria-hidden
//   · skip link is first-focusable and lands on #content; the mobile menu
//     opens/closes by keyboard with aria-expanded truth
//   · focus is VISIBLE on the interactive chrome
//   · standing text contrast vs ink ≥ 4.5:1 (small) / 3:1 (large) — the
//     token/opacity regression tripwire (composition over liquid is the
//     owner's visual call; transient veil contrast is verify-cinematics')
//   · pt.json / en.json carry EXACTLY the same key tree
//   · reduced motion keeps the whole story
//   · no-JS keeps the authored reading order
//
// The contact-form assertions (labelled fields, a real labelled submit, the
// native POST fallback markup) were dropped on 2026-09-04 when S10 was
// quarantined and RESTORED on 2026-09-05 against `/[locale]/contact`, the
// route that replaced the chapter. They now also cover the intent chooser,
// which is new: the `?intent=` handshake used to land in a hidden field where
// nothing could observe whether it had been honoured.
//
// The homepage chapter count stays EIGHT. Contact is a route now, not a
// chapter, so it is deliberately absent from `lib/content/chapters.ts` and
// from the no-JS chapter sweep — those assert what the homepage contains.
//
// Dev server must be running:  node scripts/verify/a11y.mjs

import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

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
      document.querySelector(".gather-row-trigger")?.tabIndex === 0,
    { timeout: 40000 },
  );
  // Element-agnostic on purpose: an intent CTA renders as `<a>` when it has
  // a destination and as `<button aria-disabled>` while the S10 replacement
  // is under development. Both are focusable, which is the property this
  // test actually depends on — `a.cta` silently stopped matching on
  // 2026-09-04 and the gate timed out rather than failing a check.
  await page.locator("#problem .cta").focus();
  await page.keyboard.press("Tab");
  await page.waitForTimeout(1000);
  const first = await page.evaluate(() => ({
    trigger: document.activeElement?.classList.contains(
      "gather-row-trigger",
    ),
    label: document.activeElement?.textContent?.trim(),
    visible:
      document.activeElement instanceof HTMLElement &&
      Number(
        getComputedStyle(document.activeElement.closest(".gather-row"))
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
      "gather-row-trigger",
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
    // THE WETTING EDGE is a scrub, and this sweep measures STANDING contrast.
    // A wetted block's words carry a scroll-derived colour that is dry ahead
    // of the reading front by design, so measuring them mid-travel audits a
    // state no reader ever rests on — the same reason the veils are audited by
    // verify-cinematics rather than here. Dropping `data-wet` disables the
    // scrub's only rule, which returns every word to the colour it INHERITS
    // from its block: the colour the block itself reported before it was split
    // into words, and the one a reader actually rests on. Recorded, not
    // skipped — the words stay in the population below, and the arrived state
    // is what has to pass. probe/wet-edge.mjs gates that the front does in
    // fact land there, and that no path but the live loop ever dims a word.
    const scrubbed = document.querySelectorAll("[data-wet]");
    for (const el of scrubbed) el.removeAttribute("data-wet");

    // Chromium serialises a color-mix() result as `color(srgb 0.94 0.94 0.92 /
    // 0.54)` — channels 0..1 — while everything else still comes back as
    // `rgb(242 240 235 / 0.54)`, channels 0..255. Reading the srgb form on the
    // 0..255 assumption turns every mixed colour into black, which composites
    // to the background and reports a flat 1.00 ratio: a false failure on
    // exactly the tokens most likely to regress.
    const parse = (value) => {
      const m = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
      const scale = /^color\(\s*srgb/i.test(value) ? 255 : 1;
      return {
        r: (m[0] ?? 0) * scale,
        g: (m[1] ?? 0) * scale,
        b: (m[2] ?? 0) * scale,
        a: m.length > 3 ? m[3] : 1,
      };
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
    const glassed = [];
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
      // background-clip:text paints the glyphs OUT OF the background-image and
      // sets `color` transparent on purpose. Measuring `color` there measures
      // the wrong property and reports 1.00 on text that is plainly visible.
      // These are audited by a different property instead: they must declare a
      // fill, and they must hand the text back to system colours under
      // forced-colors, where the fill is dropped. Recorded, not skipped.
      // The clipping element is not always the one holding the text: the
      // wetting edge splits a glassed heading into per-word spans, and a word
      // inherits the block's transparent `color` while carrying no clip of
      // its own. Measuring it reports 1.00 on a headline that is plainly
      // visible — the same false failure this branch was written for, one
      // level down. So the fill is looked for on the element OR the nearest
      // ancestor that declares it.
      let clipper = null;
      if (parse(cs.color).a === 0) {
        for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
          const ncs = getComputedStyle(n);
          if ((ncs.webkitBackgroundClip || ncs.backgroundClip) === "text") {
            clipper = { el: n, cs: ncs };
            break;
          }
        }
      }
      if (clipper) {
        glassed.push({
          tag: `${clipper.el.tagName}.${String(clipper.el.className).slice(0, 40)}`,
          hasFill: clipper.cs.backgroundImage !== "none",
        });
        continue;
      }
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
    for (const el of scrubbed) el.setAttribute("data-wet", "on");
    return {
      glassed,
      scrubbed: scrubbed.length,
      words: document.querySelectorAll(".wet-w").length,
      worstSmall,
      worstLarge,
      at,
      atL,
    };
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
  // Every glassed heading must actually carry a fill (transparent glyphs with
  // no background-image are invisible glyphs) — the failure mode the plain
  // contrast sweep can no longer see now that these are audited separately.
  check(
    contrast.glassed.every((g) => g.hasFill),
    `${contrast.glassed.length} background-clip:text headings all carry a fill`,
    contrast.glassed
      .filter((g) => !g.hasFill)
      .map((g) => g.tag)
      .join(", ") || "all filled",
  );
  // The wetting edge is only allowed to be a scrub if the copy under it is
  // real copy. This says how much of the page it covers, so a future change
  // that quietly wraps the whole document in it is visible here.
  check(
    contrast.words === 0 || contrast.scrubbed > 0,
    `${contrast.words} scrubbed words audited at their arrived colour`,
    `${contrast.scrubbed} blocks`,
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

// ── reduced motion — the whole story ───────────────────────────────────
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
    ]
      .filter((id) => !document.getElementById(id))
      .join(","),
    veils: document.querySelectorAll(".cine-veils").length,
  }));
  check(rm.static === "static", "liquid takes the static path", rm.static);
  check(rm.missing === "", "all eight chapters readable", rm.missing);
  check(rm.veils === 0, "no cinematic veils under reduced motion");
  await ctx.close();
}

// ── no JavaScript — progressive enhancement never hides the business case ───
// The `?intent=structure` param is kept on the URL deliberately: it is the tag
// the CTAs still write, and the page must render identically with it present.
{
  console.log(
    "no JavaScript · complete static reading",
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
    // "absent" is a PASS: the route wipe no longer renders on a document's
    // first paint at all (it is a transition, and there is nothing to
    // transition from), so nothing can cover the no-JS page.
    const displayOf = (element) =>
      element ? getComputedStyle(element).display : "absent";
    return {
      h1: visible(document.querySelector("h1")),
      veil: displayOf(document.querySelector(".entry-veil")),
      wipe: displayOf(document.querySelector(".page-wipe")),
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
      ]
        .filter((id) => !document.getElementById(id))
        .join(","),
      canvases: document.querySelectorAll(".journey-canvas canvas").length,
    };
  });
  const inert = (value) => value === "none" || value === "absent";
  check(
    noJs.h1 && inert(noJs.veil) && inert(noJs.wipe),
    "entry and route motion cannot strand the no-JS page",
    JSON.stringify(noJs),
  );
  check(
    noJs.hiddenReveals === 0 && noJs.missing === "" && noJs.canvases === 0,
    "all eight authored chapters render visibly without JavaScript or WebGL",
    JSON.stringify(noJs),
  );
  // The no-JS POST fallback. Since 2026-09-05 the form is its own route, so
  // the redirect target is `/{locale}/contact` — the page that can actually
  // render the status it carries. It used to be `/{locale}?contact=…#contact`,
  // and pinning the exact string here is the point: a redirect to a page that
  // does not read `?contact=` is a submission that silently does nothing, and
  // it looks identical to a working one from the server's side.
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
      fallback.headers().location?.endsWith("/en/contact?contact=error"),
    "form-encoded fallback returns to an honest localized status",
    `${fallback.status()} ${fallback.headers().location}`,
  );
  await ctx.close();
}

// ── S10 · the contact page — the form's own accessibility floor ──────────────
// These assertions were dropped on 2026-09-04 when the chapter was quarantined
// and are restored against the route. What they protect is the property that
// makes the form usable at all: every control reachable and NAMED, the intent
// handshake visibly honoured, and a complete native POST underneath the
// enhancement so a browser with no JavaScript still has a working form.
for (const locale of ["pt", "en"]) {
  console.log(`${locale} · contact page`);
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${locale}/contact?intent=structure`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector("form.contact-form", { timeout: 30000 });

  const form = await page.evaluate(() => {
    const el = document.querySelector("form.contact-form");
    const controls = [
      ...el.querySelectorAll(".field input, .field textarea"),
    ];
    const named = controls.filter((control) => {
      const label = el.querySelector(`label[for="${control.id}"]`);
      return !!control.id && !!label && label.textContent.trim().length > 0;
    });
    const submit = el.querySelector('button[type="submit"]');
    const radios = [...el.querySelectorAll('input[type="radio"][name="intent"]')];
    const legend = el.querySelector("fieldset.contact-choice > legend");
    return {
      action: el.getAttribute("action") || "",
      method: (el.getAttribute("method") || "").toLowerCase(),
      controls: controls.length,
      named: named.length,
      submitLabel: submit?.textContent?.trim() ?? "",
      // The honeypot must never be focusable and must never be a control a
      // real visitor can be asked to fill.
      honeypotTabIndex:
        el.querySelector(".contact-honeypot input")?.tabIndex ?? null,
      radios: radios.length,
      checked: radios.find((radio) => radio.checked)?.value ?? null,
      legend: legend?.textContent?.trim() ?? "",
    };
  });

  check(
    form.controls === 4 && form.named === 4,
    "every contact control has a real, non-empty label",
    JSON.stringify({ controls: form.controls, named: form.named }),
  );
  check(
    form.submitLabel.length > 0,
    "the submit button carries a visible label",
    form.submitLabel,
  );
  check(
    form.method === "post" && form.action.includes("/api/contact"),
    "the form posts natively without JavaScript",
    `${form.method} ${form.action}`,
  );
  check(
    form.honeypotTabIndex === -1,
    "the honeypot is out of the tab order",
    String(form.honeypotTabIndex),
  );
  check(
    form.radios >= 4 && form.legend.length > 0,
    "the intent chooser is a labelled group of radios",
    JSON.stringify({ radios: form.radios, legend: form.legend }),
  );
  // The handshake, end to end: nine CTAs across the site spend an `?intent=`
  // tag and this is the only place it is ever spent. A tag that arrives and
  // is silently ignored is worse than no tag, because the analytics still
  // report it as a segmented lead.
  check(
    form.checked === "structure",
    "an arriving ?intent= tag pre-selects its chip",
    String(form.checked),
  );
  await ctx.close();
}

await browser.close();
console.log(
  failures === 0 ? "A11Y/I18N: all green" : `A11Y FAILURES: ${failures}`,
);
process.exit(failures === 0 ? 0 : 1);
