"use client";
import {useStats, fmt} from "@/lib/stats";

/** Compact online/visits — no outer chrome (parent provides the glass shell). */
export function GlobalCounts({className = ""}: {className?: string}) {
  const g = useStats((s) => s.global);
  return (
    <div
      role="group"
      aria-label={`${g.online} online now, ${g.visits} total visits`}
      className={`font-mono text-[10px] text-neutral-300 flex items-center gap-1.5 tabular-nums whitespace-nowrap ${className}`}
    >
      <span className="flex items-center gap-1">
        <i className="w-1.5 h-1.5 rounded-full bg-live text-live pulse shrink-0" />
        {fmt(g.online)}
        <span className="text-neutral-500 hidden xs:inline sm:inline">online</span>
      </span>
      <span className="text-neutral-500">·</span>
      <span className="text-neutral-400">{fmt(g.visits)} visits</span>
    </div>
  );
}

export function RoomCounts({id, className = "", mode = "full"}: {id: string; className?: string; mode?: "full" | "people"}) {
  const r = useStats((s) => s.rooms[id]);
  if (!r) return null;
  if (mode === "people") {
    return (
      <span className={`font-mono tabular-nums ${className}`} aria-label={`${r.online} people in room`}>
        {fmt(r.online)} in room
      </span>
    );
  }
  return (
    <span className={`font-mono tabular-nums ${className}`} aria-label={`${r.online} online, ${r.visits} visits`}>
      <span className="text-live">●</span> {fmt(r.online)} online · {fmt(r.visits)} visits
    </span>
  );
}
