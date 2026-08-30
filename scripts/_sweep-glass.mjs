// Grid-search the glass: for each candidate (brightness, fill, halo), inject the
// override and MEASURE worst real-pixel contrast over the brightest liquid.
// One browser, one page, many settings — far cheaper than edit/restart/measure.
import { PNG } from "pngjs";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3091";
const srgb = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (r, g, b) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const ratio = (a, b) => { const [hi, lo] = a > b ? [a, b] : [b, a]; return (hi + 0.05) / (lo + 0.05); };

const HALO = `0 0 3px var(--color-ink), 0 0 9px var(--color-ink), 0 0 18px var(--color-ink)`;

// brightness, fill %, halo, label colour
const CANDIDATES = [
  [0.52, 9,  false, null],                    // current
  [0.68, 6,  false, null],
  [0.68, 5,  true,  "var(--color-paper)"],
  [0.78, 4,  true,  "var(--color-paper)"],
  [0.86, 3,  true,  "var(--color-paper)"],
  [0.92, 2,  true,  "var(--color-paper)"],
  [1.0,  0,  true,  "var(--color-paper)"],
];

const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(`${BASE}/en?fshot=1`, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".topbar");
await page.waitForTimeout(4000);

await page.evaluate(() => {
  const s = document.createElement("style"); s.id = "sweep"; document.head.appendChild(s);
});

// park at the scroll positions where the liquid is brightest behind the bar
const HOTSPOTS = [];
{
  for (let i = 0; i < 30; i++) {
    await page.mouse.move(720, 500); await page.mouse.wheel(0, 950); await page.waitForTimeout(950);
    const buf = await page.screenshot({ clip: { x: 380, y: 18, width: 700, height: 70 } });
    const png = PNG.sync.read(buf);
    let s = 0, n = 0;
    for (let o = 0; o < png.data.length; o += 4) { s += lum(png.data[o], png.data[o+1], png.data[o+2]); n++; }
    HOTSPOTS.push({ y: await page.evaluate(() => Math.round(window.scrollY)), L: s / n });
  }
  HOTSPOTS.sort((a, b) => b.L - a.L);
  HOTSPOTS.length = 5;
  console.log("brightest 5 scroll positions:", HOTSPOTS.map(h => `${h.y}px(L=${h.L.toFixed(3)})`).join(" "));
}

const boxes = await page.evaluate(() => {
  const pick = (sel) => [...document.querySelectorAll(sel)].map((e) => {
    const r = e.getBoundingClientRect();
    return { label: e.textContent.trim().slice(0, 16), x: Math.round(r.x), y: Math.round(r.y),
             w: Math.round(r.width), h: Math.round(r.height) };
  });
  return [...pick(".topbar-link"), ...pick(".topbar .cta-label"), ...pick(".wordmark"), ...pick(".lang-opt")]
    .filter((b) => b.w > 4 && b.h > 4);
});

console.log("\n bright  fill  halo   worst measured   weakest label");
for (const [bright, fill, halo, colour] of CANDIDATES) {
  await page.evaluate(({ bright, fill, halo, colour, HALO }) => {
    document.getElementById("sweep").textContent = `
      .topbar { background-color: rgb(0 0 0 / ${fill / 100}) !important;
        -webkit-backdrop-filter: blur(26px) saturate(1.8) brightness(${bright}) !important;
        backdrop-filter: blur(26px) saturate(1.8) brightness(${bright}) !important; }
      .topbar[data-settled] { background-color: rgb(0 0 0 / ${(fill + 6) / 100}) !important;
        -webkit-backdrop-filter: blur(32px) saturate(1.9) brightness(${Math.max(0, bright - 0.1)}) !important;
        backdrop-filter: blur(32px) saturate(1.9) brightness(${Math.max(0, bright - 0.1)}) !important; }
      ${halo ? `.topbar-link, .topbar .cta-label, .wordmark, .topbar .lang-opt { text-shadow: ${HALO} !important; }` : ""}
      ${colour ? `.topbar-link, .topbar .lang-opt { color: ${colour} !important; }` : ""}`;
  }, { bright, fill, halo, colour, HALO });
  await page.waitForTimeout(500);

  let worst = { r: Infinity };
  for (const spot of HOTSPOTS) {
    await page.evaluate((y) => window.scrollTo(0, y), spot.y);
    await page.waitForTimeout(700);
    const buf = await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 130 } });
    const png = PNG.sync.read(buf);
    const at = (x, y) => { const o = (png.width * y + x) << 2; return [png.data[o], png.data[o+1], png.data[o+2]]; };
    for (const b of boxes) {
      const y0 = Math.max(0, b.y + ((b.h / 2) | 0) - 7), y1 = Math.min(png.height - 1, b.y + ((b.h / 2) | 0) + 7);
      const L = [];
      for (let y = y0; y <= y1; y++) for (let x = b.x; x < b.x + b.w; x++) L.push(lum(...at(x, y)));
      if (L.length < 30) continue;
      L.sort((p, q) => p - q);
      const r = ratio(L[(L.length * 0.97) | 0], L[(L.length * 0.15) | 0]);
      if (r < worst.r) worst = { r, label: b.label };
    }
  }
  const verdict = worst.r >= 5 ? "ok " : worst.r >= 4.5 ? "thin" : "FAIL";
  console.log(`  ${bright.toFixed(2)}  ${String(fill).padStart(2)}%  ${halo ? "yes " : "no  "}  ${verdict} ${worst.r.toFixed(2)}:1        ${worst.label}`);
}
await browser.close();
