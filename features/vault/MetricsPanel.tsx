import type {Metrics} from "@/lib/vault";
export default function MetricsPanel({m}:{m:Metrics}){
  const row="flex items-baseline justify-between gap-6";
  return <section aria-label="Operational metrics" className="glass rounded-xl p-4 font-mono text-xs space-y-2 min-w-[16rem]">
    <div className="text-[10px] text-neutral-500">OPERATIONAL METRICS</div>
    <div className={row}><span className="text-neutral-400">Reviewed capsules</span><b className="text-live text-sm">{m.capsules}</b></div>
    <div className={row}><span className="text-neutral-400">Session hours</span><b className="text-sm">{m.sessionHours}</b></div>
    <div className={row}><span className="text-neutral-400">Peer reviews</span><b className="text-community text-sm">{m.peerReviews}</b></div></section>;
}
