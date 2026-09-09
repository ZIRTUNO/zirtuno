// Production-preview audit. Never submits forms or follows external links.
// OUT=... BASE_URL=... node scripts/verify/site-experience.mjs
import fs from 'node:fs';
import { chromium } from 'playwright';
import { LAUNCH } from '../support/launch.mjs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = process.env.OUT || 'captures/site-experience';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(LAUNCH);
const results = [];
const profiles = [
  ['small',320,568], ['phone',390,844], ['landscape',844,390],
  ['tablet',768,1024], ['desktop',1440,900],
];
const routes = ['', '/work', '/work/juliana-delmonte', '/work/diego-santos', '/careers', '/contact', '/legal/privacy', '/legal/terms', '/legal/cookies', '/audit-missing'];
try {
  for (const [profile,width,height] of profiles) {
    const context = await browser.newContext({ viewport:{width,height}, deviceScaleFactor:1, hasTouch:width<1024 });
    // An audit must never deliver a message, even if a test adds a submit later.
    await context.route('**/api/contact**', r => r.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const locale of ['pt','en']) for (const route of routes) {
      errors.length = 0;
      const response = await page.goto(`${BASE}/${locale}${route}${route ? '' : '?ftier=full'}`,{waitUntil:'load'});
      await page.waitForFunction(() => {
        const veil=document.querySelector('.entry-veil');
        return !veil || getComputedStyle(veil).visibility==='hidden' || getComputedStyle(veil).display==='none';
      });
      await page.waitForTimeout(route ? 700 : 1800);
      await page.evaluate(()=>document.fonts.ready);
      const key = `${profile}-${locale}-${route.replaceAll('/','-') || 'home'}`;
      const state = await page.evaluate(() => {
        const W=document.documentElement.clientWidth;
        const clipped=[];
        for (const e of document.querySelectorAll('main h1,main h2,main h3,main p,main input,main textarea,main select,main button,main summary')) {
          const r=e.getBoundingClientRect(), s=getComputedStyle(e);
          if (!r.width || !r.height || s.visibility==='hidden' || e.closest('[inert],[aria-hidden="true"],.sr-only')) continue;
          if(r.left < -1 || r.right > W+1) clipped.push({tag:e.tagName,cls:e.className,text:e.textContent?.slice(0,65),left:r.left,right:r.right});
        }
        return {overflow:document.documentElement.scrollWidth-W,clipped,h1:document.querySelectorAll('main h1').length,
          images:[...document.images].filter(e=>!e.complete||e.naturalWidth===0).map(e=>e.getAttribute('src')),
          controls:[...document.querySelectorAll('input:not([type=hidden]),textarea,select')].filter(e=>e.getBoundingClientRect().width && !e.closest('[inert]')).map(e=>({id:e.id,font:parseFloat(getComputedStyle(e).fontSize)}))};
      });
      const entry = {profile,locale,route,status:response.status(),...state,errors:[...errors]};
      results.push(entry);
      if(!route || route==='/contact' || state.overflow>1 || state.clipped.length) await page.screenshot({path:`${OUT}/${key}.png`});
      console.log(JSON.stringify(entry));
      if(!route && (profile==='phone'||profile==='desktop')) {
        for(const selector of ['#problem','#ecosystem','#services .pillar','#method','#work','#name','#studio','footer']) {
          const target=page.locator(selector).first();
          if(!await target.count()) continue;
          const y=await target.evaluate(e=>Math.max(0,e.getBoundingClientRect().top+scrollY-90));
          // Native positioning is retried until Lenis has adopted the new offset.
          for(let i=0;i<3;i++){ await page.evaluate(y=>scrollTo(0,y),y); await page.waitForTimeout(180); }
          await page.waitForTimeout(650);
          await page.screenshot({path:`${OUT}/${key}-${selector.replaceAll(/[^a-z]/g,'')}.png`});
        }
      }
    }
    await context.close();
  }
} finally {
  fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(results,null,2));
  await browser.close();
}
const bad=results.filter(x=>x.overflow>1||x.clipped.length||x.errors.length||x.status!==(x.route==='/audit-missing'?404:200));
console.log(`SITE EXPERIENCE: ${results.length} route/viewports, ${bad.length} requiring review`);
process.exitCode=bad.length?1:0;
