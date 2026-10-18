// Run with: npx tsx lib/vault.test.ts
import {vaultFor} from "./server/vault";
import {metricsOf,skillsOf,tierOf,Capsule} from "./vault";
let bad=0;const eq=(a:any,b:any,m:string)=>{if(JSON.stringify(a)!==JSON.stringify(b)){bad++;console.log("FAIL",m,JSON.stringify(a),"!=",JSON.stringify(b))}else console.log("ok  ",m)};
const v=vaultFor("mira.design",null)!;
eq(v.metrics.capsules>=15,true,"mira has a substantial reviewed portfolio");
eq(v.tier,"master","mira is a Master Craftsman");eq(v.location,"Lekki Phase 1 Node, Lagos","location is a zone, never an address");
eq(v.capsules.some(c=>c.kind==="war"&&c.phase==="Penthouse CAD Core"),true,"the Penthouse project capsule exists");
eq(v.preview,true,"seeded data is flagged as preview");
// zero-text rule
const base:Capsule={...v.capsules[0]};
const unreviewed={...base,id:"x1",skill:"Carpentry" as const,peerMarks:0};
eq(skillsOf([unreviewed]),[],"unreviewed work does not count as a proven skill");
eq(skillsOf([unreviewed,{...base,id:"ok",skill:"Carpentry" as const,peerMarks:1}]).map(s=>[s.skill,s.capsuleIds]),[["Carpentry",["ok"]]],"a skill links to peer-reviewed capsules");
eq(metricsOf([unreviewed]).capsules,0,"unreviewed capsules do not count toward the portfolio");
eq(tierOf({sessionHours:0,peerReviews:0,capsules:0}),"rising","empty vault is Rising");
eq(v.skills.every(s=>s.capsuleIds.length>0),true,"every displayed skill links to reviewed work");
// access
eq(vaultFor("nobody",null),null,"unknown handle");eq(vaultFor("me",null),null,"'me' needs a session");
const me=vaultFor("me",{uid:"pk_x1234567",handle:"guild-34567",track:"creator"})!;eq([me.capsules.length,me.skills.length,me.preview],[0,0,false],"a new account starts empty and earns everything");
process.exit(bad?1:0);
