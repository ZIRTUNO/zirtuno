// verify-studio-cards — S8's three-card row. Dev server must be running:
//
//   node scripts/verify/studio-cards.mjs        (LOCALE=en for the EN pass)
//
// What this protects, in the order it can break:
//
//   · the ROW is the reference's row — three cards, 415.814/520, at the shell
//     width, inside the rail's protected column and causing no h-overflow;
//   · the two brand marquees carry DISJOINT page sets, which is the only
//     reason the same plate can never appear twice on the card at once;
//   · the marquee is PAUSED until the card is on screen — this page already
//     spends its frame budget on a WebGL field, and a compositor animation
//     four chapters away is cost with no viewer;
//   · the web stage fills one centre, one left and one right slot with the
//     other nine parked off stage, and advances;
//   · all six REAL pages are on that stage — the two client sites and four
//     pages of the studio's own — every one resolving, and every drawn surface
//     staying anonymous;
//   · the stack fan carries six named marks, each pointing at a file that
//     exists, each keeping its OWN brand colour, and lifts one card on hover;
//   · reduced motion freezes everything, and still leaves a readable card.
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE || "http://localhost:3000";
const LOCALE = process.env.LOCALE || "pt";

let failures = 0;
const ok = (label, detail = "") => console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
const bad = (label, detail = "") => {
  failures += 1;
  console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
};
const check = (cond, label, detail) => (cond ? ok(label, detail) : bad(label, detail));

const browser = await chromium.launch(LAUNCH);

/**
 * The box of `sel` once it has STOPPED MOVING.
 *
 * Lenis eases every programmatic scroll, and it is still easing well over a
 * second after `scrollIntoView` resolves. A box read inside that window is
 * already stale by the time the mouse reaches it — the pointer lands where the
 * tile was, `:hover` never matches, and the hover assertions fail on a fan that
 * works perfectly for a real hand. So poll until two reads agree.
 */
async function settledBox(page, sel, tries = 24) {
  let last = null;
  for (let i = 0; i < tries; i += 1) {
    const box = await page.locator(sel).boundingBox();
    if (box && last && Math.abs(box.y - last.y) < 0.5 && Math.abs(box.x - last.x) < 0.5) {
      return box;
    }
    last = box;
    await page.waitForTimeout(120);
  }
  return last;
}

// Lenis can restore its current scroll position after native scrollIntoView.
// Drive real wheel input and assert arrival before judging an offscreen
// animation's intentionally paused state.
async function arriveAtCards(page) {
  for (let step = 0; step < 16; step++) {
    const delta = await page.locator(".studio-cards").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2 - innerHeight / 2;
    });
    if (Math.abs(delta) < 3) break;
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(400);
  }
  await page.waitForFunction(() => {
    const r = document.querySelector(".studio-cards").getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight;
  });
}

