// Node shapes on the map. Commons rooms are crystals that grow with cursor activity; War Rooms are monoliths whose
// laser pulses harder the more escrow is held. Pure helpers only (no React, no store), so the map rig can call them every frame.
import {MapNode} from "./map";
export type Shape="crystal"|"monolith";
export const shapeOf=(n:MapNode):Shape=>n.status==="risk"?"monolith":"crystal";
const clamp01=(v:number)=>Math.min(1,Math.max(0,v));
const hash=(s:string)=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0)/4294967296};

// ---- escrow -> laser ----
// MOCK: every War Room gets a seeded escrow figure. The room you are standing in uses the live milestones instead, so
// releasing a payment visibly weakens its laser. Real source: the escrow contract's held balance for that room.
export const seedHeld=(id:string)=>Math.round((3000+hash(id+":e")*57000)/500)*500;
type M={status:string;amount:number};
export const heldFor=(id:string,roomId:string,ms:M[])=>
  id===roomId&&ms.length?ms.filter(m=>m.status!=="done").reduce((a,m)=>a+m.amount,0):seedHeld(id);
export const laserOf=(held:number)=>held>0?clamp01(Math.log(held/2000)/Math.log(80000/2000)):0; // 2k -> 0, 80k -> 1
export const laserPeriod=(pw:number)=>+(2.6-1.8*pw).toFixed(1); // seconds per pulse: bigger escrow, faster pulse
export const money=(v:number)=>"$"+(v>=1e3?(v/1e3).toFixed(v>=1e5?0:1).replace(/\.0$/,"")+"k":String(v));

// ---- cursor activity -> crystal size ----
// Real source: count presence updates per room (Liveblocks) and call poke(). MOCK: online count sets a baseline and
// cursor movement in the room you are in adds bursts that fade with a 2.5 s half-life.
const burst:Record<string,number>={},shown:Record<string,number>={};
export const poke=(id:string,n=1)=>{burst[id]=Math.min(1,(burst[id]??0)+.04*n)};
export const activityOf=(id:string,online:number,dt:number)=>{ // 0..1, eased. Call once per frame per node.
  const b=burst[id]??0,target=clamp01(online/90*.7+b*.6);
  burst[id]=b*Math.pow(.5,dt/2.5);
  const s=shown[id]??target;return shown[id]=s+(target-s)*Math.min(1,dt*2)};
export const growth=(a:number)=>+(.8+.9*a).toFixed(2); // crystal scale 0.8x .. 1.7x
export const crowdWord=(online:number)=>online>=50?"buzzing":online>=25?"active":"quiet";
