/**
 * THE MEMBRANE — state stills of a real CTA on the real page.
 *
 * `verify-membrane.mjs` proves the kernel's numbers in node. This proves the
 * part that only exists in a browser: that the SVG is actually wired to the
 * host, that the deformation leaves the border box without clipping, that the
 * flood front and the ink label agree, and that the focus contour is a visible
 * indicator rather than a hairline nobody can see.
 *
 * VIRTUAL TIME. The first version of this script drove the page in real time
 * and lied about what it photographed. Under SwiftShader at dpr 2 a single
 * screenshot costs a few hundred ms, so a still labelled "70 ms after the
 * press" was actually taken most of a second later — long enough for the
 * 1440 ms flood envelope to have opened, held and drained before the shutter.
 * The diagnostics then reported "no flood" and made a working feature look
 * broken. So once the page has settled, rAF and performance.now are replaced
 * with a hand-advanced clock: every still is now taken at exactly the age it
 * claims, and two runs of this script are comparable frame for frame.
 *
 *   node scripts/capture-membrane.mjs
 *   BASE=http://localhost:3021 TAG=r2 node scripts/capture-membrane.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE ?? "http://localhost:3021";
const OUT = process.env.OUT ?? "captures/membrane";
const TAG = process.env.TAG ?? "membrane";
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);
const PAD = 26; // shoot a margin around the button so overflow is visible
// ONLY=hero|thread|cta|rm — shoot one section. Iterating on the hero meant
// sitting through the other three every run.
const ONLY = (process.env.ONLY ?? "").toLowerCase();
const want = (name) => !ONLY || ONLY === name;

/** Every section appends its readings here; printed once at the end. */
const log = [];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  ...LAUNCH,
  args: [
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
if (want("cta")) {


// ?ftier=none keeps the WebGL field off these stills and ?fcine=0 the veils;
// the membrane is the subject.
await page.goto(`${BASE}/en?ftier=none&fcine=0`, { waitUntil: "load" });
await page.waitForTimeout(2200);

const target = await page.evaluate(async () => {
  const el = document.querySelectorAll(".cta-primary")[0];
  const y =
    el.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2;
  for (let i = 0; i < 40; i++) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 90));
    if (Math.abs(window.scrollY - y) < 4) break;
  }
  // The reveal choreography leaves copy at opacity 0 until it runs; force the
  // wrapper visible so a still is a picture of the BUTTON, not of a fade.
  let p = el.parentElement;
  while (p && p !== document.body) {
    if (p.hasAttribute("data-reveal")) {
      p.style.opacity = "1";
      p.style.transform = "none";
    }
    p = p.parentElement;
  }
  // The site's own two-layer cyan cursor tracks the mouse and would sit in
  // every still, which makes the deformation hard to read and would let a
  // reviewer mistake the cursor ring for part of the button.
  const hide = document.createElement("style");
  hide.textContent = ".cursor-dot,.cursor-ring{display:none!important}";
  document.head.appendChild(hide);
  await new Promise((r) => setTimeout(r, 300));
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});

// ── take the clock ─────────────────────────────────────────────────────────
// Installed AFTER the page has settled, so the entry choreography, Lenis and
// the reveals all ran normally. From here the page only advances when we say.
await page.evaluate(() => {
  let vt = performance.now();
  const queue = [];
  window.requestAnimationFrame = (cb) => queue.push(cb);
  window.cancelAnimationFrame = () => {};
  performance.now = () => vt;
  window.__tick = (dt) => {
    vt += dt;
    for (const cb of queue.splice(0)) cb(vt);
  };
  window.__advance = (ms, step = 16.7) => {
    for (let acc = 0; acc < ms; acc += step) window.__tick(step);
  };
});
const advance = (ms) => page.evaluate((m) => window.__advance(m), ms);

// Re-measured for every still rather than fixed once. Tabbing to the button
// scrolls it into view, which moved it straight out of a fixed clip rectangle
// and returned a solid black "focus state" image.
const clipNow = async () => {
  const r = await page.evaluate(() => {
    const b = document.querySelectorAll(".cta-primary")[0].getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  });
  return {
    x: Math.round(r.x - PAD),
    y: Math.round(r.y - PAD),
    width: Math.round(r.w + PAD * 2),
    height: Math.round(r.h + PAD * 2),
  };
};
console.log(
  `CTA ${target.w.toFixed(1)}×${target.h.toFixed(1)} at (${target.x | 0}, ${target.y | 0})`,
);

