// Liveblocks transport for the realtime store (cursors = presence; strokes/notes/layout = storage).
import {createClient,LiveList,LiveMap} from "@liveblocks/client";
const COLORS=["#00FF66","#00A3FF","#FF6B00","#C084FC","#FACC15","#F472B6","#2DD4BF","#A3E635"];
const cursorsOf=(os:any[])=>os.filter(o=>o.presence?.name).map(o=>({id:String(o.connectionId),name:o.presence.name,
  color:o.presence.color,draft:o.presence.draft??null,x:o.presence.x??.5,y:o.presence.y??.5,tx:0,ty:0}));
export async function connectLive(roomId:string,key:string|undefined,apply:(p:any)=>void){
  const useAuth=process.env.NEXT_PUBLIC_LIVEBLOCKS_AUTH==="1"; // token auth via /api/liveblocks-auth
  const client=createClient({...(useAuth?{authEndpoint:"/api/liveblocks-auth"}:{publicApiKey:key!}),throttle:50});
  const me=await fetch("/api/liveblocks-auth").then(r=>r.json()).catch(()=>null)??{name:"guest-"+Math.random().toString(36).slice(2,5),color:COLORS[Math.floor(Math.random()*COLORS.length)]};
  const uid:string=(me as any).id??crypto.randomUUID();
  const {room,leave}=(client.enterRoom as any)(roomId,{initialPresence:{x:.5,y:.5,draft:null,uid,name:me.name,color:me.color},
    initialStorage:{strokes:new LiveList([]),notes:new LiveList([]),layout:new LiveMap()}});
  const {root}=await room.getStorage();
  const sync=()=>{const im=root.toImmutable();
    apply({strokes:im.strokes,notes:im.notes,layout:Object.fromEntries(im.layout)})};
  const people=(os:any[])=>{const seen=new Set<string>([`u-${uid}`]); // tile id = user id, so notes follow the creator
    return [{id:`u-${uid}`,name:me.name,color:me.color,self:true},
      ...os.filter(o=>o.presence?.name).map(o=>({id:"u-"+(o.presence.uid??o.connectionId),name:o.presence.name,color:o.presence.color}))
        .filter(p=>!seen.has(p.id)&&(seen.add(p.id),true))]};
  sync();apply({myColor:me.color,cursors:cursorsOf(room.getOthers()),people:people(room.getOthers())});
  const u1=room.subscribe(root,sync,{isDeep:true});
  const u2=room.subscribe("others",(os:any[])=>apply({cursors:cursorsOf(os),people:people(os)}));
  return {live:{room,strokes:root.get("strokes"),notes:root.get("notes"),layout:root.get("layout")},
    stop:()=>{u1();u2();leave()}};
}
