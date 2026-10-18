"use client";
import {motion} from "framer-motion";
import {useEffect,useRef} from "react";
import type {Capsule} from "@/lib/vault";
import TileCanvas from "../mosaic/TileCanvas";
import {COLOR} from "@/lib/map";
// The project review: the hyper-lapse on the left, project details on the right.
export default function CapsuleModal({c,preview,onClose}:{c:Capsule;preview:boolean;onClose:()=>void}){
  const close=useRef<HTMLButtonElement>(null),war=c.kind==="war",col=COLOR[war?"risk":"community"];
  useEffect(()=>{const prev=document.activeElement as HTMLElement|null;close.current?.focus();
    const k=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose()};addEventListener("keydown",k);
    return()=>{removeEventListener("keydown",k);prev?.focus()}},[onClose]);
  const row=(k:string,v:React.ReactNode)=><div className="flex justify-between gap-4 border-b border-line/60 py-1.5"><dt className="text-neutral-500">{k}</dt><dd className="text-right break-all">{v}</dd></div>;
  return <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-deep/70 backdrop-blur-md" onClick={onClose}>
    <motion.div role="dialog" aria-modal="true" aria-label={`Audit: ${c.phase}`} initial={{opacity:0,scale:.94}} animate={{opacity:1,scale:1}} transition={{duration:.18}}
      onClick={e=>e.stopPropagation()} className="glass relative w-full max-w-4xl rounded-2xl border border-line overflow-hidden grid md:grid-cols-[1.3fr_1fr] max-h-[92vh] overflow-y-auto">
      <div className="relative aspect-video md:aspect-auto md:min-h-[22rem] bg-deep">
        {c.clipUrl?<video src={c.clipUrl} controls autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" onError={e=>(e.currentTarget.style.display="none")}/>:null}
        <div className="absolute inset-0 -z-0"><TileCanvas painter={c.painter} seed={c.seed} color={col}/></div>
        <div className="absolute left-3 top-3 rounded bg-deep/80 px-2 py-0.5 font-mono text-[10px] text-community">30s HYPER-LAPSE</div></div>
      <div className="p-5 space-y-3 font-mono text-xs">
        <div className="flex items-start justify-between gap-3"><div><div className="text-[10px]" style={{color:col}}>{war?`PROJECT #${c.roomNumber}`:"COMMONS BUILD"}</div><h2 className="text-base font-sans font-semibold">{c.phase}</h2></div>
          <button ref={close} onClick={onClose} aria-label="Close audit" className="btn rounded-full border border-line px-2.5 py-0.5 text-neutral-400 hover:text-white">✕</button></div>
        {preview&&<div role="note" className="rounded border border-risk/50 bg-risk/10 px-2 py-1 text-[10px] text-risk">PREVIEW DATA. This is a sample portfolio item.</div>}
        <dl>{row("Session duration",`${Math.round(c.durationSec/3600)} hours`)}
          {row("Peer reviews",c.peerMarks)}
          {row("Proof hash (sha256)",<span title={c.proofHash}>{c.proofHash.slice(0,10)}…{c.proofHash.slice(-8)}</span>)}
          {row("Peer-audit validations",<span className="inline-flex items-center gap-1.5">{c.peerMarks}<span className="inline-flex gap-0.5" aria-hidden>{Array.from({length:Math.min(c.peerMarks,12)},(_,i)=><i key={i} className="h-2 w-1 rounded-sm bg-live/80"/>)}</span></span>)}
          {row("Skill proven",c.skill)}</dl></div></motion.div></div>;
}
