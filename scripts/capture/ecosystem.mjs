import fs from "node:fs";
import { chromium } from "playwright";
import { LAUNCH } from "../support/launch.mjs";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = "captures/ecosystem";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(LAUNCH);
const results = [];
for (const [tag, width, height, lang] of [["desktop",1440,900,"pt"],["mobile",390,844,"pt"],["mobile-en",390,844,"en"]]) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(`${BASE}/${lang}?ftier=full`,{waitUntil:"load"});
  await page.waitForSelector('[data-eco-live]',{timeout:30000});
  await page.waitForFunction(()=>document.querySelector('[data-field-ready="true"]'),{timeout:30000});
  await page.waitForTimeout(1500);
  for (const [name,p] of [["identity",.16],["growth",.43],["operation",.70],["connected",.97]]) {
    const target = await page.evaluate(p=>{
      const r=document.querySelector('.eco-runway');
      return r.getBoundingClientRect().top+scrollY+(r.offsetHeight-innerHeight)*p;
    },p);
    for (let attempt=0;attempt<8;attempt++) {
      await page.mouse.wheel(0,target-await page.evaluate(()=>scrollY));
      await page.waitForTimeout(750);
      if (Math.abs(await page.evaluate(()=>scrollY)-target)<6) break;
    }
    console.log(tag,name,"target",target,"actual",await page.evaluate(()=>scrollY));
    await page.waitForTimeout(900);
    await page.screenshot({path:`${OUT}/${tag}-${name}.png`});
    results.push(await page.evaluate(({tag,name})=>{
      const s=document.querySelector('.eco-stage');
      const active=[...document.querySelectorAll('.eco-panel')].filter(e=>!e.inert);
      const box=active[0].getBoundingClientRect();
      const nav=document.querySelector('.eco-navigation').getBoundingClientRect();
      return {tag,name,p:s.style.getPropertyValue('--eco-p'),beat:s.dataset.ecoBeat,active:active.length,
        overflow:document.documentElement.scrollWidth>innerWidth,
        panel:{left:box.left,top:box.top,right:box.right,bottom:box.bottom},navTop:nav.top,
        title:active[0].querySelector('h3').textContent};
    },{tag,name}));
  }
  results.push({tag,errors});
  await ctx.close();
}
fs.writeFileSync(`${OUT}/inspection.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
await browser.close();
