// Deep links: ?room=<nodeId>&view=stream|commons|war. Only a node id is ever put in the URL, never a location.
import {NODES} from "./map";
export type View="stream"|"commons"|"war";
const VIEWS:View[]=["stream","commons","war"];
export const readLink=():{roomId:string;view:View}|null=>{
  const q=new URLSearchParams(location.search),id=q.get("room"),v=q.get("view") as View;
  if(!id||!(NODES.some(n=>n.id===id)||/^own:[A-Za-z0-9_-]{1,20}$/.test(id)))return null;
  return{roomId:id,view:VIEWS.includes(v)?v:"stream"}};
export const writeLink=(l:{roomId:string;view:View}|null)=>{
  const u=new URL(location.href);
  if(l){u.searchParams.set("room",l.roomId);u.searchParams.set("view",l.view)}
  else{u.searchParams.delete("room");u.searchParams.delete("view")}
  history.replaceState(null,"",u)};
