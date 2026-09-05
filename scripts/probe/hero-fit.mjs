// Does the Hero's sentence still FIT, now that its column is the shell's?
//
// The shell gutter is much wider than the flat clamp it replaced (178px against
// 52 at 1440), and above 960px `.lab-headline-line` is `white-space: nowrap`.
// A nowrap line wider than its column overflows the DOCUMENT, and on this site
// a wider document silently inflates the fixed top bar with it. So: line widths
// against the column, and docWidth against innerWidth, at every width in the
// band where nowrap is on — in both locales, because PT-BR is the long one.
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE || "http://localhost:3100";
const WIDTHS = (process.env.WIDTHS || "1920,1600,1440,1366,1280,1200,1100,1024,980,961,960,900,820,768,600,430,390")
  .split(",").map(Number);

const browser = await chromium.launch(LAUNCH);
const rows = [];
for (const locale of ["en", "pt"]) {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/${locale}?fprobe=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2200);
    const r = await page.evaluate(() => {
      const r1 = (n) => Math.round(n * 10) / 10;
      const hero = document.querySelector(".lab-hero");
      const cs = hero && getComputedStyle(hero);
      const pad = cs ? parseFloat(cs.paddingLeft) : 0;
      const col = hero ? hero.getBoundingClientRect().width - pad * 2 : 0;
      const lines = [...document.querySelectorAll(".lab-headline-line")].map((e) => r1(e.getBoundingClientRect().width));
      const sub = document.querySelector(".lab-sub");
      const headline = document.querySelector(".lab-headline-visual");
      const box = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { l: r1(b.left), r: r1(b.right) }; };
      return {
        col: r1(col), pad: r1(pad), lines,
        widest: lines.length ? Math.max(...lines) : 0,
        nowrap: getComputedStyle(document.querySelector(".lab-headline-line")).whiteSpace,
        headline: box(headline), sub: box(sub),
        docW: r1(document.documentElement.scrollWidth), vw: innerWidth,
        barL: box(document.querySelector(".topbar, [data-topbar]")),
      };
    });
    rows.push([locale, w, r]);
    await ctx.close();
  }
}
await browser.close();
const p = (n, k = 8) => String(n ?? "—").padStart(k);
console.log("\nloc  vw     pad     column   widest line  fits?   nowrap    docW    overflow  copy L→R          bar L→R");
for (const [loc, w, r] of rows) {
  const fits = r.widest <= r.col + 0.5 ? "  ok " : " OVER";
  const of = r.docW > r.vw + 0.5 ? `+${(r.docW - r.vw).toFixed(1)}` : "none";
  const c = r.headline ? `${r.headline.l}→${r.headline.r}` : "—";
  const b = r.barL ? `${r.barL.l}→${r.barL.r}` : "—";
  console.log(`${loc}  ${String(w).padEnd(6)} ${p(r.pad, 6)} ${p(r.col, 8)} ${p(r.widest, 12)} ${fits}  ${r.nowrap.padEnd(8)} ${p(r.docW, 7)} ${p(of, 9)}  ${c.padEnd(17)} ${b}`);
}
