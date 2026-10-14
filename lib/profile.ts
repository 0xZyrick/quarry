// Account profile and automatic roles. Nobody picks a role; it is computed from the account.
// The Profile shape mirrors the database fields it will come from:
//   creator_node_id  -> creators.node_id (the room this account hosts, null if it is not a creator)
//   client_room_ids  -> rooms where this account is the paying party on an escrow contract
// Replace `profileAdapter.get()` with a call to your session endpoint (e.g. GET /api/me). Nothing else changes.
// IMPORTANT: this runs in the browser, so it only shapes the UI. The server (escrow adapter, Liveblocks auth, LiveKit token)
// must recompute the role from the session with `roleIn()` and enforce it itself.
import {NODES} from "./map";
import {Onboarding,isComplete,onboardingAdapter} from "./onboarding";
export type Role="client"|"creator"|"guest";
export type Profile={id:string;handle:string;creatorNodeId:string|null;clientRoomIds:string[];crewRoomIds:string[];gender?:"male"|"female"|null};
export type RoomRole={role:Role;host:boolean}; // host = this creator owns the room they are standing in

export const roleIn=(p:Profile|null,roomId:string):RoomRole=>{
  if(!p)return{role:"guest",host:false};
  if(p.clientRoomIds.includes(roomId))return{role:"client",host:false};   // paying party in THIS room
  if(p.creatorNodeId)return{role:"creator",host:p.creatorNodeId===roomId};
  return{role:"guest",host:false}};                                      // signed in, but no part in this room: balcony

// What each role may do. One table, so every screen asks the same question.
export const perms=(r:RoomRole)=>({
  release:r.role==="client",                // move escrow
  apply:r.role==="creator"&&!r.host,        // apply to a raid bench
  edit:r.role!=="guest",                    // draw and move tiles in Commons
  tip:true});                               // the gifting tray stays for everyone

export interface ProfileAdapter{get():Promise<Profile|null>}
const MOCK:Record<string,Profile>={
  creator:{id:"u-creator",handle:"kodo.dev",creatorNodeId:"n1",clientRoomIds:[],crewRoomIds:[]},
  mod:{id:"u-mod",handle:"mod",creatorNodeId:null,clientRoomIds:[],crewRoomIds:[]},
  co:{id:"u-co",handle:"mio.3d",creatorNodeId:"n3",clientRoomIds:[],crewRoomIds:["n0","n2"]},
  client:{id:"u-client",handle:"acme.studio",creatorNodeId:null,clientRoomIds:NODES.map(n=>n.id),crewRoomIds:[]}};
// Profile from the onboarding record. creatorNodeId is a placeholder room id until the server assigns the creator a real node;
// a client is mocked as paying party in every room, exactly like the dev mock above.
const fromOnboarding=(o:Onboarding):Profile=>({id:o.uid!,handle:o.name!,
  creatorNodeId:o.track==="creator"?"own:"+o.uid!.slice(-8):null,clientRoomIds:o.track==="client"?NODES.map(n=>n.id):[],crewRoomIds:[],gender:o.gender});
// In development, `?as=creator|client|guest` still picks a fake account and skips onboarding.
// Otherwise the account comes from the onboarding record; nobody is signed in until it is complete.
// The server issues the session cookie and returns the profile it computed from its registry (POST /api/session).
// If the API is unreachable (static demo) the same profile is computed locally, which only shapes the UI.
export class SessionLost extends Error{} // 401: the invite session is gone (cookie expired or cleared): onboarding must start again
const signIn=async(body:object):Promise<Profile|null>=>{
  const r=await fetch("/api/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(r.status===401)throw new SessionLost("invite session lost");
  if(!r.ok)throw new Error("session "+r.status);const j=await r.json();return j.profile??null};
export const profileAdapter:ProfileAdapter={async get(){
  const as=new URLSearchParams(location.search).get("as");
  if(as&&process.env.NODE_ENV!=="production"){try{return await signIn({dev:as})}catch{return MOCK[as]??null}}
  const o=onboardingAdapter.read();if(!isComplete(o))return null;
  try{return await signIn({uid:o.uid,track:o.track})}catch(e){if(e instanceof SessionLost)throw e;return fromOnboarding(o)}}};
