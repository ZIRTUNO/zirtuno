// Measure the layout system of the reference sites: content column, gutters,
// section rhythm, type scale, grid gaps. Pure DOM measurement, no screenshots.
import { chromium } from "playwright";
import fs from "node:fs";

import { LAUNCH } from "../support/launch.mjs";

const SITES = [
  ["upsunday", "https://www.upsunday.co"],
  ["melrose", "https://getmelrose.com/"],
  ["catalin", "https://catalinvintila.design"],
];
const WIDTHS = [1920, 1512, 1440, 1280, 1024, 768, 390];

const probe = () => {
  const vw = window.innerWidth;
  const px = (v) => Math.round(v * 100) / 100;
  const all = [...document.querySelectorAll("body *")];
  const vis = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4;
  };

  // ---- text elements: where does copy actually start and stop? ----
  const textTags = new Set(["P","H1","H2","H3","H4","H5","H6","LI","BLOCKQUOTE","FIGCAPTION","SPAN","A","BUTTON","LABEL","STRONG","EM"]);
  const texts = [];
  for (const el of all) {
    if (!textTags.has(el.tagName)) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(" ");
    if (own.length < 2) continue;
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const fs2 = parseFloat(cs.fontSize);
    // skip fixed/sticky chrome so the page's own column isn't polluted
    let node = el, fixed = false;
    while (node && node !== document.body) { const p = getComputedStyle(node).position; if (p === "fixed" || p === "sticky") { fixed = true; break; } node = node.parentElement; }
    texts.push({
      tag: el.tagName, fixed,
      left: px(r.left), right: px(r.right), width: px(r.width),
      fontSize: px(fs2),
      lineHeight: cs.lineHeight === "normal" ? "normal" : px(parseFloat(cs.lineHeight) / fs2),
      letterSpacing: cs.letterSpacing === "normal" ? 0 : px(parseFloat(cs.letterSpacing) / fs2),
      weight: cs.fontWeight,
      family: cs.fontFamily.split(",")[0].replace(/["']/g, ""),
      transform: cs.textTransform,
      chars: own.length,
      maxW: cs.maxWidth,
      text: own.slice(0, 44),
    });
  }

  // ---- section rhythm: direct children of the main scroll container ----
  const roots = [document.querySelector("main"), document.body].filter(Boolean);
  const sections = [];
  for (const root of roots) {
    for (const el of root.children) {
      if (!vis(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.position === "fixed") continue;
      const r = el.getBoundingClientRect();
      sections.push({
        root: root.tagName, tag: el.tagName, cls: (el.className || "").toString().slice(0, 40),
        h: px(r.height),
        padT: px(parseFloat(cs.paddingTop)), padB: px(parseFloat(cs.paddingBottom)),
        padL: px(parseFloat(cs.paddingLeft)), padR: px(parseFloat(cs.paddingRight)),
        marT: px(parseFloat(cs.marginTop)), marB: px(parseFloat(cs.marginBottom)),
      });
    }
    if (sections.length) break;
  }

  // ---- every element that declares a padding-inline or gap worth knowing ----
  const gaps = {};
  const padsX = {};
  const padsY = {};
  for (const el of all) {
    if (!vis(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.display.includes("grid") || cs.display.includes("flex")) {
      const g = cs.gap;
      if (g && g !== "normal" && !g.startsWith("0px")) gaps[g] = (gaps[g] || 0) + 1;
    }
    const pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight);
    if (pl > 8 && Math.abs(pl - pr) < 1.5 && el.getBoundingClientRect().width > vw * 0.5) {
      const k = px(pl); padsX[k] = (padsX[k] || 0) + 1;
    }
    const pt = parseFloat(cs.paddingTop), pb = parseFloat(cs.paddingBottom);
    if (pt > 24 && el.getBoundingClientRect().width > vw * 0.5) { const k = px(pt); padsY[k] = (padsY[k] || 0) + 1; }
    if (pb > 24 && el.getBoundingClientRect().width > vw * 0.5) { const k = px(pb); padsY[k] = (padsY[k] || 0) + 1; }
  }

  // ---- widest non-fixed block that is narrower than the viewport = the shell ----
  const shells = {};
  for (const el of all) {
    if (!vis(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.position === "fixed") continue;
    const r = el.getBoundingClientRect();
    if (r.width > vw * 0.45 && r.width <= vw - 8 && r.height > 60) {
      const k = px(Math.round(r.width));
      shells[k] = (shells[k] || 0) + 1;
    }
  }

  return { vw, dpr: devicePixelRatio, docH: px(document.documentElement.scrollHeight), texts, sections, gaps, padsX, padsY, shells };
};

const out = {};
const browser = await chromium.launch(LAUNCH);
for (const [name, url] of SITES) {
  out[name] = { url, widths: {} };
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: Math.round(w * 0.5625) }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(3500);
      // nudge lazy content into existence, then return to top
      await page.evaluate(async () => {
        for (let i = 0; i < 6; i++) { window.scrollBy(0, window.innerHeight); await new Promise((r) => setTimeout(r, 260)); }
        window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 600));
      });
      out[name].widths[w] = await page.evaluate(probe);
      console.error(`ok ${name} @${w}`);
    } catch (e) {
      out[name].widths[w] = { error: String(e).slice(0, 200) };
      console.error(`FAIL ${name} @${w}: ${String(e).slice(0, 140)}`);
    }
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(process.argv[2] || "refs.json", JSON.stringify(out));
console.error("written");