/* ── 1 · geometry ───────────────────────────────────────────────────────── */
{
  console.log("\n1. the row");
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${LOCALE}?fveil=1`, { waitUntil: "networkidle" });
  await page.waitForSelector(".studio-cards");

  const geo = await page.evaluate(() => {
    const row = document.querySelector(".studio-cards");
    const cards = [...row.querySelectorAll(".studio-card")];
    const rb = row.getBoundingClientRect();
    const shell = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--shell-w"),
    );
    return {
      count: cards.length,
      columns: getComputedStyle(row).gridTemplateColumns.split(" ").length,
      ratios: cards.map((c) => {
        const b = c.getBoundingClientRect();
        return +(b.width / b.height).toFixed(3);
      }),
      rowWidth: Math.round(rb.width),
      shellPx: Math.round((shell / 100) * window.innerWidth),
      right: Math.round(window.innerWidth - rb.right),
      railSafe: getComputedStyle(document.documentElement)
        .getPropertyValue("--rail-safe")
        .trim(),
      docOverflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });

  check(geo.count === 3, "three cards", String(geo.count));
  check(geo.columns === 3, "in one row of three", `${geo.columns} columns`);
  // 415.814 / 520 = 0.79964; allow a pixel of rounding at either end
  const target = 415.814 / 520;
  check(
    geo.ratios.every((r) => Math.abs(r - target) < 0.012),
    "each card holds the reference's 415.814/520",
    geo.ratios.join(" · "),
  );
  check(geo.docOverflow <= 0, "the row causes no horizontal overflow", `${geo.docOverflow}px`);
  check(
    geo.right >= parseFloat(geo.railSafe || "0"),
    "the row stops short of the rail's protected column",
    `${geo.right}px right gap`,
  );
  await ctx.close();
}

/* ── 2 · the brand book ─────────────────────────────────────────────────── */
{
  console.log("\n2. the brand marquees");
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${LOCALE}?fveil=1`, { waitUntil: "networkidle" });
  await page.waitForSelector(".studio-card--brand");

  const rows = await page.evaluate(() => {
    const kinds = (sel) => {
      const track = document.querySelector(sel);
      const seen = [];
      for (const p of track.querySelectorAll(".bplate")) {
        const k = [...p.classList].find((c) => c.startsWith("bplate--"));
        if (k) seen.push(k.replace("bplate--", ""));
      }
      return seen;
    };
    return { top: kinds(".brand-track--ltr"), bottom: kinds(".brand-track--rtl") };
  });

  const topSet = new Set(rows.top);
  const bottomSet = new Set(rows.bottom);
  const shared = [...topSet].filter((k) => bottomSet.has(k));
  check(shared.length === 0, "the two rows share no page", shared.join(",") || "disjoint");
  check(
    rows.top.length === topSet.size * 2 && rows.bottom.length === bottomSet.size * 2,
    "each track is its set exactly twice, so -50% is one period",
    `${rows.top.length}/${topSet.size} · ${rows.bottom.length}/${bottomSet.size}`,
  );

  // paper and black must alternate, seam included, or a quadrant goes dark
  const BLACK = new Set(["mark", "icon", "wordmark", "motion", "card", "spec"]);
  const alternates = (set) =>
    set.every((k, i) => BLACK.has(k) !== BLACK.has(set[(i + 1) % set.length]));
  check(alternates([...topSet]), "the top row alternates paper and black", [...topSet].join(" "));
  check(
    alternates([...bottomSet]),
    "the bottom row alternates paper and black",
    [...bottomSet].join(" "),
  );
  await ctx.close();
}

