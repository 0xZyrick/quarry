// Invite-only entry (passkey / password come later). A code is the only way in.
// Codes: INVITE_CODES (comma-separated, case-insensitive). If it is empty the built-in test code below works, so a fresh deploy can be tried at once.
// Set INVITE_CODES in production to replace it.
import {timingSafeEqual} from "node:crypto";
export const TEST_CODE="QUARRY-ALPHA-27";
const norm=(s:string)=>s.trim().toUpperCase().replace(/\s+/g,"");
export const codes=()=>{const e=(process.env.INVITE_CODES??"").split(",").map(norm).filter(Boolean);return e.length?e:[TEST_CODE,"GUILD-ALPHA-27"]};
export function validInvite(code:unknown):boolean{
  if(typeof code!=="string"||code.length>64)return false;
  const c=Buffer.from(norm(code));let ok=false;
  for(const k of codes()){const b=Buffer.from(k);if(b.length===c.length&&timingSafeEqual(b,c))ok=true}
  return ok}
// Display name -> handle: lowercase, letters digits . _ - only, 2..24 chars. Returns null if it cannot be used.
const RESERVED=new Set(["mod","arbiter","admin","guild","quarry","support","system","guest","me"]);
export function cleanName(s:unknown):string|null{
  if(typeof s!=="string")return null;
  const h=s.trim().toLowerCase().replace(/\s+/g,".").replace(/[^a-z0-9._-]/g,"").replace(/^[._-]+|[._-]+$/g,"").slice(0,24);
  return h.length>=2&&!RESERVED.has(h)?h:null}
