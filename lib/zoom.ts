// Altitude model: camera zoom IS height. Low zoom = orbit, high zoom = standing at a desk.
// `env.a` (0 = orbit .. 1 = desk) is written by the map rig every frame; the shader, grid, labels and HUD read it.
import {useGuild} from "./store";
import {useHubs,isVisible} from "./hubs";
import {shapeOf} from "./nodeShape";
import {NODES,COLOR,cam,proj,zoneOf,PITCH_MAX} from "./map";

export const MINZ=12,MAXZ=90,DIVEZ=240;
export const clampZ=(z:number)=>Math.min(MAXZ,Math.max(MINZ,z));
export const altOf=(z:number)=>Math.min(1,Math.max(0,Math.log(z/MINZ)/Math.log(MAXZ/MINZ)));
export const zOf=(a:number)=>MINZ*Math.pow(MAXZ/MINZ,a);
export const ss=(e0:number,e1:number,x:number)=>{const t=Math.min(1,Math.max(0,(x-e0)/(e1-e0)));return t*t*(3-2*t)};
export const env={a:altOf(cam.z)};

export const STAGES=[{name:"ORBIT",a:0},{name:"REGION",a:.34},{name:"CITY",a:.67},{name:"DESK",a:1}];
export const stageOf=(a:number)=>a<.2?"ORBIT":a<.5?"REGION":a<.85?"CITY":"DESK";
// cosmetic altitude: 4,000 km at orbit down to 120 m at the desk (log scale)
export const altText=(a:number)=>{const m=Math.exp(Math.log(4e6)+(Math.log(120)-Math.log(4e6))*a);
  return m>=1000?`${Math.round(m/1000).toLocaleString()} km`:`${Math.round(m)} m`};

export const orbitBy=(dyaw:number,dpitch:number)=>{cam.yaw+=dyaw;cam.pitch=Math.min(PITCH_MAX,Math.max(0,cam.pitch+dpitch))};
export const resetView=()=>{cam.yaw=Math.round(cam.yaw/(Math.PI*2))*Math.PI*2;cam.pitch=.5}; // snap to the nearest north, no spinning back through every turn
export const flyTo=(a:number)=>{cam.z=zOf(a)};

export const nearestNode=()=>{let i=-1,d=1e9;
  NODES.forEach((n,k)=>{if(!isVisible(n.id,useHubs.getState()))return;const [x,y]=proj(n);const e=Math.hypot(x-cam.x,y-cam.y);if(e<d){d=e;i=k}});return{i,d}};

// Pushing past the lowest altitude over a node = descend into its room.
let push=0;
export const zoomBy=(f:number)=>{
  if(useGuild.getState().dive)return;
  if(f>1&&cam.z>=MAXZ*.999){push+=Math.log(f);
    if(push>.22){const{i,d}=nearestNode();push=0;if(d<.7){dive(i);return}}}
  else push=0;
  cam.z=clampZ(cam.z*f)};

// Cinematic descent: the camera accelerates straight down over the creator's zone, the map warps into a tunnel,
// and the room opens as the creator's workspace stream. The real location is never shown: only the zone ring.
export const DIVE_STYLE:"radial"|"tunnel"="radial"; // radial = zoom with a radial blur; tunnel = the earlier warp tunnel with octagon frames and streaming code
export const DIVE_MS={swap:1000,clear:1850,reduced:420};
const reduced=()=>typeof matchMedia!=="undefined"&&matchMedia("(prefers-reduced-motion: reduce)").matches;
// A crystal (Commons) opens straight into its Workbench; a monolith (War Room) lands on the stream first.
export function dive(i:number,room:"stream"|"commons"=shapeOf(NODES[i])==="crystal"?"commons":"stream"){
  const g=useGuild.getState();if(g.dive||g.layer!==1||g.trans)return;
  const n=NODES[i],[x,y]=proj(n),rm=reduced();
  g.select(n.id);cam.x=x;cam.y=y;cam.pitch=0; // the descent ends looking straight down at the desk
  const z0=cam.z,t0=performance.now(),span=rm?0:900;
  const step=()=>{const p=span?Math.min(1,(performance.now()-t0)/span):1;
    cam.z=z0*Math.pow(DIVEZ/z0,p*p*p); // ease-in: it accelerates downward
    if(p<1)requestAnimationFrame(step)};step();
  g.setDive({k:Date.now(),color:COLOR[n.status],zone:zoneOf(n).name,name:n.name});
  setTimeout(()=>{const s=useGuild.getState();
    s.setRoomId(n.id);s.setRoom(room);
    useGuild.setState({instant:true});s.setLayer(2)},rm?DIVE_MS.reduced/2:DIVE_MS.swap);
  setTimeout(()=>useGuild.getState().setDive(null),rm?DIVE_MS.reduced:DIVE_MS.clear);
}
