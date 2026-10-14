import {SOON} from "@/lib/flags";
// A control that is visible but not usable yet. Keeps the interface honest: you can see it exists, it says why it does nothing.
export default function SoonChip({children,className=""}:{children:React.ReactNode;className?:string}){
  return <span role="note" title={SOON} aria-label={`${children}. ${SOON}`} className={`glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-xs text-neutral-400 cursor-not-allowed select-none ${className}`}>
    {children}<span className="rounded-full border border-line px-1.5 text-[9px] uppercase tracking-wider text-neutral-500">soon</span></span>;
}
