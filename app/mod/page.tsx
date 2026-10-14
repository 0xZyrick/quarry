"use client";
import {useCallback,useEffect,useState} from "react";
import {REASONS,Reason} from "@/lib/reasons";
// Moderator console. Access is enforced by the API (MODERATOR_UIDS); this page only renders what the server returns.
type C={id:string;kind:"stream"|"user";room:string;target:string|null;reasons:Reason[];severe:boolean;state:string;total:number;reporters:number;opened:number;held:boolean;appeal?:{text:string};ownerUid:string|null};
const ago=(t:number)=>{const m=Math.round((Date.now()-t)/6e4);return m<60?`${m}m`:`${Math.round(m/60)}h`};
export default function Mod(){
  const [q,setQ]=useState<C[]|null>(null),[audit,setAudit]=useState<any[]>([]),[err,setErr]=useState(""),[notes,setNotes]=useState<Record<string,string>>({});
  const load=useCallback(async()=>{const r=await fetch("/api/mod/queue",{cache:"no-store"});
    if(r.status===403){setErr("Not a moderator account.");return}const j=await r.json();setQ(j.queue);setAudit(j.audit);setErr("")},[]);
  useEffect(()=>{(async()=>{ // dev only: /mod?as=mod signs in the test moderator
    const as=new URLSearchParams(location.search).get("as");
    if(as==="mod"&&process.env.NODE_ENV!=="production")await fetch("/api/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({dev:"mod"})});
    load()})();const t=setInterval(load,10000);return()=>clearInterval(t)},[load]);
  const act=async(id:string,action:string)=>{const r=await fetch("/api/mod/decide",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({caseId:id,action,note:notes[id]??""})});
    if(!r.ok)setErr((await r.json()).error??"failed");load()};
  const btn="btn rounded-full border border-line px-3 py-1 text-xs hover:border-live hover:text-live";
  return <main className="min-h-screen bg-deep text-neutral-200 p-6 max-w-4xl mx-auto space-y-4">
    <h1 className="text-lg font-semibold">Moderation queue</h1>
    {err&&<div role="alert" className="text-risk text-sm">{err}</div>}
    {q&&!q.length&&<div className="text-neutral-400 text-sm">Nothing waiting.</div>}
    {q?.map(c=><section key={c.id} className="glass rounded-xl p-4 space-y-2">
      <div className="flex flex-wrap gap-2 items-center text-xs font-mono">
        {c.severe&&<span className="text-risk">URGENT</span>}{c.state==="appealed"&&<span className="text-live">APPEAL</span>}
        <span>{c.kind==="stream"?"stream":"user @"+c.target}</span><span className="text-neutral-400">room {c.room} · {c.reporters} reporter{c.reporters===1?"":"s"} · weight {c.total} · {ago(c.opened)} ago{c.held?" · held":""}</span></div>
      <div className="text-sm">{c.reasons.map(r=>REASONS[r].label).join(" · ")}</div>
      {c.appeal&&<blockquote className="text-sm border-l-2 border-live pl-3 text-neutral-300">Owner appeal: {c.appeal.text}</blockquote>}
      <input value={notes[c.id]??""} onChange={e=>setNotes({...notes,[c.id]:e.target.value})} maxLength={300} placeholder="Decision note (shown to the owner)" aria-label="Decision note" className="w-full rounded bg-deep border border-line px-2 py-1 text-xs"/>
      <div className="flex flex-wrap gap-2">{c.kind==="stream"
        ?<>{c.state==="appealed"?<button className={btn} onClick={()=>act(c.id,"reinstate")}>Reinstate</button>:<button className={btn} onClick={()=>act(c.id,"dismiss")}>Dismiss</button>}
          <button className={btn} onClick={()=>act(c.id,"uphold")}>Uphold (strike)</button><button className={btn+" text-risk"} onClick={()=>act(c.id,"ban")}>Ban account</button></>
        :<><button className={btn} onClick={()=>act(c.id,"dismiss")}>Dismiss</button><button className={btn} onClick={()=>act(c.id,"mute")}>Mute</button>
          <button className={btn} onClick={()=>act(c.id,"roomban")}>Remove from room</button><button className={btn+" text-risk"} onClick={()=>act(c.id,"ban")}>Ban account</button></>}</div>
    </section>)}
    <h2 className="text-sm font-semibold pt-4">Audit log</h2>
    <ul className="text-[11px] font-mono text-neutral-400 space-y-0.5">{audit.map((a,i)=><li key={i}>{new Date(a.at).toLocaleTimeString()} · {a.by} · {a.action} {a.case??a.room??""}</li>)}</ul>
  </main>;
}
