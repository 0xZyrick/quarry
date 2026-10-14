import {getIdentity} from "@/lib/identity";
import {cookieFor,UID,Session} from "@/lib/server/session";
import {profileFor} from "@/lib/server/registry";
import {json,sameOrigin} from "@/lib/server/authz";
export const dynamic="force-dynamic";
const DEV:Record<string,Session>={creator:{uid:"u-creator",handle:"kodo.dev",track:"creator"},co:{uid:"u-co",handle:"mio.3d",track:"creator"},
  client:{uid:"u-client",handle:"acme.studio",track:"client"},arbiter:{uid:"u-arbiter",handle:"arbiter",track:null},mod:{uid:"u-mod",handle:"mod",track:null}};
import {limit,ipOf} from "@/lib/server/ratelimit";
// GET: the account the server sees right now (or null).
export async function GET(req:Request){const s=getIdentity(req).session;return json({profile:profileFor(s)})}
// POST: set the track on a signed-in (invited) account. Body is {uid,track} from onboarding, or {dev:"creator|co|client|arbiter"} outside production.
// The cookie carries identity only; what the account may do in a room is decided by the registry on every request.
export async function POST(req:Request){
  if(!sameOrigin(req))return json({error:"forbidden"},403);
  if(!limit("session:"+ipOf(req),20,60e3))return json({error:"slow down"},429);
  const b=await req.json().catch(()=>({}));let s:Session|null=null;
  if(typeof b.dev==="string"){if(process.env.NODE_ENV==="production"||!DEV[b.dev])return json({error:"forbidden"},403);s=DEV[b.dev]}
  else{ // onboarding: the track is set on an account that already came in through /api/invite (its signed cookie proves it)
    const cur=getIdentity(req).session;
    if(!cur||typeof b.uid!=="string"||!UID.test(b.uid)||cur.uid!==b.uid)return json({error:"invite required"},401);
    if(b.track==="creator"||b.track==="client")s={uid:cur.uid,handle:cur.handle,track:b.track};
    else s=cur}
  if(!s)return json({error:"invalid"},400);
  return json({profile:profileFor(s)},200,cookieFor(s))}