/* ── 3 · the marquee sleeps off screen ──────────────────────────────────── */
{
  console.log("\n3. idle cost");
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${LOCALE}?fveil=1`, { waitUntil: "networkidle" });
  await page.waitForSelector(".studio-card--brand");

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(900);
  const atTop = await page.evaluate(() => ({
    live: document.querySelector(".studio-card--brand").dataset.live,
    state: getComputedStyle(document.querySelector(".brand-track")).animationPlayState,
  }));
  check(atTop.live === "false", "the card is asleep from the top of the page", atTop.live);
  check(atTop.state === "paused", "and its marquee is not compositing", atTop.state);

  await arriveAtCards(page);
  await page.waitForTimeout(1200);
  const atCard = await page.evaluate(() => ({
    live: document.querySelector(".studio-card--brand").dataset.live,
    state: getComputedStyle(document.querySelector(".brand-track")).animationPlayState,
  }));
  check(atCard.live === "true", "it wakes when the reader arrives", atCard.live);
  check(atCard.state === "running", "and the marquee runs", atCard.state);
  await ctx.close();
}

/* ── 4 · the web stage ──────────────────────────────────────────────────── */
{
  console.log("\n4. the web stage");
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${LOCALE}?fveil=1`, { waitUntil: "networkidle" });
  await page.waitForSelector(".build-stage");
  await arriveAtCards(page);
  await page.waitForTimeout(600);

  const slots = () =>
    page.evaluate(() =>
      [...document.querySelectorAll(".build-shot")].map((f) =>
        [...f.classList].find((c) => c.startsWith("is-")),
      ),
    );

  const first = await slots();
  check(first.length === 12, "twelve surfaces on the stage", String(first.length));
  check(
    ["is-centre", "is-left", "is-right"].every((s) => first.filter((x) => x === s).length === 1),
    "each on-stage slot is filled exactly once",
    first.join(" "),
  );
  check(
    first.filter((s) => s === "is-enter" || s === "is-exit").length === 9,
    "and the other nine wait off stage",
    `${first.filter((s) => s === "is-enter").length} enter · ${first.filter((s) => s === "is-exit").length} exit`,
  );

  const srcs = await page.evaluate(() =>
    [...document.querySelectorAll(".build-shot img")].map((i) =>
      decodeURIComponent(i.getAttribute("src")),
    ),
  );
  const REAL = [
    "site-juliana.jpg",
    "site-diego.jpg",
    "site-zirtuno.jpg",
    "site-zirtuno-work.jpg",
    "site-zirtuno-case.jpg",
    "site-zirtuno-contact.jpg",
  ];
  const missing = REAL.filter((f) => !srcs.some((s) => s.includes(`/studio/${f}`)));
  check(
    missing.length === 0,
    "all six real pages are on the stage",
    missing.join(",") || `${srcs.length} shots`,
  );
  // every real shot must RESOLVE — a missing file leaves a blank frame that
  // still passes a src check, and the stage is the card's whole content
  const shotCodes = [];
  for (const f of REAL) {
    const res = await page.request.get(`${BASE}/studio/${f}`);
    shotCodes.push(`${f.replace("site-", "").replace(".jpg", "")}:${res.status()}`);
  }
  check(
    shotCodes.every((c) => c.endsWith(":200")),
    "and every one of them resolves",
    shotCodes.join(" "),
  );
  const drawn = await page.evaluate(() => document.querySelectorAll(".build-shot .ui").length);
  check(drawn === 6, "and six drawn surfaces beside them", String(drawn));
  const anonymous = await page.evaluate(() =>
    [...document.querySelectorAll(".build-shot .ui")].every(
      (n) => n.textContent.trim() === "" && !n.querySelector("img"),
    ),
  );
  check(anonymous, "no drawn surface carries a name or an image", String(anonymous));
  const alts = await page.evaluate(() =>
    [...document.querySelectorAll(".build-shot img")].map((i) => i.alt),
  );
  check(alts.every((a) => a && a.trim().length > 0), "each carries a real alt", alts.join(" · "));

  await page.waitForTimeout(4200);
  const second = await slots();
  check(second.join() !== first.join(), "the stage advances", `${first.join()} → ${second.join()}`);
  await ctx.close();
}

