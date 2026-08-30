// Interaction + cross-surface probe for the rebuilt header.
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";
const BASE = process.env.BASE_URL || "http://localhost:3091";
let f = 0;
const check = (ok, l, d) => { console.log(`${ok?"  ok  ":"  FAIL"} ${l}${d?` — ${d}`:""}`); if(!ok) f++; };

const b = await chromium.launch(LAUNCH);

// ── hover: the cyan underline wipe ──────────────────────────────────────────
{
  const ctx = await b.newContext({ viewport:{width:1440,height:900} });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/en`, { waitUntil:"domcontentloaded" });
  await p.waitForSelector(".topbar-link"); await p.waitForTimeout(2000);
  console.log("\nhover · underline wipe");
  const link = p.locator(".topbar-link").nth(1); // SERVICES
  const before = await link.evaluate(e => getComputedStyle(e,"::after").transform);
  const colBefore = await link.evaluate(e => getComputedStyle(e).color);
  await link.hover(); await p.waitForTimeout(700);
  const after = await link.evaluate(e => getComputedStyle(e,"::after").transform);
  const colAfter = await link.evaluate(e => getComputedStyle(e).color);
  const bg = await link.evaluate(e => getComputedStyle(e,"::after").backgroundColor);
  check(/matrix\(0,/.test(before)||before==="matrix(0, 0, 0, 1, 0, 0)", "underline hidden at rest", before);
  check(after === "matrix(1, 0, 0, 1, 0, 0)" || after === "none", "underline full on hover", after);
  check(/0,\s*227,\s*254/.test(bg), "underline is brand cyan", bg);
  check(colBefore !== colAfter, "label brightens on hover", `${colBefore} -> ${colAfter}`);

  // keyboard focus reaches the nav and the chip
  console.log("\nkeyboard · tab order through the bar");
  await p.keyboard.press("Tab"); // skip link
  const order = [];
  for (let i=0;i<8;i++){ await p.keyboard.press("Tab");
    order.push(await p.evaluate(()=>{const a=document.activeElement;return (a.className&&String(a.className).split(" ")[0])||a.tagName;})); }
  check(order.includes("topbar-brand"), "brand is focusable", order.join(" → "));
  check(order.includes("topbar-link"), "nav links are focusable");
  check(order.filter(o=>o==="lang-opt").length>=1, "locale switch is focusable");
  check(order.includes("cta"), "CTA chip is focusable");
  await ctx.close();
}

// ── mobile: the island must grow out of the burger ──────────────────────────
{
  const ctx = await b.newContext({ viewport:{width:390,height:844} });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/en`, { waitUntil:"domcontentloaded" });
  await p.waitForSelector(".burger"); await p.waitForTimeout(2000);
  console.log("\nmobile · island anchors to the burger");
  const burger = await p.locator(".burger").boundingBox();
  await p.locator(".burger").click();
  await p.waitForTimeout(1200);
  const island = await p.locator(".mobile-menu-island").boundingBox();
  check(!!island, "island opens");
  if (island) {
    const dTop = Math.abs(island.y - burger.y);
    const dRight = Math.abs((island.x+island.width) - (burger.x+burger.width));
    check(dTop <= 2, "island top edge meets the burger's", `Δ${dTop.toFixed(1)}px`);
    check(dRight <= 2, "island right edge meets the burger's", `Δ${dRight.toFixed(1)}px`);
    check(island.y + island.height <= 844, "island fits the viewport", `bottom=${(island.y+island.height).toFixed(0)}`);
  }
  await p.keyboard.press("Escape"); await p.waitForTimeout(900);
  await ctx.close();
}

// ── the bar over NON-liquid surfaces ────────────────────────────────────────
{
  for (const route of ["/en/work", "/en/legal/privacy"]) {
    const ctx = await b.newContext({ viewport:{width:1440,height:900} });
    const p = await ctx.newPage();
    const resp = await p.goto(`${BASE}${route}`, { waitUntil:"domcontentloaded" });
    await p.waitForTimeout(2000);
    console.log(`\n${route} · chrome over static content`);
    check(resp.status() < 400, "route renders", `status ${resp.status()}`);
    const g = await p.evaluate(()=>{
      const bar=document.querySelector(".topbar"); if(!bar) return null;
      const r=bar.getBoundingClientRect();
      const h1=document.querySelector("h1"); const hr=h1?h1.getBoundingClientRect():null;
      return { bar:+r.height.toFixed(1), barBottom:+r.bottom.toFixed(1),
               h1Top: hr?+hr.top.toFixed(1):null, h1Text:h1?h1.textContent.trim().slice(0,40):null,
               nav: !!document.querySelector(".topbar-nav") };
    });
    check(!!g, "bar present");
    if (g) {
      check(g.nav, "nav present on inner routes");
      check(g.h1Top === null || g.h1Top > g.barBottom, "h1 clears the floating bar",
        `bar bottom ${g.barBottom} vs h1 top ${g.h1Top} ("${g.h1Text}")`);
    }
    await ctx.close();
  }
}

await b.close();
console.log(`\n${f?`${f} FAILURE(S)`:"all interaction checks passed"}`);
process.exit(f?1:0);
