import assert from 'node:assert/strict';

export async function originStop(page, p, settle = 1100) {
  const y = await page.locator('.origin-journey').evaluate((el, p) =>
    el.getBoundingClientRect().top + window.scrollY + (el.offsetHeight-innerHeight)*p, p);
  for(let j=0;j<12;j++){
    const current = await page.evaluate(()=>window.scrollY);
    if(Math.abs(y-current)<2) break;
    await page.mouse.wheel(0,y-current);
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(settle);
  const actual = await page.evaluate(()=>window.__scenes.origin.p);
  assert.ok(Math.abs(actual-p)<.005,`scroll reached ${actual}, expected ${p}`);
}

export async function originSnapshot(page) {
  return page.evaluate(()=>{
    const visible=[];
    for(const el of document.querySelectorAll('#name .origin-copy')){
      const clip=getComputedStyle(el).clipPath;
      const vals=[...clip.matchAll(/([\d.]+)%/g)].map(m=>Number(m[1]));
      const shown=clip==='none'||(vals[0]??0)+(vals[1]??0)<90;
      if(!shown) continue;
      const box=el.getBoundingClientRect();
      visible.push({beat:el.closest('.origin-beat').className.match(/origin-beat--([\w]+)/)[1],
        top:box.top,bottom:box.bottom,left:box.left,right:box.right,clip,
        text:el.innerText.slice(0,130)});
    }
    const optic=window.__optics;
    return {p:window.__scenes?.origin?.p, visible,
      width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth-innerWidth,
      originOverflow: Math.max(0,...[...document.querySelectorAll('#name *')].map(el=>el.getBoundingClientRect().right-innerWidth)),
      canvas:document.querySelectorAll('.journey-canvas canvas').length,
      originCanvas:document.querySelectorAll('#name canvas').length,
      optics:optic ? {tier:optic.tier,frames:optic.frames,balls:optic.count,motes:optic.motes,tileOver:optic.tileOver} : null};
  });
}
