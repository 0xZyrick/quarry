import {getIdentity} from "@/lib/identity";
import {json} from "@/lib/server/authz";
import * as safety from "@/lib/server/safety";
import {isModerator} from "@/lib/server/session";
export const dynamic="force-dynamic";
// What the signed-in account needs to know about its own standing: strikes, holds on its rooms, whether it can appeal.
export async function GET(req:Request){const s=getIdentity(req).session;if(!s)return json({signedIn:false});
  return json({signedIn:true,moderator:isModerator(s),...safety.mine(s.uid)})}
