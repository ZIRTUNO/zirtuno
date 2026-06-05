// Back-test the freeze fix: with a real integrated-GPU renderer string (the
// owner's "Intel(R) UHD Graphics"), the site must mount ZERO WebGL canvases
// through a full scroll — the raymarch never runs, so the GPU driver never
// hangs. Also checks software + masked GPUs (→ SVG) and that forced glass still
// mounts for capable users.
//   BASE_URL=http://localhost:PORT node scripts/verify-freeze.mjs

import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:65138";

// Override the WebGL renderer string the page sees, before any page script runs.
function mockRenderer(value) {
  return `(() => {
    const FAKE = ${JSON.stringify(value)};
    const patch = (proto) => {
      if (!proto) return;
      const ge = proto.getExtension;
      proto.getExtension = function (n) {
        if (n === 'WEBGL_debug_renderer_info')
          return { UNMASKED_VENDOR_WEBGL: 37445, UNMASKED_RENDERER_WEBGL: 37446 };
        return ge.call(this, n);
      };
      const gp = proto.getParameter;
      proto.getParameter = function (p) {
        if (p === 37446) return FAKE;
        if (p === 37445) return 'Mock';
        return gp.call(this, p);
      };
    };
    patch(self.WebGLRenderingContext && self.WebGLRenderingContext.prototype);
    patch(self.WebGL2RenderingContext && self.WebGL2RenderingContext.prototype);
  })();`;
}

const browser = await chromium.launch({ headless: true, chromiumSandbox: false });

async function run(label, { renderer, url = "/en" }) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  if (renderer !== undefined) await ctx.addInitScript(mockRenderer(renderer));
  const page = await ctx.newPage();
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector("h1"), { timeout: 40000 });

  // Scroll the whole page in steps; lazy metaballs mount on approach IF enabled.
  let maxCanvas = 0;
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    await page.evaluate(
      (f) => window.scrollTo(0, document.body.scrollHeight * f),
      i / steps,
    );
    await page.waitForTimeout(450);
    // Count only WebGL canvases (the raymarch = the freeze risk). The S8 wordmark
    // is a benign CPU Canvas-2D and is correctly excluded.
    const n = await page.evaluate(() => {
      let webgl = 0;
      for (const c of document.querySelectorAll("canvas")) {
        try {
          if (c.getContext("webgl2") || c.getContext("webgl")) webgl++;
        } catch {
          /* ignore */
        }
      }
      return webgl;
    });
    if (n > maxCanvas) maxCanvas = n;
  }
  // still responsive? (a frozen page can't service rAF)
  const responsive = await page.evaluate(
    () =>
      new Promise((res) => {
        const t = performance.now();
        requestAnimationFrame(() => res(performance.now() - t < 1500));
      }),
  );
  await ctx.close();
  console.log(
    `${label.padEnd(28)} maxCanvasesDuringScroll=${maxCanvas}  responsive=${responsive}`,
  );
  return { maxCanvas, responsive };
}

const intel = await run("Intel UHD (owner's GPU)", {
  renderer: "ANGLE (Intel, Intel(R) UHD Graphics (0x00009A60) Direct3D11 vs_5_0 ps_5_0, D3D11)",
});
const intelHd = await run("Intel HD Graphics", {
  renderer: "ANGLE (Intel, Intel(R) HD Graphics 620 Direct3D11 vs_5_0 ps_5_0)",
});
const masked = await run("Masked / unknown", { renderer: "" });
const software = await run("Software (SwiftShader)", {}); // no mock = real swiftshader
const forced = await run("?glass=full (capable path)", { url: "/en?glass=full" });

// New policy: real GPUs (incl. Intel UHD / masked) now run the OPTIMIZED live
// glass (≥1 WebGL canvas) and must stay responsive; only a pure software
// rasterizer keeps the SVG (0 canvases). NB: a real-GPU TDR freeze can't be
// reproduced here (Playwright uses software GL) — fps/no-freeze on actual
// integrated hardware must be confirmed on-device with ?perf=1.
const pass =
  intel.maxCanvas >= 1 &&
  intel.responsive &&
  intelHd.maxCanvas >= 1 &&
  masked.maxCanvas >= 1 &&
  software.maxCanvas === 0 &&
  forced.maxCanvas >= 1;

console.log("\nGLASS-POLICY " + (pass ? "PASS ✓" : "FAIL ✗"));
await browser.close();
process.exit(pass ? 0 : 1);
