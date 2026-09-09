/** Self-contained owner review: the shipped kernels and palette, embedded as
 * ES modules. Open the resulting HTML offline; nothing is sent or fetched.
 */
import fs from "node:fs";
import { createServer } from "node:http";
import { MOOD_NAMES, EYE_POSE_NAMES, SPECIAL_MOOD_NAMES } from "../../lib/motion/companion.mjs";
const OUT = process.env.OUT ?? "captures/companion-revamp";
fs.mkdirSync(OUT, { recursive: true });
const modules = Object.fromEntries(["membrane", "companion-expressions", "companion", "companion-behavior"].map(n => [n, fs.readFileSync(`lib/motion/${n}.mjs`, "utf8")]));
const css = fs.readFileSync("app/contact.css", "utf8");
const palette = css.match(/  --cp-base: [\s\S]*?\n}/)[0].slice(0, -1);
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zirtuno — Companion expressions</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#05090b;color:#f2f0eb;font:15px/1.5 system-ui,sans-serif}button{font:inherit;color:inherit;cursor:pointer}button:focus-visible{outline:2px solid #00e3fe;outline-offset:4px}
main{max-width:1220px;margin:auto;padding:32px 30px 60px}header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ffffff18;padding-bottom:20px;font-size:13px}header strong{font-size:20px}small,.muted{color:#91a0a5}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:11px;color:#00e3fe}h1{font-size:clamp(32px,4vw,56px);line-height:1.06;letter-spacing:-.045em;font-weight:550;margin:16px 0}p{max-width:430px;color:#aeb9bd}.stage{display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:25px;min-height:420px}.preview{display:flex;flex-direction:column;align-items:center}.drawing{width:min(360px,100%);height:320px;touch-action:pan-y}.status{display:flex;gap:12px;align-items:center;font-size:12px}.status b{color:#f2f0eb;text-transform:capitalize}.status span{color:#91a0a5}.actions{display:flex;gap:10px;margin-top:24px;flex-wrap:wrap}.actions button,.tabs button{background:transparent;border:1px solid #ffffff28;border-radius:999px;padding:9px 17px}.actions button[aria-pressed=true],.tabs button[aria-selected=true]{border-color:#00e3fe;background:#00e3fe10}.tabs{display:flex;gap:10px;margin:24px 0}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.card{padding:10px 6px;background:#0c1215;border:1px solid #ffffff12;border-radius:12px;text-align:center}.card[aria-pressed=true]{border-color:#00e3fe;background:#00e3fe08}.card svg{display:block;width:100%;height:110px}.card span{display:block;text-transform:capitalize;font-size:11px}.card small{font-size:10px}.avatar{--color-cyan:#00e3fe;--color-cyan-deep:#00b6cc;--color-paper:#f2f0eb;--cp-chill:0;--cp-cool:0;--cp-warm:0;--cp-gold:0;--cp-blush:0;--cp-glow:0;${palette}}.body{fill:currentColor;fill-opacity:.065;stroke:currentColor;stroke-width:1.15;vector-effect:non-scaling-stroke}.eye{fill:currentColor;fill-opacity:.9;pointer-events:none}footer{margin-top:32px;padding-top:16px;border-top:1px solid #ffffff18;color:#849298;font-size:12px}@media(max-width:700px){main{padding:22px 18px}.stage{grid-template-columns:1fr;gap:0}.drawing{height:250px}.grid{grid-template-columns:repeat(3,1fr)}.card svg{height:100px}header .muted{display:none}h1{max-width:400px}.preview{margin-top:8px}.tabs button{font-size:12px}}
</style>
<main><header><strong>Zirtuno<span style="color:#00e3fe">.</span></strong><span class="muted">Companion / Expression study</span><span>${EYE_POSE_NAMES.length} eye styles · ${MOOD_NAMES.length} moods</span></header>
<section class="stage"><div><div class="eyebrow">A little more alive</div><h1>Small gestures.<br>A whole personality.</h1><p>Look closer. Hover, tap twice, hold, or gently stroke the droplet. Choose an emotion to explore its eyes, movement and changing colour.</p><div class="actions"><button id="interact" aria-pressed="true">Interact</button><button id="pause" aria-pressed="false">Pause motion</button><button id="reset">Reset</button></div></div><div class="preview"><svg class="drawing avatar" viewBox="-60 -60 120 120" role="img" aria-label="Interactive companion preview"><path class="body"/><path class="eye left"/><path class="eye right"/></svg><div class="status"><b id="mood">idle</b><span id="pose"></span></div></div></section>
<div class="tabs" role="tablist" aria-label="Expression collection"><button role="tab" id="moods-tab" aria-selected="true" aria-controls="collection">All moods / ${MOOD_NAMES.length}</button><button role="tab" id="special-tab" aria-selected="false" aria-controls="collection" tabindex="-1">Specials / ${SPECIAL_MOOD_NAMES.length}</button><button role="tab" id="eyes-tab" aria-selected="false" aria-controls="collection" tabindex="-1">Eyes / ${EYE_POSE_NAMES.length}</button></div><div class="grid" id="collection" role="tabpanel" aria-labelledby="moods-tab"></div>
<footer>Live geometry and colour from the website. Cyan is home; ice, coral, gold and blush carry the mood. Form reactions are tested on the contact page with local responses. No sound. No network requests.</footer></main>
<script type="module">
const modules=${JSON.stringify(modules).replace(/<\//g, "<\\/")};
const urls={};
for(const name of ['membrane','companion-expressions','companion-behavior','companion']) {
 let code=modules[name];
 for(const [dep,url] of Object.entries(urls)) code=code.replaceAll('"./'+dep+'.mjs"',JSON.stringify(url));
 urls[name]=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
}
const {makeCompanion,COMP,PARAM,MOOD_NAMES,SPECIAL_MOOD_NAMES,EYE_POSE_NAMES}=await import(urls.companion);
const {makeCompanionBehavior}=await import(urls['companion-behavior']);
const channels=['chill','cool','warm','gold','blush','glow'];
const svg=document.querySelector('.drawing'),grid=document.querySelector('.grid');
let comp=makeCompanion(1),brain=makeCompanionBehavior(0),time=0,last=0,interactive=true,paused=matchMedia('(prefers-reduced-motion:reduce)').matches,collection='moods',selected='idle',mx=0,my=0,moveAt=0,hovered=false;
const neutral={status:'idle',focused:false,typing:false,longText:false,invalid:false,crowded:false,moving:false};
function paint(c,el){el.querySelector('.body').setAttribute('d',c.bodyPath());el.querySelector('.left').setAttribute('d',c.pupilPath(-1));el.querySelector('.right').setAttribute('d',c.pupilPath(1));for(const k of channels)el.style.setProperty('--cp-'+k,Math.max(0,Math.min(1,c.params[PARAM[k]])));}
function update(){paint(comp,svg);document.querySelector('#mood').textContent=comp.expression;document.querySelector('#pose').textContent=comp.pose.replaceAll('-',' ');}
function choose(name){selected=name;interactive=false;document.querySelector('#interact').setAttribute('aria-pressed','false');if(collection!=='eyes')comp.play(name);else comp.express(name);if(paused){for(let i=0;i<100;i++){time+=1000/60;comp.step(time);}update();}for(const el of grid.children)el.setAttribute('aria-pressed',String(el.dataset.name===name));}
function cards(){grid.replaceChildren();const names=collection==='moods'?MOOD_NAMES:collection==='special'?SPECIAL_MOOD_NAMES:EYE_POSE_NAMES;names.forEach((name,i)=>{const c=makeCompanion(1);c.step(0);if(collection==='eyes')c.express(name);else c.play(name);c.aim(0,0);for(let t=0;t<600;t+=1000/60)c.step(t);const el=document.createElement('button');el.className='card';el.dataset.name=name;el.setAttribute('aria-pressed',String(name===selected));el.innerHTML='<svg class="avatar" viewBox="-60 -60 120 120" aria-hidden="true"><path class="body"/><path class="eye left"/><path class="eye right"/></svg><span>'+name.replaceAll('-',' ')+'</span>';paint(c,el.querySelector('svg'));el.onclick=()=>choose(name);grid.append(el);});}
const tabs=['moods','special','eyes'];
function setCollection(name){collection=name;for(const kind of tabs){const el=document.querySelector('#'+kind+'-tab');el.setAttribute('aria-selected',String(kind===name));el.tabIndex=kind===name?0:-1;}grid.setAttribute('aria-labelledby',name+'-tab');cards();}
for(const [i,name] of tabs.entries()){const el=document.querySelector('#'+name+'-tab');el.onclick=()=>setCollection(name);el.onkeydown=e=>{let next=i;if(e.key==='ArrowRight')next=(i+1)%3;else if(e.key==='ArrowLeft')next=(i+2)%3;else if(e.key==='Home')next=0;else if(e.key==='End')next=2;else return;e.preventDefault();setCollection(tabs[next]);document.querySelector('#'+tabs[next]+'-tab').focus();};}
document.querySelector('#interact').onclick=()=>{interactive=true;brain=makeCompanionBehavior(time);document.querySelector('#interact').setAttribute('aria-pressed','true');};
document.querySelector('#pause').onclick=e=>{paused=!paused;e.target.setAttribute('aria-pressed',String(paused));e.target.textContent=paused?'Resume motion':'Pause motion';};
document.querySelector('#reset').onclick=()=>{comp=makeCompanion(1);comp.step(time);brain=makeCompanionBehavior(time);interactive=true;document.querySelector('#interact').setAttribute('aria-pressed','true');update();};
const point=e=>{const r=svg.getBoundingClientRect(),scale=120/Math.min(r.width,r.height);return{x:(e.clientX-r.left-r.width/2)*scale,y:(e.clientY-r.top-r.height/2)*scale};};
svg.onpointermove=e=>{const p=point(e),d=Math.hypot(p.x-mx,p.y-my),speed=d/Math.max(16,time-moveAt)*1000;mx=p.x;my=p.y;moveAt=time;if(!interactive)return;comp.hand(p.x,p.y);comp.aim(p.x/60,p.y/60);brain.stroke(d,speed,true,time);};
svg.onpointerenter=()=>{hovered=true;brain.hover(true,time);};svg.onpointerleave=()=>{hovered=false;comp.hand(null);comp.release();brain.hover(false,time);};
svg.onpointerdown=e=>{if(!interactive)return;const p=point(e);brain.touch(true,time);comp.press(true);comp.strike(p.x,p.y,time);comp.poke(p.x,p.y,1.2);};
window.onpointerup=()=>{comp.press(false);if(interactive)brain.touch(false,time);};window.onpointercancel=()=>{comp.press(false);brain.cancel();};
function frame(now){const dt=last?Math.min(50,now-last):0;last=now;if(!paused&&!document.hidden){time+=dt;if(interactive)comp.play(brain.read(time,{...neutral,moving:hovered,crowded:hovered}));comp.step(time);update();}requestAnimationFrame(frame);}
const pauseButton=document.querySelector('#pause');pauseButton.setAttribute('aria-pressed',String(paused));pauseButton.textContent=paused?'Resume motion':'Pause motion';comp.step(0);comp.play('idle');update();cards();requestAnimationFrame(frame);
</script></html>`;
fs.writeFileSync(`${OUT}/review.html`, html);
console.log(`${OUT}/review.html — ${MOOD_NAMES.length} moods / ${EYE_POSE_NAMES.length} eyes / ${SPECIAL_MOOD_NAMES.length} specials`);
if (process.argv.includes("--serve")) {
  // Serve only this review document, never arbitrary workspace files.
  createServer((req, res) => {
    if (req.url !== "/") { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(fs.readFileSync(`${OUT}/review.html`));
  }).listen(3074, "127.0.0.1", () => console.log("Review: http://127.0.0.1:3074"));
}
