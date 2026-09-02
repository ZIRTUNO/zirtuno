import fs from "node:fs";
import { chromium } from "playwright";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const VW0 = Number(process.env.VW || 1280), VH0 = Number(process.env.VH || 800);
const OUT = "captures/r6";
fs.mkdirSync(OUT, { recursive: true });
const exe = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  (process.env.LOCALAPPDATA || "").split("\\").join("/") + "/Google/Chrome/Application/chrome.exe",
].find((p) => fs.existsSync(p));
if (!exe) { console.error("no system Chrome"); process.exit(1); }


const probe = async (url, label, shots = [], measureAt = 0.12) => {
  const browser = await chromium.launch({ headless: false, chromiumSandbox: false,
    executablePath: exe, args: ["--window-position=0,0", `--window-size=${VW0 + 100},${VH0 + 120}`] });
  const VW = Number(process.env.VW || 1280), VH = Number(process.env.VH || 800);
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message.slice(0, 200)));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.bringToFront(); // a backgrounded tab throttles rAF to ~1 fps
  await page.waitForFunction(() => window.__optics && window.__optics.frames > 40, null, { timeout: 30000 })
    .catch(() => {});
  // Measure where the liquid is actually working: at scroll 0 the page field
  // has not begun (the Hero's own ribbon carries that band) and the droplet
  // count is legitimately 0, which reads as a suspiciously fast frame.
  await page.evaluate((y) => window.scrollTo(0, y * document.body.scrollHeight), measureAt);
  await page.waitForTimeout(4500); // past the watchdog grace, and at rest
  const perf = await page.evaluate(() => new Promise((res) => {
    const ts = []; let last = performance.now(); let n = 0;
    const step = () => { const t = performance.now(); ts.push(t - last); last = t; n++;
      if (n < 150) requestAnimationFrame(step);
      else { ts.sort((a,b)=>a-b); res({ med: ts[75], p90: ts[135] }); } };
    requestAnimationFrame(step);
  }));
  const o = await page.evaluate(() => {
    const d = window.__optics || {};
    return { tiled: d.tiled, ballCap: d.ballCap, pop: d.pop, count: d.count,
      motes: d.motes, bind: +(d.bindAvg || 0).toFixed(2),
      entries: d.tileEntries, tileMax: d.tileMax, tileOver: d.tileOver,
      tier: d.tier, scale: +(d.scale || 0).toFixed(2), glass: d.glass, shape: d.shape };
  });
  for (const [name, y] of shots) {
    await page.evaluate((yy) => window.scrollTo(0, yy * document.body.scrollHeight), y);
    await page.waitForTimeout(2200); // shoot at REST, never mid-transition
    await page.screenshot({ path: `${OUT}/${label}-${name}.png` });
  }
  await browser.close();
  return { ...o, ...perf, errs: errs.slice(0, 4) };
};

// 0.12 = the scatter/pour band, where bind is 0 and the whole population is
// live. 0.34 is inside the §3.3 melt sequence, where the exactness gate
// correctly removes every mote — measuring there compares 48 against 48.
const shots = [["scatter", 0.12], ["gather", 0.6], ["melt", 0.34]];
const rows = [];
const F = "ftier=full";
rows.push(["R6  tiled+motes+temper", await probe(`${BASE}/pt?${F}`, "r6", shots)]);
rows.push(["    ?ftile=0  uniform", await probe(`${BASE}/pt?${F}&ftile=0`, "notile", [["scatter", 0.12]])]);
rows.push(["    ?fmotes=1 tiled only", await probe(`${BASE}/pt?${F}&fmotes=1`, "nomotes", [["scatter", 0.12]])]);
rows.push(["    pre-R6 baseline", await probe(`${BASE}/pt?${F}&fmotes=1&ftemper=0&ftile=0`, "pre", shots)]);
rows.push(["R6  probe tier (lite)", await probe(`${BASE}/pt`, "auto", [])]);

console.log("condition                     tiled  pop count motes bind entries max over   med   p90  tier");
for (const [label, r] of rows) {
  console.log(
    `${label.padEnd(29)} ${String(r.tiled).padStart(4)} ${String(r.pop).padStart(4)} ${String(r.count).padStart(5)} ` +
    `${String(r.motes).padStart(5)} ${String(r.bind).padStart(4)} ${String(r.entries).padStart(7)} ${String(r.tileMax).padStart(3)} ${String(r.tileOver).padStart(4)} ` +
    `${(r.med ?? 0).toFixed(1).padStart(5)} ${(r.p90 ?? 0).toFixed(1).padStart(5)}  ${r.tier}`);
  if (r.errs?.length) for (const e of r.errs) console.log("     console: " + e);
}
