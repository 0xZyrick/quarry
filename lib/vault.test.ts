// Run with: npx tsx lib/vault.test.ts
import {vaultFor} from "./server/vault";
import {metricsOf,skillsOf,tierOf,Capsule} from "./vault";
let bad=0;const eq=(a:any,b:any,m:string)=>{if(JSON.stringify(a)!==JSON.stringify(b)){bad++;console.log("FAIL",m,JSON.stringify(a),"!=",JSON.stringify(b))}else console.log("ok  ",m)};
const v=vaultFor("mira.design",null)!;
eq([v.metrics.throughputUsd,v.metrics.ticksVerified,v.metrics.ticksTotal],[42500,18,18],"mira: $42,500 and 18/18 verified, as in the spec");
eq(v.tier,"master","mira is a Master Craftsman");eq(v.location,"Lekki Phase 1 Node, Lagos","location is a zone, never an address");
eq(v.capsules.some(c=>c.kind==="war"&&c.amountUsd===14500&&c.phase==="Penthouse CAD Core"),true,"the $14,500 Penthouse capsule exists");
eq(v.capsules.some(c=>c.kind==="commons"&&c.tips===340),true,"the 340-tip commons build exists");
eq(v.preview,true,"seeded data is flagged as preview");
// zero-text rule
const base:Capsule={...v.capsules[0]};
const unverified={...base,id:"x1",skill:"Carpentry" as const,webhookVerified:false},noGateway={...base,id:"x2",skill:"Mural Painting" as const,gatewayTxId:null},unsigned={...base,id:"x3",skill:"Coding" as const,kind:"war" as const,clientSigned:false};
eq(skillsOf([unverified,noGateway,unsigned]),[],"no verified payment log = no skill tag");
eq(skillsOf([unverified,{...base,id:"ok",skill:"Carpentry" as const}]).map(s=>[s.skill,s.capsuleIds]),[["Carpentry",["ok"]]],"a skill links to the capsules that prove it");
eq(metricsOf([unverified,noGateway,unsigned]).capsules,0,"unverified capsules add nothing to metrics");
eq(tierOf({throughputUsd:0,ticksVerified:0,ticksTotal:0,tips:0,capsules:0}),"rising","empty vault is Rising");
eq(v.skills.every(s=>s.capsuleIds.length>0),true,"every displayed tag has proof");
// access
eq(vaultFor("nobody",null),null,"unknown handle");eq(vaultFor("me",null),null,"'me' needs a session");
const me=vaultFor("me",{uid:"pk_x1234567",handle:"guild-34567",track:"creator"})!;eq([me.capsules.length,me.skills.length,me.preview],[0,0,false],"a new account starts empty and earns everything");
process.exit(bad?1:0);
