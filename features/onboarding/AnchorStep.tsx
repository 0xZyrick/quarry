"use client";
import {motion,useReducedMotion} from "framer-motion";
import {useState} from "react";
import {ZONES} from "@/lib/map";
import {locateZone,nodeName} from "@/lib/onboarding";
import Globe from "./Globe";
import {useOnboarding} from "./OnboardingProvider";

// Screen 4: anchor to a territory. The browser position is reduced to a zone id on the spot and then discarded.
// If access is blocked the person picks a node by hand. Choosing one runs the descent and then writes the zone,
// which completes onboarding and lands on the mosaic.
export default function AnchorStep(){
  const {update}=useOnboarding(),reduce=useReducedMotion();
  const [target,setTarget]=useState<string|null>(null),[busy,setBusy]=useState(false),[manual,setManual]=useState(false),[msg,setMsg]=useState("");
  const anchor=(z:string)=>{setTarget(z);setMsg("")};
  const grant=async()=>{setBusy(true);setMsg("");
    try{anchor(await locateZone())}catch{setMsg("Location is unavailable. Pick your node instead.");setManual(true)}setBusy(false)};
  return <div className="relative h-full">
    <Globe target={target} onLanded={()=>update({zone:target})} reduce={!!reduce}/>
    <motion.div className="absolute inset-x-0 top-0 px-5 pt-14 text-center" animate={{opacity:target?0:1}} transition={{duration:.3}}>
      <h1 className="font-mono text-lg tracking-wide text-white md:text-2xl">Anchor your Beacon to your active territory.</h1>
      <p className="mt-2 text-sm text-neutral-400">Only your neighbourhood node is saved, never an exact location.</p></motion.div>
    <motion.div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-5 pb-8" animate={{opacity:target?0:1}} transition={{duration:.3}} style={{pointerEvents:target?"none":"auto"}}>
      <p role="status" className="min-h-[1rem] text-xs text-risk">{msg}</p>
      {manual&&<div role="group" aria-label="Choose your node" className="flex max-h-32 max-w-2xl flex-wrap justify-center gap-1.5 overflow-y-auto">
        {ZONES.map(z=><button key={z.id} onClick={()=>anchor(z.id)} className="btn glass rounded-full px-3 py-1.5 text-xs text-neutral-200 hover:border-community hover:text-community">{nodeName(z.id)}, {z.city}</button>)}</div>}
      <button onClick={grant} disabled={busy} className="btn rounded-xl border border-community bg-community/10 px-7 py-3.5 font-semibold text-community hover:bg-community hover:text-black disabled:opacity-60">
        {busy?"Locating…":"Grant Proximity Access"}</button>
      {!manual&&<button onClick={()=>setManual(true)} className="btn text-xs text-neutral-400 hover:text-white">Choose a node manually</button>}
    </motion.div>
    {target&&<div role="status" className="absolute inset-x-0 bottom-10 text-center font-mono text-xs text-community">Anchoring to {nodeName(target)} · {ZONES.find(z=>z.id===target)!.city}</div>}
  </div>;
}
