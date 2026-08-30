// Header verification — real Chrome, real compositing (browser-pane
// screenshots do not composite here, and a hidden pane throttles IO delivery).
//   node check-topbar.mjs
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3091";
const OUT = process.env.OUT_DIR || ".";
let failures = 0;
const check = (ok, label, detail) => {
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const geom = () => {
  const bar = document.querySelector(".topbar");
  const de = document.documentElement;
  const r = bar.getBoundingClientRect();
  const box = (s) => {
    const e = document.querySelector(s);
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
  };
  const cs = getComputedStyle(bar);
  const nav = document.querySelector(".topbar-nav");
  const navRect = nav ? nav.getBoundingClientRect() : null;
  return {
    cw: de.clientWidth,
    scrollY: Math.round(window.scrollY),
    settled: bar.getAttribute("data-settled"),
    bar: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
    leftInset: +r.x.toFixed(1),
    rightInset: +(de.clientWidth - r.right).toFixed(1),
    barCenter: +((r.x + r.right) / 2).toFixed(1),
    navCenter: navRect ? +((navRect.x + navRect.right) / 2).toFixed(1) : null,
    radius: cs.borderRadius,
    padY: parseFloat(cs.paddingTop),
    bg: cs.backgroundColor,
    backdrop: cs.backdropFilter,
    brand: box(".topbar-brand"),
    mark: box(".topbar-mark"),
    cta: box(".topbar .cta-primary"),
    actions: box(".topbar-actions"),
    burgerVisible: (() => {
      const b = document.querySelector(".burger");
      return b ? b.getBoundingClientRect().width > 0 : false;
    })(),
    navVisible: nav ? getComputedStyle(nav).display !== "none" : false,
    links: [...document.querySelectorAll(".topbar-link")].map((a) => ({
      t: a.textContent.trim(),
      h: +a.getBoundingClientRect().height.toFixed(1),
    })),
    ctaLabel: document.querySelector(".topbar .cta-label")?.textContent.trim(),
    // does anything overlap the bar's own zones?
    overlap: (() => {
      const a = document.querySelector(".topbar-brand")?.getBoundingClientRect();
      const n = navRect;
      const c = document.querySelector(".topbar-actions")?.getBoundingClientRect();
      if (!a || !n || !c) return null;
      return { brandNav: +(n.left - a.right).toFixed(1), navActions: +(c.left - n.right).toFixed(1) };
    })(),
  };
};


const browser = await chromium.launch(LAUNCH);

for (const [name, width, height] of [
  ["desktop", 1440, 900],
  ["laptop", 1280, 800],
  ["tablet", 900, 800],
  ["mobile", 390, 844],
]) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".topbar", { timeout: 20000 });
  await page.waitForTimeout(3500);

  console.log(`\n${name} · ${width}x${height}`);
  const rest = await page.evaluate(geom);
  console.log("   rest:", JSON.stringify(rest, null, 1).replace(/\n\s*/g, " "));

  check(rest.settled === null, "rest state is un-settled at top", `settled=${rest.settled}`);
  check(Math.abs(rest.leftInset - rest.rightInset) <= 1.5, "bar is horizontally symmetric",
    `L${rest.leftInset} R${rest.rightInset}`);
  check(rest.bar.y > 4, "bar floats clear of the top edge", `y=${rest.bar.y}`);
  if (rest.navVisible) {
    check(Math.abs(rest.barCenter - rest.navCenter) <= 1.5, "nav is centred on the BAR",
      `bar ${rest.barCenter} vs nav ${rest.navCenter}`);
    check(rest.overlap.brandNav > 8 && rest.overlap.navActions > 8, "zones do not collide",
      `brand→nav ${rest.overlap?.brandNav}, nav→actions ${rest.overlap?.navActions}`);
  }
  if (rest.navVisible) {
    // The links STRETCH to the bar's inner height rather than carrying a 44px
    // floor: the bar is sized to hug its contents (chip + padding) to match the
    // reference, so a 44px minimum on a link would push the plate taller than
    // the reference's and undo the port. Assert they fill what the bar allows.
    const inner = rest.bar.h - 2 * rest.padY;
    // The nav is absolutely positioned at `inset: 0`, so its box is the bar's
    // PADDING box — the links stretch to that, which is taller than the content
    // box the chip lives in. That is deliberate: it is the largest target the
    // bar can give a link without changing the bar's own height.
    check(rest.links.every((l) => l.h >= inner && l.h <= rest.bar.h),
      "nav links stretch to the bar's full inner box",
      `content=${inner.toFixed(1)} bar=${rest.bar.h} · ` + rest.links.map((l) => `${l.t}:${l.h}`).join(" "));
    check(rest.cta.w > 0, "CTA chip present", `w=${rest.cta.w}`);
    check(Math.abs(rest.cta.h - inner) <= 1.5, "chip fills the bar's inner height",
      `chip=${rest.cta.h} inner=${inner.toFixed(1)}`);
  }
  check(width >= 1024 ? !rest.burgerVisible : rest.burgerVisible, "burger only below lg",
    `burger=${rest.burgerVisible}`);

  await page.screenshot({
    path: path.join(OUT, `topbar-${name}-rest.png`),
    clip: { x: 0, y: 0, width, height: Math.min(160, height) },
  });

  // settled
  await page.mouse.move(width / 2, height / 2);
  await page.mouse.wheel(0, 1400);
  await page.waitForTimeout(2200);
  const down = await page.evaluate(geom);
  check(down.settled === "", "settles after scrolling", `scrollY=${down.scrollY} settled=${down.settled}`);
  await page.screenshot({
    path: path.join(OUT, `topbar-${name}-settled.png`),
    clip: { x: 0, y: 0, width, height: Math.min(160, height) },
  });

  // back to top
  await page.mouse.wheel(0, -4000);
  await page.waitForTimeout(2500);
  const up = await page.evaluate(geom);
  check(up.settled === null, "un-settles on return to top",
    `scrollY=${up.scrollY} settled=${JSON.stringify(up.settled)}`);

  await ctx.close();
}

await browser.close();
console.log(`\n${failures ? `${failures} FAILURE(S)` : "all checks passed"}`);
process.exit(failures ? 1 : 0);
