// Motion, made visible. Frames at a FIXED scroll — so nothing but the liquid's
// own movement differs between them — plus a difference image, which is the
// only honest way to judge "is it moving" from stills.
import fs from "node:fs";
import { chromium } from "playwright";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = "captures/r6";
fs.mkdirSync(OUT, { recursive: true });
const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((p) => fs.existsSync(p));

const run = async (qs, label, at, gapMs, tiles) => {
  const browser = await chromium.launch({ headless: false, chromiumSandbox: false,
    executablePath: exe, args: ["--window-position=0,0", "--window-size=1380,900"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${BASE}/pt?${qs}`, { waitUntil: "domcontentloaded" });
  await page.bringToFront();
  await page.waitForFunction(() => window.__optics?.frames > 60, null, { timeout: 30000 }).catch(()=>{});
  await page.evaluate((y) => window.scrollTo(0, y * (document.body.scrollHeight - innerHeight)), at);
  await page.waitForTimeout(3500);
  for (let i = 0; i < tiles; i++) {
    await page.screenshot({ path: `${OUT}/${label}-f${i}.png` });
    if (i < tiles - 1) await page.waitForTimeout(gapMs);
  }
  // How much of the liquid actually moved between the first and last frame,
  // as a fraction of the liquid's own area. This is the number; the images are
  // for judging whether it moved WELL.
  const m = await page.evaluate(async ([a, b]) => {
    const load = async (u) => {
      const img = await createImageBitmap(await (await fetch(u)).blob());
      const c = new OffscreenCanvas(img.width, img.height);
      c.getContext("2d").drawImage(img, 0, 0);
      return c.getContext("2d").getImageData(0, 0, img.width, img.height).data;
    };
    const [x, y] = [await load(a), await load(b)];
    let lit = 0, moved = 0;
    for (let p = 0; p < x.length; p += 4) {
      const isLit = x[p + 2] > 70 && x[p + 2] - x[p] > 40;
      if (isLit) lit++;
      if (Math.abs(x[p + 2] - y[p + 2]) > 24) moved++;
    }
    return { lit, moved, ratio: moved / Math.max(lit, 1) };
  }, [`/_next/../captures/r6/${label}-f0.png`, `/_next/../captures/r6/${label}-f${tiles-1}.png`]).catch(() => null);
  const o = await page.evaluate(() => ({ count: window.__optics?.count, motes: window.__optics?.motes }));
  await browser.close();
  return { ...o, m };
};

const at = Number(process.env.AT || 0.12);
const label = process.env.LABEL || "r6";
const r = await run("ftier=full", label, at, Number(process.env.GAP || 900), 3);
console.log(`${label}: count=${r.count} motes=${r.motes} → ${OUT}/${label}-f0..2.png`);
if (process.env.COMPARE) {
  const p = await run("ftier=full&fmotes=1&ftemper=0&ftile=0", label + "-pre", at, Number(process.env.GAP || 900), 3);
  console.log(`${label}-pre: count=${p.count} → ${OUT}/${label}-pre-f0..2.png`);
}
