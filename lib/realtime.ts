// Mock realtime adapter (7 simulated creators). Swap for Liveblocks/Yjs behind the same interface.
import {create} from "zustand";
export type Cursor={id:string;name:string;color:string;x:number;y:number;tx:number;ty:number;draft?:[number,number][]|null};
export type Stroke={id:string;color:string;pts:[number,number][]};
export type Note={id:string;tile:string;x:number;y:number;text:string;amount:number;by?:string}; // x,y = tile-local 0..1
export interface RealtimeAdapter{presence(x:number,y:number):void;addStroke(s:Stroke):void;addNote(n:Note):void;liveDraft(pts:[number,number][]|null):void}
export const NAMES=["you","mira","kodo","ayo","sade","tunde","lena","ravi"];
const COLORS=["#00FF66","#00A3FF","#FF6B00","#C084FC","#FACC15","#F472B6","#2DD4BF","#A3E635"];
export type Person={id:string;name:string;color:string;self?:boolean};
type R=RealtimeAdapter&{people:Person[];tips:Note[];addTip:(n:Note)=>void;removeTip:(id:string)=>void;removeNote:(id:string)=>void;myColor:string;layout:Record<string,{x:number;y:number}>;setLayout:(id:string,x:number,y:number)=>void;cursors:Cursor[];strokes:Stroke[];notes:Note[];startBots:()=>()=>void};
const MOCK_PEOPLE:Person[]=NAMES.map((n,i)=>({id:`t${i}`,name:n,color:COLORS[i],self:i===0}));
export const liveRef:{cur:null|{room:any;strokes:any;notes:any;layout:any}}={cur:null};
const rnd=()=>Math.random();
export const useRT=create<R>((set,get)=>({
  cursors:NAMES.slice(1).map((n,i)=>({id:n,name:n,color:COLORS[i+1],x:rnd(),y:rnd(),tx:rnd(),ty:rnd()})),
  people:MOCK_PEOPLE,strokes:[],notes:[],layout:{},tips:[],
  addTip:n=>set(st=>st.tips.some(t=>t.id===n.id)?st:{tips:[...st.tips.slice(-99),n]}), // tips come from the server: guests cannot write Liveblocks storage
  removeTip:id=>set(st=>({tips:st.tips.filter(t=>t.id!==id)})),
  removeNote:id=>{const l=liveRef.cur;if(l){const i=l.notes.toArray().findIndex((n:any)=>n.id===id);if(i>=0)l.notes.delete(i)}
    else set(st=>({notes:st.notes.filter(n=>n.id!==id)}))},
  setLayout:(id,x,y)=>{if(liveRef.cur)liveRef.cur.layout.set(id,{x,y});else set(st=>({layout:{...st.layout,[id]:{x,y}}}))},
  myColor:"#00FF66",liveDraft:pts=>{liveRef.cur?.room.updatePresence({draft:pts})},
  presence:(x,y)=>{liveRef.cur?.room.updatePresence({x,y})},
  addStroke:s=>{if(liveRef.cur)liveRef.cur.strokes.push(s);else set(st=>({strokes:[...st.strokes,s]}))},
  addNote:n=>{if(liveRef.cur)liveRef.cur.notes.push(n);else set(st=>({notes:[...st.notes,n]}))},
  startBots:()=>{
    const a=setInterval(()=>set(st=>({cursors:st.cursors.map(c=>({...c,
      x:c.x+(c.tx-c.x)*.12,y:c.y+(c.ty-c.y)*.12,
      ...(rnd()<.03?{tx:rnd(),ty:rnd()}:{})}))})),80);
    const b=setInterval(()=>{const c=get().cursors[Math.floor(rnd()*7)];let x=c.x,y=c.y;
      const pts:[number,number][]=Array.from({length:14},()=>[x+=(rnd()-.5)*.04,y+=(rnd()-.5)*.04]);
      get().addStroke({id:crypto.randomUUID(),color:c.color,pts})},4000);
    const t=setInterval(()=>get().addNote({id:crypto.randomUUID(),tile:"t0",x:.3+rnd()*.4,y:.3+rnd()*.4, // mock viewers tip you
      text:["Nice!","Try emerald teal here","clean lines","🔥"][Math.floor(rnd()*4)],amount:[2,5][Math.floor(rnd()*2)],by:"t"+(1+Math.floor(rnd()*7))}),9000);
    return()=>{clearInterval(a);clearInterval(b);clearInterval(t)};
  }}));

// Real Liveblocks when NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY is set, otherwise the simulated creators.
export async function startRealtime(roomId:string):Promise<()=>void>{
  useRT.setState({people:MOCK_PEOPLE,strokes:[],notes:[],layout:{},tips:[],myColor:"#00FF66"}); // fresh state per room
  const key=process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY;
  if(!key&&process.env.NEXT_PUBLIC_LIVEBLOCKS_AUTH!=="1"){
    if(roomId.startsWith("guild-own:")){useRT.setState({cursors:[]});return()=>{}} // a real creator's room has no simulated co-creators
    return useRT.getState().startBots()}
  try{const {connectLive}=await import("./liveblocks");
    const c=await connectLive(roomId,key,p=>useRT.setState(p));
    liveRef.cur=c.live;return()=>{liveRef.cur=null;c.stop()}}
  catch(e){console.warn("Liveblocks unavailable, using mock",e);return useRT.getState().startBots()}
}
