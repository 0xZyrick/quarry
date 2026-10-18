import {authorize,json,sameOrigin} from "@/lib/server/authz";
import * as chat from "@/lib/server/chat";
import * as safety from "@/lib/server/safety";
import {setPublish} from "@/lib/server/livekitPerms";
export const dynamic="force-dynamic";export const runtime="nodejs";
const sse=(e:string,d:unknown)=>`event: ${e}\ndata: ${JSON.stringify(d)}\n\n`;
// GET: one persistent stream per room. First event is a snapshot, then msg / mic / note events.
export async function GET(req:Request,{params}:{params:{room:string}}){
  const a=authorize(req,params.room);if(!a||a.hidden)return json({error:"not found"},404);
  if(a.idt.session)safety.enter(a.room.id,a.idt.session.uid); // the moment they started watching: reports need some dwell time
  const enc=new TextEncoder();let off=()=>{},hb:ReturnType<typeof setInterval>;
  const body=new ReadableStream({start(c){
    const send=(e:string,d:unknown)=>{try{c.enqueue(enc.encode(sse(e,d)))}catch{}};
    send("snapshot",chat.snapshot(a.room.id));off=chat.subscribe(a.room.id,send);
    hb=setInterval(()=>{try{c.enqueue(enc.encode(":hb\n\n"))}catch{}},20000);
    req.signal.addEventListener("abort",()=>{off();clearInterval(hb);try{c.close()}catch{}})},
    cancel(){off();clearInterval(hb)}});
  return new Response(body,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-cache, no-transform",Connection:"keep-alive","X-Accel-Buffering":"no",
    ...(a.idt.setCookie?{"Set-Cookie":a.idt.setCookie}:{})}})}
// POST {type:"say"|"requestMic"|"passMic"|"revokeMic"}. The speaker's name always comes from the session, never from the body.
export async function POST(req:Request,{params}:{params:{room:string}}){
  if(!sameOrigin(req))return json({error:"forbidden"},403);
  const a=authorize(req,params.room);if(!a||a.hidden)return json({error:"not found"},404);
  const b=await req.json().catch(()=>({})),room=a.room.id,{id,name}=a.idt;
  switch(b.type){
    case"say":{if(!a.caps.chat)return json({ok:false,reason:"quiet room"},403);const why=safety.screen(room,id,String(b.text??""));if(why)return json({ok:false,reason:why},why==="duplicate"?429:403);
      return json({ok:!!chat.say(room,id,name,String(b.text??""))},200,a.idt.setCookie)}
    case"requestMic":if(!a.caps.requestMic)return json({error:"forbidden"},403);chat.requestMic(room,id,name);return json({ok:true});
    case"cancelMicRequest":if(!a.caps.requestMic)return json({error:"forbidden"},403);return json({ok:chat.cancelMicRequest(room,id,name)});
    case"passMic":{if(!a.caps.passMic)return json({error:"forbidden"},403);
      const uid=chat.passMic(room,String(b.target??""));if(!uid)return json({ok:false},409);
      await setPublish(room,uid,["microphone"]);return json({ok:true})}
    case"revokeMic":{if(!a.caps.passMic)return json({error:"forbidden"},403);
      const uid=chat.revokeMic(room,String(b.target??""));if(uid)await setPublish(room,uid,[]);return json({ok:true})}}
  return json({error:"bad type"},400)}
