export type Status="live"|"risk"|"community";
export type Zone={id:string;name:string;city:string;x:number;y:number;r:number};
// Privacy: the client never receives a street address or real coordinates. A creator only carries a zone id.
// Zone centres are an abstract, artistic layout (not a projection of real geography).
export type MapNode={id:string;name:string;city:string;zone:string;status:Status};
export const COLOR:Record<Status,string>={live:"#00FF66",risk:"#FF6B00",community:"#00A3FF"};
export const ZONES:Zone[]=[
 {id:"forge",name:"The Forge",city:"Lagos",x:-2.5,y:1.5,r:.75},
 {id:"atelier",name:"Atelier",city:"Berlin",x:0,y:2.2,r:.75},
 {id:"arcade",name:"Arcade",city:"Nairobi",x:2.5,y:1.5,r:.75},
 {id:"commons",name:"Commons",city:"London",x:0,y:0,r:.85},
 {id:"bay",name:"The Bay",city:"Mumbai",x:-2,y:-1.8,r:.7},
 {id:"shed",name:"The Shed",city:"New York",x:2,y:-1.8,r:.7}];
// first three nodes are the feed creators (clip index -> node)
export const NODES:MapNode[]=[
 {id:"n0",name:"mira.design",city:"Lagos",zone:"forge",status:"live"},
 {id:"n1",name:"kodo.dev",city:"Berlin",zone:"atelier",status:"risk"},
 {id:"n2",name:"ayo.ui",city:"Nairobi",zone:"arcade",status:"community"},
 {id:"n3",name:"lena",city:"London",zone:"bay",status:"community"},
 {id:"n4",name:"ravi",city:"Mumbai",zone:"shed",status:"live"},
 {id:"n5",name:"sade",city:"New York",zone:"commons",status:"risk"},
 {id:"n6",name:"tunde",city:"Sao Paulo",zone:"forge",status:"live"},
 {id:"n7",name:"hana",city:"Tokyo",zone:"atelier",status:"community"},
 {id:"n8",name:"leo",city:"San Francisco",zone:"arcade",status:"live"},
 {id:"n9",name:"zoe",city:"Sydney",zone:"bay",status:"risk"},
 {id:"n10",name:"chidi.3d",city:"Lagos",zone:"forge",status:"community"},
 {id:"n11",name:"funmi",city:"Lagos",zone:"commons",status:"live"},
 {id:"n12",name:"bayo.ink",city:"Lagos",zone:"shed",status:"risk"},
 {id:"n13",name:"amaka",city:"Lagos",zone:"atelier",status:"community"}];
export const zoneOf=(n:MapNode)=>ZONES.find(z=>z.id===n.zone)!;
// Seeded scatter inside the ring: angle and radius come from a hash of the node id, never from where anyone works.
const hash=(s:string)=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0)/4294967296};
const POS=new Map<string,[number,number]>();
const place=(n:MapNode)=>{const z=zoneOf(n),a=hash(n.id+":a")*Math.PI*2,d=Math.sqrt(.15+.55*hash(n.id+":d"))*z.r*.8;
  POS.set(n.id,[z.x+Math.cos(a)*d,z.y+Math.sin(a)*d])};
NODES.forEach(place);
// Rooms that creators launch themselves join the map at runtime. Returns true when something changed (new pin or new colour),
// so the caller can ask the map to rebuild. Only a zone id is ever stored: the position is a seeded scatter inside the ring.
export function upsertNode(id:string,name:string,zone:string,status:Status):boolean{
  const z=ZONES.find(x=>x.id===zone);if(!z)return false;
  const i=NODES.findIndex(n=>n.id===id);
  if(i<0){const n:MapNode={id,name,city:z.city,zone,status};NODES.push(n);place(n);return true}
  const n=NODES[i];if(n.status===status&&n.zone===zone&&n.name===name)return false;
  if(n.zone!==zone){n.zone=zone;n.city=z.city;place(n)}n.status=status;n.name=name;return true}
export const proj=(n:MapNode):[number,number]=>POS.get(n.id)!;
// ---- 3D orbit camera ----
// The ground is the XY plane (z up). `cam` is the TARGET the user steers; `view` is the smoothed camera the renderer actually uses
// (the rig eases view toward cam every frame). `z` keeps its old meaning: pixels per map unit at the point you look at, so altitude,
// zoom and the dive work as before. yaw = rotation around the vertical axis, pitch = tilt from straight down (0) toward the horizon.
export const PITCH_MAX=1.2; // ~69 degrees; never reaches the horizon
export const cam={x:1.5,y:2.5,z:26,yaw:0,pitch:.5};
export const view={...cam};
export const fx={cx:1.5,cy:2.5,rad:60}; // terrain fade centre and radius, written by the rig
export const FOV=50*Math.PI/180,TF=Math.tan(FOV/2),NODE_Z=.1;
export const camDist=(zoom:number,h:number)=>h/(2*zoom*TF); // distance from target so that zoom stays pixels-per-unit when looking straight down
export function basis(h:number,v=view){
  const d=camDist(v.z,h),sy=Math.sin(v.yaw),cy=Math.cos(v.yaw),sp=Math.sin(v.pitch),cp=Math.cos(v.pitch);
  return{d,P:[v.x-d*sy*sp,v.y-d*cy*sp,d*cp] as [number,number,number],up:[sy,cy,0] as [number,number,number],
    F:[sy*sp,cy*sp,-cp],R:[cy,-sy,0],U:[sy*cp,cy*cp,sp]}}
// World point -> screen pixels with the same maths the WebGL camera uses. k = d/depth (1 at the target, bigger when closer), vis = in front of camera.
export function project(wx:number,wy:number,wz:number,w:number,h:number){
  const b=basis(h),vx=wx-b.P[0],vy=wy-b.P[1],vz=wz-b.P[2];
  const cz=vx*b.F[0]+vy*b.F[1]+vz*b.F[2],cx=vx*b.R[0]+vy*b.R[1],cy=vx*b.U[0]+vy*b.U[1]+vz*b.U[2];
  const f=(h/2)/TF/Math.max(cz,1e-3);
  return{x:w/2+cx*f,y:h/2-cy*f,k:b.d/Math.max(cz,1e-3),vis:cz>.05}}
export const toScreen=(n:MapNode,w:number,h:number):[number,number]=>{
  const [x,y]=proj(n),p=project(x,y,NODE_Z,w,h);return [p.x,p.y]};
export const cardLine=(n:MapNode)=>`@${n.name} | ${n.city} • ${n.status==="risk"?"Project":"Commons"}`;
