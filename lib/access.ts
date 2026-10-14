// Single source of truth for "who may do what, in which room". Pure: no React, no store, so the server can import it too.
// Kinds follow the spec matrix: Role + Ownership + Room type.
//   owner-creator  host of the room (in a War Room: the hired creator who owns the node)
//   co-creator     seated on the host's team (Commons desk)
//   client-owner   paying party on this room's escrow contract (War Room only; in a Commons they are a spectator)
//   guest          everyone else, including signed-in accounts with no part in this room
import {NODES,MapNode} from "./map";
import {shapeOf} from "./nodeShape";
import type {Profile} from "./profile";
export type RoomType="commons"|"war";
export type Kind="owner-creator"|"co-creator"|"client-owner"|"guest";
export type RoomInfo={id:string;ownerId:string;type:RoomType};
export type View="stream"|"commons"|"war";

export const nodeOf=(id:string):MapNode|undefined=>NODES.find(n=>n.id===id);
// Rooms that are not on the demo map (own:<uid>, created at onboarding) are plain Commons hosted by their owner.
export const roomInfo=(id:string):RoomInfo=>{const n=nodeOf(id);return{id,ownerId:id,type:n&&shapeOf(n)==="monolith"?"war":"commons"}};

export function kindIn(p:Profile|null,room:RoomInfo):Kind{
  if(!p)return"guest";
  if(p.creatorNodeId&&p.creatorNodeId===room.ownerId)return"owner-creator";
  if(room.type==="war"&&p.clientRoomIds.includes(room.id))return"client-owner";
  if(room.type==="commons"&&p.crewRoomIds?.includes(room.id))return"co-creator";
  return"guest"} // clients in a Commons, and creators visiting someone else's room, are spectators

export type Caps={
  stream:boolean;layout:boolean;addCrew:boolean;mute:boolean;lockTable:boolean;greenroom:boolean; // host
  voice:boolean;draw:boolean;moveTiles:boolean;leave:boolean;                                    // co-creator (+host)
  release:boolean;pushToTalk:boolean;dispute:boolean;                                            // client in a War Room
  tip:boolean;chat:boolean;requestMic:boolean;passMic:boolean;apply:boolean;                     // everyone / spectators
  streamProof:boolean};                                                                          // hired creator streams proof of work
const NONE:Caps={stream:false,layout:false,addCrew:false,mute:false,lockTable:false,greenroom:false,voice:false,draw:false,moveTiles:false,leave:false,
  release:false,pushToTalk:false,dispute:false,tip:false,chat:true,requestMic:false,passMic:false,apply:false,streamProof:false};
export const capsOf=(k:Kind,t:RoomType,visitingCreator=false):Caps=>{
  const war=t==="war";
  switch(k){
    case"owner-creator":return{...NONE,stream:true,layout:true,addCrew:!war,mute:true,lockTable:true,greenroom:war,voice:true,draw:!war,moveTiles:!war,passMic:true,streamProof:war};
    case"co-creator":return{...NONE,voice:true,draw:true,moveTiles:true,leave:true};
    case"client-owner":return{...NONE,release:true,pushToTalk:true,dispute:true,passMic:true};
    default:return{...NONE,tip:!war,requestMic:true,apply:war&&visitingCreator}}}; // War Room guests: chat only, zero controls

// The bottom bar, exactly as the spec table lists it.
export type CtlId="stream"|"layout"|"crew"|"voice"|"draw"|"leave"|"release"|"ptt"|"dispute"|"tip"|"chat"|"mic"|"greenroom";
export const CONTROLS:Record<Kind,{id:CtlId;label:string;icon:string}[]>={
  "owner-creator":[{id:"stream",label:"Stream Controls",icon:"stream"},{id:"layout",label:"Canvas Layout",icon:"layout"},{id:"crew",label:"Add Crew",icon:"crew"}],
  "co-creator":[{id:"voice",label:"Voice Unmute",icon:"voice"},{id:"draw",label:"Canvas Draw",icon:"draw"},{id:"leave",label:"Leave Table",icon:"leave"}],
  "client-owner":[{id:"release",label:"Escrow Release",icon:"release"},{id:"ptt",label:"Push-To-Talk",icon:"voice"},{id:"dispute",label:"File Dispute",icon:"dispute"}],
  "guest":[{id:"tip",label:"Drag To Tip",icon:"tip"},{id:"chat",label:"Chat Panel",icon:"chat"},{id:"mic",label:"Request Mic",icon:"mic"}]};
// Context the table cannot express alone: a hired creator in a War Room has no Add Crew; guests in a War Room get no tip/mic controls.
export function controlsFor(k:Kind,t:RoomType):typeof CONTROLS[Kind]{
  let c=CONTROLS[k];
  if(k==="owner-creator"&&t==="war")c=[c[0],c[1],{id:"greenroom",label:"Greenroom",icon:"greenroom"}];
  if(k==="guest"&&t==="war")c=[c[1]];
  return c}

// Which room views a node offers. Crystal: Commons only. Monolith: War Room, plus Commons only while the owner's Greenroom is on.
export const viewsFor=(t:RoomType,greenroom:boolean):View[]=>t==="war"?(greenroom?["stream","war","commons"]:["stream","war"]):["stream","commons"];

// ---- Content gatekeeper ----
export const FLAG_LIMIT=3;
export const CANVAS_SOURCES=["Figma","VS Code","AutoCAD","Screen share"] as const;
export type Gate={canvas:string|null;skill:string|null};
// Active Canvas Requirement: camera alone never goes live. It needs a live canvas feed OR a declared hardware skill tag.
export const canGoLive=(g:Gate)=>!!g.canvas||!!g.skill;

// ---- Server-side mapping (use in /api routes once real sessions exist) ----
export const liveblocksAccess=(c:Caps)=>c.draw||c.moveTiles||c.layout?"FULL":"READ"; // spectators never write strokes or layout
export const livekitGrant=(c:Caps)=>({canPublish:c.stream||c.voice||c.pushToTalk||c.streamProof,canSubscribe:true,canPublishData:false});
