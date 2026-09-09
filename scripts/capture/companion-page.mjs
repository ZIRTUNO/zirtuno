/** The actual contact companion: real inputs and observed form outcomes.
 * All POSTs are intercepted locally. No email is sent by this capture.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.OUT ?? "captures/companion-page";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(LAUNCH);
const notes = [];
const good = message => { notes.push(message); console.log("ok " + message); };
const mood = (page, expected) => page.waitForFunction(
  names => names.includes(document.querySelector(".companion")?.dataset.emotion),
  Array.isArray(expected) ? expected : [expected], { timeout: 6000 },
).catch(async error => {
  console.log("Expected", expected, await page.evaluate(()=>({
    emotion:document.querySelector('.companion')?.dataset,
    box:document.querySelector('.cp-carrier')?.getBoundingClientRect().toJSON(),
    active:document.activeElement?.outerHTML.slice(0,350),
    step:document.querySelector('form')?.dataset.step,
    busy:document.querySelector('form')?.getAttribute('aria-busy'),
    scroll:window.scrollY,
  })));
  await page.screenshot({path:OUT+'/failure.png'});
  throw error;
});
const color = page => page.locator(".cp-svg").evaluate(el => getComputedStyle(el).color);
const shot = async (page, name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  if (await page.locator(".cp-carrier").isVisible()) {
    const box = await page.locator(".cp-carrier").boundingBox();
    if (box.y >= 0 && box.y + box.height < page.viewportSize().height)
      await page.locator(".cp-carrier").screenshot({ path: `${OUT}/${name}-avatar.png` });
  }
};
async function setup(options = {}, locale = "en") {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, ...options });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  let response = { status: 200, body: { ok: true, delivered: true } }, release;
  let posts = 0;
  await page.route("**/api/contact**", async route => {
    posts++;
    if (response.hold) await new Promise(resolve => { release = resolve; });
    await route.fulfill({ status: response.status, contentType: "application/json", body: JSON.stringify(response.body) });
  });
  await page.goto(`${BASE}/${locale}/contact?fcap=1`, { waitUntil: "networkidle" });
  await page.waitForSelector(".contact-card");
  return { page, ctx, errors, posts: () => posts, reply: r => { response = r; }, release: () => release?.() };
}
/** The card shows every field of a track at once, so there is nothing to
 *  advance through — `next` now only has to reach a control. It stays a helper
 *  because the companion captures below are ABOUT the reader moving through the
 *  form, and each stop is still a place the avatar is asked to react to. */
