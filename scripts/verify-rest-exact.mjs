// verify-rest-exact (R5-C) — THE byte gate behind the stop-the-line rule
// "any exact rest delta after a supposedly identity change: stop" (§14.3).
//
//   node scripts/verify-rest-exact.mjs --baseline   record reference hashes
//   node scripts/verify-rest-exact.mjs              compare against them
//
// forms:rest stays the human fidelity sheet (rest render vs the owner SVG);
// it screenshots the composited page, which is NOT run-reproducible — the
// .breath-layer noise pulses above the canvas, the entry veil races the
// capture, and the SDF build can lose to the timeout. This gate removes all
// of that: animated overlays are hidden, and each state is polled until two
// CONSECUTIVE element screenshots are byte-equal — the settled still. The
// settled stills are deterministic (proven at R5-C1: byte-identical across
// reruns AND across the pre/post-optics trees), so SHA-256 equality against
// the recorded baseline is a true pixel-identity assertion. The page remains
// laid out normally, but only the deterministic stage is made visible during
// capture: fixed chrome and scene labels can overlap its rectangle and must
// not turn an unrelated typography/layout change into a false shader failure.
//
// The hashes are machine/driver-specific: record and compare on the same
// hardware (the owner QA machine). A CONSCIOUS visual re-baseline (an
// owner-approved material change) reruns --baseline and commits the json.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const REF_PATH = path.join(process.cwd(), "scripts", "rest-exact.json");
const baselineMode = process.argv.includes("--baseline");
const STATES = 8;

const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

const hashes = [];
for (let i = 0; i < STATES; i++) {
  await page.goto(`${BASE}/en?fstate=${i}&ftier=full`, { waitUntil: "networkidle" });
  await page.addStyleTag({
    content: `
      body * { visibility: hidden !important; }
      [data-hero-metaball],
      [data-hero-metaball] * { visibility: visible !important; }
      .breath-layer { display: none !important; }
    `,
  });
  const stage = page.locator("[data-hero-metaball]");
  await stage.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(900);
  let prev = null;
  let shot = null;
  let settled = false;
  for (let tries = 0; tries < 40; tries++) {
    shot = await stage.screenshot();
    if (prev && Buffer.compare(prev, shot) === 0) {
      settled = true;
      break;
    }
    prev = shot;
    await page.waitForTimeout(250);
  }
  if (!settled) {
    console.error(`state ${i}: never settled — cannot assert identity`);
    await browser.close();
    process.exit(1);
  }
  hashes.push(crypto.createHash("sha256").update(shot).digest("hex"));
}
await browser.close();

if (baselineMode) {
  fs.writeFileSync(
    REF_PATH,
    JSON.stringify({ date: new Date().toISOString(), sha256: hashes }, null, 2) + "\n",
  );
  console.log("rest-exact baseline recorded:", REF_PATH);
  process.exit(0);
}

const ref = JSON.parse(fs.readFileSync(REF_PATH, "utf8"));
let failures = 0;
for (let i = 0; i < STATES; i++) {
  const same = ref.sha256[i] === hashes[i];
  console.log(`${same ? "  ✓" : "  ✗ FAIL"} rest state ${i} ${same ? "byte-identical" : "PIXELS MOVED"}`);
  if (!same) failures++;
}
console.log(failures === 0 ? "REST EXACT: all states byte-identical" : `REST EXACT FAILURES: ${failures} — STOP THE LINE`);
process.exit(failures === 0 ? 0 : 1);
