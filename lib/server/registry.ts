// Server-side source of truth for rooms, crews, contracts, live state and flags. In-memory (one process); swap the Maps for a database.
import {NODES} from "../map";
import {shapeOf} from "../nodeShape";
import {seedLive} from "../seed";
import {canGoLive,Gate,RoomType} from "../access";
import type {Profile} from "../profile";
import type {Session} from "./session";
export type Room={id:string;type:RoomType;ownerUid:string|null;crew:Set<string>;handle?:string};
// What a creator declared at the Launch Portal. Only a zone id is kept, never a location.
export type Meta={title:string;tags:string[];env:"sandbox"|"focus";path:"digital"|"physical"|null;zone:string|null};
export type Hub={live:boolean;gate:Gate|null;flags:Set<string>;suspended:boolean;greenroom:boolean;meta?:Meta};
const OWNERS:Record<string,string>={n1:"u-creator",n3:"u-co"},CREW:Record<string,string[]>={n0:["u-co"],n2:["u-co"]};
const g=globalThis as any;
const db:{rooms:Map<string,Room>;hubs:Map<string,Hub>;handles:Map<string,string>}=g.__guildRegistry??=(()=>{
  const rooms=new Map<string,Room>(),hubs=new Map<string,Hub>(),handles=new Map<string,string>();
  for(const n of NODES)handles.set(n.name,"demo-"+n.id);for(const h of["kodo.dev","mio.3d","acme.studio"])handles.set(h,"demo");
  for(const n of NODES){rooms.set(n.id,{id:n.id,type:shapeOf(n)==="monolith"?"war":"commons",ownerUid:OWNERS[n.id]??"demo-"+n.id,crew:new Set(CREW[n.id]??[])});
    hubs.set(n.id,{live:seedLive(n.id),gate:null,flags:new Set(),suspended:false,greenroom:false})}
  return{rooms,hubs,handles}})();
// A display name belongs to one account. Re-claiming your own name is fine.
export function claimHandle(handle:string,uid:string){const o=db.handles.get(handle);if(o&&o!==uid)return false;db.handles.set(handle,uid);return true}
// Development accounts may preview the client role in War Rooms.
const openClient=()=>process.env.NODE_ENV!=="production";
export const ROOM_ID=/^[A-Za-z0-9:_-]{1,48}$/;
export const getRoom=(id:string)=>ROOM_ID.test(id)?db.rooms.get(id)??null:null;
export const hubOf=(id:string)=>db.hubs.get(id)!;
export function ensureOwnRoom(s:Session){const id="own:"+s.uid.slice(-8);
  if(!db.rooms.has(id)){db.rooms.set(id,{id,type:"commons",ownerUid:s.uid,crew:new Set(),handle:s.handle});
    db.hubs.set(id,{live:false,gate:null,flags:new Set(),suspended:false,greenroom:false})}return id}
export function profileFor(s:Session|null):Profile|null{if(!s)return null;
  if(s.track==="creator")ensureOwnRoom(s);
  const rooms=[...db.rooms.values()];
  return{id:s.uid,handle:s.handle,creatorNodeId:rooms.find(r=>r.ownerUid===s.uid)?.id??null,
    clientRoomIds:rooms.filter(r=>r.type==="war"&&s.track==="client"&&openClient()).map(r=>r.id),
    crewRoomIds:rooms.filter(r=>r.crew.has(s.uid)).map(r=>r.id)}}
export const addCrew=(roomId:string,uid:string)=>getRoom(roomId)?.crew.add(uid);
export const removeCrew=(roomId:string,uid:string)=>getRoom(roomId)?.crew.delete(uid);
// ---- hubs: who is on the map ----
export function goLive(roomId:string,gate:Gate,meta?:Meta){const h=db.hubs.get(roomId);
  if(!h||h.suspended||!canGoLive(gate))return false;h.live=true;h.gate=gate;if(meta)h.meta=meta;return true}
export const goOffline=(roomId:string)=>{const h=db.hubs.get(roomId);if(h)h.live=false};
export const setGreenroom=(roomId:string,on:boolean)=>{const h=db.hubs.get(roomId);if(h)h.greenroom=on};
// Trust and safety (lib/server/safety.ts) decides when a room is hidden; the registry only stores the result.
export const setSuspended=(id:string,on:boolean)=>{const h=db.hubs.get(id);if(!h)return;h.suspended=on;if(on)h.live=false;else h.flags.clear()}; // unhiding leaves the room offline: the owner goes live again
export const setFlags=(id:string,uids:string[])=>{const h=db.hubs.get(id);if(h)h.flags=new Set(uids)};
export const roomsOwnedBy=(uid:string)=>[...db.rooms.values()].filter(r=>r.ownerUid===uid).map(r=>r.id);
export const isOwnerOrCrew=(roomId:string,uid:string)=>{const r=db.rooms.get(roomId);return!!r&&(r.ownerUid===uid||r.crew.has(uid))};
export const snapshot=()=>{const live:Record<string,boolean>={},suspended:Record<string,boolean>={},greenroom:Record<string,boolean>={},flags:Record<string,number>={},
    rooms:Record<string,Meta&{handle:string}>={}; // rooms: creators who launched their own room (they become pins on the map and tiles in the feed)
  for(const[id,h]of db.hubs){live[id]=h.live;suspended[id]=h.suspended;greenroom[id]=h.greenroom;flags[id]=h.flags.size;
    const r=db.rooms.get(id);if(h.meta&&r?.handle&&id.startsWith("own:"))rooms[id]={...h.meta,handle:r.handle}}
  return{live,suspended,greenroom,flags,rooms}};
