"use client";
import Avatar from "../shared/Avatar";
import {useShellUi} from "@/lib/shellUi";
import {Canvas,useFrame} from "@react-three/fiber";
import * as THREE from "three";
import {RefObject,useEffect,useLayoutEffect,useMemo,useRef} from "react";
import {useGuild} from "@/lib/store";
import {NODES,ZONES,COLOR,cam,view,fx,basis,project,NODE_Z,proj,zoneOf,cardLine} from "@/lib/map";
import {RoomCounts} from "../shared/Counts";
import {isLow} from "@/lib/perf";
import {useStats} from "@/lib/stats";
import {useHubs,isVisible} from "@/lib/hubs";
import {shapeOf,heldFor,laserOf,laserPeriod,activityOf,growth} from "@/lib/nodeShape";
import NodePeek from "./NodePeek";
import {env,altOf,altText,stageOf,ss,zoomBy,flyTo,dive,orbitBy,resetView,STAGES} from "@/lib/zoom";
import {XrBridge,VrNodes,EnterVrButton} from "./VrOrbit";
import {useVr} from "@/lib/vr";

// DOM bits the rig updates every frame (no React renders while the camera moves)
type Hud={haze:RefObject<HTMLDivElement>;read:RefObject<HTMLSpanElement>;stage:RefObject<HTMLSpanElement>;
  mark:RefObject<HTMLDivElement>;north:RefObject<HTMLDivElement>;labels:RefObject<(HTMLDivElement|null)[]>;zones:RefObject<(HTMLDivElement|null)[]>};

