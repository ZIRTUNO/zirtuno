/** S7 real-scroll captures: shared stage, actual masks, settled physics. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { LAUNCH } from '../support/launch.mjs';
import { originStop, originSnapshot } from '../support/origin-browser.mjs';
const BASE=process.env.BASE??'http://localhost:3000';
const OUT=process.env.OUT??'captures/origin-rebuild';
const W=Number(process.env.W??1440),H=Number(process.env.H??900);
const LOC=process.env.LOC??'en';
const TAG=process.env.TAG??`${LOC}-${W}`;
const STOPS=(process.env.STOPS??'0.07,0.25,0.43,0.61,0.68,0.82,0.96').split(',').map(Number);
fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch(LAUNCH);
try {
  const context=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:1});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${BASE}/${LOC}?ftier=full${process.env.Q??''}`,{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('.liquid-journey')?.dataset.fieldReady==='true');
  await page.evaluate(()=>document.fonts.ready);
  await page.mouse.move(-20,-20);
  const report=[];
  for(const p of STOPS){
    await originStop(page,p,Number(process.env.WAIT??1800));
    const row=await originSnapshot(page);
    await page.screenshot({path:`${OUT}/${TAG}-${Math.round(p*100).toString().padStart(2,'0')}.png`});
    assert.equal(row.canvas,1);
    assert.equal(row.originCanvas,0);
    assert.ok(row.originOverflow<=1, `Origin overflow ${row.originOverflow}`);
    assert.ok(row.visible.length<=1,'copy beats never overlap');
    for(const v of row.visible){
      assert.ok(v.top>=80 && v.bottom<=H+2,`copy fits: ${JSON.stringify(v)}`);
      assert.ok(v.left>=0 && v.right<=W+1,'copy fits horizontally');
    }
    report.push(row);
    console.log(JSON.stringify(row));
  }
  assert.deepEqual(errors,[],'no runtime errors');
  fs.writeFileSync(`${OUT}/${TAG}.json`,JSON.stringify(report,null,2));
} finally { await browser.close(); }
