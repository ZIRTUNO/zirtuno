import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SOURCE_DIR =
  process.argv[2] ?? "C:/Users/pedro/Desktop/02_Clientes/Zirtuno ASSETS/Morphs DEFINITIVE";
// Reference set (originals + per-category SVGs + previews) lives OUTSIDE public/
// so it isn't deployed; only the runtime mirrors in public/brand/forms ship.
const OUT_ROOT = path.join(ROOT, "references", "morphs");
const FORMS_DIR = path.join(ROOT, "public", "brand", "forms");
const PREVIEW_DIR = path.join(OUT_ROOT, "_previews");

const TRACE_THRESHOLD = Number(process.env.MORPH_TRACE_THRESHOLD ?? 34);
const SIMPLIFY_TOLERANCE = Number(process.env.MORPH_SIMPLIFY_TOLERANCE ?? 1.15);
const MIN_CONTOUR_AREA = Number(process.env.MORPH_MIN_CONTOUR_AREA ?? 36);
const SVG_FILL = "#00E3FE";

const MORPHS = [
  {
    order: "01",
    key: "web",
    slug: "web-design",
    source: "WebDESIGN.png",
    labelPt: "Web Design & Experiência Digital",
    labelEn: "Web Design & Digital Experience",
    represents:
      "Browser/interface form for sites, landing pages, ecommerce, portals, and digital product experiences.",
  },
  {
    order: "02",
    key: "software",
    slug: "software-development",
    source: "Software Development.png",
    labelPt: "Desenvolvimento de Software & Apps",
    labelEn: "Software & App Development",
    represents:
      "Code/network form for systems, apps, platforms, internal tools, and custom software.",
  },
  {
    order: "03",
    key: "ai",
    slug: "ai",
    source: "AI.png",
    labelPt: "Inteligência Artificial",
    labelEn: "Artificial Intelligence",
    represents:
      "AI-brain form for agents, chatbots, intelligent automation, and assisted decision systems.",
  },
  {
    order: "04",
    key: "automation",
    slug: "automation",
    source: "Automation.png",
    labelPt: "Automação & Integrações",
    labelEn: "Automation & Integrations",
    represents:
      "Cycle/loop form for process automation, integrations, CRM flows, and connected operations.",
  },
  {
    order: "05",
    key: "data",
    slug: "data",
    source: "Data.png",
    labelPt: "Dados & Dashboards",
    labelEn: "Data & Dashboards",
    represents:
      "Structured columns form for data organization, BI, reports, dashboards, and decision visibility.",
  },
  {
    order: "06",
    key: "branding",
    slug: "branding",
    source: "Branding.png",
    labelPt: "Branding & Posicionamento",
    labelEn: "Branding & Positioning",
    represents:
      "Orbit/core form for brand identity, positioning, design systems, and visual language.",
  },
  {
    order: "07",
    key: "marketing",
    slug: "marketing",
    source: "Marketing.png",
    labelPt: "Marketing & Crescimento",
    labelEn: "Marketing & Growth",
    represents:
      "Signal/megaphone form for paid media, content, launch systems, funnels, and growth loops.",
  },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readPng(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

function lumaAt(png, x, y) {
  const i = (y * png.width + x) * 4;
  const r = png.data[i];
  const g = png.data[i + 1];
  const b = png.data[i + 2];
  return r * 0.299 + g * 0.587 + b * 0.114;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function edgePoint(edge, x, y, v) {
  const interp = (a, b) => {
    const d = b - a;
    if (Math.abs(d) < 1e-6) return 0.5;
    return Math.min(1, Math.max(0, (TRACE_THRESHOLD - a) / d));
  };

  if (edge === "top") {
    const t = interp(v.tl, v.tr);
    return { x: lerp(x, x + 1, t), y };
  }
  if (edge === "right") {
    const t = interp(v.tr, v.br);
    return { x: x + 1, y: lerp(y, y + 1, t) };
  }
  if (edge === "bottom") {
    const t = interp(v.bl, v.br);
    return { x: lerp(x, x + 1, t), y: y + 1 };
  }

  const t = interp(v.tl, v.bl);
  return { x, y: lerp(y, y + 1, t) };
}

function addSegment(segments, points, a, b) {
  segments.push({ a: points[a], b: points[b] });
}

function traceSegments(png) {
  const segments = [];

  for (let y = 0; y < png.height - 1; y += 1) {
    for (let x = 0; x < png.width - 1; x += 1) {
      const v = {
        tl: lumaAt(png, x, y),
        tr: lumaAt(png, x + 1, y),
        br: lumaAt(png, x + 1, y + 1),
        bl: lumaAt(png, x, y + 1),
      };

      const tl = v.tl >= TRACE_THRESHOLD;
      const tr = v.tr >= TRACE_THRESHOLD;
      const br = v.br >= TRACE_THRESHOLD;
      const bl = v.bl >= TRACE_THRESHOLD;
      const mask = (tl ? 1 : 0) | (tr ? 2 : 0) | (br ? 4 : 0) | (bl ? 8 : 0);
      if (mask === 0 || mask === 15) continue;

      const points = {};
      if (tl !== tr) points.top = edgePoint("top", x, y, v);
      if (tr !== br) points.right = edgePoint("right", x, y, v);
      if (br !== bl) points.bottom = edgePoint("bottom", x, y, v);
      if (bl !== tl) points.left = edgePoint("left", x, y, v);

      const edges = Object.keys(points);
      if (edges.length === 2) {
        addSegment(segments, points, edges[0], edges[1]);
      } else if (edges.length === 4) {
        if (mask === 5) {
          addSegment(segments, points, "top", "left");
          addSegment(segments, points, "right", "bottom");
        } else if (mask === 10) {
          addSegment(segments, points, "top", "right");
          addSegment(segments, points, "bottom", "left");
        } else {
          addSegment(segments, points, edges[0], edges[1]);
          addSegment(segments, points, edges[2], edges[3]);
        }
      }
    }
  }

  return segments;
}

function pointKey(p) {
  return `${Math.round(p.x * 1000)},${Math.round(p.y * 1000)}`;
}

function buildContours(segments) {
  const graph = new Map();
  const normalized = segments.map((segment, index) => ({
    ...segment,
    index,
    ak: pointKey(segment.a),
    bk: pointKey(segment.b),
    used: false,
  }));

  for (const segment of normalized) {
    if (!graph.has(segment.ak)) graph.set(segment.ak, []);
    if (!graph.has(segment.bk)) graph.set(segment.bk, []);
    graph.get(segment.ak).push(segment);
    graph.get(segment.bk).push(segment);
  }

  const contours = [];
  for (const startSegment of normalized) {
    if (startSegment.used) continue;

    startSegment.used = true;
    const startKey = startSegment.ak;
    let previousKey = startSegment.ak;
    let currentKey = startSegment.bk;
    const contour = [startSegment.a, startSegment.b];

    for (let guard = 0; guard < normalized.length; guard += 1) {
      if (currentKey === startKey) break;

      const candidates = (graph.get(currentKey) ?? []).filter((segment) => !segment.used);
      if (candidates.length === 0) break;

      let next = candidates[0];
      if (candidates.length > 1) {
        next = candidates.find((segment) => segment.ak !== previousKey && segment.bk !== previousKey) ?? next;
      }

      next.used = true;
      const nextPoint = next.ak === currentKey ? next.b : next.a;
      previousKey = currentKey;
      currentKey = next.ak === currentKey ? next.bk : next.ak;
      contour.push(nextPoint);
    }

    if (contour.length > 3) contours.push(contour);
  }

  return contours;
}

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function rdp(points, tolerance) {
  if (points.length <= 2) return points;

  let maxDistance = -1;
  let index = -1;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = distanceToSegment(points[i], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }

  if (maxDistance <= tolerance) return [first, last];

  const left = rdp(points.slice(0, index + 1), tolerance);
  const right = rdp(points.slice(index), tolerance);
  return left.slice(0, -1).concat(right);
}

function simplifyClosed(points, tolerance) {
  const area = Math.abs(polygonArea(points));
  if (points.length < 8 || area < MIN_CONTOUR_AREA) return points;

  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  for (let i = 1; i < points.length; i += 1) {
    if (points[i].x < points[minX].x) minX = i;
    if (points[i].x > points[maxX].x) maxX = i;
    if (points[i].y < points[minY].y) minY = i;
    if (points[i].y > points[maxY].y) maxY = i;
  }

  const xSpan = points[maxX].x - points[minX].x;
  const ySpan = points[maxY].y - points[minY].y;
  const start = xSpan >= ySpan ? minX : minY;
  const end = xSpan >= ySpan ? maxX : maxY;

  const walk = (from, to) => {
    const out = [];
    let i = from;
    while (true) {
      out.push(points[i]);
      if (i === to) break;
      i = (i + 1) % points.length;
    }
    return out;
  };

  const a = rdp(walk(start, end), tolerance);
  const b = rdp(walk(end, start), tolerance);
  return a.slice(0, -1).concat(b.slice(0, -1));
}

function formatNumber(n) {
  const fixed = n.toFixed(2);
  return fixed.replace(/\.?0+$/, "");
}

function contourToPath(points) {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return [
    `M${formatNumber(first.x)} ${formatNumber(first.y)}`,
    ...rest.map((point) => `L${formatNumber(point.x)} ${formatNumber(point.y)}`),
    "Z",
  ].join(" ");
}

function xmlEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pngToSvg(png, morph, sourceFile) {
  const contours = buildContours(traceSegments(png))
    .map((contour) => ({ contour, area: Math.abs(polygonArea(contour)) }))
    .filter(({ area }) => area >= MIN_CONTOUR_AREA)
    .sort((a, b) => b.area - a.area)
    .map(({ contour }) => simplifyClosed(contour, SIMPLIFY_TOLERANCE));

  const d = contours.map(contourToPath).join("\n    ");
  const titleId = `zirtuno-morph-${morph.key}-title`;
  const descId = `zirtuno-morph-${morph.key}-desc`;

  return {
    contours: contours.length,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${png.width} ${png.height}" role="img" aria-labelledby="${titleId} ${descId}">
  <title id="${titleId}">${xmlEscape(`Zirtuno morph: ${morph.labelEn}`)}</title>
  <desc id="${descId}">${xmlEscape(
    `Transparent vector silhouette traced from ${path.basename(sourceFile)}. ${morph.represents}`,
  )}</desc>
  <path fill="${SVG_FILL}" fill-rule="evenodd" clip-rule="evenodd" d="
    ${d}
  "/>
</svg>
`,
  };
}

function copyOriginal(morph, sourceFile, categoryDir) {
  const originalDir = path.join(categoryDir, "original");
  ensureDir(originalDir);
  const target = path.join(originalDir, `${morph.slug}.png`);
  fs.copyFileSync(sourceFile, target);
  return target;
}

function writeSvg(morph, svg, categoryDir) {
  const svgDir = path.join(categoryDir, "svg");
  ensureDir(svgDir);
  const target = path.join(svgDir, `${morph.slug}.svg`);
  fs.writeFileSync(target, svg, "utf8");
  fs.copyFileSync(target, path.join(FORMS_DIR, `${morph.key}.svg`));
  return target;
}

function writeReadme(manifest) {
  const rows = manifest.morphs
    .map(
      (m) =>
        `| ${m.order} | ${m.key} | ${m.labelEn} | ${m.categoryDir} | ${m.runtimeSvg} |`,
    )
    .join("\n");

  const readme = `# Zirtuno Morph References

This folder contains the seven definitive service morph references.

Each category folder keeps the original PNG and its traced SVG endpoint together:

- \`original/\` keeps the owner-provided source image.
- \`svg/\` keeps the transparent cyan vector silhouette.
- \`public/brand/forms/{key}.svg\` mirrors the final SVGs for runtime SDF/glass
  rendering (this references/ folder itself is never deployed).

Trace settings:

- threshold: ${TRACE_THRESHOLD}
- simplify tolerance: ${SIMPLIFY_TOLERANCE}
- minimum contour area: ${MIN_CONTOUR_AREA}
- fill: ${SVG_FILL}

| Order | Runtime key | Represents | Category folder | Runtime SVG |
|---|---|---|---|---|
${rows}

Use \`manifest.json\` as the machine-readable map for AI/reference workflows.
`;

  fs.writeFileSync(path.join(OUT_ROOT, "README.md"), readme, "utf8");
}

function writePreviewHtml(manifest) {
  const cards = manifest.morphs
    .map(
      (m) => `<article>
  <h2>${m.order} · ${m.labelEn}</h2>
  <p>${m.represents}</p>
  <div class="pair">
    <figure><img src="../${m.originalRelative}" alt="${m.labelEn} original"><figcaption>Original PNG</figcaption></figure>
    <figure><img class="svg" src="../${m.svgRelative}" alt="${m.labelEn} SVG"><figcaption>Final SVG</figcaption></figure>
  </div>
</article>`,
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Zirtuno Morph Reference Sheet</title>
  <style>
    :root { color-scheme: dark; --cyan:#00E3FE; --paper:#F2F0EB; --surface:#0A0A0C; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #000; color: var(--paper); font: 14px/1.45 Arial, sans-serif; }
    main { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; padding: 22px; }
    article { border: 1px solid rgba(242,240,235,.16); border-radius: 8px; padding: 14px; background: var(--surface); }
    h1 { grid-column: 1 / -1; margin: 0; font-size: 22px; letter-spacing: 0; }
    h2 { margin: 0 0 4px; color: var(--cyan); font-size: 14px; letter-spacing: 0; }
    p { margin: 0 0 12px; color: rgba(242,240,235,.68); }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    figure { margin: 0; background: #000; border: 1px solid rgba(0,227,254,.22); border-radius: 6px; padding: 8px; }
    img { display: block; width: 100%; aspect-ratio: 1; object-fit: contain; }
    img.svg { padding: 6%; }
    figcaption { margin-top: 6px; color: rgba(242,240,235,.5); font-size: 11px; text-transform: uppercase; }
  </style>
</head>
<body>
  <main>
    <h1>Zirtuno Morph Reference Sheet</h1>
    ${cards}
  </main>
</body>
</html>
`;

  ensureDir(PREVIEW_DIR);
  fs.writeFileSync(path.join(PREVIEW_DIR, "reference-sheet.html"), html, "utf8");
}

async function writePreviewPng() {
  try {
    const { chromium } = await import("playwright");
    const htmlFile = path.join(PREVIEW_DIR, "reference-sheet.html");
    const chromeCandidates = [
      process.env.CHROME_PATH,
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ].filter(Boolean);
    const executablePath = chromeCandidates.find((candidate) => fs.existsSync(candidate));
    const browser = await chromium.launch({
      headless: true,
      chromiumSandbox: false,
      ...(executablePath ? { executablePath } : {}),
    });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1700 }, deviceScaleFactor: 1 });
    await page.goto(`file://${htmlFile.replaceAll("\\", "/")}`, { waitUntil: "networkidle" });
    await page.locator("main").screenshot({ path: path.join(PREVIEW_DIR, "reference-sheet.png") });
    await browser.close();
  } catch (error) {
    console.warn(`Preview PNG skipped: ${error.message}`);
  }
}

async function main() {
  ensureDir(OUT_ROOT);
  ensureDir(FORMS_DIR);
  ensureDir(PREVIEW_DIR);

  const manifest = {
    sourceDir: SOURCE_DIR,
    outputDir: "references/morphs",
    runtimeDir: "public/brand/forms",
    trace: {
      threshold: TRACE_THRESHOLD,
      simplifyTolerance: SIMPLIFY_TOLERANCE,
      minContourArea: MIN_CONTOUR_AREA,
      fill: SVG_FILL,
    },
    morphs: [],
  };

  for (const morph of MORPHS) {
    const sourceFile = path.join(SOURCE_DIR, morph.source);
    if (!fs.existsSync(sourceFile)) {
      throw new Error(`Missing source morph: ${sourceFile}`);
    }

    const categoryName = `${morph.order}-${morph.slug}`;
    const categoryDir = path.join(OUT_ROOT, categoryName);
    ensureDir(categoryDir);

    const png = readPng(sourceFile);
    const { svg, contours } = pngToSvg(png, morph, sourceFile);
    const originalTarget = copyOriginal(morph, sourceFile, categoryDir);
    const svgTarget = writeSvg(morph, svg, categoryDir);

    const originalRelative = path.relative(OUT_ROOT, originalTarget).replaceAll("\\", "/");
    const svgRelative = path.relative(OUT_ROOT, svgTarget).replaceAll("\\", "/");

    manifest.morphs.push({
      order: morph.order,
      key: morph.key,
      slug: morph.slug,
      labelPt: morph.labelPt,
      labelEn: morph.labelEn,
      represents: morph.represents,
      sourceFile: morph.source,
      categoryDir: categoryName,
      original: `references/morphs/${originalRelative}`,
      svg: `references/morphs/${svgRelative}`,
      runtimeSvg: `public/brand/forms/${morph.key}.svg`,
      originalRelative,
      svgRelative,
      dimensions: { width: png.width, height: png.height },
      contours,
    });

    console.log(`${morph.order} ${morph.key.padEnd(10)} -> ${path.relative(ROOT, svgTarget)} (${contours} contours)`);
  }

  fs.writeFileSync(path.join(OUT_ROOT, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  writeReadme(manifest);
  writePreviewHtml(manifest);
  await writePreviewPng();

  console.log(`\nAssets ready in ${path.relative(ROOT, OUT_ROOT)}`);
  console.log(`Runtime SVGs ready in ${path.relative(ROOT, FORMS_DIR)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