async function focusField(page, track, field) {
  await page.locator(`#contact-${track}-${field}`).scrollIntoViewIfNeeded();
  await page.locator(`#contact-${track}-${field}`).focus();
  await page.waitForTimeout(650);
}
try {
  const app = await setup();
  const p = app.page;
  await p.waitForSelector('.companion[data-companion="live"]');
  await p.waitForTimeout(1700);
  const cyan = await color(p);
  assert.equal(await p.locator(".companion").getAttribute("aria-hidden"), "true");
  assert.equal(await p.locator(".companion button, .companion a, .companion [tabindex]").count(), 0);
  assert.equal(await p.locator(".companion").evaluate(el => getComputedStyle(el).pointerEvents), "none");
  await shot(p, "01-desktop-idle");

  const box = await p.locator(".cp-carrier").boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await p.mouse.move(cx, cy);
  await mood(p, "curious");
  await p.mouse.down(); await mood(p, "surprised"); await p.mouse.up();
  await p.waitForTimeout(300);
  await shot(p,"02-surprised");
  await p.mouse.down(); await p.mouse.up(); await mood(p,"playful");
  await p.mouse.down(); await p.mouse.up(); await mood(p,"laughing");
  await p.waitForTimeout(450); await shot(p,"03-laughing");
  await p.mouse.down(); await p.mouse.up(); await mood(p,"starstruck");
  await p.waitForTimeout(350); await shot(p,"03b-starstruck");
  await p.mouse.down(); await p.mouse.up(); await mood(p,"dizzy");
  await p.waitForTimeout(2000);
  await p.mouse.down(); await p.waitForTimeout(950); await mood(p,"scared");
  await p.waitForTimeout(650); await mood(p,"squished");
  await shot(p,"03c-squished");
  await p.waitForTimeout(400); await p.mouse.up(); await mood(p,"embarrassed");
  await mood(p,"relieved");
  // Short, gentle strokes stay inside the actual silhouette; distance and
  // speed arrive through native pointer events rather than forcing a mood.
  for (let i=0; i<12; i++) {
    const body = await p.locator('.cp-carrier').boundingBox();
    await p.mouse.move(body.x + body.width / 2 + (i % 2 ? 11 : -11), body.y + body.height / 2);
    await p.waitForTimeout(90);
  }
  await mood(p,"affectionate");
  await p.waitForTimeout(350); await shot(p,"03d-affectionate");
  await mood(p,"smitten");
  await p.evaluate(() => window.dispatchEvent(new PointerEvent("pointercancel")));
  await p.mouse.move(1350,900);
  good("hover, five-tap sequence, stars, dizziness, held squash, release, heart eyes and pointer cancellation");

  // CHOOSING A DIRECTION is the track switch now, and it is still a radio
  // group, so the keyboard gesture is unchanged: focus a tab, press an arrow.
  // The companion answers a choice with `proud` and a change of track with
  // `excited`, exactly as it answered the intent chips and the stage advance.
  await p.locator('.contact-tab input[value="project"]').focus();
  await p.keyboard.press("ArrowRight");
  await mood(p,"proud"); await p.waitForTimeout(450);
  assert.notEqual(await color(p),cyan);
  await shot(p,"04-proud-keyboard");
  await mood(p,"excited");
  await shot(p,"04b-excited-switch");
  // Back to Projetos, because every capture below is of that track's fields.
  await p.locator('.contact-tab:has(input[value="project"])').click();
  await p.waitForTimeout(900);
  await focusField(p,"project","message");
  await p.waitForTimeout(1900);
  await p.locator("#contact-project-message").fill("We want to connect our website, customer journeys, and internal operations into one coherent digital system, with clear measurement.");
  await mood(p,"thinking");
  await shot(p,"05-thinking");
  await p.locator("#contact-project-message").fill("We want to connect our website, customer journeys, and internal operations into one coherent digital system, with clear measurement. We also want clear ownership for each part of the customer experience.");
  await mood(p,"eureka");
  await shot(p,"05b-eureka");
  await focusField(p,"project","firstName");
  await p.locator("#contact-project-firstName").fill("Avatar");
  await p.locator("#contact-project-lastName").fill("Review");
  await p.locator("#contact-project-email").fill("invalid.example");
  // This form validates on blur. Let the inline errors finish moving the
  // submit button before pressing it, so this exercises an actual submit.
  await p.locator("#contact-project-email").press("Tab");
  await p.waitForTimeout(450);
  await p.locator("form[data-track='project'] .contact-submit").click(); await mood(p,"confused");
  await p.waitForTimeout(350); await shot(p,"06-confused");
  await p.locator("form[data-track='project'] .contact-submit").click(); await mood(p,"angry");
  await p.waitForTimeout(600); await shot(p,"07-angry");
  assert.ok(Number(await p.locator(".companion").evaluate(el=>el.style.getPropertyValue("--cp-warm"))) > .7);
  assert.equal(app.posts(),0);
  await p.locator("#contact-project-email").fill("avatar-review@example.com");
  await mood(p,"happy"); await shot(p,"08-forgiven");
  good("keyboard choices, step reactions, typing, repeated refusals and immediate forgiveness");

  app.reply({status:500,body:{ok:false,error:"delivery"},hold:true});
  await p.locator("form[data-track='project'] .contact-submit").click(); await mood(p,"working");
  assert.ok(await p.locator("form[data-track='project'] .contact-submit").isDisabled());
  await shot(p,"09-working");
  app.release(); await mood(p,"sad");
  await p.waitForTimeout(400); await shot(p,"10-sad");
  app.reply({status:200,body:{ok:true,delivered:true}});
  await p.locator("form[data-track='project'] .contact-submit").click(); await mood(p,"celebrate");
  await p.waitForTimeout(450); await shot(p,"11-celebrate");
  await mood(p,"proud"); await mood(p,"happy");
  good("busy outranks play; failure, retry and confirmed success drive distinct sequences");
  assert.deepEqual(app.errors,[]);
  await app.ctx.close();

  const idle = await setup();
  await idle.page.clock.install();
  await idle.page.clock.fastForward(46000);
  await idle.page.clock.runFor(700);
  await mood(idle.page,"sleeping");
  await shot(idle.page,"12-sleeping");
  await idle.page.mouse.move(1300,500);
  await idle.page.clock.runFor(200); await mood(idle.page,"waking");
  await idle.page.clock.resume();
  // The live OS preference must park and restore this layer, not just work on
  // initial load. Cleanup restores the identical server-rendered contours.
  await idle.page.emulateMedia({reducedMotion:"reduce"});
  await idle.page.waitForFunction(()=>!document.querySelector(".companion").hasAttribute("data-companion"));
  const rest = await idle.page.locator(".cp-body").getAttribute("d");
  await idle.page.waitForTimeout(500);
  assert.equal(await idle.page.locator(".cp-body").getAttribute("d"),rest);
  await idle.page.emulateMedia({reducedMotion:"no-preference"});
  await idle.page.waitForSelector(".companion[data-companion]");
  good("idle sleep and wake; reduced-motion toggles restore the still pose and resume cleanly");
  await idle.ctx.close();

  for (const [width,height,locale] of [[390,844,"pt"],[320,740,"en"],[768,1024,"pt"]]) {
    const mobile = await setup({viewport:{width,height},hasTouch:true,isMobile:width<500},locale);
    const page = mobile.page;
    await page.waitForSelector(".companion[data-companion]");
    assert.equal(await page.locator(".companion").getAttribute("data-follow"),"docked");
    await page.locator(".cp-body").tap(); await mood(page,"surprised");
    await page.waitForTimeout(150); await shot(page,`mobile-${width}`);
    await focusField(page,"project","message");
    await page.locator("#contact-project-message").fill("This is a local test of the companion and the contact journey.");
    await focusField(page,"project","firstName");
    await page.locator("#contact-project-firstName").fill("Mobile");
    await page.locator("#contact-project-lastName").fill("Review");
    await page.locator("#contact-project-email").fill("mobile-review@example.com");
    mobile.reply({status:202,body:{ok:true,accepted:true,delivered:false,pending:true}});
    await page.locator("form[data-track='project'] .contact-submit").click();
    await page.waitForSelector(".contact-pending");
    await page.locator(".companion").scrollIntoViewIfNeeded();
    await page.waitForTimeout(650);
    await mood(page,["searching","hopeful","patient"]);
    assert.equal(await page.locator(".contact-success").count(),0);
    if (width === 390) {
      // A hidden track retains its response. It must not make a different
      // track's active form look like it is still waiting for delivery.
      await page.locator('.contact-tab:has(input[value="advisory"])').click();
      await page.locator(".companion").scrollIntoViewIfNeeded();
      await mood(page,"proud");
      await mood(page,"excited");
      assert.equal(await page.locator('.contact-slot[data-active] .contact-pending').count(),0);
      assert.equal(await page.locator('.contact-pending').count(),1);
      good("a hidden track's pending state does not override the selected track");
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    assert.deepEqual(mobile.errors,[]);
    await mobile.ctx.close();
    good(`${width}px ${locale}: touch, full form, pending truth, scroll return and no overflow`);
  }
  for (const options of [{javaScriptEnabled:false},{reducedMotion:"reduce"}]) {
    const ctx = await browser.newContext({viewport:{width:390,height:844},...options});
    const page = await ctx.newPage();
    await page.goto(`${BASE}/pt/contact?fcap=1`);
    await page.waitForTimeout(650);
    assert.ok((await page.locator(".cp-body").getAttribute("d")).length>200);
    assert.equal(await page.locator(".companion[data-companion]").count(),0);
    assert.equal(await page.locator(".cp-carrier").evaluate(el=>getComputedStyle(el).position),"static");
    await shot(page, options.javaScriptEnabled===false ? "no-js" : "reduced-motion");
    await ctx.close();
  }
  good("no-JS and reduced motion retain the complete decorative rest pose");
  fs.writeFileSync(`${OUT}/report.json`,JSON.stringify({result:"pass",checks:notes},null,2));
  console.log("COMPANION PAGE: all checks passed");
} finally { await browser.close(); }
