import {randomBytes} from "node:crypto";
import {getIdentity} from "@/lib/identity";
import {cookieFor} from "@/lib/server/session";
import {validInvite,cleanName} from "@/lib/server/invite";
import {claimHandle} from "@/lib/server/registry";
import {json,sameOrigin} from "@/lib/server/authz";
import {limit,ipOf} from "@/lib/server/ratelimit";
export const dynamic="force-dynamic";
// POST {code,name}: the one door into the app. A valid invite code plus a display name creates the account and its signed session
// (the track is chosen on the next onboarding screen). Wrong codes are rate-limited per IP.
export async function POST(req:Request){
  if(!sameOrigin(req))return json({error:"forbidden"},403);
  if(!limit("invite:"+ipOf(req),8,60e3))return json({error:"Too many tries. Wait a minute."},429);
  const b=await req.json().catch(()=>({}));
  if(!validInvite(b.code))return json({error:"That invite code isn't valid."},403);
  const name=cleanName(b.name);
  if(!name)return json({error:"Pick a name of 2 to 24 letters or numbers."},400);
  const prev=getIdentity(req).session,uid=prev&&prev.uid.startsWith("inv_")?prev.uid:"inv_"+randomBytes(12).toString("base64url");
  if(!claimHandle(name,uid))return json({error:"That name is taken."},409);
  return json({uid,name},200,cookieFor({uid,handle:name,track:prev?.uid===uid?prev.track:null}))}
