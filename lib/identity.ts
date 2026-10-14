// Server-side identity: a signed session when the account signed in, otherwise an anonymous guest via httpOnly cookie.
import {readSession,Session} from "./server/session";
const COLORS=["#00FF66","#00A3FF","#FF6B00","#C084FC","#FACC15","#F472B6","#2DD4BF","#A3E635"];
export type Identity={id:string;name:string;color:string;setCookie?:string;session:Session|null};
export function getIdentity(req:Request):Identity{
  const session=readSession(req);
  const m=/(?:^|;\s*)guild_uid=([0-9a-f-]{36})/.exec(req.headers.get("cookie")??"");
  const id=session?session.uid:m?m[1]:crypto.randomUUID();
  const h=[...id].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7);
  return{id,session,name:session?session.handle:"guest-"+id.slice(0,4),color:COLORS[h%COLORS.length],
    setCookie:session||m?undefined:`guild_uid=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${process.env.NODE_ENV==="production"?"; Secure":""}`}}
