// The VEIL's ROUTING gate — every way a route can change, and what the curtain
// does about it.
//
// `verify/veil.mjs` proves the geometry in plain node and `capture/veil.mjs`
// proves the paint in a browser. Neither can see the third failure surface,
// which is the only one that has actually produced bugs: the handshake between
// the click interceptor, the curtain's own run state, and `template.tsx`
// remounting. Three defects came out of the audit this file was written from,
// and every one of them left the geometry and the paint perfectly correct:
//
//   A SWALLOWED CLICK. `play()` resolved only from GSAP's `onComplete`, but
//   `kill()` fires `onInterrupt` and never `onComplete`. Anything that killed a
//   tween mid-cover therefore left a promise dangling — and `cover()` is what
//   the provider awaits before it routes. The click did nothing at all, and
//   `leavingRef` was never cleared, so nothing could navigate afterwards.
//
//   A PHANTOM TRANSITION. `enter()` was rebuilt whenever `useReducedMotion`
//   changed, and `template.tsx` calls it from an effect keyed on its identity.
//   Toggling the OS setting therefore announced an arrival that never happened
//   and washed a page nobody had navigated away from.
//
//   A SILENT LOCALE SWITCH. `app/[locale]/layout.tsx` is keyed on the segment,
//   so /en → /pt remounts the provider and the curtain. `template.tsx`
//   announces from a LAYOUT effect and the curtain registers from a PASSIVE
//   one, so the announcement arrived first and found an empty slot.
//
// Dev or production server must be running:
//   BASE_URL=http://localhost:PORT node scripts/verify/veil-routes.mjs

import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE_URL || process.env.BASE || "http://localhost:3000";
const LOCALE = "en";
// `ftier=none` keeps the liquid canvas off: this gate is about routing, and a
// GPU-bound homepage only makes every wait longer. It is also an `?f*` param,
// so the entry intro is suppressed and every load arrives ready.
const READY = "?ftier=none";

const browser = await chromium.launch(LAUNCH);
let failed = 0;
const check = (name, cond, why, extra) => {
  if (cond) console.log(`  ok   ${name}${extra ? ` — ${extra}` : ""}`);
  else {
    failed++;
    console.log(`  FAIL ${name} — ${why}`);
  }
};

const state = (page) =>
  page.evaluate(() => {
    const v = document.querySelector(".page-veil");
    return {
      path: location.pathname,
      scrollY: Math.round(window.scrollY),
      stage: v?.dataset.veil ?? "absent",
      painted: v
        ? [...v.querySelectorAll("path")].filter((p) => p.getAttribute("d")).length
        : -1,
      pointer: v ? getComputedStyle(v).pointerEvents : null,
      count: document.querySelectorAll(".page-veil").length,
    };
  });

/** Resolves when the curtain is parked (or absent, under reduced motion). */
const settle = (page, ms = 20000) =>
  page
    .waitForFunction(
      () => {
        const v = document.querySelector(".page-veil");
        return !v || v.dataset.veil === "idle";
      },
      null,
      { timeout: ms },
    )
    .catch(() => false);

/** Every distinct stage the curtain passes through over `ms`. */
const stagesOver = async (page, ms) => {
  const seen = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = (await state(page)).stage;
    if (seen.at(-1) !== s) seen.push(s);
    await page.waitForTimeout(70);
  }
  return seen;
};

/** An on-screen link that is a genuine route change. */
const routeLink = (page, want) =>
  page.evaluate((w) => {
    for (const a of document.querySelectorAll("a[href]")) {
      let u;
      try {
        u = new URL(a.href, location.href);
      } catch {
        continue;
      }
      if (u.origin !== location.origin) continue;
      if (u.pathname === location.pathname) continue;
      if (w && !u.pathname.includes(w)) continue;
      const r = a.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      if (r.top < 0 || r.top > innerHeight) continue;
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, href: u.pathname };
    }
    return null;
  }, want);

