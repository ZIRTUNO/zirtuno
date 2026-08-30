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
const PAD = 100;
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

/**
 * PARK THE FORM. From the Node side, and only after the clock is frozen.
 *
 * Lenis owns the scroll here and will not be argued with from inside the page:
 * it caches a limit computed before the page has finished growing — 15000 on a
 * 15971 px range — so every  and  was
 * swallowed, and the form sat 1000 px below the fold for an entire run while
 * the diagnostics happily reported correct geometry.
 *
 * Playwright's  goes through CDP and bypasses the page
 * entirely, so it lands. But Lenis restores its own position on the next frame,
 * which is why this must come AFTER : with rAF frozen there is no
 * next frame to restore on, and the scroll holds for the whole capture.
 */
async function park(page) {
  for (let i = 0; i < 6; i++) {
    await page.locator(".contact-form").scrollIntoViewIfNeeded();
    await page.waitForTimeout(120);
    const top = await page.evaluate(
      () => document.querySelector(".contact-form").getBoundingClientRect().top,
    );
    if (top > -80 && top < 400) return true;
  }
  return false;
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
    // ON-CURVE points only. A cubic's control points sit off the curve, and on
    // a ROUNDED ring the Catmull-Rom tangents at the ends of each arc push them
    // a pixel or so outside the box — which read as a 1.6 px deformation on a
    // field at perfect rest and made exact rest look broken when it was not.
    const onCurve = (d) =>
      [...d.matchAll(/C-?[\d.]+ -?[\d.]+ -?[\d.]+ -?[\d.]+ (-?[\d.]+) (-?[\d.]+)/g)].map(
        (m) => [Number(m[1]), Number(m[2])],
      );
    const out = edges.map((p, i) => {
      const el = form.querySelectorAll(".field input, .field textarea")[i];
      const r = el.getBoundingClientRect();
      let worst = 0;
      for (const [x] of onCurve(p.getAttribute("d") || "")) {
        worst = Math.max(worst, Math.max(-x, 0, x - r.width));
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
      scrollY: Math.round(window.scrollY),
      formTop: Math.round(form.getBoundingClientRect().top),
      wired: form.getAttribute("data-fieldliquid"),
      paths: edges.length,
      states: edges.map((p) => p.getAttribute("data-fl")),
      reach: out,
      beadDrawn: beadD.length > 0,
      beadOpacity: bead ? Number(getComputedStyle(bead).strokeOpacity) : 0,
      strokes: edges.map((p) => getComputedStyle(p).stroke),
      beadCentre,
      borderHandedOver: getComputedStyle(
        form.querySelector(".field input"),
      ).borderTopColor,
    };
  });
}

