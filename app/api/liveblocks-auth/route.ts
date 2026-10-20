import {Liveblocks} from "@liveblocks/node";
import {getIdentity} from "@/lib/identity";
import {authorize} from "@/lib/server/authz";
import {liveblocksAccess} from "@/lib/access";
export const dynamic="force-dynamic";

const ROOM=/^guild-[A-Za-z0-9:_-]{1,48}$/; // only Guild rooms can ever be granted
const json=(body:unknown,status:number,cookie?:string)=>new Response(JSON.stringify(body),
  {status,headers:{"Content-Type":"application/json",...(cookie?{"Set-Cookie":cookie}:{})}});
const sameOrigin=(req:Request)=>{const o=req.headers.get("origin");
  return !o||new URL(o).host===req.headers.get("host")};

// GET: who am I (name + color shown to other people in the room)
export async function GET(req:Request){
  const u=getIdentity(req);return json({id:u.id,name:u.name,color:u.color},200,u.setCookie);
}

// POST: Liveblocks asks for a token for one room
export async function POST(req:Request){
  if(!sameOrigin(req))return json({error:"forbidden"},403);
  const secret=process.env.LIVEBLOCKS_SECRET_KEY;
  if(!secret)return json({error:"LIVEBLOCKS_SECRET_KEY is not set"},500);
  const {room}=await req.json().catch(()=>({}));
  if(typeof room!=="string"||!ROOM.test(room))return json({error:"invalid room"},400);
  const a=await authorize(req,room.slice(6));if(!a||a.hidden)return json({error:"not found"},404);
  const u=a.idt;
  const session=new Liveblocks({secret}).prepareSession(u.id,{userInfo:{name:u.name,color:u.color}});
  session.allow(room,liveblocksAccess(a.caps)==="FULL"?session.FULL_ACCESS:session.READ_ACCESS); // spectators watch and show a cursor; they cannot write strokes or layout
  const {status,body}=await session.authorize();
  return new Response(body,{status,headers:{"Content-Type":"application/json",...(u.setCookie?{"Set-Cookie":u.setCookie}:{})}});
}
