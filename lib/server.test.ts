// Run with: npx tsx lib/server.test.ts
import {cookieFor,readSession} from "./server/session";
import {profileFor,goLive,snapshot,getRoom} from "./server/registry";
import * as chat from "./server/chat";
import {kindIn,capsOf} from "./access";
import {cleanName} from "./server/invite";
import {claimHandle} from "./server/registry";
let bad=0;const eq=(a:any,b:any,m:string)=>{if(JSON.stringify(a)!==JSON.stringify(b)){bad++;console.log("FAIL",m,JSON.stringify(a),"!=",JSON.stringify(b))}else console.log("ok  ",m)};
const req=(c?:string)=>new Request("http://x/",{headers:c?{cookie:c.split(";")[0]}:{}});
// sessions
const c=cookieFor({uid:"pk_abcdefgh12",handle:"guild-fgh12",track:"client"});
eq(readSession(req(c))?.uid,"pk_abcdefgh12","signed cookie round-trips");
eq(readSession(req(c.replace("guild_sess=","guild_sess=x")))?.uid,undefined,"tampered body rejected");
eq(readSession(req(c.replace(/\.[^.;]+;/,".AAAA;"))),null,"bad signature rejected");
// roles come from the registry
const client=profileFor({uid:"u-client",handle:"acme",track:"client"})!,fake=profileFor({uid:"pk_forger0001",handle:"x",track:null})!;
eq(kindIn(client,{id:"n1",ownerId:"n1",type:"war"}),"client-owner","client track is client in a war room (demo mode)");
eq(kindIn(fake,{id:"n1",ownerId:"n1",type:"war"}),"guest","claiming nothing gets nothing");
eq(profileFor({uid:"u-creator",handle:"k",track:"creator"})!.creatorNodeId,"n1","creator owns n1");
eq(getRoom("n1")!.type,"war","n1 is a war room");
const own=profileFor({uid:"pk_newcreator1",handle:"n",track:"creator"})!;eq(own.creatorNodeId,"own:creator1","new creator gets an own: room");
// go-live gate
eq(goLive("n6",{canvas:null,skill:null}),false,"no canvas, no skill: refused");
// chat
const got:string[]=[];const off=chat.subscribe("t1",(e,d:any)=>got.push(e+":"+(d.text??"")));
chat.say("t1","u1","ann","hello");eq(chat.say("t1","u1","ann","spam")===null,true,"rate limited");
chat.system("t1","the stream started");chat.requestMic("t1","u1","ann");
eq(chat.passMic("t1","ann"),"u1","pass mic returns the uid");eq(chat.hasSlot("t1","u1"),true,"slot held");
chat.passMic("t1","ghost");eq(chat.passMic("t1","ghost"),null,"unknown handle refused");
eq(got.filter(x=>x.startsWith("msg")).length>=3,true,"subscribers receive lines");off();
eq(chat.snapshot("t1").slots,["ann"],"snapshot has slots");

eq(cleanName("  Tunde Codes! "),"tunde.codes","name becomes a clean handle");eq(cleanName("a"),null,"too short rejected");eq(cleanName("Admin"),null,"reserved name rejected");
eq(claimHandle("tunde.codes","inv_aaaaaaaa1"),true,"name claimed");eq(claimHandle("tunde.codes","inv_bbbbbbbb2"),false,"name taken by someone else");eq(claimHandle("tunde.codes","inv_aaaaaaaa1"),true,"same account may re-claim");
eq(claimHandle("kodo.dev","inv_cccccccc3"),false,"demo creator names are reserved");
// a launched room is published with its meta
const lp=profileFor({uid:"inv_launcher01",handle:"launcher",track:"creator"})!;
eq(goLive(lp.creatorNodeId!,{canvas:"Screen share",skill:null},{title:"Test room",tags:["Coding"],env:"focus",path:"digital",zone:"lekki1"}),true,"creator launches own room");
eq((snapshot().rooms as any)[lp.creatorNodeId!]?.handle,"launcher","launched room appears in snapshot with handle");
process.exit(bad?1:0);
