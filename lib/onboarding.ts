// Onboarding metadata: who the account is (invite-issued id + display name), which track they chose, their skill / need tags and their node.
// This is the single record the state router reads. Anything empty means onboarding is not finished.
// Replace `onboardingAdapter` with your profile endpoint (GET/PUT /api/me/onboarding); nothing else changes.
// Privacy: only a zone id is kept, never coordinates (see lib/map.ts).
import {ZONES} from "./map";
export type Gender="male"|"female";
export type Track="creator"|"client";
export type Onboarding={uid:string|null;name:string|null;auth:"invite"|null;track:Track|null;gender:Gender|null;tags:string[];zone:string|null};
export const EMPTY:Onboarding={uid:null,name:null,auth:null,track:null,gender:null,tags:[],zone:null};
export const CREATOR_TAGS=["Coding","Interior Design","Mural Painting","3D Motion","Carpentry","Branding UI","Architecture"];
export const CLIENT_TAGS=["Building a Team","Hiring Local Crew","Emergency Beacon Search","Scouting Masterclasses"];
export const tagsFor=(t:Track)=>t==="creator"?CREATOR_TAGS:CLIENT_TAGS;
export const isComplete=(o:Onboarding)=>!!o.uid&&!!o.name&&!!o.track&&!!o.gender&&o.tags.length>0&&!!o.zone;
// Which of the four screens still needs filling (0 invite code + name, 1 track, 2 tags, 3 location), 4 = done.
export const nextStep=(o:Onboarding):0|1|2|3|4|5=>!o.uid||!o.name?0:!o.track?1:!o.gender?2:!o.tags.length?3:!o.zone?4:5;

const KEY="guild.onboarding.v2"; // v2: invite-code accounts. Earlier passkey / device records are ignored.
export const onboardingAdapter={
  read():Onboarding{
    try{const r=JSON.parse(localStorage.getItem(KEY)||"null");if(!r)return EMPTY;
      const track:Track|null=r.track==="creator"||r.track==="client"?r.track:null;
      if(r.auth!=="invite"||typeof r.uid!=="string"||typeof r.name!=="string")return EMPTY;
      return{uid:r.uid,name:r.name,auth:"invite",track,
        gender:r.gender==="male"||r.gender==="female"?r.gender:null,
        tags:track&&Array.isArray(r.tags)?r.tags.filter((x:string)=>tagsFor(track).includes(x)):[],
        zone:ZONES.some(z=>z.id===r.zone)?r.zone:null}}
    catch{return EMPTY}},
  write(o:Onboarding){try{localStorage.setItem(KEY,JSON.stringify(o))}catch{}},
  clear(){try{localStorage.removeItem(KEY)}catch{}}};

// ---- Territory ----
// "Lekki Phase 1 Craft Zone" -> "Lekki Node". Only generalized neighbourhood names are ever shown.
export const nodeName=(zoneId:string|null)=>{const z=ZONES.find(x=>x.id===zoneId);
  return z?z.name.replace(/ Craft Zone$/,"").replace(/ Phase 1$/,"")+" Node":"Global"};
export const zoneCity=(zoneId:string|null)=>ZONES.find(z=>z.id===zoneId)?.city??null;
// City-level centres, used only to pick the nearest zone from a browser position. The position itself is discarded.
export const ZONE_GEO:Record<string,[number,number]>={
  lekki1:[6.44,3.47],ikeja:[6.6,3.35],yaba:[6.51,3.37],vi:[6.43,3.42],kreuzberg:[52.5,13.4],westlands:[-1.27,36.81],
  shoreditch:[51.52,-.08],bandra:[19.06,72.83],bk:[40.68,-73.94],pinheiros:[-23.56,-46.69],shibuya:[35.66,139.7],
  soma:[37.78,-122.4],surry:[-33.88,151.21]};
const rad=(d:number)=>d*Math.PI/180;
export function nearestZone(lat:number,lng:number){
  let best=ZONES[0].id,bd=1e9;
  for(const z of ZONES){const [a,b]=ZONE_GEO[z.id];
    const d=Math.acos(Math.min(1,Math.sin(rad(lat))*Math.sin(rad(a))+Math.cos(rad(lat))*Math.cos(rad(a))*Math.cos(rad(lng-b))));
    if(d<bd){bd=d;best=z.id}}
  return best}
// Browser position -> zone id. Rejects if blocked or unavailable; the caller falls back to a manual pick.
export const locateZone=()=>new Promise<string>((res,rej)=>{
  if(!navigator.geolocation)return rej(new Error("unsupported"));
  navigator.geolocation.getCurrentPosition(p=>res(nearestZone(p.coords.latitude,p.coords.longitude)),rej,
    {maximumAge:6e5,timeout:9000,enableHighAccuracy:false})});
