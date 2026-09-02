// Real preview media for the Selected Work gallery.
//
//   node scripts/capture/project-previews.mjs
//
// The gallery presents PROOF, so the preview must be the live site itself —
// not a mockup and not a stand-in form still. Both the card and the modal's
// flying media slot are SQUARE, so the shot is taken at a square viewport:
// each of these sites builds a 100vh hero, so a 1440x1440 frame lands on the
// hero composed for that ratio instead of a 16:9 shot cropped at the sides.
//
// Sizes are chosen for what actually renders. The card tops out near 600 CSS
// px and the modal media near 460, so 1440 square covers both at 2x; JPEG,
// because these are photographic heroes and next/image re-encodes to AVIF or
// WebP on serve anyway. The client's own icon is the mark, downscaled through
// a canvas (alpha preserved) rather than shipped at its native 512-1024.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const OUT = "public/work";
const SIDE = 1440;
const MARK_SIDE = 256;
fs.mkdirSync(OUT, { recursive: true });

const SITES = [
  {
    slug: "juliana-delmonte",
    url: "https://julianadelmonte.com.br",
    mark: "https://julianadelmonte.com.br/icon.png",
    // The hero animates its headline in; wait for it to settle before shooting.
    settle: 3200,
  },
  {
    slug: "diego-santos",
    url: "https://www.diegosantospersonal.com.br",
    mark: "https://www.diegosantospersonal.com.br/assets/logo-mark.png",
    settle: 3600,
  },
];

const browser = await chromium.launch(LAUNCH);
const kb = (n) => `${(n / 1024).toFixed(0)}kB`;

for (const site of SITES) {
  const ctx = await browser.newContext({
    viewport: { width: SIDE, height: SIDE },
    deviceScaleFactor: 1,
    // These are Brazilian sites; ask for their own locale so no translation
    // banner or locale redirect lands in the frame.
    locale: "pt-BR",
  });
  const page = await ctx.newPage();
  await page.goto(site.url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(site.settle);

  const shot = path.join(OUT, `${site.slug}.jpg`);
  await page.screenshot({ path: shot, type: "jpeg", quality: 86 });
  console.log(`${site.slug}: ${kb(fs.statSync(shot).size)}`);

  const dataUrl = await page.evaluate(
    async ([src, side]) => {
      const res = await fetch(src);
      if (!res.ok) return null;
      const bmp = await createImageBitmap(await res.blob());
      const c = document.createElement("canvas");
      c.width = c.height = side;
      const g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(bmp, 0, 0, side, side);
      return c.toDataURL("image/png");
    },
    [site.mark, MARK_SIDE],
  );
  if (dataUrl) {
    const buf = Buffer.from(dataUrl.split(",")[1], "base64");
    fs.writeFileSync(path.join(OUT, `${site.slug}-mark.png`), buf);
    console.log(`${site.slug} mark: ${kb(buf.length)}`);
  } else {
    console.warn(`${site.slug} mark: fetch failed — skipped`);
  }

  await ctx.close();
}

await browser.close();
