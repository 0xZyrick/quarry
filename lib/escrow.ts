import {useChat} from "./chat";
// Mock escrow adapter. Swap for a Starknet session-key adapter later; UI only talks to this interface.
// Roles are enforced by the real adapter on the server. The UI check in the store is only a convenience.
export type Milestone={id:string;title:string;amount:number;status:"done"|"active"|"locked"|"disputed"|"refunded";risk:"live"|"risk"};
export type Dispute={id:string;milestoneId:string;by:string;at:number;state:"open"|"resolved";reason?:string;response?:string;outcome?:"release"|"refund"|"split"};
export type EscrowState={milestones:Milestone[];total:number;held:number;released:number;dispute?:Dispute|null;escrowFunded?:boolean}; // held = active + locked
export type TipNote={id:string;x:number;y:number;text:string};
export interface EscrowAdapter{
  getState(room:string):Promise<EscrowState>;
  subscribe(room:string,cb:(s:EscrowState)=>void):()=>void;
  release(room:string,id:string):Promise<{ok:true}>;
  dispute(room:string,reason:string):Promise<{ok:true}>;
  tip(room:string,tile:string,amount:number,note?:TipNote):Promise<{ok:true}>;
}
let data:Milestone[]=[
 {id:"m1",title:"Brand discovery",amount:2500,status:"done",risk:"live"},
 {id:"m2",title:"Key visuals",amount:4000,status:"done",risk:"live"},
 {id:"m3",title:"Motion system",amount:12500,status:"active",risk:"risk"},
 {id:"m4",title:"Handoff",amount:3000,status:"locked",risk:"live"}];
const sum=(ms:Milestone[])=>ms.reduce((a,m)=>a+m.amount,0);
const snap=():EscrowState=>({milestones:structuredClone(data),total:sum(data),
  held:sum(data.filter(m=>m.status!=="done")),released:sum(data.filter(m=>m.status==="done"))});
const subs=new Set<(s:EscrowState)=>void>();
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
let dispute:Dispute|null=null;
const snap2=():EscrowState=>({...snap(),dispute});
export const mockEscrow:EscrowAdapter={
  async getState(){await wait(100);return snap2()},
  subscribe(_r,cb){subs.add(cb);return()=>{subs.delete(cb)}},
  async release(room,id){await wait(700);if(dispute?.state==="open")throw new Error("frozen");if(Math.random()<0.1)throw new Error("tx failed");
    const i=data.findIndex(m=>m.id===id),next=data.find(m=>m.status==="locked");
    data=data.map(m=>m.id===id?{...m,status:"done"}:m.id===next?.id?{...m,status:"active"}:m);
    useChat.getState().system(room,`Client signed off on Milestone ${i+1}`);subs.forEach(f=>f(snap2()));return{ok:true}},
  async dispute(room,reason){await wait(300);const m=data.find(x=>x.status==="active");if(!m||dispute?.state==="open")throw new Error("no");
    data=data.map(x=>x.id===m.id?{...x,status:"disputed"}:x);dispute={id:"d1",milestoneId:m.id,by:"client",at:Date.now(),state:"open",reason};
    useChat.getState().system(room,"Client disputed the milestone. Escrow is frozen");subs.forEach(f=>f(snap2()));return{ok:true}},
  async tip(room,_t,amount){await wait(500);if(Math.random()<.1)throw new Error("tip failed");useChat.getState().system(room,`@guest tipped $${amount}!`);return{ok:true}}
};
