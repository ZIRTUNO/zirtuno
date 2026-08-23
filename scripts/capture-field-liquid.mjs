/**
 * THE FORM'S LIQUID — state stills of the real contact form on the real page.
 *
 * `verify-coalesce.mjs` proves the merge's geometry in node. This proves the
 * half that only exists in a browser: that the SVG is actually wired to the
 * controls, that the borders were handed over without the form changing size,
 * that the bead's travel really does detach and re-fuse, and that a merged
 * bead is drawn ONCE rather than as a ring inside a bulge.
 *
 * VIRTUAL TIME, for the same reason `capture-membrane.mjs` uses it: a
 * screenshot here costs a few hundred ms, and the travel it is photographing
 * lasts about 400. Driven in real time, a still labelled "90 ms after the
 * focus moved" would be taken after the bead had already arrived — the pinch
 * would never appear in a single frame and a working merge would photograph as
 * a stationary dot. Once the page has settled, rAF and `performance.now` are
 * replaced with a hand-advanced clock, so every still is taken at exactly the
 * age it claims and two runs are comparable frame for frame.
 *
 *   BASE=http://localhost:3071 node scripts/capture-field-liquid.mjs
 *   ONLY=travel BASE=http://localhost:3071 node scripts/capture-field-liquid.mjs
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "./_launch.mjs";

const BASE = process.env.BASE ?? "http://localhost:3071";
const OUT = process.env.OUT ?? "captures/field-liquid";
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);
const PAD = 40;
const ONLY = (process.env.ONLY ?? "").toLowerCase();
const want = (n) => !ONLY || ONLY === n;

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

/** Bring the contact form into view, settled, with the page's own noise off. */
async function settle(page) {
  await page.goto(`${BASE}/en?ftier=none&fcine=0#contact`, { waitUntil: "load" });
  await page.waitForTimeout(2400);
  return page.evaluate(async () => {
    const form = document.querySelector(".contact-form");
    const y =
      form.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.18;
    for (let i = 0; i < 40; i++) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
      if (Math.abs(window.scrollY - y) < 4) break;
    }
    let p = form.parentElement;
    while (p && p !== document.body) {
      if (p.hasAttribute("data-reveal")) {
        p.style.opacity = "1";
        p.style.transform = "none";
      }
      p = p.parentElement;
    }
    // The site's own cyan cursor would sit in every still and a reviewer would
    // reasonably mistake its ring for the bead.
    const hide = document.createElement("style");
    hide.textContent = ".cursor-dot,.cursor-ring{display:none!important}";
    document.head.appendChild(hide);
    await new Promise((r) => setTimeout(r, 350));
    const r = form.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
}

/** Freeze the clock. Everything after this advances only when we say so. */
async function takeClock(page) {
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
}

/** Everything the harness wants to know about the layer, read from the DOM. */
async function probe(page) {
  return page.evaluate(() => {
    const form = document.querySelector(".contact-form");
    const edges = [...form.querySelectorAll(".fl-edge")];
    const bead = form.querySelector(".fl-bead");
    const beadD = bead?.getAttribute("d") || "";
    const nums = (d) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

    // How far each contour leaves its own control's box — the merge is the
    // only thing that can push it out, so this IS the merge, measured.
    const out = edges.map((p, i) => {
      const el = form.querySelectorAll(".field input, .field textarea")[i];
      const r = el.getBoundingClientRect();
      const n = nums(p.getAttribute("d") || "");
      let worst = 0;
      for (let k = 0; k + 1 < n.length; k += 2) {
        worst = Math.max(worst, Math.max(-n[k], 0, n[k] - r.width));
      }
      return +worst.toFixed(2);
    });

    let beadCentre = null;
    if (beadD) {
      const n = nums(beadD);
      let sx = 0;
      let sy = 0;
      let c = 0;
      for (let k = 0; k + 1 < n.length; k += 2) {
        sx += n[k];
        sy += n[k + 1];
        c++;
      }
      beadCentre = c ? [+(sx / c).toFixed(1), +(sy / c).toFixed(1)] : null;
    }
    return {
      wired: form.getAttribute("data-fieldliquid"),
      paths: edges.length,
      states: edges.map((p) => p.getAttribute("data-fl")),
      reach: out,
      beadDrawn: beadD.length > 0,
      beadCentre,
      borderHandedOver: getComputedStyle(
        form.querySelector(".field input"),
      ).borderTopColor,
    };
  });
}

async function shot(page, name, box) {
  const clip = {
    x: Math.round(box.x - PAD),
    y: Math.round(box.y - PAD),
    width: Math.round(box.w + PAD * 2),
    height: Math.round(Math.min(box.h + PAD * 2, H - box.y + PAD)),
  };
  await page.screenshot({ path: `${OUT}/${name}.png`, clip });
}

// ───────────────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await settle(page);
  await takeClock(page);

  const boxOf = async () =>
    page.evaluate(() => {
      const r = document.querySelector(".contact-form").getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });

  const focusField = (id) =>
    page.evaluate((i) => document.getElementById(i)?.focus(), id);

  // 1 ── REST. Nothing focused, nothing hovered. Every contour must be its
  // authored rectangle and the bead must not exist at all.
  if (want("rest")) {
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.evaluate((m) => window.__advance(m), 1600);
    const p = await probe(page);
    log.push(
      `rest      wired=${p.wired} paths=${p.paths} reach=[${p.reach}] bead=${p.beadDrawn} border=${p.borderHandedOver}`,
    );
    await shot(page, "1-rest", await boxOf());
  }

  // 2 ── FUSED. Focus the name field; the bead gathers and merges with its
  // left edge. `bead=false` here is the PASS: the contour has wrapped it.
  if (want("fused")) {
    await focusField("contact-name");
    await page.evaluate((m) => window.__advance(m), 1400);
    const p = await probe(page);
    log.push(
      `fused     states=[${p.states}] reach=[${p.reach}] beadDrawnSeparately=${p.beadDrawn}`,
    );
    await shot(page, "2-fused", await boxOf());
  }

  // 3 ── TRAVEL. Move focus two fields down and photograph the flight at three
  // ages. The middle one is the pinch: detached, drawn out, reaching back.
  if (want("travel")) {
    await focusField("contact-name");
    await page.evaluate((m) => window.__advance(m), 1400);
    await focusField("contact-message");
    for (const [age, name] of [
      [70, "3a-detach"],
      [150, "3b-flight"],
      [260, "3c-arriving"],
      [900, "3d-fused"],
    ]) {
      await page.evaluate(
        (m) => window.__advance(m),
        name === "3a-detach" ? age : 0,
      );
      if (name !== "3a-detach") await page.evaluate((m) => window.__advance(m), 0);
      const p = await probe(page);
      log.push(
        `${name.padEnd(10)} bead=${p.beadDrawn} centre=${p.beadCentre} reach=[${p.reach}]`,
      );
      await shot(page, name, await boxOf());
      if (name !== "3d-fused") {
        const next = { "3a-detach": 80, "3b-flight": 110, "3c-arriving": 640 }[name];
        await page.evaluate((m) => window.__advance(m), next);
      }
    }
  }

  // 3b ── THE LAST STEP. Tab from the final control to the submit button: the
  // bead must HOLD, not drain. It vanishing here reads as the form losing
  // interest exactly when the reader is about to act.
  if (want("submit")) {
    await focusField("contact-message");
    await page.evaluate((m) => window.__advance(m), 1400);
    await page.evaluate(() =>
      document.querySelector(".contact-form button[type=submit]")?.focus(),
    );
    await page.evaluate((m) => window.__advance(m), 900);
    const p = await probe(page);
    log.push(
      `submit    reach=[${p.reach}] bead=${p.beadDrawn}  (a reach of 9 on the last field is the hold)`,
    );
    await shot(page, "3e-submit-hold", await boxOf());
  }

  // 4 ── HOVER. No focus anywhere: the pointer decides, and the surface
  // deforms toward it before anything is clicked.
  if (want("hover")) {
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.evaluate((m) => window.__advance(m), 1400);
    const r = await page.evaluate(() => {
      const b = document
        .getElementById("contact-email")
        .getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    });
    await page.mouse.move(r.x + r.w * 0.5, r.y + r.h * 0.5);
    await page.evaluate((m) => window.__advance(m), 700);
    const p = await probe(page);
    log.push(`hover     states=[${p.states}] reach=[${p.reach}] bead=${p.beadDrawn}`);
    await shot(page, "4-hover", await boxOf());
  }

  // 5 ── INVALID. The contour has to carry the warn colour the border used to,
  // or the layer has silently dropped an error state.
  if (want("invalid")) {
    await page.evaluate(() => {
      document.getElementById("contact-email").setAttribute("aria-invalid", "true");
    });
    await page.evaluate((m) => window.__advance(m), 400);
    await page.waitForTimeout(320); // the stroke transition runs on real time
    const p = await probe(page);
    log.push(`invalid   states=[${p.states}]`);
    await shot(page, "5-invalid", await boxOf());
  }

  await ctx.close();
}

