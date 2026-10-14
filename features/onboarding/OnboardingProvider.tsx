"use client";
import {AnimatePresence} from "framer-motion";
import {createContext,useCallback,useContext,useEffect,useMemo,useState} from "react";
import {EMPTY,Onboarding,isComplete,onboardingAdapter} from "@/lib/onboarding";
import {profileAdapter,SessionLost} from "@/lib/profile";
import {useGuild} from "@/lib/store";
import Onboarding_ from "./Onboarding";

type Api={data:Onboarding;ready:boolean;complete:boolean;active:boolean;update:(p:Partial<Onboarding>)=>void};
const Ctx=createContext<Api|null>(null);
export const useOnboarding=()=>{const c=useContext(Ctx);if(!c)throw new Error("OnboardingProvider missing");return c};

// State router. Parses the onboarding record as soon as the app mounts; if the invite, name, role, tags or location are missing the
// onboarding flow is laid over the app (which keeps rendering underneath). `?as=creator|client|guest` (dev) skips it,
// and `?onboarding=reset` wipes the record so the flow can be run again.
export function OnboardingProvider({children}:{children:React.ReactNode}){
  const [data,setData]=useState<Onboarding>(EMPTY),[ready,setReady]=useState(false),[bypass,setBypass]=useState(false);
  useEffect(()=>{const q=new URLSearchParams(location.search);
    if(q.get("onboarding")==="reset"){onboardingAdapter.clear();q.delete("onboarding");
      history.replaceState(null,"",location.pathname+(q.size?"?"+q:"")+location.hash)}
    setBypass(q.has("as")&&process.env.NODE_ENV!=="production");setData(onboardingAdapter.read());setReady(true)},[]);
  const update=useCallback((p:Partial<Onboarding>)=>setData(d=>{const n={...d,...p};onboardingAdapter.write(n);return n}),[]);
  const complete=isComplete(data),done=ready&&(bypass||complete);
  // the role written during onboarding reaches the permission layer (useRole) as soon as it changes
  useEffect(()=>{if(!ready||bypass)return;let live=true;
    profileAdapter.get().then(p=>{if(live)useGuild.setState({profile:p,profileReady:true})})
      .catch(e=>{if(live&&e instanceof SessionLost){onboardingAdapter.clear();setData(EMPTY)}}); // the server no longer knows this invite session: ask for the code again
    return()=>{live=false}},[ready,bypass,data]);
  useEffect(()=>{const on=ready&&!done;document.documentElement.toggleAttribute("data-onboarding",on)},[ready,done]);
  const api=useMemo(()=>({data,ready,complete,active:done,update}),[data,ready,complete,done,update]);
  return <Ctx.Provider value={api}>{children}
    <AnimatePresence>{ready&&!done&&<Onboarding_ key="onboarding"/>}</AnimatePresence></Ctx.Provider>;
}
