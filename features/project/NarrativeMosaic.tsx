"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProjectWorkspace from "./ProjectWorkspace";

type MosaicItem = {
  id: string; title: string; intent: string; status: string;
  creator: { id: string; handle: string | null; levelTrack: string };
  latestNode: { dayLabel: string; phaseTitle: string; summary: string; evolutionDelta: string | null;
    mediaUrl: string | null; decisionMetric: string | null; tag: string | null; } | null;
  nodeCount: number; updatedAt: string;
};

const FRESH_MS = 90_000;

function isFresh(updatedAt: string) {
  return Date.now() - new Date(updatedAt).getTime() < FRESH_MS;
}

export default function NarrativeMosaic({ playing }: { playing: boolean }) {
  const [items, setItems] = useState<MosaicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cols, setCols] = useState(2);
  const box = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let dead = false;
    const load = () =>
      fetch("/api/projects?status=IN_PROGRESS")
        .then((r) => r.json())
        .then((d) => { if (!dead && d.projects) setItems(d.projects); })
        .catch(() => {})
        .finally(() => !dead && setLoading(false));
    load();
    const iv = setInterval(load, 30_000);
    return () => { dead = true; clearInterval(iv); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const f = () => { const w = el.clientWidth; setCols(w < 560 ? 2 : w < 900 ? 3 : w < 1300 ? 4 : 5); };
    f();
    const ro = new ResizeObserver(f);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns = useMemo(() => {
    const c: MosaicItem[][] = Array.from({ length: cols }, () => []);
    const h = Array(cols).fill(0);
    for (const it of items) {
      let k = 0;
      for (let i = 1; i < cols; i++) if (h[i] < h[k]) k = i;
      c[k].push(it);
      h[k] += 1.15;
    }
    return c;
  }, [items, cols]);

  if (openId) return <ProjectWorkspace projectId={openId} onClose={() => setOpenId(null)} />;

  return (
    <div ref={box} className="absolute inset-0 overflow-y-auto px-3 py-4">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-white">Story Mosaic</h2>
        <p className="text-[11px] text-neutral-500 font-mono mt-0.5">Intent · Decisions · Progress · Participation</p>
      </div>
      {loading && items.length === 0 && (
        <p className="text-center text-neutral-500 font-mono text-sm py-20">Loading narratives…</p>
      )}
      {!loading && items.length === 0 && (
        <div className="text-center py-20 space-y-2">
          <p className="text-neutral-400 font-mono text-sm">No active projects yet.</p>
          <p className="text-neutral-600 text-xs max-w-xs mx-auto">
            Creators start with a clear Intent. Raw streams without narrative are not surfaced here.
          </p>
        </div>
      )}
      <div className="flex gap-3 items-start">
        {columns.map((col, ci) => (
          <div key={ci} className="flex-1 space-y-3 min-w-0">
            {col.map((item) => (
              <NarrativeCard key={item.id} item={item} fresh={isFresh(item.updatedAt)} playing={playing} onOpen={() => setOpenId(item.id)} tick={tick} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function NarrativeCard({ item, fresh, playing, onOpen, tick }: { item: MosaicItem; fresh: boolean; playing: boolean; onOpen: () => void; tick: number }) {
  void tick;
  const node = item.latestNode;
  const hook = node ? `${node.dayLabel} · ${node.phaseTitle}` : "Awaiting first phase";
  const obstacleOrExperiment = node?.summary ?? item.intent;
  return (
    <motion.button type="button" layout onClick={onOpen}
      className={`relative w-full text-left rounded-xl border overflow-hidden transition-colors ${fresh ? "border-live/50 bg-live/5" : "border-white/8 bg-card/50 hover:border-white/20"}`}>
      <AnimatePresence>
        {fresh && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-live/90 text-[9px] font-mono font-bold text-black tracking-wide">
            ✨ NEW TIMELINE UPDATE
          </motion.div>
        )}
      </AnimatePresence>
      <div className="aspect-[4/3] relative bg-black/50">
        {node?.mediaUrl ? (
          <video src={node.mediaUrl} muted playsInline loop autoPlay={playing} className="absolute inset-0 w-full h-full object-cover opacity-80" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1e28] to-[#0a0b0e]" />
        )}
        <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
          <p className="font-mono text-[9px] uppercase tracking-wider text-live/90">{hook}</p>
          <p className="text-[12px] font-medium text-white leading-snug line-clamp-2 mt-0.5">{obstacleOrExperiment}</p>
        </div>
        {node?.tag && (
          <span className="absolute top-2 right-2 text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/70 text-amber-300">{node.tag}</span>
        )}
      </div>
      <div className="p-2.5 space-y-1">
        <p className="text-[11px] font-semibold text-white truncate">{item.title}</p>
        <p className="text-[10px] text-neutral-500 line-clamp-2"><span className="text-neutral-400">Intent · </span>{item.intent}</p>
        <div className="flex items-center justify-between text-[10px] font-mono text-neutral-600">
          <span>@{item.creator.handle ?? "anon"}</span>
          <span>{item.nodeCount} phase{item.nodeCount === 1 ? "" : "s"}</span>
        </div>
      </div>
    </motion.button>
  );
}
