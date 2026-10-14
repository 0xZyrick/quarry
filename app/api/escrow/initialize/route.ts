// POST {roomId, milestoneId, email}. The client pays an upfront milestone. The amount comes from the server's contract, never from the browser.
import {randomUUID} from "node:crypto";
import {authorize,json,sameOrigin} from "@/lib/server/authz";
import * as escrow from "@/lib/server/escrow";
import {PAYMENTS_ON} from "@/lib/flags";
import {limit} from "@/lib/server/ratelimit";
import {prisma} from "@/lib/server/payments/db";
import {nairaToKobo} from "@/lib/server/payments/money";
import {initializeTransaction,PaystackError} from "@/lib/server/payments/paystack";
import {hydrateFunded} from "@/lib/server/payments/webhook";
export const dynamic="force-dynamic";
const EMAIL=/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
export async function POST(req:Request){
  if(!sameOrigin(req))return json({error:"forbidden"},403);
  if(!PAYMENTS_ON)return json({error:"payments are not live yet",code:"payments_disabled"},503);
  const b=await req.json().catch(()=>({}));
  const a=authorize(req,String(b.roomId??""));if(!a||a.hidden)return json({error:"not found"},404);
  if(!a.idt.session||!a.caps.release||a.room.type!=="war")return json({error:"only the paying client can fund a milestone"},403); // same capability as Escrow Release
  if(!limit("escrowinit:"+a.idt.id,10,600e3))return json({error:"slow down"},429);
  const email=String(b.email??"");if(!EMAIL.test(email))return json({error:"a valid email is required"},400);
  const creatorUid=a.room.ownerUid;if(!creatorUid)return json({error:"room has no creator"},409);
  await hydrateFunded(a.room.id);
  const ms=escrow.state(a.room.id,"party").milestones.find(m=>m.id===String(b.milestoneId??""));
  if(!ms)return json({error:"no such milestone"},404);
  if(ms.status!=="active")return json({error:"only the active milestone can be funded"},409);
  if(escrow.isFunded(a.room.id,ms.id))return json({error:"milestone is already funded"},409);
  const amountKobo=nairaToKobo(ms.amount);if(!amountKobo)return json({error:"contract amount must be whole Naira"},409);
  const creator=await prisma.wallet.findUnique({where:{userId:creatorUid}});
  if(!creator?.paystackSubaccountCode)return json({error:"the creator has not finished payout onboarding"},409);
  const reference="qry_esc_"+randomUUID();
  await prisma.transactionLedger.create({data:{senderId:a.idt.session.uid,receiverId:creatorUid,amountKobo,type:"ESCROW_SPLIT",status:"PENDING",reference,roomId:a.room.id,milestoneId:ms.id}});
  try{
    const t=await initializeTransaction({email,amount:amountKobo,reference,subaccount:creator.paystackSubaccountCode,
      callback_url:process.env.APP_URL?`${process.env.APP_URL}/?room=${encodeURIComponent(a.room.id)}`:undefined,metadata:{roomId:a.room.id,milestoneId:ms.id}});
    return json({ok:true,authorizationUrl:t.authorization_url,reference})
  }catch(e){
    await prisma.transactionLedger.update({where:{reference},data:{status:"FAILED"}});
    if(e instanceof PaystackError)return json({error:e.status===503?"payments are not configured":"the payment provider refused the request"},e.status===503?503:502);
    console.error("escrow/initialize",e);return json({error:"server error"},500)}}
