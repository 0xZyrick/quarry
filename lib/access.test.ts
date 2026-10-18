import {kindIn,capsOf,controlsFor,roomInfo,viewsFor,canGoLive} from "./access";
import {useHubs} from "./hubs";
const P=(o:any)=>({id:"u",handle:"h",creatorNodeId:null,clientRoomIds:[],crewRoomIds:[],...o});
const eq=(a:any,b:any,m:string)=>{if(JSON.stringify(a)!==JSON.stringify(b)){console.log("FAIL",m,a,b);process.exitCode=1}else console.log("ok  ",m)};
const war=roomInfo("n1"),com=roomInfo("n0"); // n1 = monolith, n0 = crystal
eq(kindIn(P({creatorNodeId:"n1"}),war),"owner-creator","hired creator owns the war room");
eq(kindIn(P({clientRoomIds:["n1"]}),war),"client-owner","client in war room");
eq(kindIn(P({clientRoomIds:["n0"]}),com),"guest","client in a Commons is a spectator");
eq(kindIn(P({crewRoomIds:["n0"]}),com),"co-creator","seated co-creator");
eq(kindIn(P({creatorNodeId:"n3"}),com),"guest","visiting creator is a guest");
eq(kindIn(null,com),"guest","signed out");
eq(capsOf("client-owner","war").pushToTalk,true,"client can use push-to-talk");
eq(capsOf("owner-creator","war").pushToTalk,false,"hired creator does not use client push-to-talk");
eq(capsOf("guest","commons").draw,false,"commons guest: no draw");
eq(controlsFor("guest","war").map(c=>c.id),["chat"],"war guest: chat only");
eq(controlsFor("client-owner","war").map(c=>c.id),["ptt"],"client gets push-to-talk only");
eq(controlsFor("owner-creator","commons").map(c=>c.id),["stream","layout","crew"],"owner bar");
eq(viewsFor("commons",false),["stream","commons"],"crystal views");
eq(viewsFor("war",false),["stream","war"],"monolith, greenroom off");
eq(viewsFor("war",true),["stream","war","commons"],"monolith, greenroom on");
eq(canGoLive({canvas:null,skill:null}),false,"camera alone cannot go live");
eq(canGoLive({canvas:"Figma",skill:null}),true,"canvas goes live");
// server registry owns flags now; the client store only mirrors it (see server.test.ts)
const h=null as any;
