"use client";
import {useState} from "react";
import type {Capsule} from "@/lib/vault";
import {COLOR} from "@/lib/map";
import TileCanvas from "../mosaic/TileCanvas";
import LoopVideo from "../shared/LoopVideo";
const dur=(s:number)=>`${Math.round(s/3600)}h Live Session Log`;
// Default: the canvas mosaic of the real execution. Hover or focus: the looping hyper-lapse. Click: the audit modal.
export default function CapsuleCard({c,onOpen}:{c:Capsule;onOpen:(id:string)=>void}){
  const [hot,setHot]=useState(false),war=c.kind==="war",col=COLOR[war?"risk":"community"];
  return <button id={`capsule-${c.id}`} onClick={()=>onOpen(c.id)} onPointerEnter={()=>setHot(true)} onPointerLeave={()=>setHot(false)} onFocus={()=>setHot(true)} onBlur={()=>setHot(false)}
    aria-label={`${war?"Project":"Commons build"}: ${c.phase}. Open audit.`}
    className="btn glass group text-left rounded-xl overflow-hidden border border-line hover:border-white/30 transition-colors flex flex-col">
    <div className="flex items-center justify-between px-3 py-2 font-mono text-[10px]" style={{color:col}}>
      <span>{war?`🟠 PROJECT #${c.roomNumber}`:"🔵 COMMONS BUILD"}</span><span>{c.peerMarks} peer reviews</span></div>
    <div className="relative aspect-video bg-deep">
      <TileCanvas painter={c.painter} seed={c.seed} color={col}/>
      {c.clipUrl&&hot&&<LoopVideo src={c.clipUrl} active className="absolute inset-0 h-full w-full object-cover"/>}</div>
    <div className="px-3 py-2.5 space-y-1">
      <div className="text-sm font-medium truncate">Phase: {c.phase}</div>
      <div className="flex items-center justify-between font-mono text-[10px] text-neutral-400">
        <span>{dur(c.durationSec)}</span>
        {c.peerMarks > 0 && <span aria-label="Peer reviewed" className="grid h-5 w-5 place-items-center rounded bg-live/15 text-live shadow-[0_0_10px_#00FF6655]">✓</span>}</div></div></button>;
}
