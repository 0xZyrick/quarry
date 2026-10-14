// A fixed pool of <video> elements that get re-parented and re-sourced instead of mounted and unmounted.
// iOS Safari caps simultaneous decoders and leaks them when elements churn, so the feed never creates more than `n`.
export type Pool={n:number;assign:(slot:number,host:HTMLElement,src:string,hue:number)=>HTMLVideoElement;all:()=>HTMLVideoElement[]};
export function createPool(n=3):Pool{
  const els=Array.from({length:n},()=>{const v=document.createElement("video");
    v.muted=true;v.loop=true;v.playsInline=true;v.preload="auto";v.setAttribute("playsinline","");
    v.className="absolute inset-0 w-full h-full object-cover";v.onerror=()=>{v.style.display="none"};return v});
  return{n,all:()=>els,assign(slot,host,src,hue){
    const v=els[((slot%n)+n)%n];
    if(v.parentElement!==host)host.prepend(v);
    if(v.dataset.src!==src){v.dataset.src=src;v.style.display="";v.src=src}
    v.style.filter=`hue-rotate(${hue}deg)`;return v}}}
