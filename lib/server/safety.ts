// Trust and safety. Reports -> weighted cases -> automatic hold -> moderator decision -> strikes, bans, appeals. Every move is audited.
// In memory like the rest of the server (swap the Maps for tables). Design rules:
//   - A report is a signal, never a verdict. Auto-hide is a temporary hold, always reviewed by a human, always appealable.
//   - Throwaway accounts cannot take anyone down: reports from new accounts weigh 0, and reporters must have actually watched.
//   - Reporters who are repeatedly dismissed lose weight; reporters who are repeatedly upheld gain it.
//   - Severe categories (illegal, minor safety) hold on a single valid report and jump the queue.
import {getRoom,hubOf,setSuspended,setFlags,roomsOwnedBy,isOwnerOrCrew} from "./registry";
import {FLAG_LIMIT} from "../access";
import {REASONS,Reason,isReason} from "../reasons";
export {REASONS,isReason};export type {Reason};
const H=36e5,D=24*H;
const cfg=()=>({minAge:Number(process.env.SAFETY_MIN_AGE_MS??10*60e3),dwell:Number(process.env.SAFETY_MIN_DWELL_MS??30e3),perHour:5});
export type CaseState="open"|"upheld"|"dismissed"|"appealed"|"reinstated"|"expired";
export type Case={id:string;kind:"stream"|"user";room:string;ownerUid:string|null;target:string|null;reasons:Reason[];severe:boolean;
  reporters:Record<string,{weight:number;reason:Reason;at:number}>;state:CaseState;opened:number;held:boolean;restoreAt:number|null;
  appeal?:{text:string;at:number};decision?:{by:string;at:number;action:string;note:string}};
type Rep={upheld:number;dismissed:number;recent:number[]};
const g=globalThis as any;
const db:{cases:Map<string,Case>;rep:Map<string,Rep>;seen:Map<string,number>;dwell:Map<string,number>;strikes:Map<string,number>;
  bans:Map<string,{until:number|null;reason:string}>;mutes:Map<string,Set<string>>;roomBans:Map<string,Set<string>>;last:Map<string,{t:string;at:number}>;audit:any[]}
  =g.__guildSafety??={cases:new Map(),rep:new Map(),seen:new Map(),dwell:new Map(),strikes:new Map(),bans:new Map(),mutes:new Map(),roomBans:new Map(),last:new Map(),audit:[]};
const id=()=>Math.random().toString(36).slice(2,10);
export const audit=(by:string,action:string,detail:object)=>{db.audit.push({at:Date.now(),by,action,...detail});if(db.audit.length>1000)db.audit.shift()};
export const auditTail=(n=50)=>db.audit.slice(-n).reverse();
// ---- accounts ----
export const touch=(uid:string)=>{if(!db.seen.has(uid))db.seen.set(uid,Date.now())};
export const enter=(room:string,uid:string)=>{const k=room+"|"+uid;if(!db.dwell.has(k))db.dwell.set(k,Date.now())}; // first moment this account was inside the room
const weightOf=(uid:string,room:string,severe:boolean)=>{
  const c=cfg(),age=Date.now()-(db.seen.get(uid)??Date.now());if(age<c.minAge)return 0;       // brand-new accounts: recorded, weightless
  if(!severe&&Date.now()-(db.dwell.get(room+"|"+uid)??Date.now())<c.dwell)return 0;           // must have watched. Severe reports skip this
  const r=db.rep.get(uid),n=r?r.upheld+r.dismissed:0;if(n>=3){const acc=r!.upheld/n;if(acc<.3)return .25;if(acc>.7)return 1.5}return 1};
export function isBanned(uid:string|undefined){if(!uid)return false;const b=db.bans.get(uid);if(!b)return false;
  if(b.until&&b.until<Date.now()){db.bans.delete(uid);return false}return true}
export const banInfo=(uid:string)=>db.bans.get(uid)??null;
export const isRoomBanned=(room:string,uid:string|undefined)=>!!uid&&!!db.roomBans.get(room)?.has(uid);
const ban=(uid:string,until:number|null,reason:string,by:string)=>{db.bans.set(uid,{until,reason});audit(by,"ban",{uid,until,reason})};
// ---- chat screening (called before a message is accepted) ----
export function screen(room:string,uid:string,text:string):null|"muted"|"banned"|"links"|"duplicate"{
  if(isRoomBanned(room,uid))return"banned";if(db.mutes.get(room)?.has(uid))return"muted";
  if((text.match(/https?:\/\/|www\./gi)??[]).length>2)return"links";
  const l=db.last.get(uid),t=text.trim().toLowerCase();if(l&&l.t===t&&Date.now()-l.at<30e3)return"duplicate";
  db.last.set(uid,{t,at:Date.now()});return null}