const open = async (opts = {}, path = `/${LOCALE}${READY}`) => {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...opts,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.errors = errors;
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector("h1"), {
    timeout: 60000,
  });
  await page.waitForTimeout(2200);
  return { ctx, page };
};

// ── 1. a cold document ──────────────────────────────────────────────────────
console.log("\n1. a cold document");
{
  const { ctx, page } = await open();
  const stages = await stagesOver(page, 1400);
  check(
    "nothing plays on a document's first paint",
    stages.every((s) => s === "idle"),
    `saw ${stages.join(" → ")} — a transition needs something to transition FROM, and the entry intro owns that moment`,
    "idle throughout",
  );
  const s = await state(page);
  check("exactly one curtain in the document", s.count === 1, `${s.count} found`);
  check(
    "and it takes no pointer at rest",
    s.pointer === "none",
    `pointer-events: ${s.pointer} — an idle curtain would eat every click on the site`,
  );
  await ctx.close();
}

// ── 2. a link click ─────────────────────────────────────────────────────────
console.log("\n2. a link click");
{
  const { ctx, page } = await open();
  const link = await routeLink(page, null);
  await page.mouse.click(link.x, link.y);
  const stages = await stagesOver(page, 3400);
  await settle(page);
  const end = await state(page);
  check(
    "covers, then reveals",
    stages.includes("cover") && stages.includes("reveal"),
    `stages were ${stages.join(" → ")}`,
    stages.join(" → "),
  );
  check("and lands", end.path === link.href, `expected ${link.href}, got ${end.path}`, end.path);
  check(
    "leaving nothing painted",
    end.stage === "idle" && end.painted === 0,
    `stage ${end.stage}, ${end.painted} layers still painted`,
  );
  check("no page errors", page.errors.length === 0, page.errors.join(" | "));
  await ctx.close();
}

// ── 3. back / forward ───────────────────────────────────────────────────────
console.log("\n3. back / forward");
{
  const { ctx, page } = await open();
  const link = await routeLink(page, null);
  await page.mouse.click(link.x, link.y);
  await settle(page);
  await page.waitForTimeout(400);

  await page.goBack();
  const stages = await stagesOver(page, 2600);
  await settle(page);
  const end = await state(page);
  check(
    "a history pop gets the wash, never a blackout",
    stages.includes("wash") && !stages.includes("cover") && !stages.includes("reveal"),
    `stages were ${stages.join(" → ")} — covering hides exactly the page the visitor came back to see`,
    stages.join(" → "),
  );
  check("and settles", end.stage === "idle" && end.painted === 0, `left on ${end.stage}/${end.painted}`);
  await ctx.close();
}

// ── 4. the locale toggle ────────────────────────────────────────────────────
// A <button> calling router.replace, so it never reaches the click
// interceptor — AND it remounts `app/[locale]/layout.tsx`, curtain included.
console.log("\n4. the locale toggle");
{
  const { ctx, page } = await open();
  if ((await page.locator(".lang-opt").count()) < 2) {
    check("the locale control is present", false, "fewer than two .lang-opt buttons");
  } else {
    await page.locator(".lang-opt", { hasText: "PT" }).first().click();
    const stages = [];
    let vanished = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 3000) {
      const s = await state(page);
      if (stages.at(-1) !== s.stage) stages.push(s.stage);
      if (s.count !== 1) vanished++;
      await page.waitForTimeout(70);
    }
    await settle(page);
    const end = await state(page);
    check(
      "the curtain survives the layout remount",
      vanished === 0,
      `the .page-veil element was missing on ${vanished} samples`,
      "one curtain throughout",
    );
    check(
      "the switch is acknowledged",
      stages.includes("wash"),
      `stages were ${stages.join(" → ")} — the arrival landed before the curtain registered and was dropped`,
      stages.join(" → "),
    );
    check(
      "as a wash, not a blackout",
      !stages.includes("cover"),
      "a locale switch deliberately keeps the reader where they were; hiding the page contradicts it",
    );
    check("it lands on the other locale", end.path.startsWith("/pt"), `landed on ${end.path}`, end.path);
    check(
      "with a matching document lang",
      (await page.evaluate(() => document.documentElement.lang)) === "pt-BR",
      "lang did not follow the locale",
    );
    // and the machinery still works afterwards
    const link = await routeLink(page, null);
    await page.mouse.click(link.x, link.y);
    const after = await stagesOver(page, 3200);
    await settle(page);
    check(
      "and transitions still run after it",
      after.includes("cover"),
      `stages were ${after.join(" → ")} — the remount lost the curtain's registration for good`,
      after.join(" → "),
    );
  }
  check("no page errors", page.errors.length === 0, page.errors.join(" | "));
  await ctx.close();
}

