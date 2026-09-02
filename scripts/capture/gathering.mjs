/**
 * S3 · THE GATHERING — the editorial opening, viewport stills through the
 * runway, and the closing statement, plus the one number the old label
 * placement could never guarantee: how many capability rows overlap.
 *
 * The previous layout parked each name at its own mass and nudged it sideways
 * to dodge a neighbour, which is a hope, not a guarantee — at some viewports and
 * in some locales the boxes still collided. The blocks make it structural, and
 * this reports it as a count so a regression is visible rather than argued.
 *
 *   node scripts/capture/gathering.mjs
 *   W=1920 H=1080 node scripts/capture/gathering.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "captures/gathering";
const W = Number(process.env.W ?? 1512);
const H = Number(process.env.H ?? 860);
const TAG = process.env.TAG ?? `${W}x${H}`;
const STOPS = (process.env.STOPS ?? "0.30,0.55,0.72,0.92").split(",").map(Number);
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  ...LAUNCH,
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
await page.goto(`${BASE}/en?ftier=full${process.env.Q ?? ""}`, { waitUntil: "load" });
await page.waitForFunction(() => !!window.__scenes, { timeout: 30000 });
await page.waitForTimeout(1800);

const scrollTo = async (selector, offset = 0) => {
  const y = await page.evaluate(
    ({ selector, offset }) => {
      const el = document.querySelector(selector);
      return el ? Math.round(el.getBoundingClientRect().top + scrollY + offset) : 0;
    },
    { selector, offset },
  );
  await page.evaluate(async (target) => {
    for (let i = 0; i < 30; i++) {
      window.scrollTo(0, target);
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (Math.abs(window.scrollY - target) < 3) break;
    }
  }, y);
  await page.waitForTimeout(900);
};

await scrollTo(".gather-intro");
await page.screenshot({ path: `${OUT}/gather-${TAG}-intro.png` });

for (const f of STOPS) {
  const y = await page.evaluate((frac) => {
    const rw = document.querySelector("[data-organism]");
    const top = rw.getBoundingClientRect().top + window.scrollY;
    return Math.round(top + rw.offsetHeight * frac - window.innerHeight / 2);
  }, f);
  await page.evaluate(async (t) => {
    for (let i = 0; i < 30; i++) {
      window.scrollTo(0, t);
      await new Promise((r) => setTimeout(r, 100));
      if (Math.abs(window.scrollY - t) < 3) break;
    }
  }, y);
  await page.waitForTimeout(2200);

  const info = await page.evaluate(() => {
    const layer = document.querySelector(".journey-interactions");
    const vis = (el) => {
      const cs = getComputedStyle(el);
      return cs.display !== "none" && parseFloat(cs.opacity) > 0.05;
    };
    const rows = [...document.querySelectorAll(".gather-row")].filter(vis);
    const boxes = rows.map((r) => r.getBoundingClientRect());
    let overlaps = 0;
    const pairs = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.right > b.left && b.right > a.left && a.bottom > b.top && b.bottom > a.top) {
          overlaps++;
          pairs.push(`${rows[i].textContent.trim().slice(0, 18)} / ${rows[j].textContent.trim().slice(0, 18)}`);
        }
      }
    // rows must also stay inside the stage
    const st = layer.getBoundingClientRect();
    const outside = boxes.filter((b) => b.left < st.left - 1 || b.right > st.right + 1 || b.top < st.top - 1 || b.bottom > st.bottom + 1).length;
    // how many distinct x-axes does the type sit on? (alignment, measured)
    const axes = new Set(boxes.map((b) => Math.round(b.left / 4) * 4));
    const blocks = [...document.querySelectorAll(".gather-block")].map((b) => {
      const r = b.getBoundingClientRect();
      return `${b.dataset.sys}@${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}${r.top < st.top - 1 ? " CLIPPED" : ""}`;
    });
    return {
      grow: layer.style.getPropertyValue("--eco-grow"),
      visibleRows: rows.length,
      overlaps,
      pairs: pairs.slice(0, 4),
      outside,
      axes: axes.size,
      blocks,
    };
  });

  const name = `${OUT}/gather-${TAG}-${String(Math.round(f * 100)).padStart(2, "0")}.png`;
  await page.screenshot({ path: name });
  console.log(
    `  p=${f.toFixed(2)} grow=${String(info.grow).slice(0, 5)}  rows=${String(info.visibleRows).padStart(2)}  ` +
      `overlaps=${info.overlaps}  offstage=${info.outside}  x-axes=${info.axes}` +
      (info.pairs.length ? `\n      ${info.pairs.join(" · ")}` : "") +
      `\n      ${info.blocks.join("  |  ")}`,
  );
}

await scrollTo(".gather-outro");
await page.screenshot({ path: `${OUT}/gather-${TAG}-outro.png` });
console.log(`\n-> ${OUT}/gather-${TAG}-*.png`);
await browser.close();
