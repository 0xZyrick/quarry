"use client";
import {useEffect,useRef,useState} from "react";
// Muted-by-default looping video. Plays only while `active`; hides itself if the source fails.
export default function LoopVideo({src,active,audio=false,preload="metadata",className,style}:
  {src:string;active:boolean;audio?:boolean;preload?:"auto"|"metadata"|"none";className?:string;style?:React.CSSProperties}){
  const r=useRef<HTMLVideoElement>(null);const [bad,setBad]=useState(false);
  useEffect(()=>{const v=r.current;if(!v)return;if(active)v.play().catch(()=>{});else v.pause()},[active,src]);
  useEffect(()=>{if(r.current)r.current.muted=!audio},[audio]);
  if(bad)return null;
  return <video ref={r} src={src} muted loop playsInline preload={preload} onError={()=>setBad(true)} className={className} style={style}/>;
}
