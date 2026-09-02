import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";
const PAGES = ["/en", "/en/work", "/en/careers"];
const browser = await chromium.launch(LAUNCH);
for (const path of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("http://localhost:3000" + path, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2200);
  const bad = await page.evaluate(() => {
    const cs0 = getComputedStyle(document.documentElement);
    const probe = (tok) => { const d = document.createElement("div"); d.style.cssText = `position:absolute;visibility:hidden;margin-top:var(${tok})`;
      document.body.appendChild(d); const v = parseFloat(getComputedStyle(d).marginTop); d.remove(); return v; };
    const want = {}; for (const t of ["--space-section","--space-span","--space-block","--space-group","--space-tight"]) want[t] = probe(t);
    const PROP = { mt: "marginTop", py: "paddingTop", pt: "paddingTop", pb: "paddingBottom", gap: "gap" };
    const out = [];
    for (const el of document.querySelectorAll('[class*="-[var(--space-"]')) {
      const cls = el.className.toString();
      for (const m of cls.matchAll(/\b(mt|py|pt|pb|gap)-\[var\((--space-[a-z]+)\)\]/g)) {
        const prop = PROP[m[1]];
        const got = parseFloat(getComputedStyle(el)[prop]) || 0;
        const exp = want[m[2]];
        if (Math.abs(got - exp) > 1.5)
          out.push(`${m[1]}-[${m[2]}] wanted ${exp.toFixed(1)} got ${got.toFixed(1)}  <${el.tagName.toLowerCase()} class="${cls.slice(0,72)}">`);
      }
    }
    return out;
  });
  console.log(`\n### ${path} — ${bad.length} overridden`);
  for (const b of bad) console.log("   " + b);
  await ctx.close();
}
await browser.close();
