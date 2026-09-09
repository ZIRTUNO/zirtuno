// Compare the audit's intake snapshot with its final build on the same browser.
// This writes evidence only; it never replaces the signed-off fixture.
import crypto from 'node:crypto';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {LAUNCH} from '../support/launch.mjs';
const BASE=process.env.BASE_URL||'http://localhost:3000';
const OUT=process.env.OUT||'captures/audit-rest';
fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch(LAUNCH);
const hashes=[];
try {
 const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
 for(let i=0;i<8;i++) {
  await page.goto(`${BASE}/en/lab/forms?fstate=${i}`,{waitUntil:'networkidle',timeout:120000});
  await page.addStyleTag({content:'body *{visibility:hidden!important}[data-hero-metaball],[data-hero-metaball] *{visibility:visible!important}.breath-layer{display:none!important}'});
  const stage=page.locator('[data-hero-metaball]');
  await stage.waitFor({state:'visible',timeout:30000});
  await page.waitForFunction(()=>{
   const c=document.querySelector('[data-hero-metaball] canvas');
   return c&&c.width===Math.round(c.parentElement.clientWidth*Math.min(devicePixelRatio,2))&&c.height===Math.round(c.parentElement.clientHeight*Math.min(devicePixelRatio,2));
  },null,{timeout:30000});
  await page.waitForTimeout(900);
  let prev,shot,settled=false;
  for(let attempt=0;attempt<40;attempt++) {
   shot=await stage.screenshot();
   if(prev&&Buffer.compare(prev,shot)===0){settled=true;break;}
   prev=shot;await page.waitForTimeout(250);
  }
  if(!settled)throw new Error(`State ${i} never settled`);
  fs.writeFileSync(`${OUT}/${i}.png`,shot);
  hashes.push(crypto.createHash('sha256').update(shot).digest('hex'));
  console.log(`state ${i} settled: ${hashes.at(-1)}`);
 }
 fs.writeFileSync(`${OUT}/hashes.json`,JSON.stringify(hashes,null,2));
 if(process.env.COMPARE){
  const previous=JSON.parse(fs.readFileSync(process.env.COMPARE,'utf8'));
  const same=hashes.every((hash,i)=>hash===previous[i]);
  console.log(same?'AUDIT REST: all 8 states byte-identical':'AUDIT REST: delta found');
  process.exitCode=same?0:1;
 }
} finally{await browser.close();}
