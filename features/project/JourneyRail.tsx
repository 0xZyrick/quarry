"use client";
import { motion } from "framer-motion";

type MediaDrop = { id: string; type: string; videoUrl: string; durationSecs: number; decisionMetric: string | null; tag: string | null };
type JourneyNode = { id: string; position: number; dayLabel: string; phaseTitle: string; summaryText: string; evolutionDelta: string | null; prevSnapshotUrl: string | null; nextSnapshotUrl: string | null; mediaDrops: MediaDrop[]; createdAt: string };

export default function JourneyRail({ nodes, selectedId, onSelect }: { nodes: JourneyNode[]; selectedId: string | null; onSelect: (id: string) => void }) {
  if (!nodes.length) return <div className="text-center py-16 text-neutral-500 font-mono text-sm">No journey nodes yet. The creator will drop the first phase soon.</div>;
  return (
    <ol className="relative space-y-6 pl-2">
      <div className="absolute left-[15px] top-3 bottom-3 w-px bg-white/10" aria-hidden />
      {nodes.map((node, i) => {
        const active = node.id === selectedId;
        const drop = node.mediaDrops[0];
        return (
          <motion.li key={node.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="relative">
            <div className={`absolute left-0 top-3 w-[11px] h-[11px] rounded-full border-2 ${active ? "bg-live border-live" : "bg-deep border-white/30"}`} />
            <button type="button" onClick={() => onSelect(node.id)}
              className={`ml-7 w-[calc(100%-1.75rem)] text-left rounded-xl border transition-colors p-3.5 ${active ? "border-live/40 bg-live/5" : "border-white/5 bg-card/40 hover:border-white/15 hover:bg-card/60"}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] tracking-wider text-neutral-500">{node.dayLabel}</span>
                <span className="font-semibold text-sm text-white uppercase tracking-wide">{node.phaseTitle}</span>
                {drop?.tag && <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-amber-300/90">{drop.tag}</span>}
              </div>
              <p className="mt-2 text-sm text-neutral-300 leading-relaxed">{node.summaryText}</p>
              {(node.prevSnapshotUrl || node.nextSnapshotUrl || node.evolutionDelta) && (
                <div className="mt-3 rounded-lg border border-white/5 overflow-hidden bg-black/30">
                  {node.evolutionDelta && <p className="px-3 py-1.5 text-[11px] font-mono text-live border-b border-white/5">Δ {node.evolutionDelta}</p>}
                  <div className="grid grid-cols-2 gap-px bg-white/5">
                    {node.prevSnapshotUrl && (
                      <div className="relative aspect-video bg-black/50">
                        <img src={node.prevSnapshotUrl} alt="Previous" className="absolute inset-0 w-full h-full object-cover opacity-80" />
                        <span className="absolute bottom-1 left-1 text-[9px] font-mono bg-black/60 px-1 rounded text-neutral-400">BEFORE</span>
                      </div>
                    )}
                    {node.nextSnapshotUrl && (
                      <div className="relative aspect-video bg-black/50">
                        <img src={node.nextSnapshotUrl} alt="After" className="absolute inset-0 w-full h-full object-cover" />
                        <span className="absolute bottom-1 left-1 text-[9px] font-mono bg-black/60 px-1 rounded text-live">AFTER</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {drop && (
                <div className="mt-3 rounded-lg overflow-hidden border border-white/5 bg-black/40">
                  <div className="aspect-video relative">
                    <video src={drop.videoUrl} className="absolute inset-0 w-full h-full object-cover" muted playsInline controls={active} preload="metadata" />
                    <span className="absolute top-1.5 right-1.5 text-[9px] font-mono bg-black/70 px-1.5 py-0.5 rounded text-neutral-300">
                      {drop.durationSecs}s · {drop.type === "PERMANENT_TEASE" ? "TEASE" : "VOD"}
                    </span>
                  </div>
                  {drop.decisionMetric && (
                    <p className="px-3 py-2 text-[11px] text-neutral-400 border-t border-white/5">
                      <span className="text-amber-300/80 font-mono mr-1">Decision</span>{drop.decisionMetric}
                    </p>
                  )}
                </div>
              )}
            </button>
          </motion.li>
        );
      })}
    </ol>
  );
}
