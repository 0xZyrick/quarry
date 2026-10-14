// WebXR state for "Enter VR Orbit". The map canvas registers enter/exit once it exists; the DOM button only talks to this store.
// WebXR needs https (or localhost) and a headset browser, so `supported` is false on most desktops.
import {create} from "zustand";
type V={supported:boolean;active:boolean;error:string;enter:null|(()=>Promise<void>);exit:null|(()=>void)};
export const useVr=create<V>(()=>({supported:false,active:false,error:"",enter:null,exit:null}));
export const probeVr=async()=>{const xr=(navigator as any).xr;if(!xr?.isSessionSupported)return;
  try{useVr.setState({supported:await xr.isSessionSupported("immersive-vr")})}catch{}};
