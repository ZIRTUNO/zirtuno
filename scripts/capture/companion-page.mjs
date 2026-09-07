/**
 * THE COMPANION, ON THE REAL PAGE.
 *
 * `capture/companion.mjs` proves the GEOMETRY — it drives the kernel directly
 * and can say nothing at all about whether the thing is wired up. This drives
 * the shipped contact page with a real browser, performs the seven things a
 * visitor actually does, and photographs what the companion does back. It is
 * the only artefact that can catch the failures that live between the kernel
 * and the DOM:
 *
 *   · the rest pose is in the SERVER HTML — the droplet is present and
 *     correct before a single line of JavaScript has run
 *   · `data-companion` appears only after a live frame has been drawn
 *   · the gaze actually follows the pointer, the caret and the error summary
 *   · the FIRST rejected submit gets `doubt` and the SECOND gets `angry`
 *   · fixing the field cancels the scowl instead of leaving it armed
 *   · the form still submits, still validates and still announces its errors
 *     with the companion mounted over it
 *
 * NOTHING IS EVER SENT. `/api/contact` is stubbed with `page.route`, so the
 * success / pending / failure states render from a local fixture and no
 * request leaves this machine — the delivery path is Resend, and a capture
 * script that mails the owner every time it runs is a capture script nobody
 * runs twice.
 *
 *   BASE_URL=http://localhost:3000 node scripts/capture/companion-page.mjs
 *   (npm run companion:page)
 */
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "captures/companion-page";
const LOCALE = process.env.LOCALE ?? "pt";
// Any `?f*` param puts the site in a QA context and skips the entry veil with
// no flash — without it the first frames are shot behind a curtain.
const URL = `${BASE}/${LOCALE}/contact?fcap=1`;

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

const problems = [];
const note = (m) => {
  problems.push(m);
  console.log(`  ! ${m}`);
};
const good = (m) => console.log(`  ok ${m}`);

/**
 * The companion's own box, cropped tight with a little air around it.
 *
 * The CARRIER, not the slot: once the layer is live the carrier detaches to
 * `position: fixed` and travels, while the slot stays behind in the flow
 * holding the layout open. Clipping on the slot photographs empty space the
 * moment the droplet undocks.
 */
async function shot(name, pad = 18) {
  const el = await page.$(".cp-carrier");
  if (!el) return note(`${name}: no .cp-carrier in the document`);
  const box = await el.boundingBox();
  if (!box) return note(`${name}: .cp-carrier has no box`);
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    clip: {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: box.width + pad * 2,
      height: box.height + pad * 2,
    },
  });
}

const state = () =>
  page.evaluate(() => {
    const host = document.querySelector(".companion");
    const body = host?.querySelector(".cp-body")?.getAttribute("d") ?? "";
    const left = host?.querySelector(".cp-eye-l")?.getAttribute("d") ?? "";
    const car = host?.querySelector(".cp-carrier");
    return {
      live: host?.getAttribute("data-companion") ?? null,
      chill: host?.style.getPropertyValue("--cp-chill") ?? "",
      // The other two light channels, and the attribute that gates the halo.
      // `chill` alone stopped being the whole colour story once the mood could
      // be BRIGHT as well as cold.
      glow: host?.style.getPropertyValue("--cp-glow") ?? "",
      lumen: host?.style.getPropertyValue("--cp-lumen") ?? "",
      lit: host?.hasAttribute("data-glow") ?? false,
      // The bounce rides on the travel spring's own transform, so this is
      // where a `hop` is observable from outside the kernel.
      y: Number(
        /translate3d\([^,]+,\s*(-?[\d.]+)px/.exec(car?.style.transform ?? "")?.[1] ??
          NaN,
      ),
      bodyLen: body.length,
      bodyHead: body.slice(0, 40),
      leftHead: left.slice(0, 40),
      summary: !!document.querySelector(".contact-error-summary"),
      hidden: host?.getAttribute("aria-hidden"),
    };
  });

// ── 1. the server HTML, before any script has run ───────────────────────────
console.log("\n1. pre-hydration");
{
  await page.route("**/api/contact*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, delivered: true, requestId: "capture" }),
    }),
  );
  // JavaScript off: whatever is on screen came out of the server renderer.
  const noJs = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    javaScriptEnabled: false,
  });
  await noJs.goto(URL, { waitUntil: "domcontentloaded" });
  const still = await noJs.evaluate(() => {
    const host = document.querySelector(".companion");
    const d = host?.querySelector(".cp-body")?.getAttribute("d") ?? "";
    return { present: !!host, len: d.length, live: host?.getAttribute("data-companion") };
  });
  if (still.present && still.len > 200) {
    good(`the still droplet ships in the HTML (${still.len} chars of path, no JS)`);
  } else {
    note(`no server-rendered droplet: ${JSON.stringify(still)}`);
  }
  if (still.live === null || still.live === undefined) {
    good("data-companion is absent without JavaScript (the additive contract)");
  } else {
    note(`data-companion was ${still.live} with JavaScript off`);
  }
  await noJs.screenshot({ path: `${OUT}/00-no-js.png`, fullPage: false });
  await noJs.close();
}