const cy = target.y + target.h / 2;

/** Peak distance the drawn outline reaches outside the rest box. */
const deform = () =>
  page.evaluate(() => {
    const el = document.querySelectorAll(".cta-primary")[0];
    const d = el.querySelector(".mem-edge").getAttribute("d") || "";
    const r = el.getBoundingClientRect();
    const n = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    let out = 0;
    for (let i = 0; i + 1 < n.length; i += 2) {
      const dx = Math.max(-n[i], 0, n[i] - r.width);
      const dy = Math.max(-n[i + 1], 0, n[i + 1] - r.height);
      out = Math.max(out, Math.hypot(dx, dy));
    }
    return +out.toFixed(2);
  });

/** How far the commit flood has spread, and whether the ink label agrees. */
const floodState = () =>
  page.evaluate(() => {
    const el = document.querySelectorAll(".cta-primary")[0];
    const d = el.querySelector(".mem-flood")?.getAttribute("d") || "";
    const ink = el.querySelector(".cta-label-ink");
    if (!d) return "flood —";
    const n = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    let minX = 1e9;
    let maxX = -1e9;
    for (let i = 0; i < n.length; i += 2) {
      minX = Math.min(minX, n[i]);
      maxX = Math.max(maxX, n[i]);
    }
    const clipped = (ink?.style.clipPath || "").startsWith("path");
    return `flood ⌀${Math.round(maxX - minX)}${clipped ? " +ink" : " NO-INK"}`;
  });

/** The interior wash — how proximity actually expresses itself. */
const wash = () =>
  page.evaluate(() => {
    const el = document.querySelectorAll(".cta-primary")[0];
    return el.querySelector(".mem-skin")?.getAttribute("fill-opacity") ?? "-";
  });

const frame = async (name, extra = "") => {
  // Virtual time drives the MEMBRANE; it does not drive CSS. The transitions
  // on `.mem-edge`'s stroke and `.mem-focus`'s opacity run on the browser's own
  // clock, so a still taken immediately after `advance()` photographs the
  // membrane at the right age and the CSS at t=0 — which is how the focus
  // contour first came back reading `opacity: 0` and looked like a missing
  // accessibility indicator. A real wait settles the CSS; the membrane cannot
  // move during it, because its rAF is ours.
  await page.waitForTimeout(260);
  const [d, f, wsh] = [await deform(), await floodState(), await wash()];
  log.push(
    `${name.padEnd(17)} out-of-box ${String(d).padStart(5)} px   wash ${String(wsh).padStart(5)}   ${f.padEnd(17)} ${extra}`,
  );
  await page.screenshot({ path: `${OUT}/${TAG}-${name}.png`, clip: await clipNow() });
};

// ── 1. rest ────────────────────────────────────────────────────────────────
await page.mouse.move(20, 20);
await advance(1600);
await frame("1-rest", "(nothing near it — must be ~0)");

// ── 2. aware: the pointer is close but not on it ───────────────────────────
// To the RIGHT, deliberately: this CTA sits at x=48, so "210 px to its left"
// is x = -26 and the move is a no-op — the pointer stayed where the rest shot
// left it and the still was a duplicate of rest that looked like a dead state.
await page.mouse.move(target.x + target.w + 170, cy + 30);
await advance(900);
await frame("2-aware", "(pointer 170 px off the right edge)");

// ── 3-4. hover: the displacement well ──────────────────────────────────────
await page.mouse.move(target.x + target.w * 0.24, cy - 4, { steps: 10 });
await advance(500);
await frame("3-hover-left", "(hand at 24% width)");

await page.mouse.move(target.x + target.w * 0.78, cy + 6, { steps: 12 });
await advance(500);
await frame("4-hover-right", "(hand at 78% width)");

// ── 5. the strike + flood, sampled through the wave ────────────────────────
// Releasing over the CTA fires its real click, and this one smooth-scrolls the
// page to #contact — which took the button out of frame and ended the shoot.
// That the click still fires is the point (the membrane's listeners are all
// passive and never swallow a navigation), so it is suppressed here rather
// than designed around.
await page.evaluate(() => {
  document.querySelectorAll(".cta-primary")[0].addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true,
  );
});
await page.mouse.move(target.x + target.w * 0.2, cy);
await advance(400);
await page.mouse.down();
let elapsed = 0;
for (const ms of [60, 140, 260, 420, 700, 1100]) {
  await advance(ms - elapsed);
  elapsed = ms;
  await frame(`5-press-${String(ms).padStart(4, "0")}ms`);
}
await page.mouse.up();
await advance(140);
await frame("6-release");

