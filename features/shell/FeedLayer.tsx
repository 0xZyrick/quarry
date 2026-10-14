"use client";
import {motion,MotionValue,useTransform} from "framer-motion";
import {useGuild,swipedNode} from "@/lib/store";
import {NODES,COLOR,toScreen} from "@/lib/map";
import {useDesktop} from "@/lib/layout";
import Discovery from "../mosaic/Discovery";
import PeekFrame from "./PeekFrame";

const S_END=.1,RING=28,DROP=96,tt=(p:number)=>Math.min(1,Math.max(0,(p-.55)/.4)); // DROP = how far above its node the token starts // sheet ends at 10% scale, circle radius 14px on screen
// `pull` 0 = full-bleed clip, 1 = collapsed into the creator's avatar node on the map.
// The sheet scales about the node's screen position and is clipped to a shrinking circle: transform + clip-path only.
export default function FeedLayer({pull,w,h,playing}:{pull:MotionValue<number>;w:number;h:number;playing:boolean}){
  const desktop=useDesktop(),node=swipedNode;
  const sc=useTransform(pull,p=>1-(1-S_END)*p);
  const x=useTransform(pull,p=>toScreen(node(),w,h)[0]*(1-S_END)*p);
  const y=useTransform(pull,p=>toScreen(node(),w,h)[1]*(1-S_END)*p);
  const clip=useTransform(pull,p=>{const [tx,ty]=toScreen(node(),w,h),R0=Math.hypot(w,h),R1=RING/2/S_END;
    return `circle(${R0+(R1-R0)*Math.pow(p,1.4)}px at ${tx}px ${ty}px)`});
  const op=useTransform(pull,p=>p<.9?1:Math.max(0,1-(p-.9)/.1));
  const ringOp=useTransform(pull,p=>Math.min(1,Math.max(0,(p-.55)/.4)));
  // The avatar token falls onto its node: it accelerates (height ~ 1 - t^2), shrinks as it nears the ground, and casts a growing shadow.
  const ringSc=useTransform(pull,p=>1+.8*(1-tt(p)**2));
  const ringX=useTransform(pull,()=>toScreen(node(),w,h)[0]-RING/2);
  const ringY=useTransform(pull,p=>toScreen(node(),w,h)[1]-RING/2-DROP*(1-tt(p)**2));
  const shX=useTransform(pull,()=>toScreen(node(),w,h)[0]-RING/2);
  const shY=useTransform(pull,()=>toScreen(node(),w,h)[1]+RING*.35);
  const shOp=useTransform(pull,p=>.55*tt(p)),shSc=useTransform(pull,p=>.3+.7*tt(p));
  const hide=useTransform(pull,p=>p>=.999?"hidden":"visible");
  const hit=useTransform(pull,p=>p>=.999?"none":"auto");
  useGuild(s=>s.clip);const sw=useGuild(s=>s.swipeNode),n=NODES.find(x=>x.id===sw)??NODES[useGuild.getState().clip%3],c=COLOR[n.status];
  const go=(l:0|1|2)=>useGuild.getState().setLayer(l);
  const war=()=>{const g=useGuild.getState();g.setRoomId(NODES[g.clip%3].id);g.setRoom("war");go(2)};
  return <motion.div className="absolute inset-0 z-10" style={{visibility:hide,pointerEvents:hit}}>
    <motion.div className="absolute inset-0 will-change-transform bg-deep"
      style={{scale:sc,x,y,clipPath:clip,opacity:op,transformOrigin:"0 0",touchAction:"pan-y"}}>
      <PeekFrame enabled={desktop} onMap={()=>go(1)} onWar={war}><Discovery playing={playing}/></PeekFrame>
    </motion.div>
    <motion.div aria-hidden className="absolute left-0 top-0 rounded-full bg-black pointer-events-none blur-[2px]"
      style={{width:RING,height:RING*.4,x:shX,y:shY,opacity:shOp,scale:shSc}}/>
    <motion.div aria-hidden className="absolute left-0 top-0 rounded-full border-2 grid place-items-center font-mono text-[11px] font-bold pulse bg-card pointer-events-none"
      style={{width:RING,height:RING,x:ringX,y:ringY,opacity:ringOp,scale:ringSc,color:c,borderColor:c}}>{n.name[0].toUpperCase()}</motion.div>
  </motion.div>;
}
