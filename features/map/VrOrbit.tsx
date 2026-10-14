"use client";
// VR Orbit: the map becomes a table-top model (about 1.6 m across) in front of you. Walk around it to orbit, point a controller at a
// node and pull the trigger to select it; pull the trigger on the selected node again to leave VR and descend into its room.
// Untested on a headset: written against the three.js WebXR API (renderer.xr), which react-three-fiber drives while a session is live.
import {RefObject,useEffect,useMemo,useRef} from "react";
import {useFrame,useThree} from "@react-three/fiber";
import * as THREE from "three";
import {useGuild} from "@/lib/store";
import {useStats,fmt} from "@/lib/stats";
import {NODES,COLOR,proj,zoneOf} from "@/lib/map";
import {useHubs,isVisible} from "@/lib/hubs";
import {shapeOf,heldFor,laserOf,money,crowdWord} from "@/lib/nodeShape";
import {useVr,probeVr} from "@/lib/vr";
import {dive} from "@/lib/zoom";

const SCALE=.04;                 // 1 map unit = 4 cm
const TABLE:[number,number,number]=[-1.5*SCALE,.85,-1.1+2.5*SCALE]; // map centre (1.5, 2.5) lands 85 cm up, 1.1 m in front of you

function card(lines:string[],color:string,w:number,big=40){
  const h=lines.length*(big+18)+26,c=document.createElement("canvas");c.width=w;c.height=h;const g=c.getContext("2d")!;
  g.fillStyle="rgba(13,14,17,.86)";g.fillRect(0,0,w,h);g.strokeStyle=color;g.lineWidth=5;g.strokeRect(3,3,w-6,h-6);
  lines.forEach((t,i)=>{g.fillStyle=i?"#b8bcc8":"#fff";g.font=`${i?"":"bold "}${i?big*.8:big}px sans-serif`;g.fillText(t,22,18+(i+1)*(big+12)-6)});
  const t=new THREE.CanvasTexture(c);return{t,aspect:w/h}}

// 3D stand-ins for the DOM pillars (DOM is invisible inside a headset).
export function VrNodes(){
  const sel=useGuild(s=>s.selected),roomId=useGuild(s=>s.roomId),ms=useGuild(s=>s.milestones),rooms=useStats(s=>s.rooms);
  const group=useRef<THREE.Group>(null),panel=useRef<THREE.Sprite>(null),lasers=useRef<(THREE.Mesh|null)[]>([]);
  const items=useMemo(()=>NODES.map(n=>({n,kind:shapeOf(n),pos:proj(n),color:COLOR[n.status],tag:card([`@${n.name}`,n.city],COLOR[n.status],420,44)})),[]);
  const oct=useMemo(()=>new THREE.OctahedronGeometry(1),[]),box=useMemo(()=>new THREE.BoxGeometry(.8,.8,2.4),[]);
  useEffect(()=>{const i=NODES.findIndex(n=>n.id===sel),p=panel.current;if(!p)return;
    if(i<0||!isVisible(NODES[i].id,useHubs.getState())){p.visible=false;return}
    const it=items[i],r=rooms[it.n.id],held=heldFor(it.n.id,roomId,ms);
    const c=card([`@${it.n.name} · ${it.kind==="crystal"?"Commons":"Project"}`,zoneOf(it.n).name,`${r?fmt(r.online):0} online · ${r?fmt(r.visits):0} visits`,
      it.kind==="monolith"?`${money(held)} in escrow`:crowdWord(r?.online??0),"trigger again: enter room"],it.color,860,40);
    (p.material.map as THREE.Texture|null)?.dispose();p.material.map=c.t;p.material.needsUpdate=true;
    p.scale.set(7.5,7.5/c.aspect,1);p.position.set(it.pos[0],it.pos[1],5.2);p.visible=true},[sel,rooms,ms,roomId,items]);
  useFrame(({clock})=>{const t=clock.elapsedTime;
    group.current?.children.forEach((g,i)=>{const it=items[i];if(!it)return;
      g.visible=isVisible(it.n.id,useHubs.getState()); // idle or flagged creators have no pin in VR either
      const on=it.n.id===sel;g.scale.setScalar(on?1.35:1);
      if(it.kind==="crystal"){const s=g.getObjectByName("spin");if(s)s.rotation.z=t*.6}
      else{const pw=laserOf(heldFor(it.n.id,roomId,ms)),L=lasers.current[i];
        if(L){const pulse=.5+.5*Math.sin(t*Math.PI*2/(2.6-1.8*pw));L.scale.set(1+pw,1,1+pw);
          (L.material as THREE.MeshBasicMaterial).opacity=.3+.7*pulse;L.scale.y=.4+.6*pulse}}})});
  return <group ref={group}>{items.map((it,i)=>
    <group key={it.n.id} position={[it.pos[0],it.pos[1],0]}>
      {it.kind==="crystal"
        ?<group name="spin" position={[0,0,1]}><mesh userData={{pick:it.n.id}} geometry={oct} scale={[.55,.55,1.1]}>
            <meshBasicMaterial color={it.color} transparent opacity={.85}/></mesh>
          <lineSegments scale={[.56,.56,1.12]}><edgesGeometry args={[oct]}/><lineBasicMaterial color="#ffffff"/></lineSegments></group>
        :<><mesh userData={{pick:it.n.id}} geometry={box} position={[0,0,1.2]}><meshBasicMaterial color={it.color}/></mesh>
          <mesh ref={m=>{lasers.current[i]=m}} position={[0,0,3.4]} rotation={[Math.PI/2,0,0]}>
            <cylinderGeometry args={[.07,.07,2.2,8]}/><meshBasicMaterial color="#ffffff" transparent opacity={.7}/></mesh></>}
      <sprite position={[0,0,3.3]} scale={[3.2,3.2/it.tag.aspect,1]}>
        <spriteMaterial map={it.tag.t} depthTest={false} transparent/></sprite>
    </group>)}
    <sprite ref={panel} visible={false}><spriteMaterial depthTest={false} transparent/></sprite></group>;
}

