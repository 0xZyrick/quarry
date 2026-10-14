"use client";
import {motion,animate,useMotionValue,useMotionValueEvent} from "framer-motion";
import {useCallback,useEffect,useRef,useState} from "react";
import {useGuild,Layer,swipedNode} from "@/lib/store";
import {NODES,cam,proj} from "@/lib/map";
import {MAXZ} from "@/lib/zoom";
import WarRoom from "../war/WarRoom";
import GridMap from "../map/GridMap";
import Commons from "../commons/Commons";
import FeedLayer from "./FeedLayer";
import {readLink,writeLink} from "@/lib/deeplink";
import {reducedMotion} from "@/lib/perf";
import {GlobalCounts} from "../shared/Counts";
import RoleChip from "../shared/RoleChip";
import {useRole,useRoomSecurity} from "@/lib/store";
import {viewsFor} from "@/lib/access";
import {useRoomCtl} from "@/lib/roomCtl";
import {useHubs,isVisible} from "@/lib/hubs";
import {useStats} from "@/lib/stats";
import Tunnel from "../map/Tunnel";
import Workspace from "../stream/Workspace";
import ModBanner from "../safety/ModBanner";
import LaunchPortal from "../launch/LaunchPortal";
import VaultSheet from "../vault/VaultSheet";
import {useShellUi} from "@/lib/shellUi";
import SoonChip from "../shared/SoonChip";
import {PAYMENTS_ON} from "@/lib/flags";

function Wallet({bare=false}:{bare?:boolean}){
  if(!PAYMENTS_ON)return <SoonChip className={bare?"!py-0.5 !px-1.5 !text-[9px]":""}>Wallet</SoonChip>;
  const w=useGuild(s=>s.wallet),pending=useGuild(s=>s.pending);
  const mv=useMotionValue(w);const [txt,setTxt]=useState(w);
  useMotionValueEvent(mv,"change",v=>setTxt(Math.round(v)));
  useEffect(()=>{const c=animate(mv,w,{duration:1.2,ease:"easeOut"});return c.stop},[w]);
  const body=<>${txt.toLocaleString()}{pending&&" · pending"}</>;
  if(bare)return <div role="status" aria-live="polite" className={`font-mono text-[10px] whitespace-nowrap ${pending?"text-risk":"text-live"}`}>{body}</div>;
  return <div role="status" aria-live="polite" className={`glass px-3 py-1.5 rounded-full font-mono text-sm ${pending?"text-risk":"text-live"}`}>{body}</div>;
}

const SPRING={type:"spring" as const,stiffness:300,damping:30};
type G={id:number;x:number;y:number;axis:""|"x"|"y";l:Layer;lastX:number;lastT:number;vx:number};