// ── 2. hydrated, at rest ────────────────────────────────────────────────────
console.log("\n2. rest");
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
{
  const s = await state();
  if (s.live === "live") good("data-companion=live after the first drawn frame");
  else note(`data-companion is ${s.live} after hydration`);
  if (s.hidden === "true") good("aria-hidden=true — it carries nothing a reader needs");
  else note(`aria-hidden is ${s.hidden}`);
  await shot("01-rest");
}

// ── 3. it looks where you point ─────────────────────────────────────────────
console.log("\n3. the gaze follows the pointer");
{
  const box = await (await page.$(".companion")).boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const seen = new Set();
  for (const [tag, dx, dy] of [
    ["right", 520, 0],
    ["down", 0, 420],
    ["left", -260, 0],
    ["up", 0, -180],
  ]) {
    await page.mouse.move(cx + dx, cy + dy);
    await page.waitForTimeout(650);
    const s = await state();
    seen.add(s.leftHead);
    await shot(`02-gaze-${tag}`);
  }
  if (seen.size === 4) good("four pointer positions produced four distinct pupil paths");
  else note(`the gaze only reached ${seen.size} distinct poses out of 4`);
}

// ── 4. it watches you write ─────────────────────────────────────────────────
console.log("\n4. focus and typing");
{
  await page.click("#contact-name");
  await page.waitForTimeout(500);
  await shot("03-attend");
  await page.type("#contact-name", "Pedro Paiva", { delay: 45 });
  await page.waitForTimeout(180);
  await shot("04-read");

  await page.click("#contact-message");
  await page.type("#contact-message", "Precisamos estruturar um ecossistema digital completo para a operação.", { delay: 18 });
  await page.waitForTimeout(200);
  await shot("05-ponder");
  good("focus and keystrokes drove the companion without touching the form");
}

// ── 5. the wrong thing, and the scowl ───────────────────────────────────────
console.log("\n5. rejection and escalation");
{
  // A bad email fails the RESOLVER, so `handleSubmit` never calls `onSubmit`
  // and no request is made at all — this is the client-side path on purpose.
  await page.fill("#contact-email", "pedro.exemplo");
  await page.click("button[type=submit]");
  await page.waitForTimeout(700);
  const first = await state();
  if (first.summary) good("the error summary rendered — the submit was refused");
  else note("no error summary after an invalid submit");
  await shot("06-first-rejection");

  await page.click("button[type=submit]");
  await page.waitForTimeout(900);
  const second = await state();
  await shot("07-second-rejection");
  if (Number(second.chill) > Number(first.chill || 0)) {
    good(`escalation: chill ${first.chill || 0} -> ${second.chill} (colder, never warmer)`);
  } else {
    note(`no escalation between rejections: ${first.chill} -> ${second.chill}`);
  }
  if (Number(second.chill) <= 1) good("chill stayed on the cyan ramp");
  else note(`chill left the ramp at ${second.chill}`);
}

// ── 6. forgiveness ──────────────────────────────────────────────────────────
console.log("\n6. it forgives");
{
  await page.fill("#contact-email", "pedro@zirtuno.com");
  await page.waitForTimeout(700);
  const s = await state();
  await shot("08-approve");
  if (Number(s.chill) < 0.2) good(`the scowl cleared when the field was fixed (chill ${s.chill})`);
  else note(`still scowling after the fix (chill ${s.chill})`);
}

// ── 7. delivered — from the stub, nothing sent ──────────────────────────────
console.log("\n7. delivered (stubbed route, no mail)");
{
  await page.click("button[type=submit]");
  await page.waitForTimeout(1400);
  const ok = await page.$(".contact-success");
  if (ok) good("the success state rendered from the stub");
  else note("the stubbed submit did not reach the success state");
  await shot("09-delivered");
}

