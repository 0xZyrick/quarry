"use client";
import {motion,useReducedMotion} from "framer-motion";
import {createPortal} from "react-dom";
import {useState} from "react";
import {Tile,TAG} from "@/lib/mosaic";
import TileCanvas from "./TileCanvas";
import {isLow} from "@/lib/perf";

const RADIAL="radial-gradient(circle at 50% 50%,transparent 12%,#000 75%)";
// Spatial hyper-zoom. The clicked tile scales (transform only) from where it sits until it fills the screen while a
// radially blurred veil closes over the rest of the mosaic. When it is full-bleed the room is entered underneath and the
// veil lifts. Rendered in a portal because the feed sheet is transformed, which would otherwise trap `position: fixed`.
export default function ZoomDive({tile,rect,onEnter,onDone}:{tile:Tile;rect:DOMRect;onEnter:()=>void;onDone:()=>void}){
  const reduce=useReducedMotion(),[fade,setFade]=useState(false),W=innerWidth,H=innerHeight;
  const s=Math.max(W/rect.width,H/rect.height),d=reduce?.15:.62;
  return createPortal(
    <motion.div className="fixed inset-0 z-[45]" onPointerDown={e=>e.stopPropagation()}
      animate={{opacity:fade?0:1}} transition={{duration:reduce?.15:.5,ease:"easeOut"}} onAnimationComplete={()=>{if(fade)onDone()}}>
      <motion.div aria-hidden className="absolute inset-0 bg-deep/40" style={{WebkitMaskImage:RADIAL,maskImage:RADIAL}}
        initial={{opacity:0,backdropFilter:"blur(0px)"}} animate={{opacity:1,backdropFilter:isLow()||reduce?"blur(0px)":"blur(16px)"}} transition={{duration:d}}/>
      <motion.div aria-hidden className="absolute overflow-hidden rounded-xl border border-line bg-deep will-change-transform"
        style={{left:rect.left,top:rect.top,width:rect.width,height:rect.height,boxShadow:`0 0 40px ${tile.color}66`}}
        initial={{x:0,y:0,scale:1}} animate={{x:W/2-(rect.left+rect.width/2),y:H/2-(rect.top+rect.height/2),scale:s}}
        transition={{duration:d,ease:[.5,0,.2,1]}} onAnimationComplete={()=>{if(!fade){onEnter();setFade(true)}}}>
        <TileCanvas painter={tile.painter} seed={tile.seed} color={tile.color} scale={.3}/>
        <div className="absolute inset-0 bg-gradient-to-t from-deep/80 to-transparent"/>
        <div className="absolute left-2 top-2 font-mono text-[9px]" style={{color:tile.color}}>{TAG[tile.kind]} | @{tile.name}</div>
      </motion.div>
    </motion.div>,document.body);
}
