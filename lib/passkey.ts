// One-tap sign-in. Creates a platform passkey (FaceID / TouchID / Windows Hello) and derives the account id from it.
// If the device cannot do WebAuthn (insecure origin, old browser), it falls back to a device-local account id.
// NOTE: the challenge is generated in the browser, so this proves device presence only. Before real money moves, create the
// challenge on the server, verify the attestation there, and issue a session. Account-abstraction wallet deploy hooks in after this call.
const b64=(b:ArrayBuffer)=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
export type Auth={uid:string;auth:"passkey"|"device"};
export async function registerPasskey():Promise<Auth>{
  if(!window.PublicKeyCredential||!navigator.credentials||!window.isSecureContext)return{uid:"dev_"+crypto.randomUUID(),auth:"device"};
  const id=crypto.getRandomValues(new Uint8Array(16));
  const cred=await navigator.credentials.create({publicKey:{
    challenge:crypto.getRandomValues(new Uint8Array(32)),
    rp:{name:"The Guild",id:location.hostname},
    user:{id,name:"guild-"+b64(id.buffer).slice(0,6),displayName:"Guild member"},
    pubKeyCredParams:[{type:"public-key",alg:-7},{type:"public-key",alg:-257}],
    authenticatorSelection:{authenticatorAttachment:"platform",userVerification:"required",residentKey:"preferred"},
    timeout:60000}}) as PublicKeyCredential|null;
  if(!cred)throw new Error("cancelled");
  return{uid:"pk_"+b64(cred.rawId).slice(0,22),auth:"passkey"}}
