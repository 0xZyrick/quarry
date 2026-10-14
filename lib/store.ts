import {create} from "zustand";
import {useMemo} from "react";
import {Milestone,Dispute,TipNote} from "./escrow";
import {escrow} from "./escrowAdapter";
import {PAYMENTS_ON,TOKENS_ON} from "./flags";
import {Profile,Role,roleIn,perms,profileAdapter} from "./profile";
import {kindIn,capsOf,roomInfo} from "./access";
import {NODES} from "./map";
export type {Role};
// The creator whose tile the swipe started on (mosaic tiles carry data-node); in the reels feed it is the clip on screen.
export const swipedNode=()=>{const g=useGuild.getState();return NODES.find(n=>n.id===g.swipeNode)??NODES[g.clip%3]};
export type Trans={from:Layer;to:Layer}|null; // layer machine: idle (null) or entering/exiting a layer
export const SETTLE_MS=650;
let settle:ReturnType<typeof setTimeout>|null=null;
let unsub:null|(()=>void)=null;
export type Layer=0|1|2; // feed, map, room
type Room="stream"|"commons"|"war";
type S={swipeNode:string|null;quiet:Record<string,boolean>;nodesV:number;trans:Trans;landed:{k:number;id:string}|null;profile:Profile|null;profileReady:boolean;tip:(tile:string,amount:number,note?:TipNote)=>Promise<boolean>;credit:(n:number)=>void;roomId:string;setRoomId:(id:string)=>void;sound:boolean;toggleSound:()=>void;clip:number;setClip:(c:number)=>void;dive:{k:number;color:string;zone:string;name:string}|null;setDive:(d:S["dive"])=>void;instant:boolean;selected:string|null;select:(id:string|null)=>void;room:Room;setRoom:(r:Room)=>void;layer:Layer;setLayer:(l:Layer)=>void;wallet:number;disputed:boolean;dispute:Dispute|null;fileDispute:(reason:string)=>Promise<boolean>;leaveTable:()=>void;watchEscrow:(roomId:string)=>()=>void;milestones:Milestone[];pending:boolean;releasing:boolean;
 load:()=>Promise<void>;release:()=>Promise<void>};
export const useGuild=create<S>((set,get)=>({
 swipeNode:null,quiet:{},nodesV:0,landed:null,profile:null,profileReady:false,
 credit:n=>set(s=>({wallet:s.wallet+n})),
 tip:async(tile,amount,note)=>{if(!TOKENS_ON)return false;
  if(!PAYMENTS_ON){try{await escrow.tip(get().roomId,tile,amount,note);return true}catch{return false}} // play token: a note only, no wallet
  if(get().wallet<amount)return false;
  set(s=>({wallet:s.wallet-amount,pending:true})); // optimistic
  try{await escrow.tip(get().roomId,tile,amount,note);set({pending:false});return true}
  catch{set(s=>({wallet:s.wallet+amount,pending:false}));return false}}, // rollback
 roomId:"n0",setRoomId:id=>set({roomId:id}),sound:false,toggleSound:()=>set(s=>({sound:!s.sound})),clip:0,setClip:c=>set({clip:c}),dive:null,setDive:d=>set({dive:d}),instant:false,selected:null,select:id=>set({selected:id}),room:"stream",setRoom:r=>set({room:r}),layer:0,trans:null,setLayer:l=>{const from=get().layer;if(l===from)return;
  set({layer:l,trans:{from,to:l}});if(settle)clearTimeout(settle);settle=setTimeout(()=>set({trans:null}),SETTLE_MS)},wallet:1240,disputed:false,dispute:null,
 fileDispute:async reason=>{if(!PAYMENTS_ON)return false;const {roomId,profile}=get(),room=roomInfo(roomId);if(!capsOf(kindIn(profile,room),room.type).dispute)return false;
  try{await escrow.dispute(roomId,reason);const st=await escrow.getState(roomId);set({milestones:st.milestones,dispute:st.dispute??null,disputed:st.dispute?.state==="open"});return true}catch{return false}},
 leaveTable:()=>{const {roomId,profile}=get();if(!profile)return;
  fetch(`/api/crew/${encodeURIComponent(roomId)}`,{method:"DELETE"}).catch(()=>{}); // the server removes the seat; the UI follows at once
  set({profile:{...profile,crewRoomIds:profile.crewRoomIds.filter(r=>r!==roomId)}})},
 watchEscrow:roomId=>{let dead=false;const apply=(n:{milestones:Milestone[];dispute?:Dispute|null})=>{if(!dead&&get().roomId===roomId)set({milestones:n.milestones,dispute:n.dispute??null,disputed:n.dispute?.state==="open"})};
  set({milestones:[],dispute:null,disputed:false});escrow.getState(roomId).then(apply).catch(()=>{});const u=escrow.subscribe(roomId,apply);return()=>{dead=true;u()}},
 milestones:[],pending:false,releasing:false,
load:async()=>{profileAdapter.get().then(p=>set({profile:p,profileReady:true})).catch(()=>set({profile:null,profileReady:true}));
  },
 release:async()=>{if(!PAYMENTS_ON)return;
  const {milestones,profile,roomId}=get();const a=milestones.find(m=>m.status==="active");const room=roomInfo(roomId);if(!a||get().disputed||!capsOf(kindIn(profile,room),room.type).release)return;
  set({pending:true,releasing:true}); // optimistic: tank drains immediately
  try{await escrow.release(roomId,a.id);set(s=>({wallet:s.wallet+a.amount,releasing:false})) // milestones arrive via subscribe
  
  }catch{set({releasing:false})} // rollback
  set({pending:false});
 }}));

// The role for the room you are in, computed from the account. Screens use this; none of them store a role.
export const useRole=()=>{const p=useGuild(s=>s.profile),id=useGuild(s=>s.roomId);
  return useMemo(()=>{const r=roleIn(p,id);return{...r,...perms(r),profile:p}},[p,id])};
// useRoomSecurity: evaluates room.ownerId, user.profileId, user.role and room.type together and returns the one decision every room screen uses.
export const useRoomSecurity=()=>{const p=useGuild(s=>s.profile),id=useGuild(s=>s.roomId);
  const quiet=useGuild(s=>!!s.quiet[id]); // Silent Focus Bench: guests watch only
  return useMemo(()=>{const room=roomInfo(id),kind=kindIn(p,room),visiting=!!p?.creatorNodeId&&p.creatorNodeId!==room.ownerId,base=capsOf(kind,room.type,visiting);
    return{room,kind,caps:quiet&&kind==="guest"?{...base,chat:false,requestMic:false}:base,profile:p,self:p?.handle??"guest",key:`${id}:${kind}`}},[p,id,quiet])};
