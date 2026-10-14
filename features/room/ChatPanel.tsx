"use client";
import {useEffect,useRef,useState} from "react";
import {useChat,connectChat} from "@/lib/chat";
import {useRT} from "@/lib/realtime";
import ReportSheet from "../safety/ReportSheet";
import {roomControl} from "@/lib/safety";
import {useRoomSecurity} from "@/lib/store";
import {useRoomCtl} from "@/lib/roomCtl";
// Live Log Split: guest text and platform system triggers share one stream. Owners and clients can hover a text line and Pass the Mic.
export default function ChatPanel({className=""}:{className?:string}){
  const sec=useRoomSecurity(),log=useChat(s=>s.log),requests=useChat(s=>s.requests),slots=useChat(s=>s.slots);
  const open=useRoomCtl(s=>s.chatOpen);
  const [rep,setRep]=useState<string|null>(null),[text,setText]=useState(""),end=useRef<HTMLDivElement>(null),room=sec.room.id;
  useEffect(()=>connectChat(room,n=>useRT.getState().addTip(n)),[room]);
  const mine=log.filter(m=>m.room===room);
  useEffect(()=>{end.current?.scrollIntoView({block:"end"})},[mine.length]);
  const send=()=>{useChat.getState().say(room,sec.self,text);setText("")};
  return <aside aria-label="Room chat" onPointerDown={e=>e.stopPropagation()}
    className={`glass rounded-xl flex-col min-h-0 ${open?"flex":"hidden md:flex"} ${className}`}>
    <div className="px-3 py-2 font-mono text-[10px] text-neutral-400 flex justify-between border-b border-line">
      <span>LIVE LOG</span><span>{slots.length?`🎙️ ${slots.map(s=>"@"+s).join(" ")}`:requests.length?`${requests.length} mic request${requests.length>1?"s":""}`:""}</span></div>
    <div role="log" aria-live="polite" className="flex-1 overflow-auto p-2 space-y-1.5 text-xs">
      {mine.map(m=>m.kind==="system"
        ?<div key={m.id} className="rounded px-2 py-1 font-mono text-[10px] text-community bg-community/10">{m.text}</div>
        :<div key={m.id} className="group relative rounded px-2 py-1 hover:bg-white/5"><b className="text-neutral-300">@{m.by}</b> <span className="text-neutral-200">{m.text}</span>
          {sec.caps.passMic&&m.by!==sec.self&&!slots.includes(m.by)&&(m.question||requests.includes(m.by))&&
            <button onClick={()=>useChat.getState().passMic(room,m.by)}
              className="btn absolute right-1 top-1 hidden group-hover:block group-focus-within:block rounded-full bg-live text-black text-[10px] font-semibold px-2 py-0.5">Pass the Mic</button>}
          {m.by!==sec.self&&<span className="absolute right-1 bottom-0.5 hidden group-hover:flex group-focus-within:flex gap-2 text-[10px]">
            <button onClick={()=>setRep(m.by)} className="btn text-neutral-400 hover:text-risk" aria-label={`Report ${m.by}`}>report</button>
            {sec.kind==="owner-creator"&&<button onClick={()=>roomControl(room,"mute",m.by)} className="btn text-neutral-400 hover:text-white">mute</button>}
            {sec.kind==="owner-creator"&&<button onClick={()=>roomControl(room,"ban",m.by)} className="btn text-neutral-400 hover:text-risk">remove</button>}</span>}
        </div>)}<div ref={end}/></div>
    {rep&&<ReportSheet room={room} kind="user" target={rep} onClose={()=>setRep(null)}/>}
    {sec.caps.chat&&<div className="p-2 border-t border-line flex gap-2">
      <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")send()}} maxLength={240} aria-label="Chat message" placeholder="say something"
        className="flex-1 min-w-0 rounded-lg bg-deep border border-line px-2 py-1 text-xs outline-none focus:border-live"/>
      <button onClick={send} className="btn text-xs text-live">Send</button></div>}
  </aside>;
}