// ── 5. a route that never commits ───────────────────────────────────────────
// The watchdog is the only thing standing between a push that does not land
// and a working site left behind an opaque black screen.
console.log("\n5. a route that 404s");
{
  const { ctx, page } = await open();
  await page.evaluate(() => {
    const a = document.createElement("a");
    a.id = "probe-404";
    a.href = "/en/definitely-not-a-route";
    a.textContent = "404";
    a.style.cssText =
      "position:fixed;top:300px;left:40px;z-index:99998;padding:10px;background:#111;color:#fff";
    document.body.appendChild(a);
  });
  const t0 = Date.now();
  await page.mouse.click(60, 312);
  await settle(page, 12000);
  const took = Date.now() - t0;
  const end = await state(page);
  check(
    "the curtain still lifts",
    end.stage === "idle" && end.painted === 0,
    `left on "${end.stage}" with ${end.painted} layers painted — the site would be behind a black screen`,
    `cleared in ${took} ms`,
  );
  check("and the 404 is readable", (await page.locator("h1").count()) > 0, "no h1 on the not-found page");
  await ctx.close();
}

// ── 6. an interrupted cover ─────────────────────────────────────────────────
// Flipping prefers-reduced-motion mid-cover re-runs the curtain's registration
// effect, whose cleanup kills the tween. If `play()` does not settle on
// `onInterrupt`, the click is swallowed outright and nothing can navigate
// afterwards either.
console.log("\n6. an interrupted cover");
{
  const { ctx, page } = await open();
  const link = await routeLink(page, null);
  await page.mouse.click(link.x, link.y);
  await page.waitForTimeout(200); // inside the 720 ms cover
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(1000);
  const during = await state(page);
  check(
    "the click still routes",
    during.path === link.href,
    `still on ${during.path} — the navigation was swallowed with the tween`,
    `landed on ${during.path}`,
  );
  check(
    "and the curtain is gone under reduced motion",
    during.stage === "absent",
    `the veil element is still in the document (stage "${during.stage}")`,
  );

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForTimeout(1200);
  const restored = await state(page);
  check(
    "restoring the preference does not invent a transition",
    restored.stage === "idle",
    `stage went to "${restored.stage}" on a page nobody navigated away from`,
  );

  const next = await routeLink(page, null);
  await page.mouse.click(next.x, next.y);
  const stages = await stagesOver(page, 3400);
  await settle(page);
  const end = await state(page);
  check(
    "and the site can still navigate",
    end.path === next.href && stages.includes("cover"),
    `clicked ${next.href}, ended on ${end.path} after ${stages.join(" → ")} — the departure latch is stuck`,
    end.path,
  );
  await ctx.close();
}