// Grid density follows altitude: coarse lines read from orbit, 1-unit lines fade in over the city, a fine desk grid appears last.
function Lines({step,color,base,fade}:{step:number;color:string;base:number;fade:(a:number)=>number}){
  const geo=useMemo(()=>{const p:number[]=[];
    for(let i=-20;i<=20;i+=step)p.push(i,-20,0,i,20,0,-20,i,0,20,i,0);
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(p,3));return g},[step]);
  const m=useRef<THREE.LineBasicMaterial>(null);
  useFrame(()=>{m.current!.opacity=base*fade(env.a)});
  return <lineSegments geometry={geo}><lineBasicMaterial ref={m} color={color} transparent opacity={base}/></lineSegments>;
}
function Rig({hud}:{hud:Hud}){ // eases the real camera toward the target, publishes altitude, and projects every DOM marker with the same maths
  const last=useRef(""),flip=useRef(new Map<number,string>());
  useFrame(({camera,size,gl},dt)=>{const o=camera as THREE.PerspectiveCamera;
    if(gl.xr.isPresenting){env.a=.35;fx.cx=1.5;fx.cy=2.5;fx.rad=40;return} // in a headset the user's head is the camera
    view.z+=(cam.z-view.z)*.15;view.x+=(cam.x-view.x)*.2;view.y+=(cam.y-view.y)*.2;
    view.yaw+=(cam.yaw-view.yaw)*.18;view.pitch+=(cam.pitch-view.pitch)*.18;
    const b=basis(size.height);
    o.position.set(b.P[0],b.P[1],b.P[2]);o.up.set(b.up[0],b.up[1],b.up[2]);o.lookAt(view.x,view.y,0);
    o.near=Math.max(.02,b.d*.02);o.far=b.d*40+400;o.updateProjectionMatrix();
    fx.cx=view.x;fx.cy=view.y;fx.rad=b.d*3.2;
    const a=altOf(view.z);env.a=a;
    if(hud.haze.current)hud.haze.current.style.opacity=String((1-a)*.6);
    if(hud.mark.current)hud.mark.current.style.top=`${a*100}%`;
    if(hud.north.current)hud.north.current.style.transform=`rotate(${view.yaw}rad)`; // the N rotates with the world
    const key=altText(a)+stageOf(a);
    if(key!==last.current){last.current=key;
      if(hud.read.current)hud.read.current.textContent=altText(a);
      if(hud.stage.current)hud.stage.current.textContent=stageOf(a)}
    const lab=ss(.45,.7,a),zl=ss(.3,.6,a),ph=10+40*ss(.1,.9,a),W=size.width,H=size.height;
    const g=useGuild.getState(),rooms=useStats.getState().rooms,d=Math.min(.1,dt),hs=useHubs.getState();
    const put=(el:HTMLElement,k:string,v:string)=>{if(el.style.getPropertyValue(k)!==v)el.style.setProperty(k,v)};
    NODES.forEach((n,i)=>{const el=hud.labels.current![i];if(!el)return;if(!isVisible(n.id,hs)){el.style.display="none";return} // idle or flagged creators have no pin
      const [x,y]=proj(n);
      const p=project(x,y,NODE_Z,W,H),k=Math.min(1.6,Math.max(.55,p.k)); // nearer nodes draw bigger, far ones smaller
      el.style.display=p.vis?"":"none";if(!p.vis)return;
      el.style.setProperty("--h",ph+"px");el.style.setProperty("--lab",String(lab));
      if(shapeOf(n)==="crystal"){const a2=activityOf(n.id,rooms[n.id]?.online??0,d);put(el,"--g",String(growth(a2)));put(el,"--act",a2.toFixed(2))}
      else{const pw=laserOf(heldFor(n.id,g.roomId,g.milestones));put(el,"--pw",pw.toFixed(2));put(el,"--ld",laserPeriod(pw)+"s")}
      const fl=p.x>W-230?"1":"0";if(el.dataset.flip!==fl)el.dataset.flip=fl; // peek card flips left near the right edge
      el.style.transform=`translate(${p.x}px,${p.y}px) scale(${k})`});
    ZONES.forEach((z,i)=>{const el=hud.zones.current![i];if(!el)return;
      const p=project(z.x,z.y,0,W,H);el.style.display=p.vis?"":"none";if(!p.vis)return;
      el.style.opacity=String(zl);
      el.style.transform=`translate(${p.x}px,${p.y-z.r*view.z*p.k*Math.cos(view.pitch*.6)-8}px) translate(-50%,-100%)`})});
  return null;
}
function Terrain(){
  const m=useRef<THREE.ShaderMaterial>(null);
  useFrame(({clock})=>{const u=m.current!.uniforms;u.t.value=clock.elapsedTime;u.alt.value=env.a;u.ctr.value.set(fx.cx,fx.cy);u.rad.value=fx.rad});
  return <mesh position={[0,0,-1]}><planeGeometry args={[1600,1600]}/>
    <shaderMaterial ref={m} transparent depthWrite={false} uniforms={{t:{value:0},alt:{value:env.a},ctr:{value:new THREE.Vector2()},rad:{value:60}}}
      vertexShader={`varying vec2 v;void main(){v=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
      fragmentShader={`varying vec2 v;uniform float t;uniform float alt;uniform vec2 ctr;uniform float rad;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
void main(){float a=n(v*.35+t*.02)*.6+n(v*.9-t*.03)*.3+n(v*2.)*.1+n(v*7.)*alt*.18;
vec3 c=mix(vec3(.04,.07,.1),vec3(.02,.2,.25),smoothstep(.35,.8,a));
c=mix(c*vec3(.7,.95,1.5),c*vec3(1.,1.1,.95),alt);
float k=abs(fract(a*9.)-.5)*2.;float tp=1.-smoothstep(0.,.08,k);c+=vec3(0.,.5,.65)*tp*(.2+.2*alt);gl_FragColor=vec4(c,.9*(1.-smoothstep(rad*.45,rad,length(v-ctr))));}`}/></mesh>;
}
const enter=dive; // entering a room is a descent: camera drops onto the node first
let lastTap={i:-1,t:0};
const tap=(i:number)=>{const now=Date.now();
  if(lastTap.i===i&&now-lastTap.t<350)enter(i); // double-tap
  else useGuild.getState().select(NODES[i].id);
  lastTap={i,t:now}};

// A craft zone: an abstract ring of rotating dashes, contour rings and ticks. It marks a neighbourhood-sized area,
// never a building, and its centre is not a real coordinate.
function ZoneRing({z,geo}:{z:typeof ZONES[number];geo:{dash:THREE.BufferGeometry;circ:THREE.BufferGeometry;tick:THREE.BufferGeometry}}){
  const g=useRef<THREE.Group>(null),inner=useRef<THREE.Group>(null),outer=useRef<THREE.Group>(null);
  const bm=useMemo(()=>new THREE.LineBasicMaterial({color:"#00A3FF",transparent:true,opacity:.5,depthWrite:false}),[]);
  const fm=useMemo(()=>new THREE.MeshBasicMaterial({color:"#00A3FF",transparent:true,opacity:.04,depthWrite:false,blending:THREE.AdditiveBlending}),[]);
  useFrame(({clock})=>{const t=clock.elapsedTime;
    g.current!.rotation.z=t*.07;inner.current!.rotation.z=-t*.11;
    const st=useGuild.getState(),sel=NODES.find(n=>n.id===st.selected),on=sel?.zone===z.id;
    const L=st.landed,hit=L&&NODES.find(n=>n.id===L.id)?.zone===z.id,f=hit?Math.max(0,1-(Date.now()-L!.k)/800):0; // token landed here: the zone flashes and swells
    bm.color.set(on?COLOR[sel!.status]:"#00A3FF");bm.opacity=Math.min(1,(on?.95:.45)+f*.5);fm.opacity=(on?.1:.04)+f*.25;fm.color.copy(bm.color);
    outer.current!.scale.setScalar(z.r*(1+.14*f*f))});
  return <group ref={outer} position={[z.x,z.y,.05]} scale={z.r}>
    <mesh material={fm}><circleGeometry args={[1,64]}/></mesh>
    <group ref={g}><lineSegments geometry={geo.dash} material={bm}/><lineSegments geometry={geo.tick} material={bm}/></group>
    <group ref={inner}><lineLoop geometry={geo.circ} material={bm} scale={.7}/><lineLoop geometry={geo.circ} material={bm} scale={.42}/></group>
  </group>;
}
function Zones(){
  const geo=useMemo(()=>{
    const mk=(p:number[])=>{const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(p,3));return g};
    const d:number[]=[],c:number[]=[],t:number[]=[];
    for(let i=0;i<36;i++){const a=i/36*Math.PI*2,b=a+.11;d.push(Math.cos(a),Math.sin(a),0,Math.cos(b),Math.sin(b),0)}
    for(let i=0;i<=96;i++){const a=i/96*Math.PI*2;c.push(Math.cos(a),Math.sin(a),0)}
    for(let i=0;i<48;i++){const a=i/48*Math.PI*2,l=i%4===0?.14:.06;t.push(Math.cos(a)*1.06,Math.sin(a)*1.06,0,Math.cos(a)*(1.06+l),Math.sin(a)*(1.06+l),0)}
    return{dash:mk(d),circ:mk(c),tick:mk(t)}},[]);
  return <>{ZONES.map(z=><ZoneRing key={z.id} z={z} geo={geo}/>)}</>;
}

function Nodes(){ // base discs: orbit-level dots and the tap targets under each pillar
  const core=useRef<THREE.InstancedMesh>(null),glow=useRef<THREE.InstancedMesh>(null);
  const selected=useGuild(s=>s.selected),live=useHubs(s=>s.live),sus=useHubs(s=>s.suspended),nv=useGuild(s=>s.nodesV);
  useLayoutEffect(()=>{const d=new THREE.Object3D();
    NODES.forEach((n,i)=>{const [x,y]=proj(n);const s=!isVisible(n.id,{live,suspended:sus})?0:n.id===selected?1.5:.8;const c=new THREE.Color(COLOR[n.status]);
      d.position.set(x,y,.1);d.scale.setScalar(s);d.updateMatrix();
      core.current!.setMatrixAt(i,d.matrix);core.current!.setColorAt(i,c);
      d.scale.setScalar(s*2.4);d.updateMatrix();glow.current!.setMatrixAt(i,d.matrix);glow.current!.setColorAt(i,c)});
    for(const m of [core.current!,glow.current!]){m.instanceMatrix.needsUpdate=true;m.instanceColor!.needsUpdate=true}},[selected,live,sus,nv]);
  return <>
    <instancedMesh key={"g"+NODES.length} ref={glow} args={[undefined,undefined,NODES.length]}>
      <circleGeometry args={[.3,64]}/><meshBasicMaterial transparent opacity={.18} blending={THREE.AdditiveBlending} depthWrite={false}/></instancedMesh>
    <instancedMesh key={"c"+NODES.length} ref={core} args={[undefined,undefined,NODES.length]}
      onClick={e=>{e.stopPropagation();tap(e.instanceId!)}}>
      <circleGeometry args={[.3,64]}/><meshBasicMaterial/></instancedMesh></>;
}

export default function GridMap({active}:{active:boolean}){
  const wrap=useRef<HTMLDivElement>(null),P=useRef(new Map<number,[number,number]>()),orb=useRef<{id:number;x:number;y:number}|null>(null),world=useRef<THREE.Group>(null);
  const selected=useGuild(s=>s.selected),select=useGuild(s=>s.select),landed=useGuild(s=>s.landed);useGuild(s=>s.nodesV); // re-render when a creator launches a room
  const edge=(x:number)=>x<28||x>innerWidth-28; // edges stay free for the layer swipe
  const hud:Hud={haze:useRef(null),read:useRef(null),stage:useRef(null),mark:useRef(null),north:useRef(null),labels:useRef([]),zones:useRef([])};
  useEffect(()=>{if(!active)return;const k=(e:KeyboardEvent)=>{
    if(/^(INPUT|TEXTAREA)$/.test((e.target as HTMLElement)?.tagName))return;
    if(e.key==="+"||e.key==="=")zoomBy(1.25);if(e.key==="-")zoomBy(.8);
    if(e.key==="q"||e.key==="Q")orbitBy(-Math.PI/12,0);if(e.key==="e"||e.key==="E")orbitBy(Math.PI/12,0); // orbit
    if(e.key==="["||e.key==="PageDown")orbitBy(0,-.1);if(e.key==="]"||e.key==="PageUp")orbitBy(0,.1);     // pitch
    if(e.key==="0")resetView()};
    addEventListener("keydown",k);return()=>removeEventListener("keydown",k)},[active]);
  const node=NODES.findIndex(n=>n.id===selected&&isVisible(n.id,useHubs.getState())),vr=useVr(s=>s.active);
  return <div ref={wrap} role="region" aria-label="Grid map. Use plus and minus to zoom, Tab to reach creators." className="relative h-full touch-none overflow-hidden"
    onContextMenu={e=>e.preventDefault()}
    onPointerDown={e=>{if(edge(e.clientX))return;e.stopPropagation(); // map owns this gesture; the shell only gets edge swipes
      if(e.button===2||e.shiftKey||e.ctrlKey){orb.current={id:e.pointerId,x:e.clientX,y:e.clientY};return} // right-drag / shift-drag = orbit
      P.current.set(e.pointerId,[e.clientX,e.clientY])}}
    onPointerMove={e=>{const ob=orb.current;
      if(ob&&ob.id===e.pointerId){orbitBy(-(e.clientX-ob.x)*.006,-(e.clientY-ob.y)*.005);ob.x=e.clientX;ob.y=e.clientY;return}
      const p=P.current.get(e.pointerId);if(!p)return;
      if(P.current.size===1){ // pan along the ground, turned by yaw; vertical drags stretch with tilt
        const dx=e.clientX-p[0],dy=e.clientY-p[1],sy=Math.sin(cam.yaw),cy=Math.cos(cam.yaw),s=cam.z,v=s*Math.max(.35,Math.cos(cam.pitch));
        cam.x=Math.max(-20,Math.min(20,cam.x-dx*cy/s+dy*sy/v));cam.y=Math.max(-20,Math.min(20,cam.y+dx*sy/s+dy*cy/v))}
      else if(P.current.size===2){const o=[...P.current.entries()].find(([k])=>k!==e.pointerId)![1];
        zoomBy(Math.hypot(e.clientX-o[0],e.clientY-o[1])/Math.hypot(p[0]-o[0],p[1]-o[1]));
        let da=Math.atan2(e.clientY-o[1],e.clientX-o[0])-Math.atan2(p[1]-o[1],p[0]-o[0]); // two-finger twist = yaw, two-finger drag up = tilt
        if(da>Math.PI)da-=Math.PI*2;if(da<-Math.PI)da+=Math.PI*2;
        orbitBy(-da,-(e.clientY-p[1])*.0025)}
      P.current.set(e.pointerId,[e.clientX,e.clientY])}}
    onPointerUp={e=>{P.current.delete(e.pointerId);if(orb.current?.id===e.pointerId)orb.current=null}}
    onPointerCancel={e=>{P.current.delete(e.pointerId);if(orb.current?.id===e.pointerId)orb.current=null}}
    onWheel={e=>zoomBy(Math.exp(-e.deltaY*.0015))}>
    <Canvas dpr={isLow()?1:[1,2]} camera={{fov:50,near:.5,far:2000,up:[0,1,0],position:[cam.x,cam.y-30,50]}} frameloop={active?"always":"never"}
      gl={{alpha:true}} onPointerMissed={()=>select(null)} className="absolute inset-0">
      <color attach="background" args={["#0D0E11"]}/>
      <Rig hud={hud}/><XrBridge world={world}/>
      <group ref={world}>
        <Terrain/>
        <Lines step={.25} color="#00A3FF" base={.3} fade={a=>ss(.72,.95,a)}/>
        <Lines step={1} color="#242936" base={.7} fade={a=>.15+.85*ss(.15,.55,a)}/>
        <Lines step={5} color="#00A3FF" base={.3} fade={a=>1.8-.8*ss(.2,.8,a)}/><Zones/><Nodes/>
        {vr&&<VrNodes/>}</group>
    </Canvas>
    <div ref={hud.haze} className="absolute inset-0 pointer-events-none" // atmosphere: thick from orbit, clears as you descend
      style={{background:"linear-gradient(to bottom,rgba(0,163,255,.22),transparent 55%),radial-gradient(ellipse at 50% 20%,rgba(120,200,255,.18),transparent 60%)"}}/>
    <div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(ellipse at center,transparent 50%,#0D0E11 100%)"}}/>
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {ZONES.map((z,i)=><div key={z.id} ref={el=>{hud.zones.current![i]=el}} style={{opacity:0}}
        className="absolute left-0 top-0 font-mono text-[10px] leading-tight whitespace-nowrap text-community/80">{z.name}</div>)}
      {NODES.map((n,i)=>{const kind=shapeOf(n);return(
      <div key={n.id} ref={el=>{hud.labels.current![i]=el}} style={{"--c":COLOR[n.status],"--h":"24px","--lab":0} as React.CSSProperties}
        className={`nodebox absolute left-0 top-0 ${n.id===selected?"pillar-sel":""}`}>
        <button aria-label={`Select @${n.name}, ${kind==="crystal"?"Commons":"Project"}`} onClick={()=>tap(i)} style={{animationDelay:`${-(i*.7)%3.2}s`}}
          className={`pillar ${kind} pointer-events-auto cursor-pointer outline-none focus-visible:ring-2 ring-community`}>
          {kind==="crystal"?<><i/><i className="facet"/></>:<><i/><b className="laser"/></>}</button>
        {landed?.id===n.id&&<i key={landed.k} aria-hidden className="ripple"/>}
        <div className="absolute left-3 -top-3 font-mono text-[10px] leading-tight whitespace-nowrap" style={{opacity:"var(--lab)"}}>
          <div style={{color:COLOR[n.status]}}>@{n.name}</div><div className="text-neutral-400">{n.city}</div></div>
        <NodePeek n={n}/></div>)})}</div>
    <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none font-mono text-[10px] text-neutral-400 flex gap-2">
      <span>ALT <span ref={hud.read} className="text-white"/></span><span ref={hud.stage} className="text-community"/></div>
    <EnterVrButton/>
    <div className="absolute left-3 top-[34%] z-20 glass rounded-xl p-1 flex flex-col items-center gap-1" onPointerDown={e=>e.stopPropagation()} role="group" aria-label="Orbit and tilt">
      <button onClick={resetView} aria-label="Reset view to north" title="Reset view (0)" className="btn w-8 h-8 rounded-full border border-line grid place-items-center">
        <div ref={hud.north} className="font-mono text-[10px] font-bold text-community leading-none">N</div></button>
      {([["⟲","Rotate left (Q)",()=>orbitBy(-Math.PI/12,0)],["⟳","Rotate right (E)",()=>orbitBy(Math.PI/12,0)],
         ["⤒","Tilt toward the horizon (])",()=>orbitBy(0,.1)],["⤓","Tilt toward top-down ([)",()=>orbitBy(0,-.1)]] as const).map(([g,t,f])=>
        <button key={t} onClick={f} aria-label={t} title={t} className="btn w-8 h-8 rounded-full text-sm text-neutral-300 hover:bg-community hover:text-black">{g}</button>)}</div>
    <div className="absolute right-3 top-[28%] bottom-[28%] w-16 z-20" onPointerDown={e=>e.stopPropagation()}>
      <div className="absolute right-1.5 top-0 bottom-0 w-px bg-line"/>
      <div ref={hud.mark} className="absolute right-[3px] -mt-[3px] w-[7px] h-[7px] rounded-full bg-community shadow-[0_0_8px_#00A3FF]"/>
      {STAGES.map(t=><button key={t.name} onClick={()=>flyTo(t.a)} style={{top:`${t.a*100}%`}}
        className="btn absolute right-4 -translate-y-1/2 font-mono text-[9px] text-neutral-400 hover:text-white">{t.name}</button>)}</div>
    <div className="absolute top-3 left-3 pointer-events-none font-mono text-[10px] text-neutral-400 space-y-1">
      <div className="text-community">GRID MAP</div>
      {([["live","◆","commons · live"],["community","◆","commons · community"],["risk","▮","project"]] as const).map(([s,g,t])=><div key={s} className="flex items-center gap-1.5">
        <span className="w-2 text-center leading-none" style={{color:COLOR[s]}}>{g}</span>{t}</div>)}</div>
    {node>=0&&<div role="status" className="absolute bottom-16 left-3 right-3 glass rounded-xl p-3 flex items-center gap-3 z-20">
      <button type="button" title="Open PoE Vault" onPointerDown={e=>e.stopPropagation()} onClick={()=>useShellUi.getState().openVault(NODES[node].name)}
        className="relative shrink-0 btn rounded-full p-0 focus-visible:ring-2 ring-community">
        <Avatar handle={NODES[node].name} size={40} />
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#0D0E11]" style={{background:COLOR[NODES[node].status]}}/>
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{cardLine(NODES[node])}</div>
        <div className="font-mono text-[10px] text-neutral-400 truncate">{zoneOf(NODES[node]).name}</div>
        <RoomCounts id={NODES[node].id} className="text-[10px] text-neutral-300"/>
      </div>
      <button onClick={()=>enter(node)} className="btn rounded-full bg-live text-black text-xs font-semibold px-4 py-2 hover:bg-white shrink-0">Enter</button>
    </div>}
  </div>;
}
