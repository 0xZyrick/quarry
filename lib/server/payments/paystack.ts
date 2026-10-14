// Thin Paystack client + webhook signature check. Server only. All amounts are kobo integers.
import {createHmac,timingSafeEqual} from "node:crypto";
const BASE="https://api.paystack.co";
export class PaystackError extends Error{constructor(msg:string,readonly status=502){super(msg)}}
// Sandbox binding: outside production only sk_test_ keys are accepted, so localhost can never touch live money.
export function secretKey():string{const k=process.env.PAYSTACK_SECRET_KEY??"";
  if(!k)throw new PaystackError("PAYSTACK_SECRET_KEY is not set",503);
  if(!/^sk_(test|live)_[A-Za-z0-9]+$/.test(k))throw new PaystackError("PAYSTACK_SECRET_KEY is malformed",503);
  if(process.env.NODE_ENV!=="production"&&!k.startsWith("sk_test_"))throw new PaystackError("Only an sk_test_ key may be used outside production",503);
  return k}
async function call<T>(method:"GET"|"POST",path:string,body?:object):Promise<T>{
  const res=await fetch(BASE+path,{method,headers:{Authorization:`Bearer ${secretKey()}`,"Content-Type":"application/json"},
    body:body?JSON.stringify(body):undefined,cache:"no-store",signal:AbortSignal.timeout(15_000)});
  const j=await res.json().catch(()=>null) as {status?:boolean;message?:string;data?:T}|null;
  if(!res.ok||!j?.status||j.data===undefined){console.error("paystack",method,path,res.status,j?.message);throw new PaystackError(j?.message??`Paystack ${res.status}`,res.status===404||res.status===422?422:502)}
  return j.data}
export const resolveAccount=(accountNumber:string,bankCode:string)=>
  call<{account_name:string;account_number:string}>("GET",`/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`);
// percentage_charge is the share Paystack routes to the MAIN (platform) account on every split charge for this subaccount.
export const createSubaccount=(p:{business_name:string;settlement_bank:string;account_number:string;percentage_charge:number})=>
  call<{subaccount_code:string}>("POST","/subaccount",p);
export const initializeTransaction=(p:{email:string;amount:number;reference:string;subaccount:string;callback_url?:string;metadata?:object})=>
  call<{authorization_url:string;access_code:string;reference:string}>("POST","/transaction/initialize",{...p,currency:"NGN"});
export const verifyTransaction=(reference:string)=>
  call<{status:string;amount:number;currency:string;reference:string}>("GET",`/transaction/verify/${encodeURIComponent(reference)}`);
// HMAC-SHA512 of the RAW body with the secret key, hex, compared in constant time.
export function verifyWebhookSignature(rawBody:string,header:string|null):boolean{
  if(!header)return false;
  const want=Buffer.from(createHmac("sha512",secretKey()).update(rawBody,"utf8").digest("hex"));
  const got=Buffer.from(header.trim().toLowerCase());
  return want.length===got.length&&timingSafeEqual(want,got)}
