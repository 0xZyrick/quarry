export type Status="live"|"risk"|"community";
export type Zone={id:string;name:string;city:string;x:number;y:number;r:number};
// Privacy: the client never receives a street address or real coordinates. A creator only carries a zone id.
// Zone centres are an abstract, artistic layout (not a projection of real geography).
export type MapNode={id:string;name:string;city:string;zone:string;status:Status};
export const COLOR:Record<Status,string>={live:"#00FF66",risk:"#FF6B00",community:"#00A3FF"};
export const ZONES:Zone[]=[
 {id:"lekki1",name:"Lekki Phase 1 Craft Zone",city:"Lagos",x:2.1,y:.5,r:.55},
 {id:"ikeja",name:"Ikeja Craft Zone",city:"Lagos",x:-.6,y:1.9,r:.55},
 {id:"yaba",name:"Yaba Craft Zone",city:"Lagos",x:.7,y:1.3,r:.55},
 {id:"vi",name:"Victoria Island Craft Zone",city:"Lagos",x:.6,y:-.1,r:.55},
 {id:"kreuzberg",name:"Kreuzberg Craft Zone",city:"Berlin",x:1.3,y:5.3,r:.5},
 {id:"westlands",name:"Westlands Craft Zone",city:"Nairobi",x:3.7,y:-.1,r:.5},
 {id:"shoreditch",name:"Shoreditch Craft Zone",city:"London",x:0,y:5.2,r:.5},
 {id:"bandra",name:"Bandra Craft Zone",city:"Mumbai",x:7.3,y:1.9,r:.5},
 {id:"bk",name:"Brooklyn Craft Zone",city:"New York",x:-7.4,y:4.1,r:.5},
 {id:"pinheiros",name:"Pinheiros Craft Zone",city:"Sao Paulo",x:-4.7,y:-2.3,r:.5},
 {id:"shibuya",name:"Shibuya Craft Zone",city:"Tokyo",x:14,y:3.6,r:.5},
 {id:"soma",name:"SoMa Craft Zone",city:"San Francisco",x:-12.2,y:3.8,r:.5},
 {id:"surry",name:"Surry Hills Craft Zone",city:"Sydney",x:15.1,y:-3.4,r:.5}];
// first three nodes are the feed creators (clip index -> node)
export const NODES:MapNode[]=[
 {id:"n0",name:"mira.design",city:"Lagos",zone:"lekki1",status:"live"},
 {id:"n1",name:"kodo.dev",city:"Berlin",zone:"kreuzberg",status:"risk"},
 {id:"n2",name:"ayo.ui",city:"Nairobi",zone:"westlands",status:"community"},
 {id:"n3",name:"lena",city:"London",zone:"shoreditch",status:"community"},
 {id:"n4",name:"ravi",city:"Mumbai",zone:"bandra",status:"live"},
 {id:"n5",name:"sade",city:"New York",zone:"bk",status:"risk"},
 {id:"n6",name:"tunde",city:"Sao Paulo",zone:"pinheiros",status:"live"},
 {id:"n7",name:"hana",city:"Tokyo",zone:"shibuya",status:"community"},
 {id:"n8",name:"leo",city:"San Francisco",zone:"soma",status:"live"},
 {id:"n9",name:"zoe",city:"Sydney",zone:"surry",status:"risk"},
 {id:"n10",name:"chidi.3d",city:"Lagos",zone:"lekki1",status:"community"},
 {id:"n11",name:"funmi",city:"Lagos",zone:"yaba",status:"live"},
 {id:"n12",name:"bayo.ink",city:"Lagos",zone:"ikeja",status:"risk"},
 {id:"n13",name:"amaka",city:"Lagos",zone:"vi",status:"community"}];
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
