/** Pixel evidence for the actual backdrop displacement, not just CSS support.
 * A temporary calibration pattern is confined to the test browser.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { LAUNCH } from "../support/launch.mjs";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = "captures/contact-optics";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(LAUNCH);
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, reducedMotion: "reduce" });
  await page.goto(BASE + "/en/contact?fcap=1");
  await page.waitForSelector(".contact-card");
  // The message field of the track the card opens on: the largest control on
  // the page, so the rim and the quiet centre are both several pixels wide.
  await page.waitForSelector(
    "form[data-track='project'] .contact-message-field .contact-glass[data-optical]",
  );
  await page.addStyleTag({ content: ".aura,.breath-layer,.fl,[class*=cursor]{visibility:hidden!important}.contact-control{background:repeating-linear-gradient(90deg,#111 0px,#111 5px,#ccc 5px,#ccc 10px)!important}.contact-control textarea{visibility:hidden}" });
  const host = page.locator(
    "form[data-track='project'] .contact-message-field .contact-control",
  );
  await host.scrollIntoViewIfNeeded();
  const map = host.locator("feDisplacementMap");
  await page.waitForTimeout(500);
  const normalMap = await host.evaluate(async el => {
    const img = new Image(); img.src = el.querySelector("feImage").getAttribute("href"); await img.decode();
    const canvas = document.createElement("canvas"); canvas.width=img.width; canvas.height=img.height;
    const ctx=canvas.getContext("2d"); ctx.drawImage(img,0,0);
    return { map:[img.width,img.height], centre:[...ctx.getImageData(Math.floor(img.width/2),Math.floor(img.height/2),1,1).data],
      edge:[...ctx.getImageData(4,Math.floor(img.height/2),1,1).data],filter:getComputedStyle(el.querySelector(".contact-glass-transmission")).backdropFilter };
  });
  assert.deepEqual(normalMap.centre, [128, 128, 128, 255], "neutral optical centre");
  assert.ok(normalMap.edge[0] < 100, "nonzero normal at the rolled rim");
  const on = PNG.sync.read(await host.screenshot({ path: OUT + "/refracting.png" }));
  await map.evaluate(el => el.setAttribute("scale", "0"));
  const off = PNG.sync.read(await host.screenshot({ path: OUT + "/neutral.png" }));
  let edge = 0, inner = 0, ne = 0, ni = 0;
  for (let y = 3; y < on.height - 3; y++) for (let x = 3; x < on.width - 3; x++) {
    const d = Math.min(x, y, on.width - 1 - x, on.height - 1 - y);
    const diff = Math.abs(on.data[(y * on.width + x) * 4] - off.data[(y * off.width + x) * 4]);
    if (d < 13) { edge += diff; ne++; }
    if (d > 24) { inner += diff; ni++; }
  }
  const result = { edgeDifference: edge / ne, centreDifference: inner / ni };
  fs.writeFileSync(OUT + "/report.json", JSON.stringify(result, null, 2));
  assert.ok(result.edgeDifference > 2, "The rolled rim must actually refract the backdrop: " + JSON.stringify(result));
  assert.ok(result.centreDifference < result.edgeDifference * 0.35, "The centre must stay optically quiet");
  console.log("CONTACT OPTICS: actual backdrop displacement verified " + JSON.stringify(result));
} finally { await browser.close(); }
