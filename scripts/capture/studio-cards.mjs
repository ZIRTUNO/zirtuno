// Flat web shots for S8's "Web & Software" card stage.
//
//   node scripts/capture/studio-cards.mjs
//
// The Studio card floats three small browser frames, and at ~140 CSS px wide a
// frame has to read as A WEBSITE in about a fifth of a second. The gallery's
// preview media cannot do that job: those are square lifestyle renders of a
// laptop on a table, so at card scale the laptop wins and the site disappears.
// So this shoots the live sites FLAT, 16:9, hero-composed — the same proof the
// gallery presents (`lib/content/portfolio.ts`), framed for a thumbnail.
//
// 1600x900 at dSF 1 is ~2.7x the largest rendered frame (~590 px on a 2560
// viewport), which survives next/image's AVIF re-encode with room to spare.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const OUT = "public/studio";
const W = 1600;
const H = 900;
fs.mkdirSync(OUT, { recursive: true });

const BASE = process.env.BASE || "http://localhost:3000";

const SITES = [
  {
    name: "site-juliana",
    url: "https://julianadelmonte.com.br",
    settle: 3600,
  },
  {
    name: "site-diego",
    url: "https://www.diegosantospersonal.com.br",
    settle: 4000,
  },
  // The studio's own pages. `?fveil=1` suppresses the entry intro (see the
  // locale layout's pre-paint script), so a frame lands on an arrived page and
  // not on the curtain. Four different pages, not four crops of one: the stage
  // is meant to show a RANGE of web work, and a hero, an index, a case page
  // and a form are four different jobs.
  {
    name: "site-zirtuno",
    url: `${BASE}/pt?fveil=1`,
    settle: 5200,
  },
  {
    name: "site-zirtuno-work",
    url: `${BASE}/pt/work?fveil=1`,
    settle: 4200,
  },
  {
    name: "site-zirtuno-case",
    url: `${BASE}/pt/work/juliana-delmonte?fveil=1`,
    settle: 4200,
  },
  {
    name: "site-zirtuno-contact",
    url: `${BASE}/pt/contact?fveil=1`,
    settle: 4200,
  },
];

const browser = await chromium.launch(LAUNCH);
const kb = (n) => `${(n / 1024).toFixed(0)}kB`;

for (const site of SITES) {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    locale: "pt-BR",
  });
  const page = await ctx.newPage();
  try {
    await page.goto(site.url, { waitUntil: "networkidle", timeout: 60000 });
  } catch {
    try {
      // networkidle never lands on sites with a looping request; the hero is
      // painted long before that, so fall back to the load event and settle.
      await page.goto(site.url, { waitUntil: "load", timeout: 60000 });
    } catch {
      // The studio's own shot needs a dev server; the client shots need the
      // internet. Say WHICH, and keep the shots that did land — re-running
      // for one missing frame should not mean re-shooting all three.
      console.error(
        `${site.name}: SKIPPED — ${site.url} did not answer.` +
          (site.url.includes("localhost")
            ? " Start the dev server first (npm run dev), or set BASE."
            : " Check the connection."),
      );
      await ctx.close();
      continue;
    }
  }
  await page.waitForTimeout(site.settle);

  // The cursor ring is CHROME, not the page, and the Next dev badge is not
  // part of the site at all. At ~190 px in the card they are a stray dot and a
  // stray pill, and on the studio's own hero the ring lands on the sub-headline.
  await page.addStyleTag({
    content: ".cursor-dot,.cursor-ring,nextjs-portal,[data-nextjs-toast]{display:none!important}",
  });
  await page.waitForTimeout(120);

  const shot = path.join(OUT, `${site.name}.jpg`);
  await page.screenshot({ path: shot, type: "jpeg", quality: 88 });
  console.log(`${site.name}: ${kb(fs.statSync(shot).size)}`);
  await ctx.close();
}

await browser.close();
