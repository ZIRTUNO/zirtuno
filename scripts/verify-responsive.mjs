// verify-responsive — the RESPONSIVENESS gate.
//
//   BASE_URL=http://localhost:PORT node scripts/verify-responsive.mjs
//   WIDTHS=360,768 node scripts/verify-responsive.mjs      (narrow the sweep)
//
// Walks the real page at every width the site is expected to survive and, at
// each chapter, asserts the things that are objectively broken rather than
// merely ugly:
//
//   · the document never scrolls sideways (the single most common phone defect)
//   · no ELEMENT sticks out past the viewport — reported with the culprit's
//     selector, because "the page overflows by 12px" is not actionable
//   · every interactive control meets the 44px touch target
//   · no text is set below 12px
//   · copy is never hidden under the fixed topbar at rest
//   · every chapter actually has height (a collapsed section is invisible)
//
// The liquid canvas is deliberately exempt from the overflow check: it is a
// fixed full-bleed layer and is *supposed* to span the viewport.

import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const LOCALE = process.env.LOCALE || "pt";

// the range the site claims to support: small Android → desktop
const WIDTHS = (process.env.WIDTHS || "320,360,390,414,430,540,768,834,1024,1280,1440,1920")
  .split(",")
  .map((n) => Number(n.trim()))
  .filter(Boolean);

const CHAPTERS = [
  "hero",
  "problem",
  "ecosystem",
  "services",
  "method",
  "work",
  "name",
  "studio",
  "contact",
];

let failures = 0;
const fail = (label, detail) => {
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  failures++;
};

/** A stable, human-usable selector for a DOM node. */
const DESCRIBE = `(el) => {
  const id = el.id ? '#' + el.id : '';
  const cls = typeof el.className === 'string' && el.className
    ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.')
    : '';
  return (el.tagName.toLowerCase() + id + cls).slice(0, 80);
}`;

const browser = await chromium.launch(LAUNCH);