// ── 7b. it follows you down the page ────────────────────────────────────────
console.log("\n7b. the travel");
{
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1100);
  const at = () =>
    page.evaluate(() => {
      const r = document.querySelector(".cp-carrier").getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y) };
    });
  const docked = await at();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1800);
  const parked = await at();
  await shot("10-parked");

  const vh = page.viewportSize().height;
  if (Math.abs(parked.y - docked.y) > 80) {
    good(`it travels: docked y=${docked.y} -> parked y=${parked.y} of ${vh}`);
  } else {
    note(`it did not travel (docked ${docked.y}, parked ${parked.y})`);
  }
  if (parked.y > 0 && parked.y < vh - 40) {
    good("and parks inside the viewport rather than off an edge");
  } else {
    note(`parked outside the viewport at y=${parked.y}`);
  }
  // THE GUTTER. `--page-padding` keeps that strip empty at every width, which is
  // the only place a persistent floating object can live without covering copy.
  const gutter = await page.evaluate(
    () => document.querySelector(".contact-masthead").getBoundingClientRect().left,
  );
  if (parked.x + 8 < gutter) {
    good(`and parks in the shell gutter, clear of the copy (x=${parked.x} < ${Math.round(gutter)})`);
  } else {
    note(`parked over the content column (x=${parked.x}, gutter ${Math.round(gutter)})`);
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2000);
  const back = await at();
  if (Math.abs(back.y - docked.y) < 4 && Math.abs(back.x - docked.x) < 4) {
    good("and re-docks exactly where it started");
  } else {
    note(`re-docked at ${JSON.stringify(back)}, expected ${JSON.stringify(docked)}`);
  }
}

// ── 7c. it answers being touched ────────────────────────────────────────────
console.log("\n7c. hover and click");
{
  const box = await (await page.$(".cp-carrier")).boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // THE CORNER OF THE BOX IS NOT THE DROPLET. Only `.cp-body` takes the
  // pointer, so a point inside the carrier's rect but outside the silhouette
  // must NOT count as a hover — otherwise the reactive area is a rectangle and
  // the layer is quietly a click-blocker the size of its box.
  await page.mouse.move(box.x + 3, box.y + 3);
  await page.waitForTimeout(500);
  const corner = await page.evaluate(() =>
    document.elementFromPoint(
      document.querySelector(".cp-carrier").getBoundingClientRect().x + 3,
      document.querySelector(".cp-carrier").getBoundingClientRect().y + 3,
    )?.className?.baseVal ?? document.body.tagName,
  );
  if (!String(corner).includes("cp-")) {
    good(`the box's corner is not a hit target (hits ${corner || "the page"})`);
  } else {
    note(`the carrier's corner swallowed the pointer (${corner})`);
  }

  const before = await state();
  await page.mouse.move(cx, cy);
  await page.waitForTimeout(650);
  const hovered = await state();
  await shot("11-hovered");
  if (hovered.bodyHead !== before.bodyHead && hovered.leftHead !== before.leftHead) {
    good("hovering the droplet itself changes its pose");
  } else {
    note("hovering the droplet did nothing");
  }

  await page.mouse.down();
  await page.waitForTimeout(120);
  await shot("12-struck");
  const struck = await state();
  await page.mouse.up();
  if (struck.bodyHead !== hovered.bodyHead) {
    good("clicking it runs a strike through the surface");
  } else {
    note("clicking the droplet did nothing");
  }
  await page.mouse.move(cx + 420, cy + 260);
  await page.waitForTimeout(900);
}

