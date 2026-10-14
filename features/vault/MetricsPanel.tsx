import type {Metrics} from "@/lib/vault";
export default function MetricsPanel({m}:{m:Metrics}){
  const row="flex items-baseline justify-between gap-6";
  return <section aria-label="Operational metrics" className="glass rounded-xl p-4 font-mono text-xs space-y-2 min-w-[16rem]">
    <div className="text-[10px] text-neutral-500">OPERATIONAL METRICS</div>
    <div className={row}><span className="text-neutral-400">Escrow Throughput</span><b className="text-live text-sm">${m.throughputUsd.toLocaleString("en-US")}</b></div>
    <div className={row}><span className="text-neutral-400">Milestone Ticks</span><b className="text-sm">{m.ticksVerified} / {m.ticksTotal} Verified</b></div>
    <div className={row}><span className="text-neutral-400">Commons Tips</span><b className="text-community text-sm">{m.tips.toLocaleString("en-US")}</b></div></section>;
}
