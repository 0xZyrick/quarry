// The two input paths that feed a creator's desk tile.
//   digital  = screen / window capture (VS Code, Figma, Blender, AutoCAD)
//   physical = a camera, usually pointed at the desk, canvas or wall (overhead / field cam)
// Capture must start from a click, so the Launch Portal authorises it BEFORE the room exists and parks the stream here;
// the room then publishes it as soon as it is connected. With no LiveKit the same stream is shown locally on your own tile.
import {create} from "zustand";
export type Path="digital"|"physical";
type C={path:Path|null;stream:MediaStream|null;error:string;start:(p:Path)=>Promise<boolean>;stop:()=>void};
export const useCapture=create<C>((set,get)=>({path:null,stream:null,error:"",
  start:async p=>{get().stop();
    try{const md=navigator.mediaDevices;if(!md)throw new Error("unsupported");
      const stream=p==="digital"?await md.getDisplayMedia({video:true,audio:false})
        :await md.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1920}},audio:false});
      stream.getVideoTracks()[0]?.addEventListener("ended",()=>{if(get().stream===stream)get().stop()}); // user hit "Stop sharing" in the browser
      set({path:p,stream,error:""});return true}
    catch(e){set({path:null,stream:null,error:(e as Error).name==="NotAllowedError"?"Permission was declined":"Couldn't start that input"});return false}},
  stop:()=>{get().stream?.getTracks().forEach(t=>t.stop());set({path:null,stream:null})}}));
