"use client";
import {useState} from "react";
import {useOnboarding} from "./OnboardingProvider";

// Screen 1: invite code and a name. Entry is invite-only for now; passkey / password are added later in front of this screen.
// The server checks the code, claims the name and sets the signed session cookie. The record only keeps the id and the name.
export default function AuthStep(){
  const {update}=useOnboarding(),[code,setCode]=useState(""),[name,setName]=useState(""),[st,setSt]=useState<"idle"|"busy">("idle"),[err,setErr]=useState("");
  const ok=code.trim().length>=4&&name.trim().length>=2;
  const go=async(e:React.FormEvent)=>{e.preventDefault();if(!ok||st==="busy")return;setSt("busy");setErr("");
    try{const r=await fetch("/api/invite",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,name})}),j=await r.json().catch(()=>({}));
      if(!r.ok){setErr(j.error||"Something went wrong. Try again.");setSt("idle");return}
      update({uid:j.uid,name:j.name,auth:"invite"})} // success moves to the next screen by itself
    catch{setErr("Can't reach the server. Check your connection.");setSt("idle")}};
  const field="w-full rounded-xl border border-line bg-deep px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-live";
  return <div className="grid h-full place-items-center px-5">
    <form onSubmit={go} className="glass w-full max-w-sm rounded-2xl p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,.6)]">
      <div className="font-mono text-xs tracking-[.3em] text-neutral-300">QUARRY</div>
      <h1 className="mt-6 text-xl font-semibold text-white">You're invited</h1>
      <p className="mt-2 text-sm text-neutral-400">Enter your invite code and choose the name people will see.</p>
      <label className="mt-6 block text-left font-mono text-[10px] text-neutral-400">INVITE CODE
        <input value={code} onChange={e=>setCode(e.target.value)} autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={64}
          placeholder="QUARRY-XXXXX-00" className={field+" mt-1 font-mono tracking-wider"}/></label>
      <label className="mt-4 block text-left font-mono text-[10px] text-neutral-400">YOUR NAME
        <input value={name} onChange={e=>setName(e.target.value)} autoComplete="nickname" spellCheck={false} maxLength={24}
          placeholder="e.g. tunde.codes" className={field+" mt-1"}/></label>
      <button type="submit" disabled={!ok||st==="busy"} aria-busy={st==="busy"}
        className="btn mt-6 w-full rounded-xl border border-live bg-live/10 px-5 py-3.5 font-semibold text-live hover:bg-live hover:text-black disabled:cursor-not-allowed disabled:opacity-50">
        {st==="busy"?"Checking…":"Enter Quarry"}</button>
      <p role="alert" className="mt-4 min-h-[1.25rem] text-xs text-risk">{err}</p>
    </form></div>;
}
