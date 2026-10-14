// One place every API route asks "who is this, and what may they do in this room". Uses the same kindIn/capsOf as the UI.
import {getIdentity} from "../identity";
import {getRoom,profileFor,hubOf} from "./registry";
import {kindIn,capsOf} from "../access";
import * as safety from "./safety";
import * as chat from "./chat";
safety.bindChat(chat.uidOf);
export function authorize(req:Request,roomId:string){
  const idt=getIdentity(req),room=getRoom(roomId);if(!room)return null;
  if(idt.session)safety.touch(idt.session.uid);
  const profile=profileFor(idt.session),kind=kindIn(profile,{id:room.id,ownerId:room.id,type:room.type});
  const visiting=!!profile?.creatorNodeId&&profile.creatorNodeId!==room.id;
  // A Silent Focus Bench is watch-only for guests: no chat, no mic requests.
  const quiet=hubOf(room.id).meta?.env==="focus"&&kind==="guest",base=capsOf(kind,room.type,visiting);
  return{idt,room,profile,kind,caps:quiet?{...base,chat:false,requestMic:false}:base,
    // dark to everyone but its owner while held; banned accounts and room-banned accounts see nothing
    hidden:(hubOf(room.id).suspended&&kind!=="owner-creator")||safety.isBanned(idt.session?.uid)||safety.isRoomBanned(room.id,idt.id)}}
export const json=(b:unknown,status=200,cookie?:string)=>new Response(JSON.stringify(b),
  {status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",...(cookie?{"Set-Cookie":cookie}:{})}});
export const sameOrigin=(req:Request)=>{const o=req.headers.get("origin");return!o||new URL(o).host===req.headers.get("host")};
