"use client";
// Online and visit counts. This is a mock: numbers are seeded per room (so server and browser render the same thing)
// and drift while the app is open. Back it with the server later: online from Liveblocks presence or LiveKit
// participants, visits from a counter that increments once per person per room per day.
import {create} from "zustand";
import {NODES} from "./map";
export type RoomStat={online:number;visits:number};
const hash=(s:string)=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0)/4294967296};
const LOBBY=140; // people browsing the feed and map, in no room
const rooms0=()=>Object.fromEntries(NODES.map(n=>[n.id,{online:Math.round(6+hash(n.id+":o")*70),visits:Math.round(900+hash(n.id+":v")*60000)}])) as Record<string,RoomStat>;
const totals=(r:Record<string,RoomStat>)=>Object.values(r).reduce((a,x)=>({online:a.online+x.online,visits:a.visits+x.visits}),{online:LOBBY,visits:0});
type S={rooms:Record<string,RoomStat>;global:RoomStat;tick:()=>void;visit:(id:string)=>void};
const seen=new Set<string>(); // one visit per room per session
export const useStats=create<S>((set,get)=>{const r=rooms0();return{rooms:r,global:totals(r),
  tick:()=>{const rooms={...get().rooms};
    for(const id in rooms){const x=rooms[id],d=Math.floor(Math.random()*5)-2;
      rooms[id]={online:Math.max(1,x.online+d),visits:x.visits+(Math.random()<.25?1+Math.floor(Math.random()*3):0)}}
    set({rooms,global:totals(rooms)})},
  visit:id=>{if(seen.has(id)||!get().rooms[id])return;seen.add(id);
    const rooms={...get().rooms};rooms[id]={online:rooms[id].online+1,visits:rooms[id].visits+1};set({rooms,global:totals(rooms)})}}});
export const fmt=(n:number)=>n>=1e6?(n/1e6).toFixed(1)+"m":n>=1e4?Math.round(n/1e3)+"k":n>=1e3?(n/1e3).toFixed(1)+"k":String(n);
