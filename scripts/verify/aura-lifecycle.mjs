// Persistent-layout regressions: route rebinding, preference changes, resize,
// context recovery, and measured layout work. No external requests/submissions.
import fs from 'node:fs';
import { chromium } from 'playwright';
import { LAUNCH } from '../support/launch.mjs';
const BASE=process.env.BASE_URL||'http://localhost:3000';
const OUT=process.env.OUT||'captures/aura-lifecycle';
fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch(LAUNCH);
const page=await browser.newPage({viewport:{width:1280,height:800}});
const checks=[];
const check=(ok,label,detail)=>{checks.push({ok,label,detail});console.log(`${ok?'PASS':'FAIL'} ${label} ${JSON.stringify(detail??'')}`);};
await page.addInitScript(()=>{
  const original=Element.prototype.getBoundingClientRect;
  window.__auraReads=0;
  Element.prototype.getBoundingClientRect=function(...args){if(this.matches?.('.aura-vapour'))window.__auraReads++;return original.apply(this,args);};
});
try {
  await page.goto(BASE+'/pt/work');
  await page.waitForFunction(()=>window.__aura?.frames>4);
  const r0=await page.evaluate(()=>window.__auraReads);
  await page.waitForTimeout(2100);
  const reads=await page.evaluate(()=>window.__auraReads);
  check(reads-r0<=2,'settled atmosphere does not read layout every frame',reads-r0);
  await page.locator('.topbar a').first().click();
  await page.waitForURL('**/pt');
  await page.waitForTimeout(1600);
  const gate=await page.locator('.aura').evaluate(e=>getComputedStyle(e).getPropertyValue('--aura-hero').trim());
  check(Number(gate)===0,'client arrival binds the black hero gate',gate);
  // Move below the hero through ordinary keyboard scrolling.
  await page.locator('body').press('PageDown');
  await page.locator('body').press('PageDown');
  await page.waitForTimeout(1200);
  const lower=await page.locator('.aura').evaluate(e=>getComputedStyle(e).getPropertyValue('--aura-hero').trim());
  check(Number(lower)>0,'gate opens below hero after client arrival',lower);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForTimeout(300);
  const f0=await page.evaluate(()=>window.__aura?.frames);
  await page.waitForTimeout(600);
  const f1=await page.evaluate(()=>window.__aura?.frames);
  check(f0===f1,'live reduced-motion preference stops atmospheric animation',{f0,f1});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForTimeout(300);
  const f2=await page.evaluate(()=>window.__aura?.frames);
  await page.waitForTimeout(500);
  const f3=await page.evaluate(()=>window.__aura?.frames);
  check(f3>f2,'animation resumes when motion is allowed',{f2,f3});
  const supported=await page.evaluate(()=>{
    const gl=document.querySelector('.aura-vapour').getContext('webgl2');
    const ext=gl.getExtension('WEBGL_lose_context');
    if(!ext)return false;
    ext.loseContext();setTimeout(()=>ext.restoreContext(),150);return true;
  });
  await page.waitForTimeout(700);
  const c0=await page.evaluate(()=>window.__aura?.frames);
  await page.waitForTimeout(600);
  const c1=await page.evaluate(()=>window.__aura?.frames);
  check(supported&&c1>c0,'atmosphere rebuilds after context restoration',{c0,c1});
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(200);
  const size=await page.locator('.aura-vapour').evaluate(e=>({w:e.width,h:e.height,css:e.getBoundingClientRect().width,dpr:devicePixelRatio}));
  check(Math.abs(size.w-size.css*Math.min(size.dpr,2))<=1,'resize keeps atmosphere pixel density',size);
} finally {await browser.close();fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(checks,null,2));}
process.exitCode=checks.some(c=>!c.ok)?1:0;
