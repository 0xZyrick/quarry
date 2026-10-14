// Signed session cookie. The server, not the browser, decides who an account is.
// Claims in the cookie are only identity (uid, handle, track). Privileges (room owner, paying client, crew) always come from the registry.
// Entry is invite-code only for now (POST /api/invite issues the first cookie). Passkey / password come later: add them in front of `cookieFor`.
import {createHmac,timingSafeEqual} from "node:crypto";
export type Session={uid:string;handle:string;track:"creator"|"client"|null};
const secret=()=>{const s=process.env.SESSION_SECRET;if(s)return s;
  if(process.env.NODE_ENV==="production")throw new Error("SESSION_SECRET is not set");return"dev-only-secret-change-me"};
const mac=(b:string)=>createHmac("sha256",secret()).update(b).digest("base64url");
export const UID=/^(inv_|pk_|dev_)[A-Za-z0-9_-]{8,64}$/;
export function cookieFor(s:Session){const body=Buffer.from(JSON.stringify({...s,exp:Date.now()+30*864e5})).toString("base64url");
  return`guild_sess=${body}.${mac(body)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30*86400}${process.env.NODE_ENV==="production"?"; Secure":""}`}
export function readSession(req:Request):Session|null{
  const m=/(?:^|;\s*)guild_sess=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/.exec(req.headers.get("cookie")??"");if(!m)return null;
  const a=Buffer.from(mac(m[1])),b=Buffer.from(m[2]);if(a.length!==b.length||!timingSafeEqual(a,b))return null;
  try{const j=JSON.parse(Buffer.from(m[1],"base64url").toString());if(!j||j.exp<Date.now()||typeof j.uid!=="string"||typeof j.handle!=="string")return null;
    return{uid:j.uid,handle:j.handle.slice(0,32),track:j.track==="creator"||j.track==="client"?j.track:null}}catch{return null}}
export const isModerator=(s:Session|null)=>!!s&&((process.env.MODERATOR_UIDS??"").split(",").includes(s.uid)||(process.env.NODE_ENV!=="production"&&s.uid==="u-mod"));
export const isArbiter=(s:Session|null)=>!!s&&((process.env.ARBITER_UIDS??"").split(",").includes(s.uid)||(process.env.NODE_ENV!=="production"&&s.uid==="u-arbiter"));
