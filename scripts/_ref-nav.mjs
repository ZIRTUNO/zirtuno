// Measure upsunday.co's header geometry at controlled viewports.
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const browser = await chromium.launch(LAUNCH);
const rows = [];
for (const w of [1920, 1512, 1440, 1280, 1100, 1024, 900, 768, 600, 430, 390]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const p = await ctx.newPage();
  try {
    await p.goto("https://www.upsunday.co/", { waitUntil: "domcontentloaded", timeout: 45000 });
    await p.waitForSelector("header.nav", { timeout: 20000 });
    await p.waitForTimeout(2500);
    const g = await p.evaluate(() => {
      const de = document.documentElement, cw = de.clientWidth;
      const h = document.querySelector("header.nav");
      const r = h.getBoundingClientRect(), cs = getComputedStyle(h);
      const box = (sel) => { const e = h.querySelector(sel); if (!e) return null;
        const b = e.getBoundingClientRect(); return { w: +b.width.toFixed(1), h: +b.height.toFixed(1),
          x: +b.x.toFixed(1), fs: getComputedStyle(e).fontSize }; };
      const link = h.querySelector(".nav__links a");
      const links = h.querySelector(".nav__links");
      const cta = h.querySelector(".nav__cta");
      const logo = h.querySelector(".nav__logo img.nav__logo-sun") || h.querySelector(".nav__logo img");
      return {
        cw,
        barW: +r.width.toFixed(1), barH: +r.height.toFixed(1), top: +r.y.toFixed(1),
        leftInset: +r.x.toFixed(1), rightInset: +(cw - r.right).toFixed(1),
        radius: parseFloat(cs.borderRadius).toFixed(2), padding: cs.padding,
        logoH: logo ? +logo.getBoundingClientRect().height.toFixed(1) : null,
        navFs: link ? getComputedStyle(link).fontSize : null,
        navGap: links ? getComputedStyle(links).gap : null,
        ctaH: cta ? +cta.getBoundingClientRect().height.toFixed(1) : null,
        ctaPad: cta ? getComputedStyle(cta).padding : null,
        ctaFs: cta ? getComputedStyle(cta).fontSize : null,
        ctaRadius: cta ? parseFloat(getComputedStyle(cta).borderRadius).toFixed(2) : null,
        burger: !!(h.querySelector(".nav__toggle") && getComputedStyle(h.querySelector(".nav__toggle")).display !== "none"),
      };
    });
    rows.push({ w, ...g });
  } catch (e) { rows.push({ w, err: String(e).slice(0, 70) }); }
  await ctx.close();
}
await browser.close();

console.log("vw    barW    %vw   barH  h/vw   top  inset  radius  pad     logo  navFs  navGap  ctaH  ctaPad        ctaFs  burger");
for (const r of rows) {
  if (r.err) { console.log(String(r.w).padEnd(6) + r.err); continue; }
  console.log(
    String(r.w).padEnd(6) +
    String(r.barW).padEnd(8) +
    (r.barW / r.cw * 100).toFixed(1).padEnd(6) +
    String(r.barH).padEnd(6) +
    (r.barH / r.cw).toFixed(4).padEnd(7) +
    String(r.top).padEnd(6) +
    String(r.leftInset).padEnd(7) +
    String(r.radius).padEnd(8) +
    String(r.padding).padEnd(8) +
    String(r.logoH).padEnd(6) +
    String(r.navFs).padEnd(7) +
    String(r.navGap).padEnd(8) +
    String(r.ctaH).padEnd(6) +
    String(r.ctaPad).padEnd(14) +
    String(r.ctaFs).padEnd(7) +
    (r.burger ? "yes" : "no"));
}
