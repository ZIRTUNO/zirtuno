import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";
const browser = await chromium.launch(LAUNCH);
for (const w of [1920, 1440, 1280]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto("https://www.upsunday.co", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.evaluate(async () => { for (let i=0;i<8;i++){window.scrollBy(0,innerHeight);await new Promise(r=>setTimeout(r,220));} window.scrollTo(0,0); await new Promise(r=>setTimeout(r,500)); });
  const res = await page.evaluate(() => {
    const vw = innerWidth, r2 = (n) => Math.round(n*100)/100;
    const out = [];
    const walk = (el, d) => {
      if (d > 4) return;
      for (const c of el.children) {
        const cs = getComputedStyle(c);
        if (cs.display === "none") continue;
        const r = c.getBoundingClientRect();
        if (r.height < 40) { walk(c, d); continue; }
        out.push({ d, tag: c.tagName, cls: (c.className||"").toString().slice(0,46),
          w: r2(r.width), wvw: r2(r.width/vw*100), left: r2(r.left), leftvw: r2(r.left/vw*100),
          h: r2(r.height), pos: cs.position,
          padT: r2(parseFloat(cs.paddingTop)), padB: r2(parseFloat(cs.paddingBottom)),
          padL: r2(parseFloat(cs.paddingLeft)), padLvw: r2(parseFloat(cs.paddingLeft)/vw*100),
          maxW: cs.maxWidth, mar: cs.marginLeft + "/" + cs.marginRight, gap: cs.gap, disp: cs.display });
        walk(c, d + 1);
      }
    };
    walk(document.body, 0);
    return { vw, out };
  });
  console.log("\n########## UPSUNDAY @" + w + " ##########");
  for (const o of res.out) {
    if (o.h < 80) continue;
    console.log(`${"  ".repeat(o.d)}${o.tag}.${o.cls} | w=${o.w}(${o.wvw}vw) l=${o.left}(${o.leftvw}vw) h=${o.h} pos=${o.pos} padY=${o.padT}/${o.padB} padL=${o.padL}(${o.padLvw}vw) maxW=${o.maxW} mar=${o.mar} gap=${o.gap} d=${o.disp}`);
  }
  await ctx.close();
}
await browser.close();
