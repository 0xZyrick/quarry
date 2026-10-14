"use client";
import {motion} from "framer-motion";
import {useState} from "react";
import {REASONS,Reason} from "@/lib/reasons";
import {sendReport} from "@/lib/safety";
// One sheet for reporting a stream or a person. Reporter identity is never shown to the creator.
export default function ReportSheet({room,kind,target,onClose}:{room:string;kind:"stream"|"user";target?:string;onClose:()=>void}){
  const [reason,setReason]=useState<Reason|null>(null),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
  const submit=async()=>{if(!reason)return;setBusy(true);const r=await sendReport(room,kind,reason,target);setBusy(false);
    setMsg(r.ok?(r.json.status==="held"?"Thanks. This has been put on hold for review.":"Thanks. A moderator will review it."):r.status===401?"Sign in to report.":r.json.error??"Could not send.");
    if(r.ok)setTimeout(onClose,1600)};
  return <motion.div role="dialog" aria-label="Report" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} onPointerDown={e=>e.stopPropagation()}
    className="glass rounded-xl p-3 w-72 text-xs space-y-2 absolute z-50 right-4 top-24">
    <div className="font-mono text-[10px] text-neutral-400">REPORT {kind==="user"?`@${target}`:"THIS STREAM"}</div>
    <div className="space-y-1">{(Object.keys(REASONS) as Reason[]).map(k=>
      <label key={k} className="flex gap-2 items-start cursor-pointer"><input type="radio" name="reason" checked={reason===k} onChange={()=>setReason(k)} className="mt-0.5"/>
        <span className={REASONS[k].severe?"text-risk":""}>{REASONS[k].label}</span></label>)}</div>
    {msg&&<div role="status" className="text-[10px] text-community">{msg}</div>}
    <div className="flex items-center gap-2"><a href="/guidelines" target="_blank" className="text-[10px] text-neutral-400 underline">Community guidelines</a>
      <button onClick={onClose} className="btn ml-auto text-neutral-400 hover:text-white">Cancel</button>
      <button onClick={submit} disabled={!reason||busy} className="btn rounded-full bg-risk text-black px-3 py-1 font-semibold disabled:opacity-40">Report</button></div>
  </motion.div>;
}
