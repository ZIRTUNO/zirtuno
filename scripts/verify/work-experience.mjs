// Phone modal geometry + real pointer/keyboard dismissal and render work.
import fs from 'node:fs';
import { chromium } from 'playwright';
import { LAUNCH } from '../support/launch.mjs';
const BASE=process.env.BASE_URL||'http://localhost:3000';
const OUT=process.env.OUT||'captures/work-experience';
fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch(LAUNCH);
const results=[];
try {
  for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1440,900]]) {
    const page=await browser.newPage({viewport:{width,height},hasTouch:width<1024});
    await page.goto(BASE+'/pt/work');
    await page.waitForTimeout(3600);
    await page.evaluate(()=>{
      window.__cardMutations=0;
      new MutationObserver(records=>{window.__cardMutations+=records.length;}).observe(document.querySelector('.zw-card'),{attributes:true,attributeFilter:['style']});
    });
    await page.locator('.zw-card').first().click();
    await page.waitForTimeout(1800);
    const state=await page.evaluate(()=>{
      const p=document.querySelector('.zw-panel'), b=document.querySelector('.zw-chip');
      const pr=p.getBoundingClientRect(), r=b.getBoundingClientRect();
      const copy=document.querySelector('.zw-copy'), cr=copy.getBoundingClientRect();
      const first=copy.firstElementChild.getBoundingClientRect();
      return {width:innerWidth,height:innerHeight,panel:{x:pr.x,y:pr.y,w:pr.width,h:pr.height},close:{x:r.x,y:r.y,w:r.width,h:r.height},
        closeFits:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,
        panelFits:pr.x>=0&&pr.y>=0&&pr.right<=innerWidth&&pr.bottom<=innerHeight,
        copyStartReachable:first.top>=cr.top-1,
        copyScrollable:copy.scrollHeight<=copy.clientHeight+1||['auto','scroll'].includes(getComputedStyle(copy).overflowY),
        cardStyleWrites:window.__cardMutations};
    });
    await page.screenshot({path:`${OUT}/${width}-panel.png`});
    const copy=page.locator('.zw-copy');
    await copy.hover();
    await page.mouse.wheel(0,600);
    await page.waitForTimeout(400);
    state.nativeScrollWorks=await copy.evaluate(e=>e.scrollHeight<=e.clientHeight+1||e.scrollTop>0);
    state.linksReachable=await copy.evaluate(e=>{
      const r=e.getBoundingClientRect();
      return [...e.querySelectorAll('a')].every(a=>{
        const ar=a.getBoundingClientRect();return ar.top>=r.top&&ar.bottom<=r.bottom+1;
      });
    });
    await page.screenshot({path:`${OUT}/${width}-links.png`});
    // Escape is tested even when a clipped close button cannot be tapped.
    await page.keyboard.press('Escape');await page.waitForTimeout(800);
    state.dismissed=await page.locator('.zw-panel').count()===0;
    state.focusReturned=await page.locator('.zw-card').first().evaluate(e=>e===document.activeElement);
    results.push(state);console.log(JSON.stringify(state));
    await page.close();
  }
} finally {await browser.close();fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(results,null,2));}
process.exitCode=results.some(x=>!x.closeFits||!x.panelFits||!x.copyStartReachable||!x.copyScrollable||!x.nativeScrollWorks||!x.linksReachable||!x.dismissed||!x.focusReturned)?1:0;
