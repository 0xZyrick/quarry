"use client";
import {useEffect, useState} from "react";
import type {Vault} from "@/lib/vault";

export default function LiveBeacon({handle, initial}: {handle: string; initial: Vault["live"]}) {
  const [live, setLive] = useState(initial);
  useEffect(() => {
    const f = async () => {
      try {
        const r = await fetch(`/api/vault/${encodeURIComponent(handle)}`, {cache: "no-store"});
        if (r.ok) setLive((await r.json()).live);
      } catch {}
    };
    const t = setInterval(f, 6000);
    return () => clearInterval(t);
  }, [handle]);
  if (!live)
    return (
      <div
        role="status"
        className="w-full rounded-xl border border-line bg-[#12141a] px-4 py-3 font-mono text-[11px] text-neutral-500"
      >
        Not broadcasting
      </div>
    );
  const where = live.kind === "war" ? "Project" : "Commons";
  return (
    <a
      href={`/?node=${live.nodeId}&room=${live.kind}`}
      aria-label={`Live now in ${where}, room ${live.roomNumber}. Open workbench.`}
      className="group flex w-full items-center gap-3 rounded-xl border border-live bg-live px-4 py-3 font-mono text-[12px] font-semibold text-black
        transition-transform hover:scale-[1.01] active:scale-[0.99]
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-live"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inset-0 rounded-full bg-black/40 animate-ping" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-black" />
      </span>
      <span className="truncate">
        Live in {where} · Room #{live.roomNumber}: {live.label}
      </span>
      <span className="ml-auto shrink-0 rounded-md bg-black/15 px-2 py-0.5 text-[10px] uppercase tracking-wide">
        Enter
      </span>
    </a>
  );
}
