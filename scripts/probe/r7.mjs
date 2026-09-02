// R7 verification: is the served CSS the one on disk, and do the ratios hold?
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";
const URL = process.env.URL || "http://localhost:3000/en";
const browser = await chromium.launch(LAUNCH);
const rows = [];
for (const w of [1920, 1512, 1440, 1280, 1024, 768, 390]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2200);
  const r = await page.evaluate(() => {
    const vw = innerWidth, r2 = (n) => Math.round(n * 100) / 100;
    const cs = getComputedStyle(document.documentElement);
    const tok = (n) => cs.getPropertyValue(n).trim();
    const el = (s) => document.querySelector(s);
    const size = (s) => { const e = el(s); return e ? r2(parseFloat(getComputedStyle(e).fontSize)) : null; };
    const box = (s) => { const e = el(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: r2(b.left), r: r2(b.right), w: r2(b.width) }; };
    return {
      vw,
      served: tok("--shell-w") ? "R7" : "STALE",
      shell: tok("--shell-w"),
      pagePad: (() => { const e = el(".page-x"); return e ? r2(parseFloat(getComputedStyle(e).paddingLeft)) : null; })(),
      bar: box("header, .topbar, [data-topbar]"),
      pagex: (() => { const e = el(".page-x"); if (!e) return null; const b = e.getBoundingClientRect(); const c = getComputedStyle(e);
        return { l: r2(b.left + parseFloat(c.paddingLeft)), r: r2(b.right - parseFloat(c.paddingRight)), w: r2(b.width - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight)) }; })(),
      title: size(".type-section-title"),
      lead: size(".type-lead-copy"),
      body: r2(parseFloat(getComputedStyle(document.body).fontSize)),
      mono: size(".chapter-label"),
      secPad: (() => { const d = document.createElement("div"); d.style.cssText = "padding-block:var(--space-section);position:absolute;visibility:hidden";
        document.body.appendChild(d); const v = r2(parseFloat(getComputedStyle(d).paddingTop)); d.remove(); return v; })(),
    };
  });
  rows.push([w, r]);
  await ctx.close();
}
await browser.close();
console.log("\nw      served  shellVar   pagePad   page-x column        bar column          title    lead    body    mono   secPad");
for (const [w, r] of rows) {
  const c = r.pagex ? `${r.pagex.l}→${r.pagex.r} (${r.pagex.w})` : "—";
  const b = r.bar ? `${r.bar.l}→${r.bar.r} (${r.bar.w})` : "—";
  console.log(`${String(w).padEnd(6)} ${r.served.padEnd(7)} ${String(r.shell).padEnd(10)} ${String(r.pagePad).padEnd(9)} ${c.padEnd(21)} ${b.padEnd(20)} ${String(r.title).padEnd(8)} ${String(r.lead).padEnd(7)} ${String(r.body).padEnd(7)} ${String(r.mono).padEnd(6)} ${r.secPad}`);
}
console.log("\nratio check (should be CONSTANT across 1280–1920):");
console.log("w      title/vw  lead/vw  body/vw  mono/vw  pagePad/vw  secPad/vw");
for (const [w, r] of rows) {
  const p = (v) => (v == null ? "  —   " : (Math.round(v / w * 10000) / 100).toFixed(3).padStart(7));
  console.log(`${String(w).padEnd(6)} ${p(r.title)}  ${p(r.lead)}  ${p(r.body)}  ${p(r.mono)}  ${p(r.pagePad)}    ${p(r.secPad)}`);
}