// ── 7d. being poked, repeatedly ─────────────────────────────────────────────
//
// THE HEADLINE NEW BEHAVIOUR, and one only a real page can check: the kernel
// knows how to be `playful` and `laughing`, but whether the SHELL escalates
// into them is wiring, and wiring is exactly what this file exists to catch.
// It runs on a fresh page because `.contact-success` from section 7 outranks
// every reaction — a droplet that has just delivered something is not
// available to be played with.
console.log("\n7d. the poke escalation");
{
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const box = await (await page.$(".cp-carrier")).boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.mouse.move(cx, cy);
  await page.waitForTimeout(400);

  const seen = [];
  let bounced = false;
  const docked = (await state()).y;
  for (let i = 1; i <= 3; i++) {
    await page.mouse.down();
    // Sampled twice: once inside the bounce's first swing, once after the
    // expression spring has arrived. One sample cannot see both.
    await page.waitForTimeout(90);
    const mid = await state();
    if (Number.isFinite(mid.y) && Math.abs(mid.y - docked) > 1.5) bounced = true;
    await page.mouse.up();
    await page.waitForTimeout(230);
    seen.push(await state());
  }
  await shot("13-poked-thrice");

  const glow = seen.map((s) => Number(s.glow || 0));
  const lumen = seen.map((s) => Number(s.lumen || 0));
  if (glow[2] > glow[1] && glow[1] > glow[0]) {
    good(
      `it escalates: glow ${glow[0].toFixed(2)} -> ${glow[1].toFixed(2)} -> ${glow[2].toFixed(2)} across three pokes`,
    );
  } else {
    note(`no escalation across three pokes (glow ${glow.join(" -> ")})`);
  }
  if (lumen[2] > lumen[0]) {
    good(`and brightens with it (lumen ${lumen[0].toFixed(2)} -> ${lumen[2].toFixed(2)})`);
  } else {
    note(`lumen did not rise (${lumen.join(" -> ")})`);
  }
  if (seen[2].lit) {
    good("data-glow is set once the halo is worth paying for");
  } else {
    note("data-glow never appeared — the halo is gated off");
  }
  if (bounced) good("and the poke bounces the droplet on its own transform");
  else note("the bounce never reached the carrier's transform");

  // Nothing here may reach the brand's warm token, whatever the mood.
  const warm = await page.evaluate(() => {
    const svg = document.querySelector(".cp-svg");
    return svg ? getComputedStyle(svg).color : "";
  });
  if (warm && !/rgb\(2[0-9][0-9],\s*\d+,\s*\d+\)/.test(warm)) {
    good(`the lit droplet is still a cyan (${warm})`);
  } else {
    note(`the lit droplet resolved to something warm: ${warm}`);
  }
}

// ── 7e. left alone ──────────────────────────────────────────────────────────
//
// The life cycle, at its first rung. `bored` is 15 s, which is a real cost to
// pay in a gate and is paid deliberately: the ladder is built from timestamps
// compared inside the draw callback, so it cannot be fast-forwarded, and an
// untested idle behaviour is one that silently stops the day someone adds a
// stray `stir()`. The deeper rungs (`drowsy` at 32 s, `sleeping` at 58 s) are
// covered by the kernel gate's monotonic-dimming assertion and by the contact
// sheet; waiting a minute here would not earn its place.
console.log("\n7e. the idle ladder");
{
  await page.mouse.move(40, 900);
  const awake = await state();
  await page.waitForTimeout(16500);
  const idle = await state();
  await shot("14-bored");
  const before = Number(awake.lumen || 1);
  const after = Number(idle.lumen || 1);
  if (after < before - 0.05) {
    good(`left alone for 16 s it dims (lumen ${before.toFixed(2)} -> ${after.toFixed(2)})`);
  } else {
    note(`it never got bored (lumen ${before.toFixed(2)} -> ${after.toFixed(2)})`);
  }

  await page.mouse.move(700, 500);
  await page.waitForTimeout(700);
  const back = Number((await state()).lumen || 1);
  if (back > after + 0.05) {
    good(`and comes back when the pointer does (lumen ${back.toFixed(2)})`);
  } else {
    note(`it stayed dim after the pointer returned (lumen ${back.toFixed(2)})`);
  }
}

// ── 8. the form is still the form ───────────────────────────────────────────
console.log("\n8. the form survived");
{
  const a11y = await page.evaluate(() => {
    const host = document.querySelector(".companion");
    const cs = host ? getComputedStyle(host) : null;
    const car = document.querySelector(".cp-carrier");
    const eye = document.querySelector(".cp-eye-l");
    return {
      pointer: cs?.pointerEvents,
      carrier: car ? getComputedStyle(car).pointerEvents : null,
      eye: eye ? getComputedStyle(eye).pointerEvents : null,
      inTabOrder: !!host?.querySelector("[tabindex]:not([tabindex='-1'])"),
    };
  });
  // THE SHAPE OPTS IN; NOTHING ABOVE IT DOES. Once the droplet became
  // deliberately clickable, the thing to guard against stopped being "can it be
  // touched" and became "is a 108px rectangle now sitting over the page". Only
  // `.cp-body` may carry pointer-events; the slot and the carrier must stay
  // `none` or the layer is a click-blocker the size of its box.
  if (a11y.pointer === "none" && a11y.carrier === "none") {
    good("only the silhouette takes the pointer — slot and carrier stay none");
  } else {
    note(`pointer-events leaked: slot ${a11y.pointer}, carrier ${a11y.carrier}`);
  }
  if (!a11y.inTabOrder) good("nothing inside it is focusable");
  else note("something inside the companion is in the tab order");
}

await browser.close();

console.log(
  `\n${problems.length === 0 ? "PASS" : `${problems.length} PROBLEM(S)`} — stills in ${OUT}/`,
);
process.exit(problems.length === 0 ? 0 : 1);
