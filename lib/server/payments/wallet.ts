// The internal ledger. Every balance change happens inside one Postgres transaction that first takes row locks (SELECT ... FOR UPDATE).
import {randomUUID} from "node:crypto";
import {prisma,Prisma,isUnique} from "./db";
import {MAX_BALANCE} from "./money";

export async function ensureWallet(userId:string,handle?:string){
  for(let i=0;i<2;i++){try{
    await prisma.user.upsert({where:{id:userId},update:{},create:{id:userId,handle}});
    return await prisma.wallet.upsert({where:{userId},update:{},create:{userId}})
  }catch(e){if(!isUnique(e)||i)throw e}} // two first-requests racing: the loser just retries the upsert
  throw new Error("unreachable")}

// Lock the given wallets in a fixed (userId) order. Taking locks in the same order everywhere means A->B and B->A tips queue up instead of deadlocking.
async function lockWallets(tx:Prisma.TransactionClient,userIds:string[]){
  return tx.$queryRaw<{id:string;userId:string;internalCreditBalance:number}[]>`
    SELECT "id","userId","internalCreditBalance" FROM "Wallet" WHERE "userId" IN (${Prisma.join(userIds)}) ORDER BY "userId" FOR UPDATE`}

export class InsufficientBalance extends Error{constructor(){super("Insufficient Platform Balance")}}
export class WalletError extends Error{constructor(msg:string,readonly status:number){super(msg)}}

export type TipResult={ok:true;duplicate:boolean;reference:string;balanceKobo?:number};
// Zero-fee tip. Atomic: lock both rows -> check balance -> debit -> credit -> ledger -> COMMIT. Any throw rolls the whole thing back.
// `reference` is the idempotency key: replaying the same one never moves money twice.
export async function flickTip(senderId:string,receiverId:string,amountKobo:number,reference=`tip_${randomUUID()}`):Promise<TipResult>{
  if(senderId===receiverId)throw new WalletError("cannot tip yourself",400);
  await Promise.all([ensureWallet(senderId),ensureWallet(receiverId)]);
  try{
    const balanceKobo=await prisma.$transaction(async tx=>{
      const rows=await lockWallets(tx,[senderId,receiverId]);
      const s=rows.find(r=>r.userId===senderId),r=rows.find(x=>x.userId===receiverId);
      if(!s||!r)throw new WalletError("wallet missing",409);
      if(s.internalCreditBalance<amountKobo)throw new InsufficientBalance();       // checked on the LOCKED row: no concurrent request can sneak under it
      if(r.internalCreditBalance+amountKobo>MAX_BALANCE)throw new WalletError("recipient wallet limit reached",409);
      await tx.transactionLedger.create({data:{senderId,receiverId,amountKobo,type:"TIP_FLICK",status:"SUCCESSFUL",reference}}); // unique reference: a replay fails here and rolls back
      await tx.wallet.update({where:{id:s.id},data:{internalCreditBalance:{decrement:amountKobo}}});
      await tx.wallet.update({where:{id:r.id},data:{internalCreditBalance:{increment:amountKobo}}});
      return s.internalCreditBalance-amountKobo});
    return{ok:true,duplicate:false,reference,balanceKobo}
  }catch(e){
    if(isUnique(e)){ // same idempotency key seen before: only acknowledge it if it was this sender's tip
      const prev=await prisma.transactionLedger.findUnique({where:{reference}});
      if(prev&&prev.senderId===senderId&&prev.type==="TIP_FLICK")return{ok:true,duplicate:true,reference};
      throw new WalletError("reference already used",409)}
    throw e}}

// Context A: a bank transfer into a user's dedicated account. Idempotent on the Paystack reference.
export async function creditDeposit(walletId:string,userId:string,amountKobo:number,reference:string):Promise<"credited"|"duplicate">{
  try{
    await prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT "id" FROM "Wallet" WHERE "id"=${walletId} FOR UPDATE`;
      await tx.transactionLedger.create({data:{receiverId:userId,amountKobo,type:"DEPOSIT",status:"SUCCESSFUL",reference}});
      await tx.wallet.update({where:{id:walletId},data:{internalCreditBalance:{increment:amountKobo}}})});
    return"credited"
  }catch(e){if(isUnique(e))return"duplicate";throw e}}
