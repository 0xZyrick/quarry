// Live chat per room. Server-authored so system lines ("tipped $5", "signed off on Milestone 1") cannot be forged by a client.
// Transport: Server-Sent Events down, POST up (works in Next route handlers behind the same session cookie).
// In-memory ring of 200 lines per room. For several server instances, back this with Redis pub/sub or Ably; the route API stays the same.
export type Msg={id:string;room:string;kind:"text"|"system";by:string;text:string;t:number;question?:boolean};
export type Note={id:string;tile:string;x:number;y:number;text:string;amount:number;by?:string};
type Ev=(e:"msg"|"mic"|"note",d:unknown)=>void;
type RC={log:Msg[];notes:Note[];subs:Set<Ev>;requests:Map<string,string>;slots:Map<string,string>;handles:Map<string,string>;last:Map<string,number>};
const g=globalThis as any,rooms:Map<string,RC>=g.__guildChat??=new Map();
const rc=(r:string)=>{let c=rooms.get(r);if(!c){c={log:[],notes:[],subs:new Set(),requests:new Map(),slots:new Map(),handles:new Map(),last:new Map()};rooms.set(r,c)}return c};
const id=()=>Math.random().toString(36).slice(2);
const clean=(t:string)=>t.replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,240);
const emit=(c:RC,e:"msg"|"mic"|"note",d:unknown)=>c.subs.forEach(f=>f(e,d));
const push=(c:RC,m:Msg)=>{c.log.push(m);if(c.log.length>200)c.log.shift();emit(c,"msg",m)};
const mic=(c:RC)=>emit(c,"mic",{requests:[...c.requests.keys()],slots:[...c.slots.keys()]});
export function say(room:string,uid:string,handle:string,text:string):Msg|null{
  const c=rc(room),t=clean(text),now=Date.now();if(!t||now-(c.last.get(uid)??0)<700)return null; // 1 line per 700ms per account
  c.last.set(uid,now);c.handles.set(handle,uid);
  const m:Msg={id:id(),room,kind:"text",by:handle,text:t,t:now,question:t.includes("?")&&t.length>24};push(c,m);return m}
export const system=(room:string,text:string)=>push(rc(room),{id:id(),room,kind:"system",by:"system",text:clean(text),t:Date.now()});
export function requestMic(room:string,uid:string,handle:string){const c=rc(room);c.handles.set(handle,uid);
  if(c.requests.has(handle)||c.slots.has(handle))return;c.requests.set(handle,uid);mic(c);system(room,`@${handle} requested the mic`)}
export function passMic(room:string,handle:string):string|null{const c=rc(room),uid=c.handles.get(handle);
  if(!uid||c.slots.size>=2)return null;c.requests.delete(handle);c.slots.set(handle,uid);mic(c);system(room,`@${handle} was passed the mic`);return uid}
export function revokeMic(room:string,handle:string):string|null{const c=rc(room),uid=c.slots.get(handle)??null;c.slots.delete(handle);mic(c);return uid}
export const uidOf=(room:string,handle:string)=>rc(room).handles.get(handle)??null;
export const hasSlot=(room:string,uid:string)=>[...rc(room).slots.values()].includes(uid);
export function addNote(room:string,n:Note){const c=rc(room);if(c.notes.some(x=>x.id===n.id))return;c.notes.push(n);if(c.notes.length>100)c.notes.shift();emit(c,"note",n)}
export const snapshot=(room:string)=>{const c=rc(room);return{log:c.log.slice(-60),notes:c.notes,requests:[...c.requests.keys()],slots:[...c.slots.keys()]}};
export const subscribe=(room:string,f:Ev)=>{const c=rc(room);c.subs.add(f);return()=>{c.subs.delete(f)}};
