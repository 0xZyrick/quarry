"use client";
import {TIERS,Vault} from "@/lib/vault";
import AvatarRing from "./AvatarRing";
import LiveBeacon from "./LiveBeacon";
// Identity is shown, never typed: handle, tier, a zone-level location, and skills that link to the capsules proving them.
export default function ReputationHeader({v,onSkill}:{v:Vault;onSkill:(capsuleId:string)=>void}){
  const t=TIERS[v.tier];
  return <header className="space-y-4">
    <div className="flex flex-wrap items-center gap-5">
      <AvatarRing handle={v.handle} color={t.color}/>
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-xl font-semibold truncate">@{v.handle}</h1>
        <div className="font-mono text-xs" style={{color:t.color}}>Level: {t.label}</div>
        {v.location&&<div className="font-mono text-xs text-neutral-400">Location: {v.location}</div>}
        <ul className="flex flex-wrap gap-2 pt-1" aria-label="Verified skills">
          {v.skills.length?v.skills.map(s=><li key={s.skill}><a href={`#capsule-${s.capsuleIds[0]}`} onClick={e=>{e.preventDefault();onSkill(s.capsuleIds[0])}}
            title={`${s.capsuleIds.length} verified capsule${s.capsuleIds.length>1?"s":""}`}
            className="btn rounded-full border border-line px-2.5 py-0.5 font-mono text-[11px] text-community hover:border-community">{s.tag}</a></li>)
            :<li className="font-mono text-[11px] text-neutral-500">No verified skills yet. A skill appears only after a paid, signed-off capsule proves it.</li>}</ul></div></div>
    <LiveBeacon handle={v.handle} initial={v.live}/>
  </header>;
}
