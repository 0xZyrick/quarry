// Run with: npx tsx lib/safety.test.ts
process.env.SAFETY_MIN_AGE_MS="0";process.env.SAFETY_MIN_DWELL_MS="0";
import * as S from "./server/safety";
import * as chat from "./server/chat";
import {snapshot,getRoom} from "./server/registry";
S.bindChat(chat.uidOf);
let bad=0;const eq=(a:any,b:any,m:string)=>{if(JSON.stringify(a)!==JSON.stringify(b)){bad++;console.log("FAIL",m,JSON.stringify(a),"!=",JSON.stringify(b))}else console.log("ok  ",m)};
const U=(n:number)=>{const u="pk_reporter"+String(n).padStart(3,"0");S.touch(u);S.enter("n2",u);return u};
const rep=(room:string,uid:string,reason:S.Reason="non_skilled")=>S.report({room,uid,kind:"stream",reason}) as any;
// new accounts are weightless
process.env.SAFETY_MIN_AGE_MS="600000";
const fresh=["pk_fresh0001","pk_fresh0002","pk_fresh0003"];fresh.forEach(u=>{S.touch(u);S.enter("n3",u)});
fresh.forEach(u=>rep("n3",u));eq(snapshot().suspended.n3,false,"three brand-new accounts cannot hide a room");
eq(S.queue().find(c=>c.room==="n3")?.total,0,"their reports weigh nothing");
process.env.SAFETY_MIN_AGE_MS="0";
// weighted hold
const [a,b,c]=[U(1),U(2),U(3)];
eq(rep("n2",a).status,"recorded","1 report records");eq(rep("n2",a).error,"you already reported this","same account twice refused");
rep("n2",b);eq(rep("n2",c).status,"held","3 weighted reports hold the room");
eq(snapshot().suspended.n2,true,"room hidden from the map");eq(snapshot().live.n2,false,"and offline");
eq(S.report({room:"n2",uid:"u-co",kind:"stream",reason:"spam"}).ok,false,"crew cannot report their own room");
// moderator
const qc=S.queue().find(x=>x.room==="n2")!;
eq((S.decide(qc.id,"demo-n2","dismiss","") as any).code,403,"the owner cannot rule on their own case");
eq((S.decide(qc.id,"u-mod","dismiss","looks like real work") as any).ok,true,"moderator dismisses");
eq(snapshot().suspended.n2,false,"room returns after dismissal");
// reporter accuracy: three dismissals drop weight
const d=U(10);for(const r of ["n6","n7","n8"]){S.enter(r,d);rep(r,d);const id=S.queue().find(x=>x.room===r)!.id;S.decide(id,"u-mod","dismiss","")}
S.enter("n9",d);rep("n9",d);eq(S.queue().find(x=>x.room==="n9")?.total,.25,"a reporter dismissed 3 times weighs .25");
// rate limit
const r5=U(20);let last:any;for(const r of ["n0","n4","n5","n10","n11","n12"]){S.enter(r,r5);last=rep(r,r5)}eq(last.code,429,"6th report in an hour is refused");
// uphold -> strike, hold, appeal, reinstate
[U(30),U(31),U(32)].forEach(u=>{S.enter("n13",u);rep("n13",u)});
let id=S.queue().find(x=>x.room==="n13")!.id;
eq((S.decide(id,"u-mod","uphold","not skilled work") as any).case.state,"upheld","moderator upholds");
eq(S.mine("demo-n13").strikes,1,"owner gets a strike");eq(snapshot().suspended.n13,true,"room stays hidden");
const m=S.mine("demo-n13");eq([m.cases[0].canAppeal,m.cases[0].reasons.length],[true,1],"owner may appeal; reporters are not exposed");
eq((S.appeal(id,"someone-else","x") as any).code,404,"only the owner can appeal");
eq((S.appeal(id,"demo-n13","I was teaching a class") as any).ok,true,"appeal accepted");eq((S.appeal(id,"demo-n13","again") as any).code,409,"one appeal only");
eq(S.queue()[0].id,id,"appeals jump the queue");
eq((S.decide(id,"u-mod","reinstate","fair") as any).ok,true,"moderator reinstates");
eq([snapshot().suspended.n13,S.mine("demo-n13").strikes],[false,0],"room back, strike removed");
// expiry of a first-strike hold
[U(40),U(41),U(42)].forEach(u=>{S.enter("n12",u);rep("n12",u)});
id=S.queue().find(x=>x.room==="n12")!.id;const up=(S.decide(id,"u-mod","uphold","") as any).case;up.restoreAt=Date.now()-1;S.tick();
eq([up.state,snapshot().suspended.n12],["expired",false],"hold lifts by itself after 24h");
// severe: one valid report holds and jumps the queue
S.enter("n11",U(50));eq(rep("n11",U(50),"illegal").status,"held","one valid severe report holds at once");
eq(S.queue()[0].room,"n11","severe cases lead the queue");
// strikes -> ban
const o="demo-n5";for(const r of ["n5"]){}
let n=0;for(let k=0;k<3;k++){const rs=[U(60+k*3),U(61+k*3),U(62+k*3)];rs.forEach(u=>S.enter("n5",u));rs.forEach(u=>rep("n5",u));
  const cid=S.queue().find(x=>x.room==="n5")!.id;S.decide(cid,"u-mod","uphold","");n++}
eq([S.mine(o).strikes,!!S.isBanned(o)],[3,true],"third strike bans the account");
// chat screening and room control
eq(S.screen("n1","u1","hi https://a.co https://b.co https://c.co"),"links","link spam blocked");
eq([S.screen("n1","u2","same"),S.screen("n1","u2","same")],[null,"duplicate"],"repeat within 30s blocked");
chat.say("n1","u3","troll","hello");eq((S.roomControl("n1","mute","u3","host") as any).ok,true,"host mutes");eq(S.screen("n1","u3","x"),"muted","muted account cannot speak");
eq((S.roomControl("n1","mute","u-creator","host") as any).code,403,"cannot mute the host");
S.roomControl("n1","ban","u3","host");eq(S.isRoomBanned("n1","u3"),true,"room ban");
// user report auto-mutes pending review
chat.say("n0","uX","spammer","buy now");const ur=(u:string)=>S.report({room:"n0",uid:u,kind:"user",reason:"spam",target:"spammer"}) as any;
[U(80),U(81)].forEach(u=>{S.enter("n0",u);ur(u)});S.enter("n0",U(82));eq(ur(U(82)).status,"held","three reports mute the user pending review");eq(S.screen("n0","uX","hello"),"muted","muted while held");
void getRoom;process.exit(bad?1:0);