// Layers: feed(0) and map(1) share one screen. The feed is a sheet lying ON the map; swiping left pulls the sheet
// back into the creator's node (`pull` 0->1). Map(1) -> room(2) is a plain horizontal slide (`sx`).
// This component is the single owner of horizontal pointer intent; children never attach their own shell drag.
export default function SpatialShell(){
  const {layer,setLayer,load,room,setRoom,roomId,trans}=useGuild();
  const [size,setSize]=useState({w:390,h:800}),sz=useRef(size);sz.current=size;
  const sx=useMotionValue(0),pull=useMotionValue(0),roomScale=useMotionValue(1);
  const [pulling,setPulling]=useState(false); // map must keep rendering while the sheet is mid-pull
  const [feedOn,setFeedOn]=useState(true);    // feed video plays until the sheet has fully collapsed
  const gs=useRef<G|null>(null),me=useRole(),sec=useRoomSecurity(),profileReady=useGuild(s=>s.profileReady),gr=useHubs(s=>!!s.greenroom[roomId]);
  const views=viewsFor(sec.room.type,gr);

  const run=useCallback((l:Layer,inst:boolean)=>{
    const w=sz.current.w,tx=l===2?-w:0,rm=reducedMotion();
    if(inst||rm)sx.set(tx);else animate(sx,tx,SPRING);
    if(l===0){setFeedOn(true);
      if(pull.get()===0)setPulling(false);else{if(rm){pull.set(0);setPulling(false)}else{setPulling(true);animate(pull,0,{...SPRING,onComplete:()=>setPulling(false)})}}}
    else if(l===1){
      if(cam.z>MAXZ){cam.z=40;cam.pitch=.5} // ascending from a dive: camera pulls back out over the city
      const done=()=>{setFeedOn(false);setPulling(false);const id=swipedNode().id;
        useGuild.getState().select(id);useGuild.setState({landed:{k:Date.now(),id}})}; // token has landed: map plays the ripple + zone flash
      if(pull.get()<1){if(rm){pull.set(1);done()}else{setPulling(true);
        animate(pull,1,{duration:.55,ease:[.5,0,.2,1],onComplete:done})}}
      else{setFeedOn(false);setPulling(false)}}
    else{
      if(inst&&!rm){roomScale.set(1.3);animate(roomScale,1,{duration:.9,ease:[.2,.7,.2,1]})} // the room keeps zooming in as the veil clears
      setTimeout(()=>{pull.set(1);setFeedOn(false);setPulling(false)},inst?0:450)}
  },[]);

  useEffect(()=>{const inst=useGuild.getState().instant;if(inst)useGuild.setState({instant:false});run(layer,inst)},[layer]);
  useEffect(()=>{sx.set(layer===2?-size.w:0)},[size.w]);
  useEffect(()=>{const l=readLink();if(!l)return; // deep link: open straight into a room
    const g=useGuild.getState();g.setRoomId(l.roomId);g.setRoom(l.view);useGuild.setState({instant:true});g.setLayer(2)},[]);
  useEffect(()=>{if(layer===2&&!views.includes(room))setRoom(views[views.length>1&&room==="commons"?1:0])},[layer,room,views.join()]); // a Crystal has no Project; a Monolith has no Commons while the Greenroom is off
  useEffect(()=>{if(!profileReady)return;const q=new URLSearchParams(location.search),g=useGuild.getState(); // links from a PoE Vault: teleport to a workbench or back to the map
    const node=q.get("node"),r=q.get("room");
    if(node&&/^[A-Za-z0-9:_-]{1,48}$/.test(node)){g.setRoomId(node);g.select(node);g.setRoom(r==="war"?"war":r==="commons"?"commons":"stream");g.setLayer(2)}
    else if(q.get("view")==="map")g.setLayer(1);
    if(node||q.get("view"))history.replaceState(null,"",location.pathname)},[profileReady]);
  useEffect(()=>{useRoomCtl.getState().reset()},[roomId]);
  useEffect(()=>{if(layer!==2)return;return useGuild.getState().watchEscrow(roomId)},[roomId,layer===2]); // escrow state for the room you are standing in
  useEffect(()=>{const f=()=>useHubs.getState().sync();f();const t=setInterval(f,3000);return()=>clearInterval(t)},[]); // map visibility, flags and Greenroom come from the server
  useEffect(()=>{const u=useHubs.subscribe(s=>{const g=useGuild.getState();if(g.selected&&!isVisible(g.selected,s))g.select(null)});return u},[]); // a node that goes offline loses its selection
  useEffect(()=>{const t=setInterval(()=>useStats.getState().tick(),5000);return()=>clearInterval(t)},[]); // mock drift
  useEffect(()=>{if(layer===2)useStats.getState().visit(roomId)},[layer,roomId]); // entering a room counts one visit
  useEffect(()=>{if(useGuild.getState().dive)return;writeLink(layer===2?{roomId,view:room}:null)},[layer,room,roomId]);
  useEffect(()=>{load();const f=()=>setSize({w:innerWidth,h:innerHeight});f();
    addEventListener("resize",f);return()=>removeEventListener("resize",f)},[]);

  const go=(n:number)=>{const t=Math.max(0,Math.min(2,n)) as Layer;if(t===layer)run(t,false);else setLayer(t)};
  useEffect(()=>{const k=(e:KeyboardEvent)=>{ // keyboard fallback
    if(document.documentElement.hasAttribute("data-onboarding"))return; // onboarding is on top: arrows must not move layers underneath
    if(/^(INPUT|TEXTAREA)$/.test((e.target as HTMLElement)?.tagName)||useGuild.getState().dive||useGuild.getState().trans)return;
    if(e.key==="ArrowRight")go(layer+1);if(e.key==="ArrowLeft")go(layer-1);
    if(layer===0&&(e.key==="ArrowDown"||e.key==="ArrowUp")){
      const f=document.querySelector(".snap-y-feed");f?.scrollBy({top:(e.key==="ArrowDown"?1:-1)*f.clientHeight,behavior:"smooth"})}};
    addEventListener("keydown",k);return()=>removeEventListener("keydown",k)},[layer]);

  const down=(e:React.PointerEvent)=>{
    if(gs.current){gs.current=null;return} // second finger: not a layer swipe
    if(useGuild.getState().dive||(e.pointerType==="mouse"&&e.button!==0))return;
    if(layer===0)useGuild.setState({swipeNode:(e.target as HTMLElement).closest?.("[data-node]")?.getAttribute("data-node")??null});
    gs.current={id:e.pointerId,x:e.clientX,y:e.clientY,axis:"",l:layer,lastX:e.clientX,lastT:performance.now(),vx:0}};
  const move=(e:React.PointerEvent)=>{
    const s=gs.current;if(!s||s.id!==e.pointerId)return;
    const dx=e.clientX-s.x,dy=e.clientY-s.y;
    if(!s.axis){if(Math.hypot(dx,dy)<8)return;       // lock axis after ~8px
      if(Math.abs(dx)<=Math.abs(dy)){gs.current=null;return} // vertical = feed scroll, not ours
      s.axis="x";e.currentTarget.setPointerCapture(e.pointerId);sx.stop();pull.stop();if(s.l<=1)setPulling(true);
      if(s.l===0){const [nx,ny]=proj(swipedNode());cam.x=nx;cam.y=ny} // the map glides to the neighbourhood the avatar is about to land in
    }
    const now=performance.now(),dt=now-s.lastT;
    if(dt>0)s.vx=.8*s.vx+.2*((e.clientX-s.lastX)/dt);s.lastX=e.clientX;s.lastT=now;
    const w=sz.current.w,K=w*.55;
    if(s.l===0){pull.set(dx<0?Math.min(1,-dx/K):0)}
    else if(s.l===1){
      if(dx>0){setFeedOn(true);sx.set(0);pull.set(1-Math.min(1,dx/K))}   // pull the sheet back out of the node
      else{pull.set(1);sx.set(Math.max(-w,dx))}}                          // slide toward the room
    else sx.set(-w+(dx>0?Math.min(dx,w):dx*.15))};
  const up=(e:React.PointerEvent)=>{
    const s=gs.current;gs.current=null;if(!s||s.axis!=="x")return;
    try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{}
    const w=sz.current.w,vx=s.vx,p=pull.get(),x=sx.get();let t=s.l;
    if(s.l===0){if(p>.35||(vx<-.5&&p>.08))t=1}
    else if(s.l===1){
      if(x<0){if(x<-w*.25||(vx<-.5&&x<-20))t=2}
      else if(p<1){if(p<.65||vx>.5)t=0}}
    else if(x>-w*.75||vx>.5)t=1;
    go(t)};

  return <div className="fixed inset-0 overflow-hidden select-none" onScroll={e=>{e.currentTarget.scrollLeft=0;e.currentTarget.scrollTop=0}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
    {/* Top bar: room tools left · identity cluster right — one row, balanced CSS */}
    <header className="absolute top-0 inset-x-0 z-30 pointer-events-none px-4 sm:px-5 pt-3 pb-2">
      <div className="flex items-center gap-2 w-full max-w-[100%] mx-auto min-h-[2.25rem]">
        <div className="flex items-center gap-1.5 pointer-events-auto min-w-0 shrink">
          {layer===2&&<>
            <button type="button" aria-label="Back to feed" onClick={()=>go(0)} className="glass btn rounded-full px-2.5 py-1 font-mono text-[11px] text-neutral-200 hover:bg-live hover:text-black shrink-0">← Feed</button>
            <div className="glass rounded-full flex text-[11px] font-mono p-0.5 shrink-0">
              {(["stream","commons","war"] as const).filter(r=>views.includes(r)).map(r=>(
                <button key={r} type="button" onClick={()=>setRoom(r)} aria-pressed={room===r}
                  className={`btn px-2.5 py-1 rounded-full whitespace-nowrap ${room===r?(r==="war"?"bg-risk":"bg-live")+" text-black":"text-neutral-400 hover:text-white"}`}>
                  {r==="war"?(me.role==="guest"?"Balcony":"Project"):r==="stream"?"Workspace":"Commons"}
                </button>
              ))}
            </div>
          </>}
          {layer===1&&(
            <button type="button" aria-label="Back to feed" onClick={()=>go(0)} className="glass btn rounded-full px-3 py-1 font-mono text-[11px] text-neutral-200 hover:bg-live hover:text-black">← Feed</button>
          )}
        </div>
        <div className="flex-1 min-w-0"/>
        {/* Counts + wallet — fully inside header, never bleed past edges */}
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-line bg-[rgba(22,25,32,.9)] backdrop-blur-md pl-2.5 pr-1.5 py-1 shrink-0 max-w-[min(100%,18rem)] overflow-hidden">
          <GlobalCounts/>
          <span className="text-neutral-600 select-none shrink-0" aria-hidden>|</span>
          <Wallet bare/>
          <RoleChip/>
        </div>
      </div>
    </header>

    {/* Content layers */}
    <motion.div className="flex h-full" style={{width:size.w*2,x:sx}}>
      <section style={{width:size.w}} aria-label="Feed and map" {...({inert:layer===2?"":undefined} as any)} className="h-full relative">
        <div className="absolute inset-0 z-0 isolate"><GridMap active={layer===1||pulling}/></div>
        <FeedLayer pull={pull} w={size.w} h={size.h} playing={feedOn}/>
      </section>
      <motion.section style={{width:size.w,scale:roomScale,pointerEvents:trans&&(trans.to===2||trans.from===2)?"none":"auto"}} aria-busy={!!trans} aria-label="Room" {...({inert:layer!==2?"":undefined} as any)} className="h-full">
        {!profileReady?null:<div key={sec.key} className="h-full">{room==="war"?<WarRoom/>:room==="stream"?<Workspace/>:<Commons/>}</div>}
      </motion.section>
    </motion.div>
    <Tunnel/>
    <LaunchPortal/>
    <VaultSheet/>
    <ModBanner/>

    {/* Bottom dock — feed & map only (not inside rooms) */}
    {layer<=1&&(
      <nav aria-label="Primary" className="absolute bottom-3 inset-x-0 z-30 flex justify-center pointer-events-none px-3">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-line bg-[rgba(22,25,32,.9)] backdrop-blur-md px-1.5 py-1.5 shadow-lg">
          <SoonChip className="!cursor-not-allowed">Search</SoonChip>
          <button type="button" onClick={()=>useShellUi.getState().openLaunch()}
            className="btn rounded-full px-4 py-1.5 font-mono text-[11px] font-semibold bg-live text-black hover:brightness-110">
            Launch Portal
          </button>
          <button type="button" onClick={()=>{const h=useGuild.getState().profile?.handle;if(h)useShellUi.getState().openVault(h)}}
            className="btn glass rounded-full px-3 py-1.5 font-mono text-[10px] text-neutral-200 hover:text-white">
            Profile
          </button>
        </div>
      </nav>
    )}

    {layer<=1&&(
      <nav aria-label="Layers" className="absolute bottom-1 left-1/2 -translate-x-1/2 flex z-20">
        {["Feed","Map","Room"].map((name,i)=>(
          <button key={name} type="button" aria-label={name} aria-current={layer===i?"page":undefined} onClick={()=>go(i)}
            onPointerDown={e=>e.stopPropagation()} className="btn grid place-items-center w-8 h-6">
            <i className={`block h-1 rounded-full transition-all ${layer===i?"w-6 bg-live":"w-2 bg-neutral-600"}`}/>
          </button>
        ))}
      </nav>
    )}
  </div>;
}
