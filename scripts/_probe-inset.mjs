import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";
const BASE = process.env.BASE_URL || "http://localhost:3057";
const b = await chromium.launch({ ...LAUNCH, args:["--enable-unsafe-swiftshader","--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(`${BASE}/pt?fshot=1`, { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
await p.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
await p.waitForTimeout(3000);

const geo = await p.evaluate(() => {
  const panel = document.querySelector(".footer-panel").getBoundingClientRect();
  const cs = getComputedStyle(document.querySelector(".footer-panel"));
  const svgs = [...document.querySelectorAll(".footer-social svg")].map(s => s.getBoundingClientRect());
  const cols = document.querySelectorAll(".footer-col");
  const legal = cols[cols.length - 1].getBoundingClientRect();
  const gaps = [];
  for (let i = 1; i < svgs.length; i++) gaps.push(+(svgs[i].left - svgs[i-1].right).toFixed(2));
  const innerRight = panel.right - parseFloat(cs.paddingRight);
  return {
    count: svgs.length,
    glyph: `${svgs[0].width}x${svgs[0].height}`,
    gaps,
    panelInnerRight: Math.round(innerRight),
    lastGlyphRight: Math.round(svgs[svgs.length-1].right),
    insetFromInnerEdge: Math.round(innerRight - svgs[svgs.length-1].right),
    legalColLeft: Math.round(legal.left),
  };
});
console.log("GEOMETRY", JSON.stringify(geo));

// hover, verifying the pointer actually lands on the anchor
const a = p.locator(".footer-social").first();
const bb = await a.boundingBox();
await p.mouse.move(bb.x + bb.width/2, bb.y + bb.height/2);
await p.waitForTimeout(450);
console.log("HOVER", JSON.stringify(await p.evaluate(() => {
  const el = document.querySelector(".footer-social");
  const r = el.getBoundingClientRect();
  const top = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2);
  const c = getComputedStyle(el);
  return {
    onAnchor: top ? !!top.closest(".footer-social") : false,
    topEl: top ? top.tagName + "." + (typeof top.className === "string" ? top.className : String(top.className.baseVal||"")) : null,
    color: c.color, transform: c.transform,
  };
})));
await b.close();
