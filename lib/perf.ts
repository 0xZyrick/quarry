// Perf tier: "low" on weak devices, reduced-motion users, or ?perf=low. Heavy effects read this once and scale down.
export type Tier="low"|"high";
let cached:Tier|null=null;
export const perfTier=():Tier=>{
  if(typeof window==="undefined")return "high"; // server render (Node 21+ defines navigator but not location)
  if(cached)return cached;
  const n=navigator as any,q=new URLSearchParams(location.search).get("perf");
  const weak=(n.hardwareConcurrency??8)<=4||(n.deviceMemory??8)<=4;
  const calm=matchMedia("(prefers-reduced-motion: reduce)").matches;
  return cached=q==="low"||q==="high"?q:(weak||calm)?"low":"high"};
export const reducedMotion=()=>typeof matchMedia!=="undefined"&&matchMedia("(prefers-reduced-motion: reduce)").matches;
export const isLow=()=>perfTier()==="low";
// Fewer simultaneous decodes on low-end devices.
export const tileVideoBudget=()=>isLow()?2:7;