/* ── 5 · the stack fan ──────────────────────────────────────────────────── */
{
  console.log("\n5. the stack fan");
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${LOCALE}?fveil=1`, { waitUntil: "networkidle" });
  await page.waitForSelector(".fan");
  await page.locator(".studio-cards").evaluate((n) => n.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(600);

  const tiles = await page.evaluate(() =>
    [...document.querySelectorAll(".ftile")].map((t) => {
      const logo = t.querySelector(".ftile__logo");
      const cs = getComputedStyle(logo);
      const url = /url\("?([^")]+)"?\)/.exec(cs.backgroundImage || "");
      return {
        slot: [...t.classList].find((c) => c.startsWith("ftile--") && c.length === 9),
        self: t.classList.contains("ftile--self"),
        name: logo?.getAttribute("aria-label") || "",
        role: logo?.getAttribute("role") || "",
        src: url ? url[1] : "",
      };
    }),
  );
  check(tiles.length === 6, "six tiles on the arc", String(tiles.length));
  check(
    tiles.filter((t) => t.self).length === 1,
    "one of them is ours, and it is the lit one",
    tiles.filter((t) => t.self).map((t) => t.name).join(",") || "none",
  );
  check(
    tiles.every((t) => t.name.trim() && t.role === "img"),
    "each mark is named for a screen reader",
    tiles.map((t) => t.name).join(" · "),
  );

  // every mark must resolve — a 404 mask paints nothing and the tile goes blank
  const codes = [];
  for (const t of tiles) {
    const res = t.src ? await page.request.get(t.src) : null;
    codes.push(`${t.name}:${res ? res.status() : "no-url"}`);
  }
  check(codes.every((c) => c.endsWith(":200")), "and points at a file that exists", codes.join(" "));

  // Owner's call (2026-09-10): the marks keep their own colours. The failure
  // this guards against is a well-meaning "harmonise the fan" pass masking
  // them back into cyan, which silently makes five trademarks wrong.
  const OWN_COLOUR = {
    Figma: "#A259FF",
    Blender: "#ff7021",
    OpenAI: "#fff",
    Claude: "#D97757",
    n8n: "#ea4b71",
  };
  const kept = [];
  for (const t of tiles) {
    const want = OWN_COLOUR[t.name];
    if (!want) continue;
    const body = await (await page.request.get(t.src)).text();
    kept.push(`${t.name}:${body.toLowerCase().includes(want.toLowerCase()) ? "ok" : "LOST"}`);
  }
  check(kept.every((k) => k.endsWith(":ok")), "each mark keeps its own colour", kept.join(" "));
  const masked = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector(".ftile--brand .ftile__logo"));
    return (cs.maskImage || "none") + "|" + (cs.webkitMaskImage || "none");
  });
  check(
    !/url\(/.test(masked),
    "and is not masked into a flat fill",
    masked,
  );

  const beforeHover = await page.evaluate(
    () => getComputedStyle(document.querySelector(".ftile--d .ftile__face")).transform,
  );
  // `locator.hover()` scrolls the element into view AGAIN before moving, which
  // restarts the ease and guarantees a miss. Move the real mouse to a SETTLED
  // box instead — what a reader's hand does.
  const tile = await settledBox(page, ".ftile--d");
  await page.mouse.move(tile.x + tile.width / 2, tile.y + tile.height / 2);
  await page.waitForTimeout(250);
  const hovered = await page.evaluate(() =>
    document.querySelector(".ftile--d").matches(":hover"),
  );
  check(hovered, "the companion's tile takes the pointer", String(hovered));
  await page.waitForTimeout(900);
  const afterHover = await page.evaluate(() => {
    const c = document.querySelector(".ftile--d");
    return {
      face: getComputedStyle(c.querySelector(".ftile__face")).transform,
      z: getComputedStyle(c).zIndex,
      sibling: getComputedStyle(document.querySelector(".ftile--a .ftile__face")).opacity,
    };
  });
  check(afterHover.face !== beforeHover, "hover lifts the card out of the fan", afterHover.face);
  check(afterHover.z === "7", "and brings it in front", afterHover.z);
  check(parseFloat(afterHover.sibling) < 0.9, "while the others step back", afterHover.sibling);
  await ctx.close();
}


/* ── 6 · reduced motion ─────────────────────────────────────────────────── */
{
  console.log("\n6. reduced motion");
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${LOCALE}?fveil=1`, { waitUntil: "networkidle" });
  await page.waitForSelector(".studio-cards");
  await arriveAtCards(page);
  await page.waitForTimeout(800);

  const still = await page.evaluate(
    () => getComputedStyle(document.querySelector(".brand-track")).animationName,
  );
  check(still === "none", "the marquee does not run", still);

  const before = await page.evaluate(() =>
    [...document.querySelectorAll(".build-shot")]
      .map((f) => [...f.classList].find((c) => c.startsWith("is-")))
      .join(),
  );
  await page.waitForTimeout(4200);
  const after = await page.evaluate(() =>
    [...document.querySelectorAll(".build-shot")]
      .map((f) => [...f.classList].find((c) => c.startsWith("is-")))
      .join(),
  );
  check(before === after, "the web stage holds its slot", after);

  const readable = await page.evaluate(() => {
    const t = [...document.querySelectorAll(".studio-card__title")].map((n) => n.textContent.trim());
    const s = [...document.querySelectorAll(".studio-card__sub")].map((n) => n.textContent.trim());
    return { t, allSet: t.every(Boolean) && s.every(Boolean) };
  });
  check(readable.allSet, "all three cards still read", readable.t.join(" · "));
  await ctx.close();
}

await browser.close();
console.log(
  failures === 0
    ? "\nSTUDIO CARDS: all green"
    : `\nSTUDIO CARDS: ${failures} failing check(s)`,
);
process.exit(failures === 0 ? 0 : 1);