// ── 7. abuse ────────────────────────────────────────────────────────────────
console.log("\n7. abuse");
{
  const { ctx, page } = await open();
  const a = await routeLink(page, null);
  await page.mouse.click(a.x, a.y);
  await page.mouse.click(a.x, a.y);
  await settle(page);
  const doubled = await state(page);
  check(
    "a double-click routes once and settles",
    doubled.path === a.href && doubled.stage === "idle" && doubled.painted === 0,
    `${doubled.path} / ${doubled.stage} / ${doubled.painted} painted`,
    doubled.path,
  );

  const b = await routeLink(page, null);
  await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(520); // opaque by now
  const mid = await state(page);
  await page.mouse.click(720, 450); // straight into the curtain
  await settle(page);
  const after = await state(page);
  check(
    "the curtain takes the pointer while it hides the page",
    mid.pointer === "auto",
    `pointer-events was "${mid.pointer}" mid-cover — a click would land on something invisible`,
  );
  check(
    "and a click into it changes nothing",
    after.path === b.href && after.stage === "idle",
    `${after.path} / ${after.stage}`,
  );
  check("no page errors through the abuse", page.errors.length === 0, page.errors.join(" | "));
  await ctx.close();
}

// ── 8. clicks that are not route changes ────────────────────────────────────
console.log("\n8. clicks the curtain must ignore");
{
  const { ctx, page } = await open();
  await page.evaluate(() => {
    const mk = (href, id, top, attrs = {}) => {
      const a = document.createElement("a");
      a.href = href;
      a.id = id;
      a.textContent = id;
      Object.assign(a, attrs);
      a.style.cssText = `position:fixed;top:${top}px;left:40px;z-index:99998;padding:10px;background:#111;color:#fff`;
      document.body.appendChild(a);
    };
    // Same pathname AND same query — anything else is a real document load,
    // correctly so, and would take these probes with it.
    mk(location.pathname + location.search + "#contact", "same-doc", 300);
    mk("/en/work" + location.search, "new-tab", 340, { target: "_blank" });
  });

  const before = await state(page);
  await page.mouse.click(60, 312);
  await page.waitForTimeout(1400);
  const hashed = await state(page);
  check(
    "a same-document hash link gets no curtain",
    hashed.stage === "idle",
    `stage went to "${hashed.stage}" — that is a Lenis scroll, not a route change (AGENTS.md §4.11)`,
  );
  check(
    "and it still scrolls",
    hashed.scrollY > before.scrollY,
    `scrollY ${before.scrollY} → ${hashed.scrollY}`,
    `scrolled to ${hashed.scrollY}`,
  );
  check(
    "the page was not reloaded",
    (await page.locator("#same-doc").count()) === 1,
    "the probes are gone, so that was a document load",
  );

  await page.keyboard.down("Control");
  await page.mouse.click(60, 352);
  await page.keyboard.up("Control");
  await page.waitForTimeout(900);
  const modded = await state(page);
  check(
    "a ctrl-click is left to the browser",
    modded.stage === "idle" && modded.path === `/${LOCALE}`,
    `stage "${modded.stage}", path ${modded.path} — open-in-new-tab was hijacked`,
  );
  check("no page errors", page.errors.length === 0, page.errors.join(" | "));
  await ctx.close();
}

// ── 9. keyboard ─────────────────────────────────────────────────────────────
console.log("\n9. keyboard");
{
  const { ctx, page } = await open();
  const target = await page.evaluate(() => {
    for (const a of document.querySelectorAll("a[href]")) {
      const u = new URL(a.href, location.href);
      if (u.origin === location.origin && u.pathname !== location.pathname) {
        a.id = "kbd-target";
        return u.pathname;
      }
    }
    return null;
  });
  await page.focus("#kbd-target");
  await page.keyboard.press("Enter");
  await settle(page);
  const end = await state(page);
  check("Enter on a focused link crosses too", end.path === target, `${end.path} / ${end.stage}`, end.path);
  check(
    "the curtain never takes focus",
    !(await page.evaluate(() => document.querySelector(".page-veil")?.contains(document.activeElement))),
    "focus is sitting inside an aria-hidden decoration",
  );
  check(
    "and stays out of the accessibility tree",
    (await page.evaluate(() => document.querySelector(".page-veil")?.getAttribute("aria-hidden"))) === "true",
    "the veil is not aria-hidden",
  );
  await ctx.close();
}

