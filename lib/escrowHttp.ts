// Escrow over the server API. The server enforces roles and the dispute state machine; this only carries calls and polls for changes.
// Swap for a Starknet adapter later: same interface, and the server ledger becomes the indexer of the contract's events.
import type {EscrowAdapter,EscrowState} from "./escrow";
const path=(r:string)=>`/api/escrow/${encodeURIComponent(r)}`;
const post=async(r:string,body:object)=>{const res=await fetch(path(r),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(!res.ok)throw new Error((await res.json().catch(()=>({}))).error??"request failed");return res.json()};
export const httpEscrow:EscrowAdapter={
  async getState(r){const res=await fetch(path(r),{cache:"no-store"});if(!res.ok)throw new Error("state "+res.status);return res.json() as Promise<EscrowState>},
  subscribe(r,cb){let dead=false;const t=setInterval(async()=>{try{const s=await httpEscrow.getState(r);if(!dead)cb(s)}catch{}},3000);return()=>{dead=true;clearInterval(t)}},
  async release(r,id){await post(r,{op:"release",id});return{ok:true}},
  async dispute(r,reason){await post(r,{op:"dispute",reason});return{ok:true}},
  async tip(r,tile,amount,note){await post(r,{op:"tip",tile,amount,note});return{ok:true}}};