// ── 7. settled back to exact rest ──────────────────────────────────────────
await page.mouse.move(20, 20);
await advance(2600);
await frame("7-settled", "(must return to ~0 — the exact-rest contract)");

// ── 8. focus ───────────────────────────────────────────────────────────────
// Two traps here, and the first version of this script fell into both.
//   · `el.focus()` scrolls the element into view, which moves it out of the
//     fixed clip rectangle — the still came back solid black.
//   · programmatic focus does not match `:focus-visible` in Chrome, so even a
//     correctly-framed still would have photographed the wrong state.
// Focusing the PREVIOUS control and pressing Tab makes the focus keyboard-
// driven, which is the state a keyboard user actually sees.
await page.evaluate(() => {
  const el = document.querySelectorAll(".cta-primary")[0];
  const focusables = [
    ...document.querySelectorAll('a[href], button:not([disabled])'),
  ];
  const prev = focusables[focusables.indexOf(el) - 1];
  prev?.focus({ preventScroll: true });
});
await page.keyboard.press("Tab");
await advance(500);
await page.waitForTimeout(900); // the contour’s opacity transition is CSS-timed
// and the keypress that starts it can lag on a heavy page — 320 ms caught it
// mid-transition and reported a working focus ring as a missing one.
const focusOk = await page.evaluate(() => {
  const el = document.querySelectorAll(".cta-primary")[0];
  const ring = el.querySelector(".mem-focus");
  return {
    focused: document.activeElement === el,
    visible: el.matches(":focus-visible"),
    ringOpacity: ring ? getComputedStyle(ring).opacity : null,
    outline: getComputedStyle(el).outlineStyle,
  };
});
await frame("8-focus", `(${JSON.stringify(focusOk)})`);