for (const width of WIDTHS) {
  const phone = width < 768;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 780 : 900 },
    deviceScaleFactor: 1,
    isMobile: phone,
    hasTouch: phone,
    reducedMotion: "no-preference",
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));

  // ftier=none keeps the WebGL canvas out of it: this gate is about LAYOUT, and
  // a software-rendered field only adds noise and minutes.
  await page.goto(`${BASE}/${LOCALE}?ftier=none&fgov=0`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 40000 });
  await page.waitForTimeout(600);

  console.log(`\n${width}px`);

  for (const id of CHAPTERS) {
    const ok = await page.evaluate((cid) => {
      const el = document.getElementById(cid);
      if (!el) return false;
      el.scrollIntoView({ block: "start" });
      return true;
    }, id);
    if (!ok) {
      fail(`#${id} missing`);
      continue;
    }
    await page.waitForTimeout(260);

    const report = await page.evaluate(
      ({ describe, cid }) => {
        const desc = eval(describe);
        const vw = document.documentElement.clientWidth;
        const out = { overflow: [], small: [], tiny: [], hidden: [], docWidth: 0, sectionH: 0 };
        out.docWidth = document.documentElement.scrollWidth;
        const section = document.getElementById(cid);
        out.sectionH = section ? section.getBoundingClientRect().height : 0;

        // Elements escaping the viewport horizontally — but only ones that
        // ACTUALLY escape. Decorative sheens and mesh gradients are routinely
        // positioned outside their parent and clipped by it; reporting those is
        // noise that buries the real defects.
        const clipped = (el) => {
          let r = el.getBoundingClientRect();
          for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const pcs = getComputedStyle(p);
            if (pcs.overflowX !== "visible" || pcs.overflowY !== "visible") {
              const pr = p.getBoundingClientRect();
              if (r.right > pr.right - 1 || r.left < pr.left + 1) return true;
            }
          }
          return false;
        };
        for (const el of document.body.querySelectorAll("*")) {
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          if (cs.position === "fixed") continue; // full-bleed layers are meant to
          // Parked off-screen on purpose (honeypots, sr-only, offset labels).
          // A negative offset cannot widen the document, so it is not overflow.
          if (el.closest('[aria-hidden="true"]')) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.right < 0) continue;
          if (r.right > vw + 1 || r.left < -1) {
            if (clipped(el)) continue;
            const d = desc(el);
            if (!out.overflow.some((o) => o.el === d))
              out.overflow.push({ el: d, right: Math.round(r.right), left: Math.round(r.left) });
          }
        }

        // touch targets + minimum type size, within this chapter only
        const scope = section ?? document.body;
        for (const el of scope.querySelectorAll("a[href], button, input, select, textarea")) {
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          // Not a target if it cannot be reached: honeypot traps and other
          // aria-hidden/-1 controls exist precisely to be untouchable.
          if (el.tabIndex < 0 || el.closest('[aria-hidden="true"]')) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.width < 44 || r.height < 44) {
            const d = desc(el);
            if (!out.small.some((o) => o.el === d))
              out.small.push({ el: d, w: Math.round(r.width), h: Math.round(r.height) });
          }
        }
        for (const el of scope.querySelectorAll("p, li, dd, dt, span, a, h1, h2, h3, h4")) {
          if (!el.textContent?.trim()) continue;
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          const size = parseFloat(cs.fontSize);
          if (size && size < 12) {
            const d = desc(el);
            if (!out.tiny.some((o) => o.el === d)) out.tiny.push({ el: d, size: size.toFixed(1) });
          }
        }

        // copy sitting under the fixed topbar once the chapter is parked
        const bar = document.querySelector(".topbar");
        const barH = bar ? bar.getBoundingClientRect().height : 0;
        if (barH && section) {
          for (const el of section.querySelectorAll("h1, h2, h3, p")) {
            const cs = getComputedStyle(el);
            if (cs.display === "none" || cs.visibility === "hidden") continue;
            if (!el.textContent?.trim()) continue;
            const r = el.getBoundingClientRect();
            if (r.height === 0) continue;
            // more than half the line buried behind the bar
            if (r.top < barH - 2 && r.bottom > 0 && r.bottom - barH < r.height * 0.5) {
              const d = desc(el);
              if (!out.hidden.some((o) => o.el === d))
                out.hidden.push({ el: d, top: Math.round(r.top) });
            }
          }
        }
        return out;
      },
      { describe: DESCRIBE, cid: id },
    );

    const vw = width;
    if (report.docWidth > vw + 1)
      fail(`#${id} scrolls sideways`, `document ${report.docWidth}px vs viewport ${vw}px`);
    if (report.overflow.length)
      fail(
        `#${id} elements past the viewport`,
        report.overflow.slice(0, 3).map((o) => `${o.el} → ${o.right}px`).join(", "),
      );
    if (report.small.length)
      fail(
        `#${id} touch targets under 44px`,
        report.small.slice(0, 3).map((o) => `${o.el} ${o.w}x${o.h}`).join(", "),
      );
    if (report.tiny.length)
      fail(`#${id} type under 12px`, report.tiny.slice(0, 3).map((o) => `${o.el} ${o.size}px`).join(", "));
    if (report.hidden.length)
      fail(`#${id} copy buried under the topbar`, report.hidden.slice(0, 2).map((o) => o.el).join(", "));
    if (report.sectionH < 40) fail(`#${id} has collapsed`, `${Math.round(report.sectionH)}px tall`);
  }

  if (errors.length) fail(`${width}px page errors`, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

// ── legibility over the liquid (phones, canvas ON) ───────────────────────────
//
// The structural checks above run with ftier=none and are therefore blind to
// the defect that actually makes a phone unreadable: the liquid is a full-bleed
// layer BEHIND the copy, and a 390px viewport has no spare column for it to sit
// in. This pass measures the contrast each block of text actually achieves
// against whatever the canvas painted underneath it.
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 780 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${LOCALE}?fgov=0`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector("canvas"), { timeout: 60000 });
  await page.waitForTimeout(1500);
  const docH = await page.evaluate(() => document.body.scrollHeight);
  console.log("\n390px · legibility over the liquid");

  let worstSeen = { sel: "", ratio: 99, text: "" };
  const STOPS = Number(process.env.STOPS || 18);
  for (let i = 0; i < STOPS; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), ((docH - 780) * i) / (STOPS - 1));
    await page.waitForTimeout(520);
    const shot = (await page.screenshot()).toString("base64");
    const r = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d").drawImage(img, 0, 0);
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      const lin = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      const L = (i) => 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]);
      let worst = { sel: "", ratio: 99, text: "" };
      for (const el of document.querySelectorAll("h1,h2,h3,h4,p,dt,dd,li")) {
        if (!el.textContent?.trim()) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        if (el.closest('[aria-hidden="true"]')) continue;
        const b = el.getBoundingClientRect();
        if (b.height < 10 || b.bottom < 8 || b.top > innerHeight - 8 || b.width < 20) continue;
        // INK comes from the computed colour, not from the pixels. Hunting for
        // glyphs by percentile fails on small labels — most of their box is
        // backdrop, so even the 97th percentile is background and every such
        // label scores a meaningless 1.00:1.
        const m = cs.color.match(/[\d.]+/g);
        if (!m || m.length < 3) continue;
        if (m.length > 3 && Number(m[3]) < 0.5) continue; // clipped/gradient fill
        const ink = 0.2126 * lin(+m[0]) + 0.7152 * lin(+m[1]) + 0.0722 * lin(+m[2]);
        const lum = [];
        for (let yy = Math.max(0, b.top | 0); yy < Math.min(c.height, b.bottom | 0); yy += 2)
          for (let xx = Math.max(0, b.left | 0); xx < Math.min(c.width, b.right | 0); xx += 2)
            lum.push(L((yy * c.width + xx) * 4));
        if (lum.length < 40) continue;
        lum.sort((p, q) => p - q);
        // the backdrop is the dark bulk of the box, glyphs aside
        const back = lum[Math.floor(lum.length * 0.35)];
        const ratio = (Math.max(ink, back) + 0.05) / (Math.min(ink, back) + 0.05);
        if (ratio < worst.ratio) {
          const cls = typeof el.className === "string" ? el.className.split(/\s+/)[0] : "";
          worst = {
            sel: (el.tagName.toLowerCase() + (cls ? "." + cls : "")).slice(0, 30),
            ratio,
            text: el.textContent.trim().slice(0, 26),
          };
        }
      }
      return worst;
    }, shot);
    if (r.sel && r.ratio < worstSeen.ratio) worstSeen = r;
  }
  const OK = 3.2; // large-ish display type over a moving backdrop
  if (worstSeen.ratio < OK)
    fail(
      "copy loses contrast against the liquid",
      `${worstSeen.sel} "${worstSeen.text}" → ${worstSeen.ratio.toFixed(2)}:1`,
    );
  else
    console.log(
      `  ✓ worst block still reads — ${worstSeen.sel} "${worstSeen.text}" ${worstSeen.ratio.toFixed(2)}:1`,
    );
  await ctx.close();
}

await browser.close();
console.log(
  failures ? `\nRESPONSIVE FAILURES: ${failures}` : "\nRESPONSIVE: clean across the range",
);
process.exit(failures ? 1 : 0);
