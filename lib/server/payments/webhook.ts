// charge.success handling. The route has already verified the signature; this decides what the event means.
import {prisma} from "./db";
import {creditDeposit} from "./wallet";
import {verifyTransaction} from "./paystack";
import * as escrow from "../escrow";

export type Outcome="credited"|"funded"|"duplicate"|"ignored";
export async function processChargeSuccess(d:any):Promise<Outcome>{
  const ref=typeof d?.reference==="string"?d.reference:"",amount=d?.amount;
  if(!ref||!Number.isSafeInteger(amount)||amount<=0||d.currency!=="NGN"||d.status!=="success")return"ignored";
  // Belt and braces: ask Paystack itself. A throw here becomes a 500, so Paystack retries later.
  const v=await verifyTransaction(ref);
  if(v.status!=="success"||v.amount!==amount||v.currency!=="NGN"){console.error("webhook: verify mismatch",ref);return"ignored"}

  // Context A: virtual-account deposit -> internal balance
  const acct=d.authorization?.receiver_bank_account_number??d.dedicated_account?.account_number;
  if(d.channel==="dedicated_nuban"||acct){
    const w=acct?await prisma.wallet.findUnique({where:{dedicatedBankNumber:String(acct)}}):null;
    if(!w){console.error("webhook: deposit for an unknown virtual account, needs manual reconciliation",ref,acct);return"ignored"}
    return creditDeposit(w.id,w.userId,amount,ref)}

  // Context B: War Room milestone payment. Trust OUR pending row (written by /api/escrow/initialize), never the webhook's metadata.
  const row=await prisma.transactionLedger.findUnique({where:{reference:ref}});
  if(!row||row.type!=="ESCROW_SPLIT"||!row.roomId||!row.milestoneId)return"ignored";
  if(row.amountKobo!==amount){console.error("webhook: escrow AMOUNT MISMATCH, not funding",ref,row.amountKobo,amount);return"ignored"}
  const claimed=await prisma.transactionLedger.updateMany({where:{reference:ref,status:"PENDING"},data:{status:"SUCCESSFUL"}}); // only one delivery wins the PENDING -> SUCCESSFUL flip
  if(claimed.count===0)return"duplicate";
  if(escrow.isFunded(row.roomId,row.milestoneId))console.error("webhook: milestone was already funded, this payment needs a refund",ref);
  escrow.markFunded(row.roomId,row.milestoneId);
  return"funded"}

// The escrow book is in memory today, so after a restart it is rebuilt from the durable ledger.
export async function hydrateFunded(roomId:string){
  const rows=await prisma.transactionLedger.findMany({where:{roomId,type:"ESCROW_SPLIT",status:"SUCCESSFUL"},select:{milestoneId:true}});
  for(const r of rows)if(r.milestoneId)escrow.markFunded(roomId,r.milestoneId)}
