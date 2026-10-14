// Who is "on the map". A node exists only while its owner hosts an operational room. Idle or offline = no pin, no tile.
// The server (lib/server/registry.ts) is the authority for live state, flags and the Greenroom; this store mirrors it by polling /api/hubs.
// If the API is unreachable (static demo), the same rules run locally on mock data.
import {create} from "zustand";
import {NODES,upsertNode} from "./map";
import {dynSkills} from "./mosaic";
import {useGuild} from "./store";
import {Gate,canGoLive} from "./access";
import {seedLive} from "./seed";
export type RoomMeta={title:string;tags:string[];env:"sandbox"|"focus";path:"digital"|"physical"|null;zone:string|null;handle:string};
type Snap={live:Record<string,boolean>;suspended:Record<string,boolean>;greenroom:Record<string,boolean>;flags:Record<string,number>;rooms?:Record<string,RoomMeta>};
// Creator-launched rooms from the server become pins on the map and tiles in the feed. A Public Sandbox is a green crystal, a Silent Focus Bench a blue one.
export type Launch={title:string;tags:string[];env:"sandbox"|"focus";path:"digital"|"physical"|null;zone:string|null};
export function applyRooms(rooms:Record<string,RoomMeta>|undefined){if(!rooms)return;let changed=false;
  for(const[id,m]of Object.entries(rooms)){if(!m.zone)continue;dynSkills[id]=m.tags;
    if(upsertNode(id,m.handle,m.zone,m.env==="focus"?"community":"live"))changed=true}
  const quiet:Record<string,boolean>={};for(const[id,m]of Object.entries(rooms))quiet[id]=m.env==="focus";
  useGuild.setState(s=>({quiet:{...s.quiet,...quiet},...(changed?{nodesV:s.nodesV+1}:{})}))}
type S=Snap&{meta:Record<string,RoomMeta>;offline:boolean;sync:()=>Promise<void>;goLive:(id:string,g:Gate,launch?:Launch)=>Promise<boolean>;goOffline:(id:string)=>Promise<void>;
  setGreenroom:(id:string,on:boolean)=>Promise<void>};
const call=async(body:object)=>{try{const r=await fetch("/api/hubs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  return{status:r.status,json:await r.json().catch(()=>({}))}}catch{return null}}; // null = network down
export const useHubs=create<S>((set,get)=>({
  live:Object.fromEntries(NODES.map(n=>[n.id,seedLive(n.id)])),suspended:{},greenroom:{},flags:{},meta:{},offline:false,
  sync:async()=>{try{const r=await fetch("/api/hubs",{cache:"no-store"});if(!r.ok)throw 0;const j=await r.json();applyRooms(j.rooms);set({...j,meta:j.rooms??{},offline:false})}catch{set({offline:true})}},
  goLive:async(id,g,launch)=>{const r=await call({op:"golive",room:id,canvas:g.canvas,skill:g.skill,...launch});
    if(r){if(r.status===200){applyRooms(r.json.rooms);set({...r.json,meta:r.json.rooms??get().meta})}return r.status===200}
    if(!canGoLive(g)||get().suspended[id])return false;set(s=>({live:{...s.live,[id]:true}}));return true},
  goOffline:async id=>{const r=await call({op:"offline",room:id});if(r?.status===200)set(r.json);else if(!r)set(s=>({live:{...s.live,[id]:false}}))},
  setGreenroom:async(id,on)=>{const r=await call({op:"greenroom",room:id,on});if(r?.status===200)set(r.json);else if(!r)set(s=>({greenroom:{...s.greenroom,[id]:on}}))}}));
export const isVisible=(id:string,s:{live:Record<string,boolean>;suspended:Record<string,boolean>})=>!!s.live[id]&&!s.suspended[id];
