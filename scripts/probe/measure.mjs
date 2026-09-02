import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";
const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto("http://localhost:3000/en", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(2500);
const out = await page.evaluate(() => {
  const shell = 0.7524 * innerWidth;
  const r2 = (n) => Math.round(n * 100) / 100;
  const probe = (fontVar) => {
    const d = document.createElement("div");
    d.style.cssText = `position:absolute;visibility:hidden;font-family:var(--font-sans);font-size:var(${fontVar});width:1ch`;
    document.body.appendChild(d);
    const ch = d.getBoundingClientRect().width;
    const fs = parseFloat(getComputedStyle(d).fontSize);
    d.remove();
    return { ch: r2(ch), fs: r2(fs) };
  };
  const tiers = ["--text-hero","--text-display-l","--text-display-m","--text-lead","--text-body-l","--text-body","--text-poetic"];
  const res = {};
  for (const t of tiers) res[t] = probe(t);
  // what each measure token yields, per tier it's used with
  const cs = getComputedStyle(document.documentElement);
  const measures = ["--measure-hero","--measure-display","--measure-display-wide","--measure-editorial","--measure-lead","--measure-reading"];
  const mv = {};
  for (const m of measures) mv[m] = cs.getPropertyValue(m).trim();
  return { shell: r2(shell), res, mv };
});
console.log("shell at 1440 =", out.shell, "px\n");
console.log("tier                 fontSize   1ch");
for (const [k, v] of Object.entries(out.res)) console.log(`${k.padEnd(20)} ${String(v.fs).padEnd(10)} ${v.ch}`);
console.log("\nmeasure tokens:", out.mv);
console.log("\nresulting block widths (and % of the 1083px column):");
const pairs = [["--measure-hero","--text-hero"],["--measure-display","--text-display-l"],["--measure-display-wide","--text-display-l"],["--measure-editorial","--text-display-m"],["--measure-lead","--text-lead"],["--measure-reading","--text-body"]];
for (const [m, t] of pairs) {
  const ch = parseFloat(out.mv[m]);
  const w = ch * out.res[t].ch;
  console.log(`${m.padEnd(24)} ${String(out.mv[m]).padEnd(7)} x ${String(out.res[t].ch).padEnd(6)} = ${String(Math.round(w)).padStart(5)}px  ${Math.round(w/out.shell*100)}% of column`);
}
await browser.close();
