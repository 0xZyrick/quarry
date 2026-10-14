"use client";
import {useEffect,useRef,useState} from "react";
import {useGuild} from "@/lib/store";
import {useRoomMedia} from "@/lib/roomMedia";
import LoopVideo from "../shared/LoopVideo";
import {BROADCAST_SRC} from "@/lib/media";
import {tileVideoBudget} from "@/lib/perf";
import {useCapture} from "@/lib/capture";

function TrackVideo({track,mirror}:{track:any;mirror?:boolean}){
  const r=useRef<HTMLVideoElement>(null);
  useEffect(()=>{const el=r.current;if(!el)return;track.attach(el);return()=>{track.detach(el)}},[track]);
  return <video ref={r} autoPlay muted playsInline className={`absolute inset-0 w-full h-full object-cover rounded-[10px] ${mirror?"-scale-x-100":""}`}/>;
}
const camBtn="pointer-events-auto z-20 btn text-[10px] font-mono px-2 py-1 rounded-full border border-live text-live hover:bg-live hover:text-black";

// Live room (LiveKit): real cameras. Otherwise: your local webcam preview + mock loops capped by device tier.
export default function TileVideo({i,id,self}:{i:number;id:string;self:boolean}){
  const layer=useGuild(s=>s.layer);const [budget]=useState(tileVideoBudget);
  const {live,streams,camOn,setCam,error}=useRoomMedia();
  const v=useRef<HTMLVideoElement>(null);const [cam,setLocal]=useState<"off"|"on"|"denied">("off");
  useEffect(()=>()=>{(v.current?.srcObject as MediaStream|null)?.getTracks().forEach(t=>t.stop())},[]);
  const stream=self?streams.self:id==="host"?Object.values(streams)[0]:streams[id],cap=useCapture(); // the host seat shows whatever the owner publishes
  // Without LiveKit your own tile previews whatever input you authorised (screen or desk camera) locally.
  if(!live&&self&&cap.stream)return <>
    <video autoPlay muted playsInline ref={el=>{if(el&&el.srcObject!==cap.stream)el.srcObject=cap.stream}} className={`absolute inset-0 w-full h-full rounded-[10px] ${cap.path==="digital"?"object-contain bg-black":"object-cover"}`}/>
    <span className="absolute bottom-1 left-2 font-mono text-[9px] text-live">{cap.path==="digital"?"SCREEN":"DESK CAM"}</span></>;
  if(live)return <>
    {stream?<TrackVideo track={stream} mirror={self}/>
      :<div className="absolute inset-0 grid place-items-center text-[10px] font-mono text-neutral-500">{self?"":"no camera"}</div>}
    {self&&<div className="absolute inset-0 grid place-items-center pointer-events-none">
      <button onPointerDown={e=>e.stopPropagation()} onClick={()=>setCam(!camOn)}
        className={camBtn+(camOn?" !absolute bottom-1 right-1 opacity-70":"")}>{error||(camOn?"cam off":"enable cam")}</button></div>}</>;
  if(self)return <>
    <video ref={v} autoPlay muted playsInline className={`absolute inset-0 w-full h-full object-cover rounded-[10px] -scale-x-100 ${cam==="on"?"":"hidden"}`}/>
    {cam!=="on"&&<button onPointerDown={e=>e.stopPropagation()}
      onClick={async()=>{try{const s=await navigator.mediaDevices.getUserMedia({video:true});v.current!.srcObject=s;setLocal("on")}catch{setLocal("denied")}}}
      className={camBtn+" absolute inset-0 m-auto w-fit h-fit"}>{cam==="denied"?"cam blocked":"enable cam"}</button>}</>;
  if(i>budget)return null;
  return <LoopVideo src={BROADCAST_SRC} active={layer===2} className="absolute inset-0 w-full h-full object-cover rounded-[10px] opacity-80" style={{filter:`hue-rotate(${i*45}deg)`}}/>;
}
