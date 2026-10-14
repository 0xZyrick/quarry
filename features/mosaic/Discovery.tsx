"use client";
/**
 * Discovery — Experience C continuous surface
 * Mosaic (Discover) · Network (Connect / Return) · Room Map (legacy)
 * One continuous experience, not three separate apps.
 */
import { useState } from "react";
import Feed from "../feed/Feed";
import Mosaic from "./Mosaic";
import NarrativeMosaic from "../project/NarrativeMosaic";
import NetworkLayer from "../project/NetworkLayer";
import CreateProjectSheet from "../project/CreateProjectSheet";

type View = "stories" | "network" | "rooms" | "reels";

export default function Discovery({ playing }: { playing: boolean }) {
  const [view, setView] = useState<View>("stories");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      {view === "stories" && (
        <>
          <NarrativeMosaic playing={playing} />
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 flex-wrap justify-center px-2">
            <button
              onClick={() => setView("network")}
              className="glass btn rounded-full px-3 py-1 font-mono text-[11px] text-live hover:text-white"
            >
              Following
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="glass btn rounded-full px-3 py-1 font-mono text-[11px] text-neutral-300 hover:text-white"
            >
              + Project
            </button>
            <button
              onClick={() => setView("rooms")}
              className="glass btn rounded-full px-3 py-1 font-mono text-[11px] text-neutral-400 hover:text-white"
            >
              Room Map
            </button>
          </div>
        </>
      )}

      {view === "network" && (
        <NetworkLayer onBack={() => setView("stories")} />
      )}

      {view === "rooms" && (
        <>
          <Mosaic playing={playing} onReels={() => setView("reels")} />
          <button
            onClick={() => setView("stories")}
            className="glass btn absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full px-3 py-1 font-mono text-[11px] text-live hover:text-white"
          >
            ← Story Mosaic
          </button>
        </>
      )}

      {view === "reels" && (
        <>
          <Feed playing={playing} />
          <button
            onClick={() => setView("stories")}
            className="glass btn absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full px-3 py-1 font-mono text-[11px] text-neutral-200 hover:text-white"
          >
            Story Mosaic
          </button>
        </>
      )}

      <CreateProjectSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          // stay on stories; mosaic will refresh on next poll
        }}
      />
    </>
  );
}
