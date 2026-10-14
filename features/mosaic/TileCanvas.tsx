"use client";
import {useEffect,useRef} from "react";
import {painters,PainterId} from "@/lib/painters";
import {mosaicClock} from "@/lib/mosaicClock";
import {isLow,reducedMotion} from "@/lib/perf";
// A moving tile surface. It draws at a fraction of its CSS size (cheap), only while on screen, driven by the shared clock.
export default function TileCanvas({painter,seed,color,scale}:{painter:PainterId;seed:number;color:string;scale?:number}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{const c=ref.current!,g=c.getContext("2d",{alpha:false})!,sc=scale??(isLow()?.4:.65),still=reducedMotion();
    const sub={visible:false,last:0,draw:(t:number)=>painters[painter](g,c.width,c.height,t,seed,color)};
    const fit=()=>{c.width=Math.max(8,Math.round(c.clientWidth*sc));c.height=Math.max(8,Math.round(c.clientHeight*sc));sub.last=0;
      if(still&&sub.visible)sub.draw(0)};
    const ro=new ResizeObserver(fit);ro.observe(c);fit();
    const io=new IntersectionObserver(e=>{sub.visible=e[0].isIntersecting;if(sub.visible&&still)sub.draw(0)},{rootMargin:"120px"});io.observe(c);
    const rm=mosaicClock.add(sub);
    return()=>{rm();ro.disconnect();io.disconnect()}},[painter,seed,color,scale]);
  return <canvas ref={ref} aria-hidden className="absolute inset-0 w-full h-full"/>;
}
