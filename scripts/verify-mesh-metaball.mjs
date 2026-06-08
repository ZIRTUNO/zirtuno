// Regression check for the lightweight mesh metaball path.
// Requires the dev server to be running.

import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const URL = `${BASE}/en?glass=mesh`;

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

const executablePath = chromeCandidates.find((candidate) =>
  fs.existsSync(candidate),
);

const browser = await chromium.launch({
  headless: true,
  chromiumSandbox: false,
  ...(executablePath ? { executablePath } : {}),
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
});

const errors = [];
page.on("pageerror", (err) => errors.push(err.stack || err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

try {
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.locator("[data-hero-metaball] canvas").waitFor({
    state: "attached",
    timeout: 15000,
  });
  await page.waitForTimeout(5000);

  const state = await page.evaluate(() => {
    const hero = document.querySelector("[data-hero-metaball]");
    const fallback = document.querySelector(".metaball-fallback");
    const canvas = document.querySelector("[data-hero-metaball] canvas");
    const rect = hero?.getBoundingClientRect();
    return {
      url: location.href,
      canvasCount: document.querySelectorAll("[data-hero-metaball] canvas").length,
      fallbackOpacity: fallback ? getComputedStyle(fallback).opacity : null,
      heroWidth: rect ? Math.round(rect.width) : 0,
      heroHeight: rect ? Math.round(rect.height) : 0,
      canvasWidth: canvas ? Math.round(canvas.getBoundingClientRect().width) : 0,
      canvasHeight: canvas ? Math.round(canvas.getBoundingClientRect().height) : 0,
    };
  });

  if (state.url !== URL) {
    throw new Error(`Unexpected navigation: ${state.url}`);
  }
  if (state.canvasCount !== 1) {
    throw new Error(`Expected one hero canvas, saw ${state.canvasCount}`);
  }
  if (state.heroWidth < 300 || state.heroHeight < 300) {
    throw new Error(`Hero stage collapsed: ${state.heroWidth}x${state.heroHeight}`);
  }
  if (state.canvasWidth < 300 || state.canvasHeight < 300) {
    throw new Error(`Hero canvas collapsed: ${state.canvasWidth}x${state.canvasHeight}`);
  }
  if (Number(state.fallbackOpacity) > 0.05) {
    throw new Error(`Fallback still visible after mesh ready: ${state.fallbackOpacity}`);
  }
  if (errors.length) {
    throw new Error(`Browser errors:\n${errors.join("\n---\n")}`);
  }

  const sectionState = await page.evaluate(async () => {
    const read = async (sectionId, stageSelector) => {
      document.getElementById(sectionId)?.scrollIntoView({ block: "center" });
      await new Promise((resolve) => setTimeout(resolve, 1800));
      const stage = document.querySelector(stageSelector);
      const rect = stage?.getBoundingClientRect();
      return {
        canvasCount: stage?.querySelectorAll("canvas").length || 0,
        width: rect ? Math.round(rect.width) : 0,
        height: rect ? Math.round(rect.height) : 0,
      };
    };

    return {
      services: await read("services", ".services-metaball-stage"),
      contact: await read("contact", ".contact-metaball-stage"),
    };
  });

  for (const [name, data] of Object.entries(sectionState)) {
    if (data.width < 250 || data.height < 250) {
      throw new Error(`${name} stage collapsed: ${data.width}x${data.height}`);
    }
    if (data.canvasCount !== 1) {
      throw new Error(`${name} mesh canvas missing: saw ${data.canvasCount}`);
    }
  }

  console.log("mesh metaball ok");
} finally {
  await browser.close();
}