// ---- reports ----
export type Res<T={}>={ok:true}&T|{ok:false;code:number;error:string};
const reportsIn=(uid:string)=>{const r=db.rep.get(uid)??{upheld:0,dismissed:0,recent:[]};db.rep.set(uid,r);return r};
export function report(i:{room:string;uid:string;kind:"stream"|"user";reason:Reason;target?:string|null}):Res<{status:"recorded"|"held"}>{
  const room=getRoom(i.room);if(!room)return{ok:false,code:404,error:"no such room"};
  if(isBanned(i.uid))return{ok:false,code:403,error:"account restricted"};
  if(isOwnerOrCrew(i.room,i.uid))return{ok:false,code:403,error:"you cannot report your own room"};
  const sev=REASONS[i.reason].severe,rep=reportsIn(i.uid),now=Date.now();
  rep.recent=rep.recent.filter(t=>now-t<H);if(rep.recent.length>=cfg().perHour)return{ok:false,code:429,error:"report limit reached, try again later"};
  const target=i.kind==="user"?(i.target??"").slice(0,32)||null:null;if(i.kind==="user"&&!target)return{ok:false,code:400,error:"who are you reporting?"};
  let c=[...db.cases.values()].find(x=>x.room===i.room&&x.kind===i.kind&&x.target===target&&(x.state==="open"||x.state==="appealed"));
  if(c?.reporters[i.uid])return{ok:false,code:409,error:"you already reported this"};
  rep.recent.push(now);
  if(!c){c={id:id(),kind:i.kind,room:i.room,ownerUid:room.ownerUid,target,reasons:[],severe:false,reporters:{},state:"open",opened:now,held:false,restoreAt:null};db.cases.set(c.id,c)}
  c.reporters[i.uid]={weight:weightOf(i.uid,i.room,sev),reason:i.reason,at:now};
  if(!c.reasons.includes(i.reason))c.reasons.push(i.reason);if(sev)c.severe=true;
  const total=Object.values(c.reporters).reduce((a,r)=>a+r.weight,0),valid=Object.values(c.reporters).some(r=>r.weight>0);
  const trip=c.severe?valid:total>=FLAG_LIMIT;
  if(trip&&!c.held&&c.state==="open"){c.held=true;
    if(c.kind==="stream"){setSuspended(c.room,true);audit("system","auto-hold",{case:c.id,room:c.room,total})}
    else if(c.target){const u=uidOfHandle(c.room,c.target);if(u){(db.mutes.get(c.room)??db.mutes.set(c.room,new Set()).get(c.room)!).add(u);audit("system","auto-mute",{case:c.id,room:c.room,target:c.target})}}}
  if(c.kind==="stream")setFlags(c.room,Object.entries(c.reporters).filter(([,r])=>r.weight>0).map(([u])=>u));
  return{ok:true,status:c.held?"held":"recorded"}}