// ── the THREAD, on a secondary CTA ─────────────────────────────────────────
// Its own page, deliberately. The secondary sits 12 000 px down and by this
// point the main page's rAF belongs to us — but GSAP's ticker cached the real
// `requestAnimationFrame` at init, so Lenis is still alive and still owns the
// scroll, and it drags the viewport back off the element between the scroll
// and the shutter. A fresh context scrolls normally first, then takes the
// clock, which is the same order the primary got.
if (want("thread")) {
  const tCtx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
  });
  const tp = await tCtx.newPage();
  await tp.goto(`${BASE}/en?ftier=none&fcine=0`, { waitUntil: "load" });
  await tp.waitForTimeout(2200);

  const sec = await tp.evaluate(async () => {
    const el = document.querySelector(".cta-secondary");
    if (!el) return null;
    const y =
      el.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2;
    for (let i = 0; i < 60; i++) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
      if (Math.abs(window.scrollY - y) < 4) break;
    }
    let p = el.parentElement;
    while (p && p !== document.body) {
      if (p.hasAttribute("data-reveal")) {
        p.style.opacity = "1";
        p.style.transform = "none";
      }
      p = p.parentElement;
    }
    const hide = document.createElement("style");
    hide.textContent = ".cursor-dot,.cursor-ring{display:none!important}";
    document.head.appendChild(hide);
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
    await new Promise((r) => setTimeout(r, 300));
    const r = el.getBoundingClientRect();
    return {
      x: r.x, y: r.y, w: r.width, h: r.height,
      thread: el.getAttribute("data-thread"),
    };
  });

  if (sec && sec.y > 0 && sec.y < H) {
    await tp.evaluate(() => {
      let vt = performance.now();
      const queue = [];
      window.requestAnimationFrame = (cb) => queue.push(cb);
      window.cancelAnimationFrame = () => {};
      performance.now = () => vt;
      window.__advance = (ms, step = 16.7) => {
        for (let acc = 0; acc < ms; acc += step) {
          vt += step;
          for (const cb of queue.splice(0)) cb(vt);
        }
      };
    });
    const tAdvance = (ms) => tp.evaluate((m) => window.__advance(m), ms);
    const sclip = async () => {
      const r = await tp.evaluate(() => {
        const b = document.querySelector(".cta-secondary").getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
      });
      return {
        x: Math.max(0, Math.round(r.x - PAD)),
        y: Math.max(0, Math.round(r.y - PAD)),
        width: Math.round(r.w + PAD * 2),
        height: Math.round(r.h + PAD * 2),
      };
    };
    const sBody = () =>
      tp.evaluate(() => {
        const d =
          document.querySelector(".cta-secondary .thr-fill")?.getAttribute("d") || "";
        if (!d) return "thread — (empty)";
        const n = d.match(/-?[0-9.]+/g).map(Number);
        let lo = 1e9, hi = -1e9, xlo = 1e9, xhi = -1e9;
        for (let i = 0; i < n.length; i += 2) { xlo = Math.min(xlo, n[i]); xhi = Math.max(xhi, n[i]); }
        for (let i = 1; i < n.length; i += 2) { lo = Math.min(lo, n[i]); hi = Math.max(hi, n[i]); }
        return `body ${(hi - lo).toFixed(1)}px over ${Math.round(xhi - xlo)}px`;
      });
    const sframe = async (name, extra = "") => {
      await tp.waitForTimeout(200);
      log.push(`${name.padEnd(17)} ${(await sBody()).padEnd(30)} ${extra}`);
      await tp.screenshot({ path: `${OUT}/${TAG}-${name}.png`, clip: await sclip() });
    };

    log.push(`
  secondary ${sec.w.toFixed(0)}x${sec.h.toFixed(0)}  data-thread=${sec.thread}`);
    await tp.mouse.move(20, 20);
    await tAdvance(1400);
    await sframe("t1-rest", "(must be empty)");
    // pour from the RIGHT end, to show the source is the crossing point
    await tp.mouse.move(sec.x + sec.w - 12, sec.y + sec.h * 0.5);
    await tAdvance(90);
    await sframe("t2-pour-90ms", "(entered at the right end)");
    await tAdvance(130);
    await sframe("t3-pour-220ms", "(front ahead of the body)");
    await tAdvance(500);
    await sframe("t4-poured");
    await tp.mouse.down();
    await tAdvance(70);
    await sframe("t5-press-70ms", "(crest)");
    await tAdvance(120);
    await sframe("t6-press-190ms", "(trough — thinner than rest)");
    await tp.mouse.up();
    await tp.mouse.move(20, 20);
    await tAdvance(1800);
    await sframe("t7-withdrawn", "(must be empty — exact rest)");
  } else {
    log.push(`
  secondary NOT CAPTURED (off-screen: ${JSON.stringify(sec)})`);
  }
  await tCtx.close();
}

// Every section from here gets the browser to itself. With the main context and
// the thread context still open, `mouse.down()` in a THIRD context dispatched no
// pointerdown at all — the move landed (hover still deformed, because that runs
// off a window listener) but the press never reached the element, which reads
// exactly like a covered button. Closing each context when its block ends fixes
// it and costs nothing.
}
if (want("cta")) await ctx.close();

