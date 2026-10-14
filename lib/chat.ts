// Client side of the live chat. Real transport: Server-Sent Events down from /api/chat/[room], POST up. The server authors names and system lines.
// If the stream cannot connect three times (static demo, no server), it falls back to an in-memory mock with simulated fans.
import {create} from "zustand";
export type Msg={id:string;room:string;kind:"text"|"system";by:string;text:string;t:number;question?:boolean};
type S={log:Msg[];requests:string[];slots:string[];mode:"server"|"mock";
  say:(room:string,by:string,text:string)=>void;system:(room:string,text:string)=>void;
  requestMic:(room:string,by:string)=>void;cancelMicRequest:(room:string,by:string)=>void;passMic:(room:string,by:string)=>boolean;revokeMic:(room:string,by:string)=>void;reset:()=>void};
const id=()=>Math.random().toString(36).slice(2);
const post=(room:string,body:object)=>fetch(`/api/chat/${encodeURIComponent(room)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).catch(()=>null);
const add=(s:S,m:Msg)=>({log:[...s.log.slice(-199),m]});
export const useChat=create<S>((set,get)=>({log:[],requests:[],slots:[],mode:"mock",
  say:(room,by,text)=>{const t=text.trim().slice(0,240);if(!t)return;
    if(get().mode==="server"){post(room,{type:"say",text:t});return} // the server echoes it back with the real name
    set(s=>add(s,{id:id(),room,kind:"text",by,text:t,t:Date.now(),question:t.includes("?")&&t.length>24}))},
  system:(room,text)=>{if(get().mode==="server")return;set(s=>add(s,{id:id(),room,kind:"system",by:"system",text,t:Date.now()}))}, // server mode: only the server writes system lines
  requestMic:(room,by)=>{if(get().mode==="server"){post(room,{type:"requestMic"});return}
    if(get().requests.includes(by)||get().slots.includes(by))return;set(s=>({requests:[...s.requests,by]}));get().system(room,`@${by} requested the mic`)},
  cancelMicRequest:(room,by)=>{if(get().mode==="server"){post(room,{type:"cancelMicRequest"});return}
    if(!get().requests.includes(by))return;set(s=>({requests:s.requests.filter(r=>r!==by)}));get().system(room,`@${by} cancelled mic request`)},
  passMic:(room,by)=>{if(get().mode==="server"){post(room,{type:"passMic",target:by});return true}
    if(get().slots.length>=2)return false;set(s=>({slots:[...s.slots,by],requests:s.requests.filter(r=>r!==by)}));get().system(room,`@${by} was passed the mic`);return true},
  revokeMic:(room,by)=>{if(get().mode==="server")post(room,{type:"revokeMic",target:by});else set(s=>({slots:s.slots.filter(x=>x!==by)}))},
  reset:()=>set({log:[],requests:[],slots:[]})}));
const FANS=["tola","enzo","nia","kai"],LINES=["love this palette","how are you handling the grid on mobile layouts?","🔥🔥","what plugin do you use for the motion curves here?","nice"];
function startFans(room:string){const i=setInterval(()=>useChat.getState().say(room,FANS[Math.floor(Math.random()*FANS.length)],LINES[Math.floor(Math.random()*LINES.length)]),6500);return()=>clearInterval(i)}
// Open the room's chat. `onNote` receives server-confirmed tips so the Commons can draw them. Returns a cleanup.
export function connectChat(room:string,onNote:(n:any)=>void):()=>void{
  useChat.setState({log:[],requests:[],slots:[],mode:"mock"});
  let dead=false,fails=0,stopFans=()=>{};
  const es=typeof EventSource!=="undefined"?new EventSource(`/api/chat/${encodeURIComponent(room)}`):null;
  if(!es){stopFans=startFans(room);return()=>stopFans()}
  const j=(e:MessageEvent)=>JSON.parse(e.data);
  es.addEventListener("snapshot",e=>{fails=0;const d=j(e as MessageEvent);useChat.setState({mode:"server",log:d.log,requests:d.requests,slots:d.slots});(d.notes??[]).forEach(onNote)});
  es.addEventListener("msg",e=>useChat.setState(s=>add(s,j(e as MessageEvent))));
  es.addEventListener("mic",e=>useChat.setState(j(e as MessageEvent)));
  es.addEventListener("note",e=>onNote(j(e as MessageEvent)));
  es.onerror=()=>{if(dead||++fails<3)return;es.close();useChat.setState({mode:"mock"});stopFans=startFans(room)};
  return()=>{dead=true;es.close();stopFans()}}
