import fs from "node:fs"; import { PNG } from "pngjs";
const STOPS = ["1_29","1_13","0_97","0_81","0_65","0_49"];
const ROWS = ["captures/s4s5-before","captures/s4s5-after"];
const SC = 4, GAP = 8;
const load = p => PNG.sync.read(fs.readFileSync(p));
const f0 = load(`${ROWS[0]}/j${STOPS[0]}.png`);
const cw = (f0.width/SC)|0, ch = (f0.height/SC)|0;
const W = cw*STOPS.length + GAP*(STOPS.length-1), H = ch*ROWS.length + GAP;
const out = new PNG({width:W, height:H}); out.data.fill(0);
for (let i=3;i<out.data.length;i+=4) out.data[i]=255;
ROWS.forEach((dir,r)=>STOPS.forEach((st,s)=>{
  const src = load(`${dir}/j${st}.png`), ox = s*(cw+GAP), oy = r*(ch+GAP);
  for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
    let a=0,b=0,c=0;
    for(let dy=0;dy<SC;dy++)for(let dx=0;dx<SC;dx++){
      const j=((y*SC+dy)*src.width+(x*SC+dx))*4; a+=src.data[j];b+=src.data[j+1];c+=src.data[j+2];}
    const n=SC*SC,k=((oy+y)*W+ox+x)*4;
    out.data[k]=a/n;out.data[k+1]=b/n;out.data[k+2]=c/n;out.data[k+3]=255;}
}));
fs.writeFileSync("captures/s4s5-compare.png", PNG.sync.write(out));
console.log(`captures/s4s5-compare.png ${W}x${H}  top=before bottom=after  stops ${STOPS.join(" ")}`);
