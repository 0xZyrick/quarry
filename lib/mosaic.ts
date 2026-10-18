// Tile data for the discovery mosaic. One tile per creator node. Status decides the kind of tile and the room it opens into:
//   live -> LIVE (workspace stream), risk -> WAR ROOM (project room, tall), community -> COMMONS (shared canvas, landscape).
// Replace `tiles()` with a call to your feed endpoint; the rest of the UI only reads the Tile shape.
import {NODES,MapNode,Status} from "./map";
import {PainterId} from "./painters";
export type Kind="live"|"war"|"commons";
export type Tile={id:string;nodeId:string;name:string;city:string;zone:string;kind:Kind;skills:string[];painter:PainterId;seed:number;ar:number;color:string};
export const KIND:Record<Status,Kind>={live:"live",risk:"war",community:"commons"};
export const ROOM:Record<Kind,"stream"|"war"|"commons">={live:"stream",war:"war",commons:"commons"};
export const TAG:Record<Kind,string>={live:"LIVE",war:"PROJECT",commons:"COMMONS"};
const COLOR:Record<Kind,string>={live:"#00FF66",war:"#FF6B00",commons:"#00A3FF"};
const META:Record<string,{skills:string[];painter:PainterId}>={
  n0:{skills:["Interior Design","Architecture"],painter:"cad"},n1:{skills:["Coding","3D Motion"],painter:"code"},
  n2:{skills:["Branding UI"],painter:"ui"},n3:{skills:["Mural Painting","Branding UI"],painter:"paint"},
  n4:{skills:["Coding"],painter:"code"},n5:{skills:["Mural Painting"],painter:"paint"},
  n6:{skills:["Coding","Architecture"],painter:"code"},n7:{skills:["3D Motion"],painter:"wire"},
  n8:{skills:["Coding"],painter:"code"},n9:{skills:["Carpentry","Architecture"],painter:"cad"},
  n10:{skills:["3D Motion"],painter:"wire"},n11:{skills:["Interior Design"],painter:"cad"},
  n12:{skills:["Carpentry","Mural Painting"],painter:"cad"},n13:{skills:["Branding UI"],painter:"ui"}};
// Tile proportions: Projects are tall, Commons are landscape, live streams sit between (width / height).
const AR:Record<Kind,[number,number]>={war:[.72,.8],commons:[1.5,1.7],live:[1,1.15]};
const unit=(s:string)=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0)/4294967296};
// Skills of rooms creators launched themselves (filled from the server snapshot by lib/hubs.ts)
export const dynSkills:Record<string,string[]>={};
const make=(n:MapNode,i:number):Tile=>{const k=KIND[n.status],m=META[n.id]??{skills:dynSkills[n.id]??[],painter:"code" as PainterId},[a,b]=AR[k];
  return{id:"t-"+n.id,nodeId:n.id,name:n.name,city:n.city,zone:n.zone,kind:k,skills:m.skills,painter:m.painter,seed:i+1,ar:a+(b-a)*unit(n.id),color:COLOR[k]}};
export const tiles=():Tile[]=>NODES.map(make);
// Neighbourhood first, then the rest of the city, then everyone else. `local` keeps only the user's city.
// `visible` drops rooms that are offline or flagged out; `tags` are the profile's skill weights and float matching tiles up (a filter chip still filters hard).
export function arrange(all:Tile[],o:{zone:string|null;skills:string[];local:boolean;city:string|null;visible?:(nodeId:string)=>boolean;tags?:string[]}){
  all=o.visible?all.filter(t=>o.visible!(t.nodeId)):all;
  const fit=(t:Tile)=>o.tags?.length?t.skills.filter(s=>o.tags!.includes(s)).length:0;
  const rank=(t:Tile)=>o.zone&&t.zone===o.zone?0:o.city&&t.city===o.city?1:2;
  return all.filter(t=>(!o.skills.length||t.skills.some(s=>o.skills.includes(s)))&&(!o.local||!o.city||t.city===o.city))
    .map((t,i)=>({t,i})).sort((a,b)=>rank(a.t)-rank(b.t)||fit(b.t)-fit(a.t)||a.i-b.i).map(x=>x.t)}
