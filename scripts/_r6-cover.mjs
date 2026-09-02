// How much has the liquid's FOOTPRINT changed? The authored scatter is meant to
// read as fragmented topology; motes that merge into their hosts would quietly
// fuse it into continents. Coverage + component count says which happened.
import fs from "node:fs";
import { chromium } from "playwright";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const exe = ["C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ headless: false, chromiumSandbox: false,
  executablePath: exe, args: ["--window-position=0,0", "--window-size=1380,900"] });

const measure = async (url, at) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.bringToFront();
  await page.waitForFunction(() => window.__optics?.frames > 40, null, { timeout: 30000 }).catch(()=>{});
  await page.evaluate((y) => window.scrollTo(0, y * (document.body.scrollHeight - innerHeight)), at);
  await page.waitForTimeout(3000);
  const shot = (await page.screenshot()).toString("base64");
  const r = await page.evaluate(async (b64) => {
    const img = await createImageBitmap(await (await fetch("data:image/png;base64," + b64)).blob());
    const c = new OffscreenCanvas(img.width, img.height);
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, img.width, img.height).data;
    const W = img.width, H = img.height;
    // the liquid is brand cyan on near-black: blue high, red low
    const lit = new Uint8Array(W * H);
    let n = 0;
    for (let p = 0, i = 0; p < d.length; p += 4, i++)
      if (d[p + 2] > 70 && d[p + 2] - d[p] > 40) { lit[i] = 1; n++; }
    // connected components (4-way flood), ignoring specks under 40 px
    const seen = new Uint8Array(W * H);
    const stack = new Int32Array(W * H);
    let blobs = 0, biggest = 0;
    for (let i = 0; i < W * H; i++) {
      if (!lit[i] || seen[i]) continue;
      let sp = 0, size = 0;
      stack[sp++] = i; seen[i] = 1;
      while (sp) {
        const q = stack[--sp]; size++;
        const qx = q % W, qy = (q / W) | 0;
        if (qx > 0 && lit[q-1] && !seen[q-1]) { seen[q-1]=1; stack[sp++]=q-1; }
        if (qx < W-1 && lit[q+1] && !seen[q+1]) { seen[q+1]=1; stack[sp++]=q+1; }
        if (qy > 0 && lit[q-W] && !seen[q-W]) { seen[q-W]=1; stack[sp++]=q-W; }
        if (qy < H-1 && lit[q+W] && !seen[q+W]) { seen[q+W]=1; stack[sp++]=q+W; }
      }
      if (size >= 40) { blobs++; if (size > biggest) biggest = size; }
    }
    return { coverage: n / (W * H), blobs, biggest: biggest / (W * H) };
  }, shot);
  const o = await page.evaluate(() => ({ count: window.__optics?.count, motes: window.__optics?.motes }));
  await page.close();
  return { ...r, ...o };
};

const at = Number(process.env.AT || 0.12);
console.log(`scroll ${at}`);
console.log("condition                count motes  coverage  blobs  biggest");
for (const [label, q] of [
  ["pre-R6", "ftier=full&fmotes=1&ftemper=0&ftile=0"],
  ["R6", "ftier=full"],
]) {
  const r = await measure(`${BASE}/pt?${q}`, at);
  console.log(`${label.padEnd(24)} ${String(r.count).padStart(5)} ${String(r.motes).padStart(5)}  ` +
    `${(r.coverage*100).toFixed(2).padStart(7)}% ${String(r.blobs).padStart(6)}  ${(r.biggest*100).toFixed(2)}%`);
}
await browser.close();
