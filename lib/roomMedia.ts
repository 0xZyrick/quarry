// Room video state. Real cameras come from LiveKit when NEXT_PUBLIC_LIVEKIT_URL is set.
import {create} from "zustand";
import {useCapture,Path} from "./capture";
type M={live:boolean;streams:Record<string,any>;camOn:boolean;micOn:boolean;error:string;setCam:(on:boolean)=>Promise<void>;setMic:(on:boolean)=>Promise<void>;setPath:(p:Path|null)=>Promise<boolean>};
let ctl:null|{setCam:(on:boolean)=>Promise<void>;setMic?:(on:boolean)=>Promise<void>;publish?:(s:MediaStream,p:Path)=>Promise<void>;unpublish?:()=>Promise<void>}=null;
export const useRoomMedia=create<M>(()=>({live:false,streams:{},camOn:false,micOn:false,error:"",
  setMic:async on=>{try{await ctl?.setMic?.(on);useRoomMedia.setState({micOn:on,error:""})}catch{useRoomMedia.setState({error:"mic blocked"})}}, // no LiveKit: state only
  // Start (or stop with null) a desk input. Reuses a stream the Launch Portal already authorised for the same path.
  setPath:async p=>{const c=useCapture.getState();
    if(!p){await ctl?.unpublish?.();c.stop();return true}
    if(!(c.path===p&&c.stream)&&!(await c.start(p))){useRoomMedia.setState({error:useCapture.getState().error});return false}
    try{await ctl?.publish?.(useCapture.getState().stream!,p);useRoomMedia.setState({error:""});return true}
    catch{useRoomMedia.setState({error:"couldn't publish"});return false}},
  setCam:async on=>{try{await ctl?.setCam(on);useRoomMedia.setState({error:""})}
    catch{useRoomMedia.setState({error:"camera blocked"})}}}));
export async function startMedia(roomId:string):Promise<()=>void>{
  if(!process.env.NEXT_PUBLIC_LIVEKIT_URL)return()=>{};
  try{const {connectLK}=await import("./livekit");
    const c=await connectLK(roomId,p=>useRoomMedia.setState(p));
    ctl=c;useRoomMedia.setState({live:true,streams:{},camOn:false,error:""});
    const cap=useCapture.getState();if(cap.stream&&cap.path)c.publish?.(cap.stream,cap.path).catch(()=>{}); // the input the Launch Portal authorised goes on air
    return()=>{ctl=null;c.stop();useRoomMedia.setState({live:false,streams:{},camOn:false})}}
  catch(e){console.warn("LiveKit unavailable, using mock tiles",e);return()=>{}}
}
