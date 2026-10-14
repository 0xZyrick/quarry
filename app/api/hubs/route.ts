import {getIdentity} from "@/lib/identity";
import {authorize,json,sameOrigin} from "@/lib/server/authz";
import {snapshot,goLive,goOffline,setGreenroom} from "@/lib/server/registry";
import {setPublish} from "@/lib/server/livekitPerms";
import * as safety from "@/lib/server/safety";
import {CANVAS_SOURCES} from "@/lib/access";
import {ZONES} from "@/lib/map";
import {CREATOR_TAGS} from "@/lib/onboarding";
export const dynamic="force-dynamic";
// GET: the public map state (which rooms are live, flagged out, have a Greenroom). Flaggers are never exposed.
export async function GET(){safety.tick();return json(snapshot())}
// POST {op:"golive"|"offline"|"greenroom", room, ...}. Reports live in /api/safety/report. Everything is checked against the caller's role in that room.
export async function POST(req:Request){
  if(!sameOrigin(req))return json({error:"forbidden"},403);
  const b=await req.json().catch(()=>({})),room=String(b.room??""),a=authorize(req,room);
  if(!a)return json({error:"no such room"},404);
  if(a.kind!=="owner-creator")return json({error:"only the room owner"},403);
  if(b.op==="golive"){
    const canvas=CANVAS_SOURCES.includes(b.canvas)?b.canvas:null,skill=typeof b.skill==="string"?b.skill.slice(0,40):null;
    // Launch Portal declaration: room title, craft tags, environment, and which input path feeds the desk. All sanitised here.
    const meta=typeof b.title==="string"?{title:b.title.replace(/\s+/g," ").trim().slice(0,60),
      tags:(Array.isArray(b.tags)?b.tags:[]).filter((t:unknown)=>typeof t==="string"&&CREATOR_TAGS.includes(t)).slice(0,5),
      env:b.env==="focus"?"focus" as const:"sandbox" as const,path:b.path==="digital"||b.path==="physical"?b.path as "digital"|"physical":null,
      zone:ZONES.some(z=>z.id===b.zone)?String(b.zone):null}:undefined;
    if(meta&&!meta.title)return json({error:"give the room a title"},422);
    if(!goLive(room,{canvas,skill},meta))return json({error:"needs a canvas source or skill tag, or the room is suspended"},422);
    await setPublish(room,a.idt.id,["camera","microphone","screen_share"]); // the Active Canvas gate is passed: camera is now allowed
    return json(snapshot())}
  if(b.op==="offline"){goOffline(room);await setPublish(room,a.idt.id,["microphone","screen_share"]);return json(snapshot())}
  if(b.op==="greenroom"){if(a.room.type!=="war")return json({error:"war rooms only"},422);setGreenroom(room,!!b.on);return json(snapshot())}
  return json({error:"bad op"},400)}
