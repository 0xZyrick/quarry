// Demo creators get seeded preview portfolio items; real accounts start empty.
import {NODES,zoneOf} from "../map";
import {shapeOf} from "../nodeShape";
import {hash} from "../seed";
import {BROADCAST_SRC} from "../media";
import {Capsule,Vault,metricsOf,tierOf,skillsOf} from "../vault";
import {SKILLS,Skill} from "../skills";
import {getRoom,hubOf} from "./registry";
import type {Session} from "./session";
import type {PainterId} from "../painters";
const PAINTERS:PainterId[]=["cad","paint","code","wire","ui"],BASE=Date.parse("2026-10-01T12:00:00Z");
const hex=(seed:string,n=64)=>{let o="",i=0;while(o.length<n)o+=Math.floor(hash(seed+":"+i++)*4294967296).toString(16).padStart(8,"0");return o.slice(0,n)};
const pick=<T,>(a:readonly T[],s:string)=>a[Math.floor(hash(s)*a.length)];
const PHASES=["Penthouse CAD Core","Key Visual System","Lighting Array Sandbox","Motion Language","Facade Study","Brand Discovery","Component Library","Joinery Details","Mural Layout","Handoff Package","Spatial Walkthrough","Material Board"];
function demoCapsules(nodeId:string,war:boolean,special:boolean):Capsule[]{
  const out:Capsule[]=[],k=special?(war?18:4):war?3+Math.floor(hash(nodeId+"k")*9):2+Math.floor(hash(nodeId+"k")*5);
  for(let i=0;i<k;i++){const id=`${nodeId}-${i}`,skill=(special&&i===0?(war?"Interior Design":"3D Layout"):pick(SKILLS,id+"s")) as Skill;
    out.push({id,kind:war?"war":"commons",roomId:nodeId,roomNumber:100+Math.floor(hash(id+"r")*900),phase:special&&i===0?(war?"Penthouse CAD Core":"Lighting Array Sandbox"):pick(PHASES,id+"p"),skill,
      durationSec:special&&i===0?4*3600:3600*(1+Math.floor(hash(id+"d")*5)),
      createdAt:BASE-Math.floor(hash(id+"a")*330)*864e5,
      proofHash:hex(id+"h"),peerMarks:Math.floor(hash(id+"m")*13),painter:pick(PAINTERS,id+"c"),seed:Math.floor(hash(id+"z")*1e6),clipUrl:BROADCAST_SRC})}
  return out}
export function vaultFor(handle:string,session:Session|null):Vault|null{
  const mine=handle==="me"||(!!session&&handle===session.handle),n=NODES.find(x=>x.name===handle);
  if(n){const war=shapeOf(n)==="monolith",mira=n.id==="n0"; // the spec example: one creator with both a War Room history and Commons builds
    const cs=mira?[...demoCapsules(n.id,true,true),...demoCapsules("n0c",false,true).map(c=>({...c,roomId:n.id}))]:demoCapsules(n.id,war,false);
    const h=hubOf(n.id),room=getRoom(n.id),g=h?.gate;
    return{handle:n.name,location:`${zoneOf(n).name.replace(" Craft Zone"," Node")}, ${n.city}`,tier:tierOf(metricsOf(cs)),metrics:metricsOf(cs),skills:skillsOf(cs),capsules:cs.sort((a,b)=>b.createdAt-a.createdAt),
      preview:true,nodeId:n.id,live:h?.live&&!h.suspended?{nodeId:n.id,kind:room?.type??"commons",roomNumber:100+Math.floor(hash(n.id+"rn")*900),label:g?.canvas??g?.skill??"Live session"}:null}}
  if(mine&&session)return{handle:session.handle,location:null,tier:"rising",metrics:metricsOf([]),skills:[],capsules:[],preview:false,nodeId:null,live:null}; // earned, never granted
  return null}
