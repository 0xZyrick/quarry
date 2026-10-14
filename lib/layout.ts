"use client";
import {useEffect,useState} from "react";
// Desktop = wide screen with a real pointer. Drives the "peeking canvas" frame (mobile stays pure full-bleed).
export function useDesktop(){
  const [d,setD]=useState(false);
  useEffect(()=>{const m=matchMedia("(min-width:900px) and (hover:hover) and (pointer:fine)");
    const f=()=>setD(m.matches);f();m.addEventListener("change",f);return()=>m.removeEventListener("change",f)},[]);
  return d;
}