// ── the HERO CTA ───────────────────────────────────────────────────────────
// Its own context: it sits at the top of the page, so it needs no scroll fight,
// and it is the CTA that forced `.mem-back` to exist — it is the only one that
// sits over the LIVE liquid stream, where a rectangular CSS backing behind a
// deforming outline would show a seam. Shot with the field ON for that reason.
if (want("hero")) {
  const hCtx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
  });
  const hp = await hCtx.newPage();
  await hp.goto(`${BASE}/en?fcine=0`, { waitUntil: "load" });
  await hp.waitForTimeout(3200);

  const hero = await hp.evaluate(async () => {
    const el = document.querySelector(".lab-cta");
    if (!el) return null;
    const hide = document.createElement("style");
    hide.textContent = ".cursor-dot,.cursor-ring{display:none!important}";
    document.head.appendChild(hide);
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
    await new Promise((r) => setTimeout(r, 300));
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, mode: el.getAttribute("data-membrane") };
  });

  if (hero && hero.mode) {
    await hp.evaluate(() => {
      let vt = performance.now();
      const queue = [];
      window.requestAnimationFrame = (cb) => queue.push(cb);
      window.cancelAnimationFrame = () => {};
      performance.now = () => vt;
      window.__advance = (ms, step = 16.7) => {
        for (let acc = 0; acc < ms; acc += step) {
          vt += step;
          for (const cb of queue.splice(0)) cb(vt);
        }
      };
    });
    const hAdv = (ms) => hp.evaluate((m) => window.__advance(m), ms);
    const hClip = async () => {
      const r = await hp.evaluate(() => {
        const b = document.querySelector(".lab-cta").getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
      });
      return {
        x: Math.max(0, Math.round(r.x - PAD)),
        y: Math.max(0, Math.round(r.y - PAD)),
        width: Math.round(r.w + PAD * 2),
        height: Math.round(r.h + PAD * 2),
      };
    };
    const hFrame = async (name, extra = "") => {
      await hp.waitForTimeout(240);
      const info = await hp.evaluate(() => {
        const el = document.querySelector(".lab-cta");
        const d = el.querySelector(".mem-edge").getAttribute("d") || "";
        const r = el.getBoundingClientRect();
        const n = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
        let out = 0;
        for (let i = 0; i + 1 < n.length; i += 2)
          out = Math.max(out, Math.hypot(
            Math.max(-n[i], 0, n[i] - r.width),
            Math.max(-n[i + 1], 0, n[i + 1] - r.height)));
        const ink = el.querySelector(".lab-cta-ink");
        const flooded = (ink?.style.clipPath || "").startsWith("path");
        return {
          out: +out.toFixed(2),
          flooded,
          floodLen: (el.querySelector(".mem-flood")?.getAttribute("d") || "").length,
        };
      });
      log.push(
        `${name.padEnd(17)} out-of-box ${String(info.out).padStart(5)} px   flood ${String(info.floodLen).padStart(4)}${info.flooded ? " +ink" : ""}   ${extra}`,
      );
      await hp.screenshot({ path: `${OUT}/${TAG}-${name}.png`, clip: await hClip() });
    };

    log.push(`
  hero ${hero.w.toFixed(0)}x${hero.h.toFixed(0)}  data-membrane=${hero.mode}  (over the live stream)`);
    await hp.mouse.move(20, 20);
    await hAdv(1500);
    await hFrame("h1-rest", "(the backing must follow the outline, not a box)");
    // Aim through the LOCATOR, not through a rect.
    //
    // The hero CTA rides `.lab-plane`, which the cinematic camera tilts in 3-D
    // from the pointer. `getBoundingClientRect()` returns the axis-aligned
    // bounding box of that rotated quad, so a point 26% across the box can sit
    // outside the quad — and it did: `pointerdown` fired at exactly the
    // computed coordinate and landed on `DIV.lab-plane`, never reaching the
    // button. `elementFromPoint` disagreed and said the point was inside,
    // because the tilt keeps moving between the probe and the press.
    // Playwright's locator actions re-resolve the element and hit-test it, so
    // they land on the button whatever the camera is doing.
    const hitPoint = { x: hero.w * 0.3, y: hero.h * 0.5 };
    await hp.locator(".lab-cta").hover({ position: hitPoint });
    await hAdv(500);
    await hFrame("h2-hover");
    await hp.locator(".lab-cta").hover({ position: hitPoint });
    await hp.mouse.down();
    await hAdv(150);
    await hFrame("h3-press-150ms");
    await hAdv(280);
    await hFrame("h4-press-430ms", "(label AND arrow flip)");
    await hp.mouse.up();
    await hp.mouse.move(20, 20);
    await hAdv(2600);
    await hFrame("h5-settled", "(back to exact rest)");
  } else {
    log.push(`
  hero NOT CAPTURED (${JSON.stringify(hero)})`);
  }
  await hCtx.close();
}

// ── 9. reduced motion — the membrane must not exist at all ─────────────────
if (want("rm")) {
const rmCtx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
});
const rm = await rmCtx.newPage();
await rm.goto(`${BASE}/en?ftier=none&fcine=0`, { waitUntil: "load" });
await rm.waitForTimeout(1800);
const rmState = await rm.evaluate(() => {
  const el = document.querySelectorAll(".cta-primary")[0];
  return {
    membrane: el.getAttribute("data-membrane"),
    edgeDrawn: !!el.querySelector(".mem-edge")?.getAttribute("d"),
    border: getComputedStyle(el).borderTopColor,
    sweepPresent: !!el.querySelector(".cta-fill"),
    inkDisplay: getComputedStyle(el.querySelector(".cta-label-ink")).display,
  };
});
console.log("\nreduced motion:", JSON.stringify(rmState));
}

console.log(`\n${log.join("\n")}\n\nstills → ${OUT}/${TAG}-*.png`);
await browser.close();
