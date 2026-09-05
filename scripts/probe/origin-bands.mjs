/** S7 pinned-copy regression matrix. The old five independent sticky bands
 * have been replaced by one stage and five non-overlapping GSAP wipes. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { LAUNCH } from '../support/launch.mjs';
import { originStop, originSnapshot } from '../support/origin-browser.mjs';
const BASE=process.env.BASE??'http://localhost:3000';
const W=Number(process.env.W??1440),H=Number(process.env.H??900);
const LOC=process.env.LOC??'en';
const browser=await chromium.launch(LAUNCH);
try {
 const page=await browser.newPage({viewport:{width:W,height:H}});
 await page.goto(`${BASE}/${LOC}?ftier=full`,{waitUntil:'load'});
 await page.waitForFunction(()=>!!window.__scenes);
 for(const [p,beat] of [[.07,'force'],[.25,'direction'],[.43,'convergence'],[.68,'identity'],[.86,'continuation']]){
  await originStop(page,p,500);
  const row=await originSnapshot(page);
  assert.deepEqual(row.visible.map(v=>v.beat),[beat]);
  const b=row.visible[0];
  assert.ok(b.bottom<=H+1 && b.top>80,`${beat} fits at ${W}x${H}`);
  if(beat==='identity') assert.ok(b.top>H*.59,'copy clears the exact mark');
  if(beat==='continuation' && W>1000) assert.ok(b.left>W*.54,'purpose stays beside the mark');
  assert.ok(row.originOverflow<=1);
 }
 // Pausing the score does not pause the simulation.
 await originStop(page,.3,600);
 const a=await page.evaluate(()=>({frames:window.__optics.frames,balls:Array.from(window.__optics.balls).slice(0,144),p:window.__scenes.origin.p}));
 await page.waitForTimeout(900);
 const b=await page.evaluate(()=>({frames:window.__optics.frames,balls:Array.from(window.__optics.balls).slice(0,144),p:window.__scenes.origin.p}));
 assert.ok(Math.abs(a.p-b.p)<.001 && b.frames>a.frames,'held score keeps drawing');
 assert.ok(a.balls.some((v,i)=>Math.abs(v-b.balls[i])>.001),'held score keeps moving liquid');
 // Opposed clauses expose stationary type; reverse scroll retraces the crop.
 const clips=[];
 for(const p of [.365,.39,.425,.39]){
  await originStop(page,p,1100);
  clips.push(await page.locator('.origin-type--clause-0').evaluate(el=>({clip:getComputedStyle(el).clipPath,transform:getComputedStyle(el).transform,opacity:getComputedStyle(el).opacity})));
 }
 assert.notEqual(clips[0].clip,clips[1].clip);
 assert.notEqual(clips[1].clip,clips[2].clip);
 const crop=c=>Number(c.clip.match(/([\d.]+)%/)[1]);
 assert.ok(Math.abs(crop(clips[1])-crop(clips[3]))<1,'reverse restores the crop within the real scroll rounding tolerance');
 assert.ok(clips.every(c=>c.transform==='none' && c.opacity==='1'),'type keeps a stable baseline and full ink');
 // Static, no-JS, reduced and short viewports retain every beat in document order.
 for(const mode of ['static','reduced','nojs','short']){
  const ctx=await browser.newContext({viewport:mode==='short'?{width:844,height:390}:{width:W,height:H},javaScriptEnabled:mode!=='nojs',reducedMotion:mode==='reduced'?'reduce':'no-preference'});
  const fallback=await ctx.newPage();
  await fallback.goto(`${BASE}/${LOC}${mode==='static'?'?ftier=none':''}`,{waitUntil:'load'});
  const boxes=await fallback.locator('#name .origin-copy').evaluateAll(els=>els.map(el=>({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,clip:getComputedStyle(el).clipPath,text:el.textContent})));
  assert.equal(boxes.length,5);
  for(let i=0;i<boxes.length;i++){
    assert.equal(boxes[i].clip,'none',`${mode} copy unmasked`);
    assert.ok(boxes[i].text.length>20);
    if(i) assert.ok(boxes[i].top>=boxes[i-1].bottom,`${mode} preserves reading order`);
  }
  await ctx.close();
 }
 console.log(`ORIGIN_BANDS ${LOC} ${W}x${H}: live beats, clearances, static, reduced, no-JS PASS`);
} finally { await browser.close(); }
