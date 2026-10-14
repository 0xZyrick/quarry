// POST {bankCode, accountNumber}. Verifies the bank account with Paystack, then creates the payout subaccount (platform keeps 5% of every split).
import {authorize,json,sameOrigin} from "@/lib/server/authz";
import {getIdentity} from "@/lib/identity";
import {profileFor} from "@/lib/server/registry";
import {PAYMENTS_ON} from "@/lib/flags";
import {limit} from "@/lib/server/ratelimit";
import {prisma} from "@/lib/server/payments/db";
import {ensureWallet} from "@/lib/server/payments/wallet";
import {resolveAccount,createSubaccount,PaystackError} from "@/lib/server/payments/paystack";
export const dynamic="force-dynamic";
const PLATFORM_CUT=5.0;
export async function POST(req:Request){
  if(!sameOrigin(req))return json({error:"forbidden"},403);
  if(!PAYMENTS_ON)return json({error:"payments are not live yet",code:"payments_disabled"},503);
  const s=getIdentity(req).session;
  // The creator promotion gate: a signed-in account on the creator track that owns a room. Put the milestone-validation check here too.
  if(!s||s.track!=="creator"||!profileFor(s)?.creatorNodeId)return json({error:"only promoted creators can onboard for payouts"},403);
  if(!limit("onboard:"+s.uid,5,3600e3))return json({error:"slow down"},429);
  const b=await req.json().catch(()=>({}));
  const bankCode=String(b.bankCode??""),accountNumber=String(b.accountNumber??"");
  if(!/^\d{3,6}$/.test(bankCode)||!/^\d{10}$/.test(accountNumber))return json({error:"bad bank details"},400);
  try{
    const w=await ensureWallet(s.uid,s.handle);
    if(w.paystackSubaccountCode)return json({ok:true,subaccountCode:w.paystackSubaccountCode,already:true}); // payout details are set once; changing them is a separate, reviewed flow
    const acct=await resolveAccount(accountNumber,bankCode); // proves the account exists and gives the legal name
    const sub=await createSubaccount({business_name:acct.account_name||s.handle,settlement_bank:bankCode,account_number:accountNumber,percentage_charge:PLATFORM_CUT});
    const won=await prisma.wallet.updateMany({where:{userId:s.uid,paystackSubaccountCode:null},data:{paystackSubaccountCode:sub.subaccount_code}});
    if(won.count===0){const cur=await prisma.wallet.findUnique({where:{userId:s.uid}});return json({ok:true,subaccountCode:cur?.paystackSubaccountCode,already:true})} // lost a double-click race
    return json({ok:true,subaccountCode:sub.subaccount_code,accountName:acct.account_name})
  }catch(e){
    if(e instanceof PaystackError)return json({error:e.status===503?"payments are not configured":"the bank details could not be verified"},e.status===503?503:e.status===422?422:502);
    console.error("onboard-creator",e);return json({error:"server error"},500)}}
