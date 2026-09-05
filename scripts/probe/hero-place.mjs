// Where does the Hero's copy actually sit, and what is it sitting against?
//
// Reports, per viewport: the chrome's bottom edge, the copy block's box, the
// ribbon's top and the y at which its mask reaches full opacity — i.e. the two
// things the sentence has to stay clear of.
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const URL = process.env.URL || "http://localhost:3000/en?fprobe=1";
const SIZES = [
  [1920, 1080],
  [1512, 982],
  [1440, 900],
  [1280, 800],
  [1024, 768],
  [820, 1180],
  [768, 1024],
  [430, 932],
  [390, 844],
];

const browser = await chromium.launch(LAUNCH);
const rows = [];
for (const [w, h] of SIZES) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2600);
  const r = await page.evaluate(() => {
    const r2 = (n) => (n == null ? null : Math.round(n * 10) / 10);
    const q = (s) => document.querySelector(s);
    const box = (s) => {
      const e = q(s);
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { t: r2(b.top), b: r2(b.bottom), l: r2(b.left), r: r2(b.right), w: r2(b.width), h: r2(b.height) };
    };
    const hero = q(".lab-hero");
    const cs = hero ? getComputedStyle(hero) : null;
    const ribbon = q(".lab-ribbon");
    const rb = ribbon ? ribbon.getBoundingClientRect() : null;
    const root = getComputedStyle(document.documentElement);
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:absolute;visibility:hidden;padding-top:var(--topbar-h);padding-left:var(--page-padding);padding-bottom:var(--space-section)";
    document.body.appendChild(probe);
    const pcs = getComputedStyle(probe);
    const tokens = {
      topbarH: r2(parseFloat(pcs.paddingTop)),
      pagePad: r2(parseFloat(pcs.paddingLeft)),
      spaceSection: r2(parseFloat(pcs.paddingBottom)),
    };
    probe.remove();

    return {
      vh: innerHeight,
      vw: innerWidth,
      shell: root.getPropertyValue("--shell-w").trim(),
      tokens,
      heroPad: cs
        ? {
            t: r2(parseFloat(cs.paddingTop)),
            b: r2(parseFloat(cs.paddingBottom)),
            l: r2(parseFloat(cs.paddingLeft)),
          }
        : null,
      heroH: hero ? r2(hero.getBoundingClientRect().height) : null,
      bar: box(".topbar, header[class*=topbar], [data-topbar]"),
      plane: box(".lab-plane"),
      headline: box(".lab-headline"),
      sub: box(".lab-sub"),
      ribbon: rb ? { t: r2(rb.top), b: r2(rb.bottom), h: r2(rb.height) } : null,
      // the mask is transparent 0% → opaque 26% → opaque 58% → transparent 100%
      ribbonLight: rb ? { rise: r2(rb.top), full: r2(rb.top + rb.height * 0.26) } : null,
      sphere: box(".lab-sphere"),
      proof: box(".lab-proof"),
    };
  });
  rows.push([w, h, r]);
  await ctx.close();
}
await browser.close();

const p = (n, w = 7) => String(n ?? "—").padStart(w);
console.log(
  "\nvw×vh        pad(t/b/l)        bar↓    copy top   copy bot   copy mid   mid%   ribbon↑  full↑   headroom  clearance",
);
for (const [w, h, r] of rows) {
  const top = r.headline?.t;
  const bot = r.sub?.b ?? r.headline?.b;
  const mid = top != null && bot != null ? (top + bot) / 2 : null;
  const midPct = mid != null ? Math.round((mid / r.vh) * 1000) / 10 : null;
  const headroom = top != null && r.bar ? Math.round(top - r.bar.b) : null;
  const clearance = bot != null && r.ribbonLight ? Math.round(r.ribbonLight.rise - bot) : null;
  console.log(
    `${String(w + "×" + h).padEnd(12)} ${p(r.heroPad?.t, 5)}/${p(r.heroPad?.b, 5)}/${p(r.heroPad?.l, 5)}  ${p(r.bar?.b, 6)} ${p(top, 10)} ${p(bot, 10)} ${p(mid, 10)} ${p(midPct, 6)} ${p(r.ribbon?.t, 8)} ${p(r.ribbonLight?.full, 7)} ${p(headroom, 9)} ${p(clearance, 10)}`,
  );
}
console.log("\ntokens (topbar-h / page-padding / space-section) and shell:");
for (const [w, , r] of rows) {
  console.log(
    `${String(w).padEnd(6)} ${p(r.tokens.topbarH)} ${p(r.tokens.pagePad)} ${p(r.tokens.spaceSection)}   shell=${r.shell}  heroH=${r.heroH}  planeW=${r.plane?.w}  headlineW=${r.headline?.w}`,
  );
}
console.log("\nleftovers still mounted in the Hero:");
for (const [w, , r] of rows) {
  console.log(`${String(w).padEnd(6)} sphere=${r.sphere ? "PRESENT" : "—"}  proof=${r.proof ? "PRESENT" : "—"}`);
}
