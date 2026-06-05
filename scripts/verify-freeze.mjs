// Back-test the freeze fix. The per-pixel RAYMARCH (the TDR-freeze risk) must
// NEVER mount on a weak GPU. With a real integrated-GPU renderer string (the
// owner's "Intel(R) UHD Graphics") the hero serves the lighter MESH glass instead
// (geometry + a matcap lookup — safe), and every other section stays static SVG.
//
// We tag the hero's live wrapper data-glass-tech="mesh" | "raymarch". A WebGL
// canvas that is NOT inside a [data-glass-tech="mesh"] ancestor is a raymarch
// canvas (hero or any chapter) = the freeze risk. On weak GPUs that count must be
// ZERO, while the safe mesh hero is present and the page stays responsive.
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
  let mesh = 0; // safe mesh canvases (data-glass-tech="mesh")
  let raymarch = 0; // raymarch canvases (everything else WebGL) = the freeze risk
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    await page.evaluate(
      (fr) => window.scrollTo(0, document.body.scrollHeight * fr),
      i / steps,
    );
    await page.waitForTimeout(450);
    const c = await page.evaluate(() => {
      let total = 0;
      let mesh = 0;
      for (const cv of document.querySelectorAll("canvas")) {
        let gl = null;
        try {
          gl = cv.getContext("webgl2") || cv.getContext("webgl");
        } catch {
          /* ignore */
        }
        if (!gl) continue; // skip the CPU Canvas-2D wordmark
        total++;
        if (cv.closest('[data-glass-tech="mesh"]')) mesh++;
      }
      return { mesh, raymarch: total - mesh };
    });
    if (c.mesh > mesh) mesh = c.mesh;
    if (c.raymarch > raymarch) raymarch = c.raymarch;
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
    `${label.padEnd(30)} mesh=${mesh}  raymarch=${raymarch}  responsive=${responsive}`,
  );
  return { mesh, raymarch, responsive };
}

const intel = await run("Intel UHD (owner's GPU)", {
  renderer: "ANGLE (Intel, Intel(R) UHD Graphics (0x00009A60) Direct3D11 vs_5_0 ps_5_0, D3D11)",
});
const intelHd = await run("Intel HD Graphics", {
  renderer: "ANGLE (Intel, Intel(R) HD Graphics 620 Direct3D11 vs_5_0 ps_5_0)",
});
const masked = await run("Masked / unknown", { renderer: "" });
const software = await run("Software (SwiftShader)", {}); // no mock = real swiftshader
const forcedMesh = await run("?glass=mesh (mesh path)", { url: "/en?glass=mesh" });
const forcedFull = await run("?glass=full (raymarch path)", { url: "/en?glass=full" });

// Policy:
//  - integrated / mobile / masked → MESH hero only, ZERO raymarch (no freeze), live.
//  - software → static SVG (no WebGL at all).
//  - forced mesh → the mesh hero mounts; forced full → the raymarch mounts.
const pass =
  intel.raymarch === 0 &&
  intel.mesh >= 1 &&
  intel.responsive &&
  intelHd.raymarch === 0 &&
  intelHd.mesh >= 1 &&
  masked.raymarch === 0 &&
  masked.mesh >= 1 &&
  software.raymarch === 0 &&
  software.mesh === 0 &&
  software.responsive &&
  forcedMesh.mesh >= 1 &&
  forcedFull.raymarch >= 1;

console.log("\nFREEZE-GUARD " + (pass ? "PASS ✓" : "FAIL ✗"));
await browser.close();
process.exit(pass ? 0 : 1);