async function shot(page, name, box) {
  // Intersected with the viewport, not merely clamped. Focusing a control can
  // scroll the page under the clip, and Playwright rejects a rectangle that
  // falls outside the image rather than cropping it — which turned a working
  // capture run into a crash halfway through the travel.
  const x0 = Math.max(0, Math.round(box.x - PAD));
  const y0 = Math.max(0, Math.round(box.y - PAD));
  const x1 = Math.min(W, Math.round(box.x + box.w + PAD));
  const y1 = Math.min(H, Math.round(box.y + box.h + PAD));
  if (x1 - x0 < 8 || y1 - y0 < 8) {
    log.push(
      `${name.padEnd(10)} SKIPPED — box ${JSON.stringify(box)} -> clip ${x0},${y0},${x1},${y1}`,
    );
    return;
  }
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
  });
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
  await park(page);

  // Read only. Do NOT scroll here: Lenis owns the scroll position and is frozen
  // under the virtual clock, so a  from this side is either
  // ignored or fought, and the page ended up parked where nothing is. Focus
  // moves use  instead, which keeps the page where settle() put
  // it for the whole run.
  const boxOf = async () => {
    await park(page);
    return page.evaluate(() => {
      const r = document.querySelector(".contact-form").getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
  };

  const focusField = (id) =>
    page.evaluate((i) => document.getElementById(i)?.focus({ preventScroll: true }), id);

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
    // long enough for the travel, the merge AND the cross-fade to finish
    await page.evaluate((m) => window.__advance(m), 3200);
    const p = await probe(page);
    log.push(
      `fused     states=[${p.states}] reach=[${p.reach}] drop drawn separately=${p.beadDrawn} (opacity ${p.beadOpacity})`,
    );
    await shot(page, "2-fused", await boxOf());
  }

  // 3 ── TRAVEL. Move focus two fields down and photograph the flight at three
  // ages. The middle one is the pinch: detached, drawn out, reaching back.
  if (want("travel")) {
    await focusField("contact-name");
    await page.evaluate((m) => window.__advance(m), 1400);
    await focusField("contact-message");
    // Re-timed for the gentler spring: the drop now takes ~340 ms to reach full
    // lift and ~1.2 s to touch down, where it used to do both in half that.
    for (const [age, name] of [
      [170, "3a-detach"],
      [360, "3b-stretch"],
      [820, "3c-flight"],
      [1320, "3d-touchdown"],
      [2800, "3e-fused"],
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
      if (name !== "3e-fused") {
        const next = { "3a-detach": 190, "3b-stretch": 460, "3c-flight": 500, "3d-touchdown": 1480 }[name];
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

  // 3f ── THE TOUR. With nobody using the form the drop walks the fields on its
  // own. Sampled across a full lap: which field is holding it should change,
  // and every field should get a turn.
  if (want("tour")) {
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.evaluate((m) => window.__advance(m), 2600); // clear the grace
    const visits = [];
    for (let k = 0; k < 26; k++) {
      await page.evaluate((m) => window.__advance(m), 500);
      const p = await probe(page);
      const holder = p.reach.findIndex((v) => v > 6);
      visits.push(holder < 0 ? "." : String(holder));
    }
    const seen = new Set(visits.filter((v) => v !== "."));
    log.push(
      `tour      ${visits.join("")}  — ${seen.size}/4 fields visited over ${(26 * 500) / 1000}s`,
    );
    await shot(page, "3f-tour", await boxOf());

    // …and it YIELDS. Focus a field and the drop must come to it and stop.
    await focusField("contact-email");
    await page.evaluate((m) => window.__advance(m), 2600);
    const a = await probe(page);
    await page.evaluate((m) => window.__advance(m), 4000);
    const b = await probe(page);
    const held =
      a.reach[1] > 6 && b.reach[1] > 6 && Math.abs(a.reach[1] - b.reach[1]) < 1;
    log.push(
      `tour-stop ${held ? "PASS" : "FAIL"} — focused field 1, reach ${a.reach[1]} then ${b.reach[1]} four seconds later (must not wander)`,
    );

    // …and it STOPS COSTING when nobody can see it. An autonomous animation
    // that keeps running for a form scrolled off the screen is the one thing
    // this feature could fairly be accused of.
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.evaluate((m) => window.__advance(m), 3000);
    await page.evaluate(() => {
      // push the form far out of the observer's 220px margin
      document.querySelector(".contact-form").style.transform =
        "translateY(-4000px)";
    });
    await page.waitForTimeout(400); // the IntersectionObserver is async
    await page.evaluate((m) => window.__advance(m), 3000);
    const off = await probe(page);
    const quiet = off.reach.every((v) => v < 0.5) && !off.beadDrawn;
    log.push(
      `tour-offscreen ${quiet ? "PASS" : "FAIL"} — reach [${off.reach}] bead=${off.beadDrawn} (the drop drains and the loop sleeps)`,
    );
    await page.evaluate(() => {
      document.querySelector(".contact-form").style.transform = "";
    });
  }

  // 3g ── THE OUTLINE STAYS ON. The drop is drawn for as long as it has mass,
  // merged or not. This replaces an earlier design where it was hidden on merge
  // and had to be cross-faded out — three rounds of machinery to make a
  // disappearance acceptable, when not disappearing turned out to be better.
  // The invariant is now the opposite one, and it is worth pinning: nothing
  // may switch the drop off mid-tour.
  if (want("tourfade")) {
    // The stroke transition is switched OFF for this measurement. The drop
    // copies the host's computed stroke once per drawn frame, so mid-ease it
    // trails by one — and under the virtual clock that gap is inflated
    // arbitrarily, because rAF is frozen while CSS transitions keep running on
    // the real clock. Removing the ease removes the artifact and leaves the
    // thing actually under test: whether the two are the same material.
    await page.addStyleTag({
      content: ".fl-edge, .fl-bead { transition: none !important }",
    });
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.evaluate((m) => window.__advance(m), 4000);
    const on = [];
    const mats = new Set();
    for (let k = 0; k < 80; k++) {
      await page.evaluate((m) => window.__advance(m), 60);
      const st = await page.evaluate(() => {
        const bd = document.querySelector(".fl-bead");
        const drawn = bd && (bd.getAttribute("d") || "").length > 0;
        const cs = bd ? getComputedStyle(bd) : null;
        return {
          on: drawn && cs && Number(cs.strokeOpacity) > 0.9 ? 1 : 0,
          // the material the drop is wearing, and the material of whichever
          // contour is drawing the same circle underneath it
          stroke: cs ? cs.stroke : "",
          // ONLY while the bridge is actually drawn. A field goes `wet` when it
          // takes ownership, which is well before the drop reaches it, and its
          // 200 ms stroke transition runs in that gap — comparing then reports
          // a mismatch for a circle nothing is drawing yet.
          host:
            [...document.querySelectorAll(".fl-edge")]
              .map((e) => {
                const pts = (e.getAttribute("d") || "").match(
                  /C[-\d. ]+ (-?[\d.]+) [-\d.]+/g,
                ) || [];
                const out = pts.some(
                  (m) => Number(m.split(" ").slice(-2)[0]) < -6,
                );
                return out ? getComputedStyle(e).stroke : null;
              })
              .find(Boolean) ?? "",
        };
      });
      on.push(st.on);
      if (st.host) mats.add(`${st.stroke} on ${st.host}`);
    }
    // measured from the drop's FIRST appearance: it grows from zero mass after
    // the form comes back on screen, and that gather is not a switch-off
    const first = on.indexOf(1);
    const after = first < 0 ? [] : on.slice(first);
    const gaps = after.filter((v) => v === 0).length;
    log.push(`tour-fade ${on.map((v) => (v ? "█" : ".")).join("")}`);
    log.push(
      `          ${first >= 0 && gaps === 0 ? "PASS" : "FAIL"} — once it has mass the outline is on for ${after.length - gaps}/${after.length} frames (it must never switch off mid-tour; the ${first} leading frames are it gathering)`,
    );
    // While the bridge is formed both draw the SAME circle. If the two
    // materials differ the outline goes bolder and brighter on landing — a
    // blink with no fade anywhere in it.
    //
    // Compared by DISTANCE, not by string. The drop copies the host's computed
    // stroke once per drawn frame, so during the host's 200 ms transition it
    // trails by a frame — and under the virtual clock that gap widens, because
    // rAF is frozen while CSS transitions keep running on the real clock (see
    // `cta-membrane-spec.md §5`). What matters is that the two are
    // indistinguishable, not byte-equal.
    const rgba = (c) => {
      const n = (c.match(/[\d.]+/g) ?? []).map(Number);
      return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n[3] ?? 1];
    };
    const mismatched = [...mats].filter((m) => {
      const [a, b] = m.split(" on ").map(rgba);
      const dc = Math.max(...[0, 1, 2].map((i) => Math.abs(a[i] - b[i])));
      return dc > 26 || Math.abs(a[3] - b[3]) > 0.12;
    });
    log.push(
      `tour-mat  ${mismatched.length === 0 ? "PASS" : "FAIL"} — drop vs the contour drawing the same circle, ${mats.size} pairing(s) seen, ${mismatched.length} distinguishable${mismatched.length ? ": " + mismatched.join(" | ") : ""}`,
    );
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
    await page.evaluate((m) => window.__advance(m), 2200);
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
  await settle(page);
  await park(page);
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
  // measured AFTER parking, not before — settle()'s box is from a page that
  // had not been scrolled yet
  const box = await page.evaluate(() => {
    const r = document.querySelector(".contact-form").getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await shot(page, "6-reduced-motion", box);
  await ctx.close();
}

await browser.close();
console.log(`\n${log.join("\n")}\n\nstills → ${OUT}/`);