// 5b ── THE KERNEL FAILS. The layer is decorative, so no failure inside it may
// ever cost the reader the form. This blocks the merge kernel's chunk at the
// network layer — the closest thing to the stale-chunk failure that produced an
// empty contact section in dev — and checks that what is left is the complete
// bordered form: `data-fieldliquid` unset, so every CSS rule gated on it stays
// inert and the borders never went transparent.
if (want("broken")) {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.route(/coalesce/, (route) => route.abort());
  await page.goto(`${BASE}/en?ftier=none&fcine=0#contact`, { waitUntil: "load" });
  await page.waitForTimeout(3800);
  const p = await page.evaluate(() => {
    const form = document.querySelector(".contact-form");
    if (!form) return { formGone: true };
    const inp = form.querySelector(".field input");
    return {
      formGone: false,
      wired: form.getAttribute("data-fieldliquid"),
      paths: form.querySelectorAll(".fl-edge").length,
      fields: form.querySelectorAll(".field input, .field textarea").length,
      submit: !!form.querySelector("button[type=submit]"),
      border: inp ? getComputedStyle(inp).borderTopColor : null,
    };
  });
  const ok =
    !p.formGone &&
    p.wired === null &&
    p.paths === 0 &&
    p.fields === 4 &&
    p.submit === true &&
    !/rgba\(0, 0, 0, 0\)/.test(p.border ?? "");
  log.push(
    `broken    ${ok ? "PASS" : "FAIL"} — form=${p.formGone ? "GONE" : "rendered"} wired=${p.wired} paths=${p.paths} fields=${p.fields} submit=${p.submit} border=${p.border}`,
  );
  await ctx.close();
}

// 6 ── REDUCED MOTION. The layer must not mount at all and the CSS borders
// must still be there. This is the additive contract, photographed.
if (want("rm")) {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  const form = await settle(page);
  const p = await page.evaluate(() => {
    const f = document.querySelector(".contact-form");
    return {
      wired: f.getAttribute("data-fieldliquid"),
      paths: f.querySelectorAll(".fl-edge").length,
      border: getComputedStyle(f.querySelector(".field input")).borderTopColor,
    };
  });
  log.push(
    `reduced   wired=${p.wired} paths=${p.paths} border=${p.border}  (must be null / 0 / a visible colour)`,
  );
  await shot(page, "6-reduced-motion", form);
  await ctx.close();
}

await browser.close();
console.log(`\n${log.join("\n")}\n\nstills → ${OUT}/`);
