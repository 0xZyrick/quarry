import {getIdentity} from "@/lib/identity";
import {json,sameOrigin} from "@/lib/server/authz";
import * as safety from "@/lib/server/safety";
import {limit} from "@/lib/server/ratelimit";
export const dynamic="force-dynamic";
// POST {caseId, text}. One appeal per case, from the room's owner. A human reviews it; nobody who reported or owns the room can decide it.
export async function POST(req:Request){
  if(!sameOrigin(req))return json({error:"forbidden"},403);
  const s=getIdentity(req).session;if(!s)return json({error:"sign in"},401);
  if(!limit("appeal:"+s.uid,5,36e5))return json({error:"too many appeals"},429);
  const b=await req.json().catch(()=>({})),r=safety.appeal(String(b.caseId??""),s.uid,String(b.text??""));
  return r.ok?json({ok:true}):json({error:r.error},r.code)}
