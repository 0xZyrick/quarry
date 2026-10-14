// Paystack -> us. No cookie, no origin check: the HMAC-SHA512 signature IS the authentication.
import {verifyWebhookSignature,PaystackError} from "@/lib/server/payments/paystack";
import {processChargeSuccess} from "@/lib/server/payments/webhook";
import {PAYMENTS_ON} from "@/lib/flags";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function POST(req:Request){
  const raw=await req.text(); // the exact bytes Paystack signed; never re-serialise parsed JSON before checking
  try{if(!verifyWebhookSignature(raw,req.headers.get("x-paystack-signature")))return new Response("invalid signature",{status:401})}
  catch(e){if(e instanceof PaystackError)return new Response("not configured",{status:503});throw e}
  if(!PAYMENTS_ON)return new Response("payments disabled",{status:503}); // Paystack will retry
  let ev:any;try{ev=JSON.parse(raw)}catch{return new Response("bad json",{status:400})}
  if(ev?.event!=="charge.success")return new Response("ok"); // other events are acknowledged and ignored
  try{const outcome=await processChargeSuccess(ev.data);return Response.json({ok:true,outcome})}
  catch(e){console.error("paystack webhook failed",e);return new Response("retry",{status:500})} // non-2xx makes Paystack redeliver; processing is idempotent
}
