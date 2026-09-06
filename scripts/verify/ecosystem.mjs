// S3: reversible reading, native input, contained type, complete fallbacks.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { LAUNCH } from '../support/launch.mjs';
import { ecosystemFlow } from '../../lib/webgl/ecosystem-flow.mjs';
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const out = new Float64Array(5), dest = [.4, .6, .025];
for (let i=0;i<48;i++) {
  for (let p=0;p<=1;p+=.005) {
    ecosystemFlow(out,i,p,17,dest);
    assert([...out].every(Number.isFinite));
    assert(out[2]>0 && out[2]<.05);
  }
  ecosystemFlow(out,i,1,17,dest);
  assert.deepEqual([...out].slice(0,3),dest,'S4 source endpoint is exact');
}
console.log('PASS: finite field, positive bounded radii, exact S4 source');
const browser=await chromium.launch(LAUNCH);
const errors=[], reports=[];
let failures=0;
const check=(ok,name,detail='')=>{
  console.log(`${ok?'PASS':'FAIL'}: ${name} ${detail}`);
  if(!ok) failures++;
};
const seek=async(page,p)=>{
  const y=await page.evaluate(p=>{
    const r=document.querySelector('.eco-runway'),s=r.querySelector('.eco-stage');
    return r.getBoundingClientRect().top+scrollY+(r.offsetHeight-s.offsetHeight)*p;
  },p);
  for(let i=0;i<10;i++){
    await page.mouse.wheel(0,y-await page.evaluate(()=>scrollY));
    await page.waitForTimeout(650);
    if(Math.abs(y-await page.evaluate(()=>scrollY))<3) break;
  }
  await page.waitForTimeout(350);
};
fs.mkdirSync('captures/ecosystem',{recursive:true});
for(const [width,height,locale] of [[1440,900,'pt'],[390,844,'pt'],[375,667,'en'],[768,1024,'pt']]){
  const ctx=await browser.newContext({viewport:{width,height},hasTouch:width<1024});
  const page=await ctx.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${BASE}/${locale}?ftier=full`,{waitUntil:'load'});
  await page.waitForSelector('[data-eco-live]');
  const canvas=await page.locator('.journey-canvas canvas').elementHandle();
  for(const [p,beat] of [[.16,0],[.43,1],[.70,2],[.97,3],[.43,1],[.16,0]]){
    await seek(page,p);
    const info=await page.evaluate(()=>{
      const active=[...document.querySelectorAll('.eco-panel')].filter(e=>!e.inert);
      const nav=document.querySelector('.eco-navigation').getBoundingClientRect();
      const children=[...active[0].children].map(e=>e.getBoundingClientRect());
      return {beat:+document.querySelector('.eco-stage').dataset.ecoBeat,active:active.length,
        contained:children.every(r=>r.left>=0&&r.right<=innerWidth+1&&r.bottom<nav.top),
        title:active[0].querySelector('h3').textContent,
        documentWidth:document.documentElement.scrollWidth,width:innerWidth,
        outside:[...document.querySelectorAll('#ecosystem *')].filter(e=>{
          if(e.closest('[inert]')||getComputedStyle(e).display==='none')return false;
          const r=e.getBoundingClientRect();return r.width&&(r.left < -1||r.right>innerWidth+1);
        }).map(e=>e.className).slice(0,8)};
    });
    check(info.beat===beat&&info.active===1,`${width}x${height} reversible beat ${beat}`);
    check(info.contained&&info.outside.length===0,`${width}x${height} content fits above controls`,JSON.stringify(info));
    reports.push({width,height,p,...info});
  }
  const summary=page.locator('.eco-panel:not([inert]) summary').first();
  if(width<1024)await summary.tap();else await summary.click();
  await page.waitForTimeout(150);
  check(await page.locator('#ecosystem details[open]').count()===1,`${width} disclosure opens`);
  const explanation=await page.locator('#ecosystem details[open] > p').boundingBox();
  check(explanation&&explanation.x>=0&&explanation.x+explanation.width<=width+1&&explanation.y+explanation.height<height-55,`${width} explanation stays in viewport`,JSON.stringify(explanation));
  await page.screenshot({path:`captures/ecosystem/${width}-disclosure.png`});
  await summary.press('Enter');
  check(await page.locator('#ecosystem details[open]').count()===0,`${width} keyboard closes disclosure`);
  await page.locator('[data-eco-step="2"]').click();
  await page.waitForTimeout(1600);
  check(await page.locator('.eco-stage').getAttribute('data-eco-beat')==='2',`${width} chapter control scrolls to operation`);
  check(await page.evaluate(el=>el===document.querySelector('.journey-canvas canvas'),canvas),`${width} same liquid canvas throughout`);
  if(width===390){
    const before=await page.evaluate(()=>window.__optics.frames);
    await page.waitForTimeout(700);
    check(await page.evaluate(()=>window.__optics.frames)>before,'liquid keeps rendering at rest');
    await page.evaluate(()=>{
      const canvas=document.querySelector('.journey-canvas canvas');
      window.__ecoLoss=canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
      window.__ecoLoss.loseContext();
    });
    await page.waitForTimeout(400);
    check(await page.locator('.eco-visual-fallback').isVisible(),'S3 context loss reveals its static sculpture');
    await page.evaluate(()=>window.__ecoLoss.restoreContext());
    await page.waitForFunction(()=>document.querySelector('[data-field-ready="true"]'));
  }
  await ctx.close();
}
for(const [name,opts,query] of [
  ['reduced',{reducedMotion:'reduce'},''],
  ['no-js',{javaScriptEnabled:false},''],
  ['no-webgl',{},'?ftier=none'],
  ['short',{viewport:{width:320,height:568}},'?ftier=full'],
]){
  const ctx=await browser.newContext({viewport:{width:390,height:844},...opts});
  const page=await ctx.newPage();
  await page.goto(`${BASE}/pt${query}`,{waitUntil:'load'});
  await page.waitForTimeout(1000);
  const info=await page.evaluate(()=>({live:!!document.querySelector('[data-eco-live]'),
    titles:document.querySelectorAll('.eco-panel h3').length,
    capabilities:document.querySelectorAll('.eco-capability').length,
    hidden:document.querySelectorAll('.eco-panel[inert]').length,
    clipped:[...document.querySelectorAll('.eco-panel')].some(e=>getComputedStyle(e).clipPath!=='none')}));
  check(!info.live&&info.titles===4&&info.capabilities===10&&!info.hidden&&!info.clipped,`${name} complete reading path`,JSON.stringify(info));
  await page.locator('.eco-panel').first().scrollIntoViewIfNeeded();
  await page.screenshot({path:`captures/ecosystem/${name}.png`});
  await ctx.close();
}
check(errors.length===0,'no runtime errors',errors.join('; '));
await browser.close();
fs.writeFileSync('captures/ecosystem/verification.json',JSON.stringify({failures,reports,errors},null,2));
process.exitCode=failures?1:0;
