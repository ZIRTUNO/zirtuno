import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";
const OUT = "captures/careers"; fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE_URL || "http://localhost:3055";
const browser = await chromium.launch({ ...LAUNCH, args: ["--enable-unsafe-swiftshader","--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"] });
for (const [name, url, w, h] of [
  ["pt-desktop", `${BASE}/pt/careers?fshot=1`, 1440, 900],
  ["en-desktop", `${BASE}/en/careers?fshot=1`, 1440, 900],
  ["pt-mobile",  `${BASE}/pt/careers?fshot=1`, 390, 844],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  page.on("console", m => m.type() === "error" && errs.push(m.text()));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const info = await page.evaluate(() => ({
    h1: document.querySelector("h1")?.textContent,
    h2s: [...document.querySelectorAll("h2")].map(e => e.textContent),
    chips: [...document.querySelectorAll(".careers-function")].map(e => e.textContent),
    cta: document.querySelector(".careers-cta a")?.getAttribute("href"),
  }));
  console.log(name, JSON.stringify(info), errs.length ? `ERRORS: ${errs.slice(0,2)}` : "");
  await page.close();
}
await browser.close();
console.log("done ->", OUT);
