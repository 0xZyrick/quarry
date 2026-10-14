"use client";
import {motion,animate,useMotionValue} from "framer-motion";
import {useRef} from "react";
// Neon-green hold-to-release trigger. Extracted from the Project so the control bar can place it.
export default function HoldButton({onDone,disabled,label}:{onDone:()=>void;disabled?:boolean;label?:string}){
  const p=useMotionValue(0);const a=useRef<any>(null);
  const start=()=>{if(disabled)return;a.current=animate(p,1,{duration:.6,ease:"linear",onComplete:()=>{onDone();p.set(0)}})};
  const stop=()=>{a.current?.stop();p.set(0)};
  return <button disabled={disabled} onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} aria-label="Hold to release the milestone payment"
    onKeyDown={e=>{if((e.key===" "||e.key==="Enter")&&!e.repeat)start()}} onKeyUp={e=>{if(e.key===" "||e.key==="Enter")stop()}} onBlur={stop}
    className="btn relative overflow-hidden px-4 py-2 rounded-full border border-live text-live text-xs font-semibold hover:bg-live/10 select-none disabled:opacity-40 disabled:cursor-not-allowed">
    <motion.span className="absolute inset-0 bg-live/30 origin-left" style={{scaleX:p}}/>
    <span className="relative">🔒 {label??(disabled?"Release frozen":"Hold to Release")}</span></button>;
}
