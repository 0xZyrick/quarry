"use client";
import {useEffect,useState} from "react";
import {useSafety,sendAppeal} from "@/lib/safety";
import {useGuild} from "@/lib/store";
// Tells a creator the truth about their standing: held rooms, strikes, bans, and gives them a way to appeal.
export default function ModBanner(){
  const me=useSafety(s=>s.me),ready=useGuild(s=>s.profileReady),profile=useGuild(s=>s.profile);
  const [open,setOpen]=useState(false),[text,setText]=useState(""),[msg,setMsg]=useState("");
  useEffect(()=>{if(!ready||!profile)return;const f=()=>useSafety.getState().refresh();f();const t=setInterval(f,15000);return()=>clearInterval(t)},[ready,profile?.id]);
  if(me.banned)return <div role="alert" className="absolute top-14 left-1/2 -translate-x-1/2 z-50 glass rounded-xl px-4 py-2 text-xs text-risk max-w-[92vw]">
    Your account is restricted{me.banned.until?` until ${new Date(me.banned.until).toLocaleDateString()}`:""}. Reason: {me.banned.reason}. See the <a className="underline" href="/guidelines">community guidelines</a>.</div>;
  const c=me.cases?.[0];if(!c)return null;
  const send=async()=>{const r=await sendAppeal(c.id,text);setMsg(r.ok?"Appeal sent. A moderator will review it.":r.json.error??"Could not send.");if(r.ok){setOpen(false);useSafety.getState().refresh()}};
  return <div role="alert" onPointerDown={e=>e.stopPropagation()} className="absolute top-14 left-1/2 -translate-x-1/2 z-50 glass rounded-xl p-3 text-xs max-w-[92vw] w-[26rem] space-y-1.5">
    <div className="text-risk font-semibold">{c.state==="appealed"?"Appeal under review":"Your room is hidden while we review it"}</div>
    <div className="text-neutral-300">Reported for: {c.reasons.join(", ")}.{c.restoreAt?` It returns ${new Date(c.restoreAt).toLocaleString()} unless a moderator decides otherwise.`:""}{me.strikes?` Strikes: ${me.strikes}.`:""}</div>
    {msg&&<div className="text-community text-[10px]">{msg}</div>}
    {c.canAppeal&&!open&&<button onClick={()=>setOpen(true)} className="btn rounded-full border border-live text-live px-3 py-1">Appeal</button>}
    {open&&<><textarea value={text} onChange={e=>setText(e.target.value)} rows={3} maxLength={500} aria-label="Appeal" placeholder="What was actually happening on stream?" className="w-full rounded bg-deep border border-line p-1.5 resize-none"/>
      <div className="flex gap-2 justify-end"><button onClick={()=>setOpen(false)} className="btn text-neutral-400">Cancel</button>
        <button onClick={send} disabled={!text.trim()} className="btn rounded-full bg-live text-black px-3 py-1 font-semibold disabled:opacity-40">Send appeal</button></div></>}
  </div>;
}
