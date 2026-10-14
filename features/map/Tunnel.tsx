"use client";
import {motion,useReducedMotion} from "framer-motion";
import {useEffect,useRef} from "react";
import {useGuild} from "@/lib/store";
import {DIVE_MS,DIVE_STYLE,ss} from "@/lib/zoom";
import {isLow} from "@/lib/perf";

const RADIAL_MASK="radial-gradient(circle at 50% 50%,transparent 10%,#000 72%)";
const GLYPHS="01{}<>/=;#$%&*+".split("");
// Map -> workspace descent. The map blurs behind frosted glass, rings rush toward the viewer like a warp tunnel with
// code streaming past, then the veil clears into the creator's stream. Nothing here knows where anyone is.
export default function Tunnel(){
  const d=useGuild(s=>s.dive),reduce=useReducedMotion();
  if(!d)return null;
  if(reduce)return <motion.div key={d.k} aria-hidden className="fixed inset-0 z-40 pointer-events-none bg-deep"
    initial={{opacity:0}} animate={{opacity:[0,1,1,0]}} transition={{duration:DIVE_MS.reduced/1000,times:[0,.4,.6,1]}}/>;
  return <Warp key={d.k} color={d.color} zone={d.zone}/>;
}

function Warp({color,zone}:{color:string;zone:string}){
  const cv=useRef<HTMLCanvasElement>(null),lab=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const c=cv.current!,g=c.getContext("2d")!,low=isLow(),dpr=low?1:Math.min(devicePixelRatio||1,1.5);
    const W=innerWidth,H=innerHeight;c.width=W*dpr;c.height=H*dpr;g.scale(dpr,dpr);
    const cx=W/2,cy=H/2,R=Math.hypot(W,H)/2;
    const streaks=Array.from({length:low?28:70},()=>({a:Math.random()*Math.PI*2,o:Math.random(),w:.5+Math.random()*1.2}));
    const glyphs=Array.from({length:low?0:60},()=>({a:Math.random()*Math.PI*2,o:Math.random(),ch:GLYPHS[Math.floor(Math.random()*GLYPHS.length)]}));
    const t0=performance.now();let ph=0,last=t0,raf=0;
    const frame=(now:number)=>{
      const t=Math.min(1,(now-t0)/DIVE_MS.clear),dt=(now-last)/1000;last=now;
      const spd=.25+3.4*ss(0,.55,t);ph+=dt*spd; // accelerates, like the camera
      // veil envelope: closes over the map, stays opaque across the room swap, then clears
      const env=ss(.08,.42,t)*(1-ss(.72,1,t));
      g.clearRect(0,0,W,H);
      g.fillStyle=`rgba(13,14,17,${env*.94})`;g.fillRect(0,0,W,H);
      const glow=g.createRadialGradient(cx,cy,0,cx,cy,R*.9);
      glow.addColorStop(0,color+"55");glow.addColorStop(.5,color+"11");glow.addColorStop(1,"transparent");
      g.globalAlpha=env;g.fillStyle=glow;g.fillRect(0,0,W,H);
      g.lineCap="round";
      // radial streaks
      g.strokeStyle=color;
      for(const s of streaks){const p=(s.o+ph*.6*(.5+s.w))%1,r0=R*p*p,r1=R*Math.min(1,p*p+.03+spd*.025*p);
        g.globalAlpha=env*p*.7;g.lineWidth=s.w;g.beginPath();
        g.moveTo(cx+Math.cos(s.a)*r0,cy+Math.sin(s.a)*r0);g.lineTo(cx+Math.cos(s.a)*r1,cy+Math.sin(s.a)*r1);g.stroke()}
      const tunnel=DIVE_STYLE==="tunnel";
      // octagon frames rushing past, each a glowing blueprint outline (tunnel style only)
      const N=tunnel?low?8:16:0,rot=ph*.12;
      for(let k=0;k<N;k++){const z=((k/N+ph*.35)%1),r=R*Math.pow(z,2.2)+4;
        g.globalAlpha=env*Math.min(1,z*3)*(1-z*.55)*.9;g.lineWidth=1+z*2.2;g.strokeStyle=k%4===0?"#ffffff":color;
        g.beginPath();for(let i=0;i<=8;i++){const a=rot+i/8*Math.PI*2+k*.07;
          const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;i?g.lineTo(x,y):g.moveTo(x,y)}g.stroke()}
      // code streaming outward along the streak lanes
      g.font="10px 'JetBrains Mono',monospace";g.fillStyle=color;
      for(const s of tunnel?glyphs:[]){const p=(s.o+ph*.45)%1,r=R*p*p*1.05+20;
        g.globalAlpha=env*Math.sin(p*Math.PI)*.8;g.fillText(s.ch,cx+Math.cos(s.a)*r,cy+Math.sin(s.a)*r)}
      // breakthrough flash as the tunnel opens onto the stream
      const f=ss(.62,.72,t)*(1-ss(.72,.86,t));
      if(f>0){g.globalAlpha=f*.55;g.strokeStyle="#fff";g.lineWidth=2+f*10;g.beginPath();g.arc(cx,cy,R*ss(.62,.86,t),0,Math.PI*2);g.stroke()}
      g.globalAlpha=1;
      if(lab.current)lab.current.style.opacity=String(ss(.2,.35,t)*(1-ss(.6,.7,t)));
      if(t<1)raf=requestAnimationFrame(frame)};
    raf=requestAnimationFrame(frame);return()=>cancelAnimationFrame(raf)},[color]);
  return <div aria-hidden className="fixed inset-0 z-40 pointer-events-none">
    <motion.div className="absolute inset-0 bg-deep/40" // frosted-glass warp. Radial style: sharp in the middle, blur grows toward the edges
      style={DIVE_STYLE==="radial"?{WebkitMaskImage:RADIAL_MASK,maskImage:RADIAL_MASK}:undefined}
      initial={{opacity:0}} animate={{opacity:[0,1,1,0],backdropFilter:isLow()?undefined:["blur(0px)","blur(14px)","blur(22px)","blur(0px)"]}}
      transition={{duration:DIVE_MS.clear/1000,times:[0,.3,.7,1],ease:"easeInOut"}}/>
    <canvas ref={cv} className="absolute inset-0 w-full h-full"/>
    <div ref={lab} style={{opacity:0}} className="absolute inset-x-0 top-1/2 mt-16 text-center font-mono text-[10px] text-neutral-300">
      <div>routing through {zone}</div><div className="text-neutral-400 mt-1">exact location never leaves the creator</div></div>
  </div>;
}
