import {authorize,json,sameOrigin} from "@/lib/server/authz";
import * as escrow from "@/lib/server/escrow";
import * as chat from "@/lib/server/chat";
import {isArbiter} from "@/lib/server/session";
import {PAYMENTS_ON,ALPHA_TOKENS} from "@/lib/flags";
import {limit,ipOf} from "@/lib/server/ratelimit";
import {hydrateFunded} from "@/lib/server/payments/webhook";
export const dynamic="force-dynamic";
const TIPS=[2,5,10];
export async function GET(req:Request,{params}:{params:{room:string}}){
  const a=authorize(req,params.room);if(!a||a.hidden)return json({error:"not found"},404);
  if(PAYMENTS_ON)await hydrateFunded(a.room.id).catch(()=>{}); // funded flags survive a restart (they live in the ledger)
  const party=a.kind==="client-owner"||a.kind==="owner-creator"||isArbiter(a.idt.session);
  return json(escrow.state(a.room.id,party?"party":"public"))}
// POST {op:"release"|"dispute"|"respond"|"resolve"|"tip"}. Role comes from the registry, not from anything the browser says about itself.
export async function POST(req:Request,{params}:{params:{room:string}}){
  if(!sameOrigin(req))return json({error:"forbidden"},403);
  if(!PAYMENTS_ON&&ALPHA_TOKENS){ // alpha play tokens: a sticky note only, no money moves. Every other op stays refused below.
    const b=await req.clone().json().catch(()=>({}));
    if(b.op==="tip"){const a=authorize(req,params.room);if(!a||a.hidden)return json({error:"not found"},404);
      if(!a.caps.tip||!a.idt.session)return json({error:"sign in as a spectator to leave a note"},403);
      if(!limit("sticky:"+a.idt.id,12,60e3))return json({error:"slow down"},429);
      const amount=Number(b.amount);if(!TIPS.includes(amount))return json({error:"bad amount"},400);
      const tile=String(b.tile??"").slice(0,80);if(tile==="u-"+a.idt.id)return json({error:"cannot tip yourself"},400);
      const n=b.note??{};
      chat.addNote(a.room.id,{id:String(n.id??crypto.randomUUID()).slice(0,64),tile,x:Math.min(1,Math.max(0,+n.x||.5)),y:Math.min(1,Math.max(0,+n.y||.5)),
        text:String(n.text??"🔥").replace(/[\u0000-\u001f]/g," ").slice(0,80),amount,by:"u-"+a.idt.id});
      chat.system(a.room.id,`@${a.idt.name} dropped a $${amount} play token!`);return json({ok:true})}}
  if(!PAYMENTS_ON)return json({error:"payments are not live yet",code:"payments_disabled"},503); // tips, release, dispute, resolve: all money paths
  const a=authorize(req,params.room);if(!a||a.hidden)return json({error:"not found"},404);
  const b=await req.json().catch(()=>({})),room=a.room.id,who=a.idt.name;
  const done=(r:escrow.Res)=>{if(!r.ok)return json({error:r.error},r.code);if(r.label)chat.system(room,r.label);return json({ok:true,state:escrow.state(room,"party")})};
  switch(b.op){
    case"release":if(a.caps.release&&!escrow.isFunded(room,String(b.id??""))){await hydrateFunded(room);if(!escrow.isFunded(room,String(b.id??"")))return json({error:"milestone has not been funded"},409)}
      return a.caps.release?done(escrow.release(room,String(b.id??""))):json({error:"only the client can release"},403);
    case"dispute":return a.caps.dispute?done(escrow.openDispute(room,who,String(b.reason??""))):json({error:"only the client can dispute"},403);
    case"respond":return a.kind==="owner-creator"?done(escrow.respond(room,String(b.text??""))):json({error:"only the hired creator can respond"},403);
    case"resolve":{if(!isArbiter(a.idt.session))return json({error:"arbiters only"},403);
      const o=["release","refund","split"].includes(b.outcome)?b.outcome:null;return o?done(escrow.resolve(room,o)):json({error:"bad outcome"},400)}
    case"tip":{
      if(!a.caps.tip||!a.idt.session)return json({error:"sign in as a spectator to tip"},403);
      const amount=Number(b.amount);if(!TIPS.includes(amount))return json({error:"bad amount"},400);
      const tile=String(b.tile??"").slice(0,80);if(tile==="u-"+a.idt.id)return json({error:"cannot tip yourself"},400);
      const n=b.note??{};
      chat.addNote(room,{id:String(n.id??crypto.randomUUID()).slice(0,64),tile,x:Math.min(1,Math.max(0,+n.x||.5)),y:Math.min(1,Math.max(0,+n.y||.5)),
        text:String(n.text??"🔥").slice(0,80),amount,by:"u-"+a.idt.id});
      chat.system(room,`@${who} tipped $${amount}!`);return json({ok:true})}}
  return json({error:"bad op"},400)}
