import {getIdentity} from "@/lib/identity";
import {json} from "@/lib/server/authz";
import {vaultFor} from "@/lib/server/vault";
export const dynamic="force-dynamic";
export async function GET(req:Request,{params}:{params:{handle:string}}){
  const v=await vaultFor(decodeURIComponent(params.handle),getIdentity(req).session);return v?json(v):json({error:"not found"},404)}
