// Confirm the hero morph FILM plays on an integrated GPU (the owner's Intel UHD):
// a <video> is present and actually advancing, ZERO WebGL canvases mount, and
// the page stays responsive. Captures the hero so we can see the real result.
//   BASE_URL=http://localhost:PORT node scripts/verify-hero-film.mjs

import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:65139";
fs.mkdirSync("captures/verify", { recursive: true });

const INTEL =
  "ANGLE (Intel, Intel(R) UHD Graphics (0x00009A60) Direct3D11 vs_5_0 ps_5_0, D3D11)";
const mock = `(() => {
  const FAKE = ${JSON.stringify(INTEL)};
  const patch = (p) => { if(!p) return;
    const ge=p.getExtension; p.getExtension=function(n){ if(n==='WEBGL_debug_renderer_info') return {UNMASKED_VENDOR_WEBGL:37445,UNMASKED_RENDERER_WEBGL:37446}; return ge.call(this,n); };
    const gp=p.getParameter; p.getParameter=function(x){ if(x===37446) return FAKE; if(x===37445) return 'Mock'; return gp.call(this,x); };
  };
  patch(self.WebGLRenderingContext&&self.WebGLRenderingContext.prototype);
  patch(self.WebGL2RenderingContext&&self.WebGL2RenderingContext.prototype);
})();`;

const browser = await chromium.launch({ headless: true, chromiumSandbox: false });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: "no-preference",
});
await ctx.addInitScript(mock);
const page = await ctx.newPage();
await page.goto(`${BASE}/en`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 40000 });
await page.waitForTimeout(1500); // let it start

const t0 = await page.evaluate(() => {
  const v = document.querySelector("[data-hero-metaball] video");
  return v ? v.currentTime : null;
});
await page.waitForTimeout(1400);
const info = await page.evaluate(() => {
  const v = document.querySelector("[data-hero-metaball] video");
  let webgl = 0;
  for (const c of document.querySelectorAll("canvas")) {
    try {
      if (c.getContext("webgl2") || c.getContext("webgl")) webgl++;
    } catch {
      /* ignore */
    }
  }
  return {
    hasVideo: !!v,
    paused: v ? v.paused : null,
    currentTime: v ? Number(v.currentTime.toFixed(2)) : null,
    duration: v ? Number((v.duration || 0).toFixed(2)) : null,
    webglCanvases: webgl,
  };
});
const responsive = await page.evaluate(
  () =>
    new Promise((res) => {
      const t = performance.now();
      requestAnimationFrame(() => res(performance.now() - t < 1500));
    }),
);

await page.locator("[data-hero-metaball]").first().screenshot({
  path: "captures/verify/hero-intel-uhd.png",
});

const playing = t0 != null && info.currentTime != null && info.currentTime > t0;
console.log(
  "HERO-FILM " +
    JSON.stringify({ ...info, t0, playing, responsive, freezeRisk: info.webglCanvases }),
);
console.log(
  playing && info.webglCanvases === 0 && responsive ? "PASS ✓" : "FAIL ✗",
);
await browser.close();
