// One shared clock for every moving tile. A single requestAnimationFrame loop draws only tiles that are on screen, at a low
// frame rate, and at most a few per frame, so a dozen live thumbnails cost about the same as one. Paused when the feed is
// not showing or the tab is hidden; reduced-motion users get a single still frame per tile instead of a loop.
import {isLow,reducedMotion} from "./perf";
export type Sub={visible:boolean;last:number;draw:(t:number)=>void};
const subs=new Set<Sub>();
let raf=0,off=false;
const hidden=()=>typeof document!=="undefined"&&document.hidden;
const loop=(now:number)=>{raf=0;if(off||hidden()||!subs.size)return;
  const low=isLow(),gap=1000/(low?8:14),max=low?2:3,due:Sub[]=[];
  subs.forEach(s=>{if(s.visible&&now-s.last>=gap)due.push(s)});
  due.sort((a,b)=>a.last-b.last); // longest-waiting first, so the cost is spread across frames
  for(let i=0;i<due.length&&i<max;i++){due[i].last=now;due[i].draw(now/1000)}
  raf=requestAnimationFrame(loop)};
const kick=()=>{if(!raf&&!off&&!hidden()&&subs.size&&!reducedMotion())raf=requestAnimationFrame(loop)};
if(typeof document!=="undefined")document.addEventListener("visibilitychange",kick);
export const mosaicClock={
  add(s:Sub){subs.add(s);kick();return()=>{subs.delete(s)}},
  setPaused(p:boolean){off=p;if(!p)kick()}};
