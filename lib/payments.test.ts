// Run with: npx tsx lib/payments.test.ts
// Part 1 needs nothing. Part 2 (row locking, idempotency) needs a throwaway Postgres: DATABASE_URL=postgresql://... npx prisma migrate deploy && DATABASE_URL=... npx tsx lib/payments.test.ts
process.env.PAYSTACK_SECRET_KEY="sk_test_unit1234567890";
import {createHmac} from "node:crypto";
import {koboOf,nairaToKobo} from "./server/payments/money";
import {verifyWebhookSignature,secretKey} from "./server/payments/paystack";
import * as escrow from "./server/escrow";
import {getRoom} from "./server/registry";
let bad=0;const eq=(a:any,b:any,m:string)=>{if(JSON.stringify(a)!==JSON.stringify(b)){bad++;console.log("FAIL",m,JSON.stringify(a),"!=",JSON.stringify(b))}else console.log("ok  ",m)};

// ---- zero-float strictness
eq(koboOf(500000),500000,"whole kobo accepted");
for(const v of[1.5,0.1,"500",NaN,Infinity,-5,0,null,undefined,{},[],2_000_000_001,Number.MAX_SAFE_INTEGER+2])eq(koboOf(v),null,"rejects "+String(v));
eq(nairaToKobo(2500),250000,"Naira x100");eq(nairaToKobo(12.5),null,"fractional Naira rejected");

// ---- webhook signature
const body=JSON.stringify({event:"charge.success",data:{reference:"r1",amount:100}});
const sig=createHmac("sha512","sk_test_unit1234567890").update(body).digest("hex");
eq(verifyWebhookSignature(body,sig),true,"valid signature passes");
eq(verifyWebhookSignature(body+" ",sig),false,"1 byte changed in body fails");
eq(verifyWebhookSignature(body,sig.slice(0,-1)+(sig.endsWith("0")?"1":"0")),false,"1 char changed in signature fails");
eq(verifyWebhookSignature(body,null),false,"missing header fails");
eq(verifyWebhookSignature(body,"short"),false,"wrong length fails (no throw)");
eq(verifyWebhookSignature(body,sig.toUpperCase()),true,"hex case-insensitive");

// ---- sandbox binding
process.env.PAYSTACK_SECRET_KEY="sk_live_abcdef123456";
let threw=false;try{secretKey()}catch{threw=true}eq(threw,true,"sk_live_ refused outside production");
process.env.PAYSTACK_SECRET_KEY="";threw=false;try{secretKey()}catch{threw=true}eq(threw,true,"missing key refused");
process.env.PAYSTACK_SECRET_KEY="sk_test_unit1234567890";

// ---- escrow funded flag
const war=[...Array(12).keys()].map(i=>"n"+i).find(id=>getRoom(id)?.type==="war")!;
eq(escrow.state(war,"party").escrowFunded,false,"tank starts unfunded");
eq(escrow.isFunded(war,"m3"),false,"m3 not funded");
escrow.markFunded(war,"m3");
eq(escrow.state(war,"party").escrowFunded,true,"funding the active milestone lights the tank");
eq(escrow.isFunded(war,"m4"),false,"other milestones unaffected");

// ---- Part 2: real Postgres
async function db(){
  const {prisma}=await import("./server/payments/db");
  const {flickTip,ensureWallet,creditDeposit,InsufficientBalance}=await import("./server/payments/wallet");
  const id=Math.random().toString(36).slice(2,10),A="dev_A"+id+"xxxx",B="dev_B"+id+"xxxx";
  const wa=await ensureWallet(A),wb=await ensureWallet(B);
  await creditDeposit(wa.id,A,1000,"dep_"+id);
  eq((await creditDeposit(wa.id,A,1000,"dep_"+id)),"duplicate","deposit replay is a no-op");
  eq((await prisma.wallet.findUnique({where:{userId:A}}))!.internalCreditBalance,1000,"deposit credited once");
  // 20 parallel tips of 100 from a balance of 1000: exactly 10 may win
  const rs=await Promise.allSettled(Array.from({length:20},()=>flickTip(A,B,100)));
  eq(rs.filter(r=>r.status==="fulfilled").length,10,"exactly 10 of 20 concurrent tips succeed");
  eq(rs.filter(r=>r.status==="rejected"&&(r as any).reason instanceof InsufficientBalance).length,10,"the rest fail with Insufficient Platform Balance");
  eq((await prisma.wallet.findUnique({where:{userId:A}}))!.internalCreditBalance,0,"sender ends at 0, never negative");
  eq((await prisma.wallet.findUnique({where:{userId:B}}))!.internalCreditBalance,1000,"receiver got exactly 1000");
  // idempotent replay
  await creditDeposit(wa.id,A,500,"dep2_"+id);
  const k="tip_"+A+"_key1";const r1=await flickTip(A,B,100,k),r2=await flickTip(A,B,100,k);
  eq([r1.duplicate,r2.duplicate],[false,true],"same idempotency key replays safely");
  eq((await prisma.wallet.findUnique({where:{userId:A}}))!.internalCreditBalance,400,"debited once");
  // opposite directions at once: must not deadlock
  await creditDeposit(wb.id,B,10000,"dep3_"+id);
  const x=await Promise.all(Array.from({length:10},(_,i)=>flickTip(i%2?A:B,i%2?B:A,10)));
  eq(x.length,10,"A->B and B->A concurrently: no deadlock");
  const tot=(await prisma.wallet.findMany({where:{userId:{in:[A,B]}}})).reduce((s,w)=>s+w.internalCreditBalance,0);
  eq(tot,1000+500+10000,"money is conserved");
  await prisma.$disconnect()}
(async()=>{if(process.env.DATABASE_URL)await db();else console.log("skip Postgres tests (set DATABASE_URL)");
console.log(bad?`\n${bad} FAILED`:"\nall passed");process.exit(bad?1:0)})();
