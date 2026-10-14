// Per-room control state shared by the control bar and the room screens. Resets when you change room.
import {create} from "zustand";
type S={locked:boolean;draw:boolean;chatOpen:boolean;sheet:null|"stream"|"crew"|"dispute";crew:string[];
  set:(p:Partial<S>)=>void;reset:()=>void};
const init={locked:false,draw:true,chatOpen:false,sheet:null,crew:[]};
export const useRoomCtl=create<S>(set=>({...init,set:p=>set(p),reset:()=>set(init)}));
