"use client";
import {AnimatePresence,motion} from "framer-motion";
import {useState} from "react";
import {useGuild,useRoomSecurity} from "@/lib/store";
import {controlsFor,CtlId,CANVAS_SOURCES,canGoLive} from "@/lib/access";
import {useRoomCtl} from "@/lib/roomCtl";
import {useRoomMedia} from "@/lib/roomMedia";
import {useChat} from "@/lib/chat";
import {useHubs} from "@/lib/hubs";
import HoldButton from "./HoldButton";
import {CTL_ICON} from "../shared/Icons";
import {PAYMENTS_ON,SOON} from "@/lib/flags";
const SKILLS=["Interior Design","Coding","Architecture","Carpentry","Mural Painting","3D Motion","Branding UI"];
// The bottom bar morphs with Role + Ownership + Room type. Nothing here picks a role; useRoomSecurity decides, the bar renders.
export default function ControlBar({tray}:{tray?:React.ReactNode}){
  const sec=useRoomSecurity(),ctl=useRoomCtl(),media=useRoomMedia(),chat=useChat(),hubs=useHubs();
  const {release,disputed,milestones,fileDispute,leaveTable}=useGuild(),greenroom=hubs.greenroom,setGreenroom=hubs.setGreenroom;
  const [canvas,setCanvas]=useState<string|null>(null),[skill,setSkill]=useState<string|null>(null),[who,setWho]=useState(""),[why,setWhy]=useState("");
  const {kind,caps,room}=sec,controls=controlsFor(kind,room.type),active=milestones.some(m=>m.status==="active");
  const live=hubs.live[room.id],gate=canGoLive({canvas,skill});
  const btn="btn glass rounded-full px-3 py-2 text-xs font-semibold hover:bg-white/10 flex items-center gap-1.5 aria-pressed:bg-live aria-pressed:text-black";
  const ico=(id:string)=>{const I=CTL_ICON[id];return I?<I size={13}/>:null};
  const on=(id:CtlId,pressed:boolean,fn:()=>void,label:string,_icon?:string)=><button key={id} aria-pressed={pressed} onClick={fn} className={btn}>{ico(id)}{label}</button>;
  const render=(c:{id:CtlId;label:string;icon:string})=>{switch(c.id){
    case"stream":return on(c.id,ctl.sheet==="stream"||live,()=>ctl.set({sheet:ctl.sheet==="stream"?null:"stream"}),live?"Live":c.label,c.icon);
    case"layout":return on(c.id,ctl.locked,()=>ctl.set({locked:!ctl.locked}),ctl.locked?"Table Locked":c.label,c.icon);
    case"crew":return on(c.id,ctl.sheet==="crew",()=>ctl.set({sheet:ctl.sheet==="crew"?null:"crew"}),c.label,c.icon);
    case"greenroom":return on(c.id,!!greenroom[room.id],()=>setGreenroom(room.id,!greenroom[room.id]),greenroom[room.id]?"Greenroom On":c.label,c.icon);
    case"voice":return on(c.id,media.micOn,()=>media.setMic(!media.micOn),media.micOn?"Mic Live":c.label,c.icon);
    case"draw":return on(c.id,ctl.draw,()=>ctl.set({draw:!ctl.draw}),c.label,c.icon);
    case"leave":return on(c.id,false,leaveTable,c.label,c.icon);
    case"release":return !PAYMENTS_ON?<HoldButton key={c.id} disabled onDone={()=>{}} label="Hold to Release · soon"/>:active?<HoldButton key={c.id} disabled={disputed} onDone={release}/>:<span key={c.id} className="text-[10px] text-neutral-400 px-2">No active milestone</span>;
    case"ptt":return <button key={c.id} aria-label="Push to talk, hold" onPointerDown={()=>media.setMic(true)} onPointerUp={()=>media.setMic(false)} onPointerLeave={()=>media.micOn&&media.setMic(false)} className={btn}>{ico(c.id)}{c.label}</button>;
    case"dispute":if(!PAYMENTS_ON)return <button key={c.id} disabled aria-disabled title={SOON} className={btn+" opacity-50 cursor-not-allowed"}><span aria-hidden>{c.icon}</span>{c.label} · soon</button>;
      return on(c.id,disputed,()=>!disputed&&ctl.set({sheet:ctl.sheet==="dispute"?null:"dispute"}),disputed?"Dispute Filed":c.label,c.icon);
    case"tip":return tray?<div key={c.id}>{tray}</div>:null;
    case"chat":return on(c.id,ctl.chatOpen,()=>ctl.set({chatOpen:!ctl.chatOpen}),c.label,c.icon);
    case"mic":{const mine=chat.slots.includes(sec.self),asked=chat.requests.includes(sec.self);
      return on(c.id,mine||asked,()=>{
        if(mine) media.setMic(!media.micOn);
        else if(asked) chat.cancelMicRequest(room.id,sec.self);
        else chat.requestMic(room.id,sec.self);
      }, mine?(media.micOn?"On Mic":"Unmute"):asked?"Cancel Request":c.label,c.icon)}}};
  return <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 max-w-[96vw]" onPointerDown={e=>e.stopPropagation()}>
    <AnimatePresence>{ctl.sheet&&caps&&<motion.div key={ctl.sheet} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="glass rounded-xl p-3 w-72 text-xs space-y-2">
      {ctl.sheet==="stream"&&caps.stream&&<>
        <div className="font-mono text-[10px] text-neutral-400">GO LIVE needs a canvas feed or a skill tag</div>
        <div className="font-mono text-[9px] text-neutral-500">Canvas source = screen capture · skill tag only = desk camera</div>
        <div className="flex flex-wrap gap-1.5">{CANVAS_SOURCES.map(s=><button key={s} aria-pressed={canvas===s} onClick={()=>setCanvas(canvas===s?null:s)} className="btn rounded-full border border-line px-2 py-1 aria-pressed:border-live aria-pressed:text-live">{s}</button>)}</div>
        <select aria-label="Hardware skill tag" value={skill??""} onChange={e=>setSkill(e.target.value||null)} className="w-full rounded bg-deep border border-line p-1.5"><option value="">No hardware skill tag</option>{SKILLS.map(s=><option key={s}>{s}</option>)}</select>
        {!gate&&<div className="text-[10px] text-risk">Camera alone can't broadcast. Pick a canvas source or a skill tag.</div>}
        {hubs.suspended[room.id]&&<div className="text-[10px] text-risk">Hidden after {hubs.flags[room.id]??0} flags. Review needed.</div>}
        <div className="flex gap-2"><button disabled={!gate||!!hubs.suspended[room.id]} onClick={async()=>{if(await hubs.goLive(room.id,{canvas,skill}))media.setPath(canvas?"digital":"physical")}} className="btn rounded-full bg-live text-black px-3 py-1 font-semibold disabled:opacity-40">{live?"Update":"Go live"}</button>
          {live&&<button onClick={()=>{void hubs.goOffline(room.id);void media.setPath(null);void media.setCam(false);void media.setMic(false)}} className="btn text-neutral-400 hover:text-white">End stream</button>}</div></>}
      {ctl.sheet==="crew"&&caps.addCrew&&<>
        <div className="font-mono text-[10px] text-neutral-400">INVITE TO THE TABLE</div>
        <div className="flex gap-2"><input value={who} onChange={e=>setWho(e.target.value)} aria-label="Crew handle" placeholder="@handle" maxLength={32} className="flex-1 rounded bg-deep border border-line px-2 py-1"/>
          <button disabled={!who.trim()} onClick={()=>{const h=who.trim().replace(/^@/,"");ctl.set({crew:[...ctl.crew,h]});setWho("");
            fetch(`/api/crew/${encodeURIComponent(room.id)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({uid:h,handle:h})}).catch(()=>{})}} className="btn text-live disabled:opacity-40">Invite</button></div>
        {!!ctl.crew.length&&<div className="text-[10px] text-neutral-400">Invited: {ctl.crew.map(c=>"@"+c).join(" ")}</div>}</>}
      {ctl.sheet==="dispute"&&caps.dispute&&<>
        <div className="font-mono text-[10px] text-risk">FILE A DISPUTE. This freezes the escrow release.</div>
        <textarea value={why} onChange={e=>setWhy(e.target.value)} rows={2} maxLength={280} aria-label="Dispute reason" className="w-full rounded bg-deep border border-line p-1.5 resize-none"/>
        <button disabled={!why.trim()} onClick={async()=>{if(await fileDispute(why))ctl.set({sheet:null});setWhy("")}} className="btn rounded-full bg-risk text-black px-3 py-1 font-semibold disabled:opacity-40">Freeze and file</button></>}
    </motion.div>}</AnimatePresence>
    <AnimatePresence mode="wait"><motion.div key={sec.key} initial={{opacity:0,scale:.96}} animate={{opacity:1,scale:1}} exit={{opacity:0}} transition={{duration:.12}}
      role="toolbar" aria-label={`${kind} controls`} className="glass rounded-full px-3 py-2 flex items-center gap-2 flex-wrap justify-center">{controls.map(render)}</motion.div></AnimatePresence>
  </div>;
}
