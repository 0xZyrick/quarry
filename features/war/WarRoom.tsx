"use client";
import {motion} from "framer-motion";
import {useState} from "react";
import {useGuild,useRole} from "@/lib/store";
import ControlBar from "../room/ControlBar";
import ChatPanel from "../room/ChatPanel";
import LoopVideo from "../shared/LoopVideo";
import {BROADCAST_SRC} from "@/lib/media";
import {applyToRaid} from "@/lib/raid";
import Avatar from "../shared/Avatar";

function Timelapse({title,onClose}:{title:string;onClose:()=>void}){ // swap bars for a looping compressed clip
  return <motion.div initial={{opacity:0,scale:.96}} animate={{opacity:1,scale:1}} className="absolute inset-3 glass rounded-lg z-10 overflow-hidden">
    <div className="flex justify-between text-[10px] font-mono p-2 text-community"><span>TIME-LAPSE · {title} · 8x</span>
      <button onClick={onClose} className="btn hover:text-white">✕</button></div>
    <div className="flex items-end gap-1 h-[55%] px-3">{Array.from({length:24}).map((_,i)=>
      <motion.i key={i} className="flex-1 bg-community/70 rounded-t" animate={{height:["20%",`${30+(i*37)%60}%`,"20%"]}}
        transition={{duration:2+(i%5)*.3,repeat:Infinity,ease:"easeInOut"}}/>)}</div>
    <motion.div className="absolute bottom-0 left-0 h-1 bg-live" initial={{width:"0%"}} animate={{width:"100%"}} transition={{duration:4,repeat:Infinity,ease:"linear"}}/>
  </motion.div>;
}

export default function WarRoom(){
  const {layer,room,roomId}=useGuild(),me=useRole();
  const roleLabel=me.host?"CREATOR · HOST":me.role==="creator"?"CREATOR · VISITOR":me.role==="client"?"PROJECT OWNER":"GUEST";
  const [applying,setApplying]=useState(false),[note,setNote]=useState(""),[appState,setAppState]=useState<"idle"|"sending"|"sent"|"error">("idle");
  const send=async()=>{setAppState("sending");try{await applyToRaid(roomId,note);setAppState("sent")}catch{setAppState("error")}};
  const [tl,setTl]=useState<string|null>(null);
  return <div className="relative h-full pt-14 pb-24 px-3 grid grid-rows-[1fr_1.2fr] gap-3 md:grid-rows-1 md:grid-cols-[62fr_38fr]">
    <div className="flex flex-col gap-3 min-h-0">
      <div className="glass rounded-xl flex-1 relative grid place-items-center text-live font-mono text-xs">
        <span className="absolute top-2 left-2 z-10 flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-live pulse"/>LIVE · 1080p</span>
        <span className="absolute top-2 right-2 z-10 glass rounded-full px-2.5 py-1 text-[9px] uppercase tracking-[0.12em] text-community">{roleLabel}</span>
        <span className="opacity-40">NO SIGNAL</span><LoopVideo src={BROADCAST_SRC} active={layer===2&&room==="war"} className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-90"/>{tl&&<Timelapse title={tl} onClose={()=>setTl(null)}/>}</div>
      <div className="glass rounded-xl p-3 flex items-center gap-2">
        <span className="text-xs text-neutral-400">{me.host?"YOUR RAID":"THE BENCH"}</span>
        <div className="flex -space-x-2 ml-1">
          {["client","peer-a","peer-b"].map((h,i)=>(
            <Avatar key={h} handle={h} size={22} className="ring-1 ring-[#0D0E11]" />
          ))}
        </div>
        {["bg-community","bg-live"].map((c,i)=><div key={i} className={`w-8 h-8 rounded-full ${c}`}/>)}
        {me.apply&&<button onClick={()=>setApplying(v=>!v)} aria-expanded={applying}
          className={`btn px-3 py-1.5 rounded-full border border-dashed border-live text-xs hover:bg-live hover:text-black ${appState==="sent"?"text-neutral-400 border-line":"text-live pulse"}`}>
          {appState==="sent"?"Applied · pending":"+ Apply to Team"}</button>}
        {me.role==="client"&&<span className="ml-auto text-[10px] text-neutral-400">Applications appear here</span>}
        {me.role==="guest"&&<span className="ml-auto text-[10px] text-neutral-400">Sign in as a creator to apply</span>}
      </div>
      {applying&&me.apply&&<motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} onPointerDown={e=>e.stopPropagation()}
        className="glass rounded-xl p-3 flex flex-col gap-2">
        {appState==="sent"?<div className="text-xs text-live">Application sent. The client will see it on the bench.</div>:<>
          <label className="text-[11px] text-neutral-400" htmlFor="raid-note">Why you, and what you'd take on</label>
          <textarea id="raid-note" value={note} onChange={e=>setNote(e.target.value)} maxLength={280} rows={3}
            className="w-full rounded-lg bg-deep border border-line p-2 text-sm outline-none focus:border-live resize-none"/>
          <div className="flex items-center gap-2"><span className="font-mono text-[10px] text-neutral-400">{note.length}/280</span>
            {appState==="error"&&<span className="text-[11px] text-risk">Couldn't send. Add a note and try again.</span>}
            <button onClick={()=>setApplying(false)} className="btn ml-auto text-xs text-neutral-400 hover:text-white">Cancel</button>
            <button onClick={send} disabled={!note.trim()||appState==="sending"}
              className="btn rounded-full bg-live text-black text-xs font-semibold px-4 py-1.5 disabled:opacity-40">{appState==="sending"?"Sending…":"Send"}</button></div></>}
      </motion.div>}</div>
    <div className="min-h-0 flex-1">
      <ChatPanel className="h-full min-h-[12rem]"/>
    </div>
    <ControlBar/>
  </div>;
}