// handle -> uid, supplied by the chat module (set once at startup of the route layer to avoid a cycle)
let uidOfHandle:(room:string,handle:string)=>string|null=()=>null;
export const bindChat=(f:typeof uidOfHandle)=>{uidOfHandle=f};
// ---- moderators ----
const stat=(uids:string[],field:"upheld"|"dismissed")=>uids.forEach(u=>{reportsIn(u)[field]++});
export function decide(caseId:string,mod:string,action:"dismiss"|"uphold"|"ban"|"reinstate"|"mute"|"roomban",note:string):Res<{case:Case}>{
  const c=db.cases.get(caseId);if(!c)return{ok:false,code:404,error:"no such case"};
  if(c.ownerUid===mod)return{ok:false,code:403,error:"conflict of interest"};
  if(c.state!=="open"&&c.state!=="appealed")return{ok:false,code:409,error:"case already closed"};
  const reporters=Object.keys(c.reporters),own=c.ownerUid,done=(s:CaseState)=>{c.state=s;c.decision={by:mod,at:Date.now(),action,note:note.slice(0,300)};audit(mod,action,{case:c.id,room:c.room});return{ok:true as const,case:c}};
  if(c.kind==="stream"){
    if(action==="dismiss"||action==="reinstate"){setSuspended(c.room,false);c.held=false;c.restoreAt=null;
      if(action==="dismiss")stat(reporters,"dismissed");else if(own)db.strikes.set(own,Math.max(0,(db.strikes.get(own)??1)-1)); // an upheld appeal removes the strike
      return done(action==="dismiss"?"dismissed":"reinstated")}
    if(action==="uphold"||action==="ban"){stat(reporters,"upheld");setSuspended(c.room,true);c.held=true;
      if(own){const n=(db.strikes.get(own)??0)+1;db.strikes.set(own,n);
        if(action==="ban"||c.severe)ban(own,null,"upheld: "+c.reasons.join(", "),mod);else if(n>=3)ban(own,Date.now()+30*D,"3 strikes",mod);
        c.restoreAt=isBanned(own)?null:Date.now()+(n===1?D:7*D)} // first strike hides for 24h, second for 7 days
      return done("upheld")}}
  else{const u=c.target?uidOfHandle(c.room,c.target):null,set=(m:Map<string,Set<string>>)=>{if(u)(m.get(c.room)??m.set(c.room,new Set()).get(c.room)!).add(u)};
    if(action==="dismiss"){if(u)db.mutes.get(c.room)?.delete(u);stat(reporters,"dismissed");c.held=false;return done("dismissed")}
    if(action==="mute"){set(db.mutes);stat(reporters,"upheld");return done("upheld")}
    if(action==="roomban"){set(db.roomBans);stat(reporters,"upheld");return done("upheld")}
    if(action==="ban"){if(u)ban(u,null,"upheld: "+c.reasons.join(", "),mod);stat(reporters,"upheld");return done("upheld")}}
  return{ok:false,code:400,error:"action does not apply to this case"}}
export function appeal(caseId:string,uid:string,text:string):Res{
  const c=db.cases.get(caseId);if(!c||c.ownerUid!==uid||c.kind!=="stream")return{ok:false,code:404,error:"no such case"};
  if(c.state!=="upheld"&&!(c.state==="open"&&c.held))return{ok:false,code:409,error:"nothing to appeal"};
  if(c.appeal)return{ok:false,code:409,error:"already appealed"};if(!text.trim())return{ok:false,code:400,error:"say why"};
  c.appeal={text:text.trim().slice(0,500),at:Date.now()};c.state="appealed";audit(uid,"appeal",{case:c.id});return{ok:true}}
export function tick(){const now=Date.now();for(const c of db.cases.values())
  if(c.kind==="stream"&&c.state==="upheld"&&c.restoreAt&&c.restoreAt<now&&!isBanned(c.ownerUid??"")){setSuspended(c.room,false);c.held=false;c.state="expired";audit("system","restore",{case:c.id,room:c.room})}}
export function queue(){tick();const rank=(c:Case)=>c.severe?0:c.state==="appealed"?1:2;
  return[...db.cases.values()].filter(c=>c.state==="open"||c.state==="appealed").sort((a,b)=>rank(a)-rank(b)||a.opened-b.opened)
    .map(c=>({...c,total:Object.values(c.reporters).reduce((s,r)=>s+r.weight,0),reporters:Object.keys(c.reporters).length}))}
export function mine(uid:string){tick();const rooms=roomsOwnedBy(uid);
  return{banned:isBanned(uid)?banInfo(uid):null,strikes:db.strikes.get(uid)??0,
    cases:[...db.cases.values()].filter(c=>c.kind==="stream"&&rooms.includes(c.room)&&(c.held||c.state==="upheld"||c.state==="appealed")).map(c=>({id:c.id,room:c.room,state:c.state,
      reasons:c.reasons.map(r=>REASONS[r].label),restoreAt:c.restoreAt,appeal:c.appeal?true:false,canAppeal:!c.appeal&&(c.state==="upheld"||c.held&&c.state==="open"),
      note:c.decision?.note??null}))}} // reporter identities are never shown to owners
// ---- owner / moderator room controls (spec: the host can mute participants) ----
export function roomControl(room:string,op:"mute"|"unmute"|"ban"|"unban",uid:string,by:string):Res{
  if(isOwnerOrCrew(room,uid))return{ok:false,code:403,error:"cannot act on the host or crew"};
  const m=op==="mute"||op==="unmute"?db.mutes:db.roomBans,add=op==="mute"||op==="ban",s=m.get(room)??m.set(room,new Set()).get(room)!;
  add?s.add(uid):s.delete(uid);audit(by,op,{room,uid});return{ok:true}}
export const _reset=()=>{for(const m of Object.values(db))(m as any).clear?.();db.audit.length=0};
void hubOf;