// Lives inside the Canvas. Registers enter/exit, moves the world onto the "table" while a session is live, wires controller rays.
export function XrBridge({world}:{world:RefObject<THREE.Group>}){
  const {gl,scene}=useThree(),active=useVr(s=>s.active);
  useEffect(()=>{
    gl.xr.setReferenceSpaceType("local-floor");gl.xr.enabled=true;
    const pending={i:-1};
    const onStart=()=>useVr.setState({active:true,error:""});
    const onEnd=()=>{useVr.setState({active:false});const i=pending.i;pending.i=-1;if(i>=0)setTimeout(()=>dive(i),350)};
    gl.xr.addEventListener("sessionstart",onStart);gl.xr.addEventListener("sessionend",onEnd);
    useVr.setState({
      enter:async()=>{const xr=(navigator as any).xr;if(!xr)return;
        try{const s=await xr.requestSession("immersive-vr",{optionalFeatures:["local-floor","bounded-floor"]});await gl.xr.setSession(s)}
        catch(e:any){useVr.setState({error:String(e?.message??e)})}},
      exit:()=>{gl.xr.getSession()?.end()}});
    const ray=new THREE.Raycaster(),rot=new THREE.Matrix4(),undo:(()=>void)[]=[];
    for(let k=0;k<2;k++){
      const c=gl.xr.getController(k);scene.add(c);
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-4)]),new THREE.LineBasicMaterial({color:"#00A3FF"}));c.add(line);
      const fire=()=>{
        rot.identity().extractRotation(c.matrixWorld);ray.ray.origin.setFromMatrixPosition(c.matrixWorld);ray.ray.direction.set(0,0,-1).applyMatrix4(rot);
        const picks:THREE.Object3D[]=[];world.current?.traverse(o=>{if(o.userData.pick)picks.push(o)});
        const id=ray.intersectObjects(picks,false)[0]?.object.userData.pick as string|undefined;if(!id)return;
        const g=useGuild.getState();
        if(g.selected===id){pending.i=NODES.findIndex(n=>n.id===id);gl.xr.getSession()?.end()} // second pull: leave VR, then dive
        else g.select(id)};
      c.addEventListener("selectstart",fire);
      undo.push(()=>{c.removeEventListener("selectstart",fire);c.remove(line);scene.remove(c)})}
    return()=>{gl.xr.removeEventListener("sessionstart",onStart);gl.xr.removeEventListener("sessionend",onEnd);undo.forEach(f=>f());useVr.setState({enter:null,exit:null})};
  },[gl,scene]);
  useEffect(()=>{const w=world.current;if(!w)return;
    if(active){w.scale.setScalar(SCALE);w.rotation.set(-Math.PI/2,0,0);w.position.set(...TABLE)} // ground (x,y) -> table (x,-z), map up -> world up
    else{w.scale.setScalar(1);w.rotation.set(0,0,0);w.position.set(0,0,0)}},[active,world]);
  return null;
}

export function EnterVrButton(){
  const {supported,active,error,enter,exit}=useVr();
  useEffect(()=>{probeVr()},[]);
  const ok=supported&&!!enter;
  return <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1" onPointerDown={e=>e.stopPropagation()}>
    <button onClick={()=>active?exit?.():enter?.()} disabled={!ok&&!active} aria-label={active?"Exit VR":"Enter VR Orbit"}
      title={ok||active?"Open the map as a table-top model in your headset":"VR needs a WebXR headset browser on https"}
      className="glass btn rounded-full px-3 py-1 font-mono text-[10px] text-community enabled:hover:bg-community enabled:hover:text-black disabled:opacity-40">
      {active?"Exit VR":"Enter VR Orbit"}</button>
    {error&&<span role="status" className="font-mono text-[9px] text-risk max-w-[220px] text-center">{error}</span>}</div>;
}
