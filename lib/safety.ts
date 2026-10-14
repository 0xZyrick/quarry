// Client side of trust and safety: file reports, read your own standing, appeal. Every rule is enforced on the server.
import {create} from "zustand";
export type Standing={signedIn:boolean;moderator?:boolean;strikes?:number;banned?:{until:number|null;reason:string}|null;
  cases?:{id:string;room:string;state:string;reasons:string[];restoreAt:number|null;appeal:boolean;canAppeal:boolean;note:string|null}[]};
type S={me:Standing;refresh:()=>Promise<void>};
export const useSafety=create<S>(set=>({me:{signedIn:false},
  refresh:async()=>{try{const r=await fetch("/api/safety/me",{cache:"no-store"});if(r.ok)set({me:await r.json()})}catch{}}}));
const post=async(path:string,body:object)=>{try{const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  return{ok:r.ok,status:r.status,json:await r.json().catch(()=>({}))}}catch{return{ok:false,status:0,json:{error:"offline"}}}};
export const sendReport=(room:string,kind:"stream"|"user",reason:string,target?:string)=>post("/api/safety/report",{room,kind,reason,target});
export const sendAppeal=(caseId:string,text:string)=>post("/api/safety/appeal",{caseId,text});
export const roomControl=(room:string,op:"mute"|"unmute"|"ban"|"unban",handle:string)=>post("/api/safety/room",{room,op,handle});
