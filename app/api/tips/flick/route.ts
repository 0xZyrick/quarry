// POST {roomId, amountKobo, idempotencyKey?}. Zero-fee tip from the signed-in sender to the room's host.
import {authorize,json,sameOrigin} from "@/lib/server/authz";
import {PAYMENTS_ON} from "@/lib/flags";
import {limit} from "@/lib/server/ratelimit";
import {koboOf} from "@/lib/server/payments/money";
import {flickTip,InsufficientBalance,WalletError} from "@/lib/server/payments/wallet";
export const dynamic="force-dynamic";
export async function POST(req:Request){
  if(!sameOrigin(req))return json({error:"forbidden"},403);
  if(!PAYMENTS_ON)return json({error:"payments are not live yet",code:"payments_disabled"},503);
  const b=await req.json().catch(()=>({}));
  const a=authorize(req,String(b.roomId??""));if(!a||a.hidden)return json({error:"not found"},404);
  if(!a.idt.session||!a.caps.tip)return json({error:"sign in as a spectator to tip"},403);
  if(!limit("flick:"+a.idt.id,60,60e3))return json({error:"slow down"},429);
  const amountKobo=koboOf(b.amountKobo);if(!amountKobo)return json({error:"amountKobo must be a whole positive number of kobo"},400);
  const host=a.room.ownerUid;if(!host)return json({error:"room has no host"},409);
  const key=b.idempotencyKey==null?undefined:String(b.idempotencyKey);
  if(key!==undefined&&!/^[A-Za-z0-9_-]{8,64}$/.test(key))return json({error:"bad idempotencyKey"},400);
  try{
    const r=await flickTip(a.idt.session.uid,host,amountKobo,key&&`tip_${a.idt.session.uid}_${key}`);
    return json({ok:true,duplicate:r.duplicate,balanceKobo:r.balanceKobo})
  }catch(e){
    if(e instanceof InsufficientBalance)return json({error:e.message},402);
    if(e instanceof WalletError)return json({error:e.message},e.status);
    console.error("tips/flick",e);return json({error:"server error"},500)}}
