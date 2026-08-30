/**
 * Footer colophon stills (S11) — desktop, mobile, and a legal document.
 *
 * Scrolls to the true page bottom and waits for the liquid to settle before
 * shooting, because the footer is the ONE surface the release scene is still
 * animating over: a still taken on arrival catches the panel mid-coda.
 *
 *   node scripts/_shot-footer.mjs
 *   BASE=http://localhost:3047 node scripts/_shot-footer.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE ?? "http://localhost:3047";
const OUT = process.env.OUT ?? "captures/footer";

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  ...LAUNCH,
  args: [
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});

async function shoot(name, { url, width, height, full = false, toBottom = true }) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  // `?f*` is the harness convention that pre-paint-skips the entry veil
  // (app/[locale]/layout.tsx VEIL_SKIP) — without it every still is a still
  // of the intro.
  await page.goto(`${url}?fshot=1`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);

  if (toBottom) {
    // Lenis owns the wheel, so drive the document directly, then give the
    // scroll-scrubbed release scene time to reach its resting frame.
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }),
    );
    await page.waitForTimeout(3500);
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }),
    );
    await page.waitForTimeout(2500);
  }

  const box = await page
    .locator(".footer")
    .boundingBox()
    .catch(() => null);
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file, fullPage: full });
  console.log(
    `${name.padEnd(22)} footer box: ${
      box ? `${Math.round(box.width)}x${Math.round(box.height)} @ y${Math.round(box.y)}` : "NOT FOUND"
    }${errors.length ? `  ERRORS: ${errors.slice(0, 3).join(" | ")}` : ""}`,
  );
  await page.close();
}

await shoot("desktop-1440", { url: `${BASE}/pt`, width: 1440, height: 900 });
await shoot("desktop-1280", { url: `${BASE}/en`, width: 1280, height: 820 });
await shoot("mobile-390", { url: `${BASE}/pt`, width: 390, height: 844 });
await shoot("work-index", {
  url: `${BASE}/pt/work`,
  width: 1440,
  height: 900,
});
await shoot("legal-privacy", {
  url: `${BASE}/pt/legal/privacy`,
  width: 1440,
  height: 900,
  full: true,
  toBottom: false,
});

await browser.close();
console.log("done ->", OUT);
