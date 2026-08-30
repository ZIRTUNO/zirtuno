// Side-by-side: Zirtuno's bar vs the reference's, same viewports, same probe.
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";
const LOCAL = process.env.BASE_URL || "http://localhost:3091";
const READ = () => {
  const de = document.documentElement, cw = de.clientWidth;
  const h = document.querySelector("header.nav") || document.querySelector(".topbar");
  if (!h) return null;
  const r = h.getBoundingClientRect(), cs = getComputedStyle(h);
  const q = (a, b) => h.querySelector(a) || h.querySelector(b);
  const link = q(".nav__links a", ".topbar-link");
  const cta = q(".nav__cta", ".cta-primary");
  return {
    cw, barW: +r.width.toFixed(1), barH: +r.height.toFixed(1), top: +r.y.toFixed(1),
    radius: +parseFloat(cs.borderRadius).toFixed(2), pad: parseFloat(cs.paddingLeft).toFixed(1),
    navFs: link ? +parseFloat(getComputedStyle(link).fontSize).toFixed(2) : null,
    ctaH: cta ? +cta.getBoundingClientRect().height.toFixed(1) : null,
  };
};
const browser = await chromium.launch(LAUNCH);
const out = {};
for (const [name, url] of [["ref", "https://www.upsunday.co/"], ["zir", `${LOCAL}/en?fshot=1`]]) {
  out[name] = {};
  for (const w of [1920, 1512, 1440, 1280, 1024]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    const p = await ctx.newPage();
    try {
      await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await p.waitForSelector("header.nav, .topbar", { timeout: 20000 });
      await p.waitForTimeout(name === "ref" ? 2500 : 3500);
      out[name][w] = await p.evaluate(READ);
    } catch (e) { out[name][w] = { err: String(e).slice(0, 50) }; }
    await ctx.close();
  }
}
await browser.close();
const F = ["barW", "barH", "top", "radius", "pad", "navFs", "ctaH"];
console.log("vw     field    reference   zirtuno    delta");
let bad = 0;
for (const w of [1920, 1512, 1440, 1280, 1024]) {
  const a = out.ref[w], b = out.zir[w];
  if (!a || !b || a.err || b.err) { console.log(w, "  ERR", a?.err || b?.err); continue; }
  for (const f of F) {
    const d = (b[f] ?? 0) - (a[f] ?? 0);
    const pct = a[f] ? Math.abs(d / a[f]) * 100 : 0;
    const flag = pct <= 3 ? "" : pct <= 10 ? "  ~" : "  <-";
    if (pct > 10) bad++;
    console.log(`${String(w).padEnd(6)} ${f.padEnd(8)} ${String(a[f]).padEnd(11)} ${String(b[f]).padEnd(10)} ${(d >= 0 ? "+" : "") + d.toFixed(1)}${flag}`);
  }
  console.log("");
}
console.log(bad ? `${bad} field(s) off by >10%` : "every field within 10% of the reference");
