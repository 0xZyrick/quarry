// Shared mock seeds, so the server registry and the offline client fallback agree on who starts live.
export const hash=(s:string)=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0)/4294967296};
export const seedLive=(id:string)=>hash(id+":live")>.2; // roughly 1 in 5 demo creators starts idle
