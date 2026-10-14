// Server-side escrow ledger and dispute state machine. This is the adapter-side truth until the Starknet contract (contracts/escrow) is deployed:
// every function here maps one-to-one onto a contract entrypoint (release, open_dispute, respond, resolve).
// Rules: only the paying client releases or disputes; a disputed milestone is frozen until an arbiter resolves it; every move is idempotent.
import type {Milestone,EscrowState,Dispute} from "../escrow";
import {getRoom} from "./registry";
type C={milestones:Milestone[];dispute:Dispute|null;funded:Set<string>};
const g=globalThis as any,book:Map<string,C>=g.__guildEscrow??=new Map();
const seed=():Milestone[]=>[
 {id:"m1",title:"Brand discovery",amount:2500,status:"done",risk:"live"},{id:"m2",title:"Key visuals",amount:4000,status:"done",risk:"live"},
 {id:"m3",title:"Motion system",amount:12500,status:"active",risk:"risk"},{id:"m4",title:"Handoff",amount:3000,status:"locked",risk:"live"}];
const contract=(room:string):C|null=>{const r=getRoom(room);if(!r||r.type!=="war")return null;
  let c=book.get(room);if(!c){c={milestones:seed(),dispute:null,funded:new Set()};book.set(room,c)}return c};
const sum=(ms:Milestone[])=>ms.reduce((a,m)=>a+m.amount,0);
export function state(room:string,viewer:"party"|"public"):EscrowState{
  const c=contract(room);if(!c)return{milestones:[],total:0,held:0,released:0,dispute:null};
  const d=c.dispute?{...c.dispute,...(viewer==="public"?{reason:undefined,response:undefined}:{})}:null; // the reasons stay between the parties
  return{milestones:structuredClone(c.milestones),total:sum(c.milestones),
    held:sum(c.milestones.filter(m=>m.status==="active"||m.status==="locked"||m.status==="disputed")),
    released:sum(c.milestones.filter(m=>m.status==="done")),dispute:d,
    escrowFunded:c.milestones.some(m=>m.status==="active"&&c.funded.has(m.id))}} // drives the green liquid tank
// Paystack confirmed the client's payment for this milestone (webhook). Server-only; never callable from a route body.
export function markFunded(room:string,msId:string){contract(room)?.funded.add(msId)}
export const isFunded=(room:string,msId:string)=>!!contract(room)?.funded.has(msId);
export type Res={ok:true;label?:string}|{ok:false;code:409|404;error:string};
const activateNext=(c:C)=>{const n=c.milestones.find(m=>m.status==="locked");if(n)n.status="active"};
export function release(room:string,msId:string):Res{const c=contract(room);if(!c)return{ok:false,code:404,error:"no contract"};
  const i=c.milestones.findIndex(m=>m.id===msId),m=c.milestones[i];
  if(!m)return{ok:false,code:404,error:"no such milestone"};
  if(c.dispute?.state==="open")return{ok:false,code:409,error:"release is frozen by an open dispute"};
  if(m.status!=="active")return{ok:false,code:409,error:"milestone is not active"}; // second release of the same milestone lands here
  m.status="done";activateNext(c);return{ok:true,label:`Client signed off on Milestone ${i+1}`}}
export function openDispute(room:string,by:string,reason:string):Res{const c=contract(room);if(!c)return{ok:false,code:404,error:"no contract"};
  if(c.dispute?.state==="open")return{ok:false,code:409,error:"a dispute is already open"};
  const i=c.milestones.findIndex(m=>m.status==="active");if(i<0)return{ok:false,code:409,error:"no active milestone to dispute"};
  c.milestones[i].status="disputed";
  c.dispute={id:Math.random().toString(36).slice(2),milestoneId:c.milestones[i].id,by,at:Date.now(),state:"open",reason:reason.trim().slice(0,280)};
  return{ok:true,label:`Client disputed Milestone ${i+1}. Escrow is frozen`}}
export function respond(room:string,text:string):Res{const c=contract(room);const d=c?.dispute;
  if(!c||!d||d.state!=="open")return{ok:false,code:409,error:"no open dispute"};
  if(d.response)return{ok:false,code:409,error:"already responded"};d.response=text.trim().slice(0,280);return{ok:true,label:"Creator responded to the dispute"}}
export function resolve(room:string,outcome:"release"|"refund"|"split"):Res{const c=contract(room);const d=c?.dispute;
  if(!c||!d||d.state!=="open")return{ok:false,code:409,error:"no open dispute"};
  const i=c.milestones.findIndex(m=>m.id===d.milestoneId),m=c.milestones[i];
  if(outcome==="refund")m.status="refunded"; // funds go back to the client; later milestones stay locked
  else{m.status="done";activateNext(c)}   // release pays in full; split pays half (recorded on the dispute) and moves on
  d.state="resolved";d.outcome=outcome;
  return{ok:true,label:`Dispute on Milestone ${i+1} resolved: ${outcome}`}}
