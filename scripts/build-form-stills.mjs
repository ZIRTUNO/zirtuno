// Form STILLS (R3) — bakes each service pillar's SDF-glass form to a shipped
// transparent PNG (public/brand/stills/<category>.png). The work cards use
// these as placeholder ART (consistent, on-brand — replaces the text-in-a-box)
// until real project media arrives; zero runtime WebGL cost, works on every
// tier. Renders via the deterministic ?fstate=N frozen path — the EXACT same
// glass the site ships. Dev server must be running:
//   node scripts/build-form-stills.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "public", "brand", "stills");
const BASE = process.env.BASE || "http://localhost:3000";
fs.mkdirSync(OUT, { recursive: true });

// state index (lib/webgl/symbols: 1-7) → work category key (lib/sanity/types)
const FORMS = [
  [1, "web-design"],
  [2, "software"],
  [3, "ai"],
  [4, "automation"],
  [5, "data"],
  [6, "branding"],
  [7, "marketing"],
];

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const executablePath = chromeCandidates.find((c) => fs.existsSync(c));

const browser = await chromium.launch({
  headless: process.env.HEADLESS !== "false",
  chromiumSandbox: false,
  ...(executablePath ? { executablePath } : {}),
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1.5, // ~720px stills — crisp in a 16/10 card
});

for (const [state, key] of FORMS) {
  await page.goto(`${BASE}/en?fstate=${state}`, { waitUntil: "networkidle" });
  const stage = page.locator("[data-hero-metaball]");
  await stage.waitFor({ timeout: 20000 });
  await page.waitForTimeout(1400); // SDF build + the frozen draw
  // transparent still of the glass form ONLY: hide everything that is not the
  // stage subtree (labels, chapter index, chrome), clear every background
  await page.evaluate(() => {
    const st = document.querySelector("[data-hero-metaball]");
    if (!st) return;
    for (const el of document.querySelectorAll("body *")) {
      if (el === st || el.contains(st) || st.contains(el)) {
        el.style.background = "transparent";
      } else {
        el.style.visibility = "hidden";
      }
    }
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
  });
  await page.waitForTimeout(120);
  await stage.screenshot({
    path: path.join(OUT, `${key}.png`),
    omitBackground: true,
  });
  console.log(`still ${key} (state ${state})`);
}

await browser.close();
console.log(`→ public/brand/stills/ (${FORMS.length} forms)`);
