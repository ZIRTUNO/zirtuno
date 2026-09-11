// Live Services reading stops and bridges, using the production page canvas.
import fs from 'node:fs';
import {chromium} from 'playwright';
import {LAUNCH} from '../support/launch.mjs';
const OUT=process.env.OUT||'captures/mobile-morphs';
const BASE=process.env.BASE_URL||'http://localhost:3000';
const LOCALE=process.env.LOCALE||'pt';
const profiles=(process.env.PROFILES||'320x568,390x844,430x932,768x1024,844x390,1440x900').split(',').map(s=>s.split('x').map(Number));
const browser=await chromium.launch(LAUNCH);const results=[];
fs.mkdirSync(OUT,{recursive:true});
try {
 for(const [width,height] of profiles){
  const page=await browser.newPage({viewport:{width,height},hasTouch:width<960});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${BASE}/${LOCALE}?ftier=full`,{waitUntil:'load'});
  await page.waitForFunction(()=>window.__scenes?.site);await page.waitForTimeout(2000);
  const canvas=await page.locator('.journey-canvas canvas').elementHandle();
  const centers=await page.locator('#services .pillar').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return r.top+scrollY+r.height/2-innerHeight/2;}));
  for(let k=0;k<13;k++){
   const index=Math.floor(k/2),rest=k%2===0;
   const y=rest?centers[index]:(centers[index]+centers[index+1])/2;
   for(let n=0;n<3;n++){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(150);}
   await page.waitForTimeout(900);
   const state=await page.evaluate(({index,rest})=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom};};
    const pillar=document.querySelectorAll('#services .pillar')[index];
    const s=window.__scenes.site,o=window.__optics;
    return {index,rest,a:s.pairA,b:s.pairB,m:s.pairM,stage:rect(pillar.querySelector('.pillar-stage')),copy:rect(pillar.querySelector('.pillar-copy')),copyOpacity:Number(getComputedStyle(pillar.querySelector('.pillar-copy')).opacity),overflow:document.documentElement.scrollWidth-innerWidth,glass:o.glass,forms:[o.formA,o.formB],errors:[]};
   },{index,rest});
   state.sameCanvas=await canvas.evaluate(e=>e===document.querySelector('.journey-canvas canvas'));
   const name=`${width}x${height}-${String(k+1).padStart(2,'0')}-${rest?'rest':'bridge'}`;
   await page.screenshot({path:`${OUT}/${name}.png`});
   results.push({width,height,...state,errors:[...errors]});
   console.log(JSON.stringify(results.at(-1)));
  }
  if(width===390){
   const summary=page.locator('#services .pillar summary').first();
   await summary.focus();
   await page.waitForTimeout(250);
   const focused=await summary.evaluate(e=>Number(getComputedStyle(e.closest('.pillar-copy')).opacity)===1);
   await page.keyboard.press('Enter');await page.waitForTimeout(1200);
   const opened=await summary.evaluate(e=>e.parentElement.open&&Number(getComputedStyle(e.closest('.pillar-copy')).opacity)===1);
   if(!focused||!opened)throw new Error('Focused/open mobile service copy must remain readable');
   console.log('PASS: keyboard focus and opened details retain readable copy');
  }
  await page.close();
 }
 for(const mode of ['reduced','no-js','no-webgl']){
  const page=await browser.newPage({viewport:{width:390,height:844},javaScriptEnabled:mode!=='no-js',reducedMotion:mode==='reduced'?'reduce':'no-preference'});
  await page.goto(`${BASE}/${LOCALE}${mode==='no-webgl'?'?ftier=none':''}`,{waitUntil:'load'});
  await page.waitForTimeout(1500);
  const readable=await page.locator('#services .pillar-copy').evaluateAll(es=>es.length===7&&es.every(e=>getComputedStyle(e).opacity==='1'));
  if(!readable)throw new Error(`${mode} service copy must stay fully visible`);
  console.log(`PASS: ${mode} complete Services reading path`);await page.close();
 }
}finally{await browser.close();fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(results,null,2));}
const bad=results.filter(r=>r.overflow>1||!r.sameCanvas||r.errors.length||(r.rest&&(r.copyOpacity<.98||(r.m>.85?r.b:r.m<.15?r.a:-1)!==r.index+1)));
console.log(`MOBILE MORPHS: ${results.length} states, ${bad.length} failures`);process.exitCode=bad.length?1:0;