// ── 10. reduced motion ──────────────────────────────────────────────────────
console.log("\n10. reduced motion");
{
  const { ctx, page } = await open({ reducedMotion: "reduce" });
  const s = await state(page);
  check("no curtain is rendered at all", s.count === 0, `${s.count} .page-veil elements in the document`);
  const link = await routeLink(page, null);
  await page.mouse.click(link.x, link.y);
  await page.waitForTimeout(2500);
  const end = await state(page);
  check(
    "and links route exactly as they always did",
    end.path === link.href,
    `clicked ${link.href} and stayed on ${end.path}`,
    end.path,
  );
  check("no page errors", page.errors.length === 0, page.errors.join(" | "));
  await ctx.close();
}

// ── 11. the mobile nav sheet ────────────────────────────────────────────────
// The sheet and the chrome that morphs over it sit at z-index 1000/1001/1002.
// A curtain the chrome pokes through is not a curtain.
console.log("\n11. the mobile nav sheet");
{
  const { ctx, page } = await open({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  await page.locator(".burger").click();
  await page.waitForTimeout(800);
  const sheetLink = await page.evaluate(() => {
    for (const a of document.querySelectorAll(".nav-sheet a[href]")) {
      const u = new URL(a.href, location.href);
      if (u.pathname === location.pathname) continue;
      const r = a.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, href: u.pathname };
    }
    return null;
  });
  if (!sheetLink) {
    check("the sheet carries a route link", false, "no navigable link inside .nav-sheet");
  } else {
    await page.mouse.click(sheetLink.x, sheetLink.y);
    await page.waitForFunction(
      () => {
        const v = document.querySelector(".page-veil");
        if (!v || v.dataset.veil !== "cover") return false;
        const ink = v.querySelectorAll("path")[2];
        return ink.getAttribute("d") && ink.getBBox().height > 99.9;
      },
      null,
      { timeout: 20000 },
    );
    const box = await page.evaluate(() => {
      const r = document.querySelector(".page-veil").getBoundingClientRect();
      return { top: r.top, left: r.left, w: r.width, h: r.height, iw: innerWidth, ih: innerHeight };
    });
    check(
      "the curtain fills the viewport exactly",
      box.top === 0 &&
        box.left === 0 &&
        Math.abs(box.w - box.iw) < 1 &&
        Math.abs(box.h - box.ih) < 1,
      `veil ${box.w}x${box.h} at (${box.left},${box.top}) in a ${box.iw}x${box.ih} viewport`,
      `${box.w}x${box.h}`,
    );
    const corners = await page.evaluate(() =>
      [
        [20, 20],
        [innerWidth / 2, 40],
        [innerWidth - 20, innerHeight / 2],
        [innerWidth / 2, innerHeight - 24],
      ].map(([x, y]) => {
        const e = document.elementFromPoint(x, y);
        return e ? `${e.tagName.toLowerCase()}.${(e.getAttribute("class") || "").split(" ")[0]}` : "null";
      }),
    );
    check(
      "and paints above the open sheet and its chrome",
      corners.every((c) => c.includes("page-veil")),
      `hit-test found ${corners.join(", ")} — something pokes through the curtain`,
      "curtain is topmost at all four edges",
    );
    await settle(page);
    const end = await state(page);
    check("the sheet navigation completes", end.path === sheetLink.href, `${end.path} / ${end.stage}`, end.path);
    check(
      "and the sheet is closed on arrival",
      !(await page.evaluate(() => document.documentElement.hasAttribute("data-nav-open"))),
      "the nav sheet is still open behind the new page",
    );
  }
  check("no page errors", page.errors.length === 0, page.errors.join(" | "));
  await ctx.close();
}

await browser.close();
console.log(
  failed === 0
    ? "\nVEIL ROUTES OK — every arrival accounted for, nothing swallowed, nothing stranded.\n"
    : `\n${failed} FAILED\n`,
);
process.exit(failed === 0 ? 0 : 1);
