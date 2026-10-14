"use client";
import {useGuild, useRoomSecurity} from "@/lib/store";
import {useState} from "react";
import ReportSheet from "../safety/ReportSheet";
import {NODES, COLOR, cardLine} from "@/lib/map";
import {BROADCAST_SRC} from "@/lib/media";
import {useHubs} from "@/lib/hubs";
import {RoomCounts} from "../shared/Counts";
import LoopVideo from "../shared/LoopVideo";
import Avatar from "../shared/Avatar";

/** Full-bleed host stream — same identity as Commons/Project host. */
export default function Workspace() {
  const {layer, room, roomId, setRoom, trans} = useGuild();
  const found = NODES.findIndex((n) => n.id === roomId),
    i = Math.max(0, found),
    n = NODES[i] ?? NODES[0],
    c = COLOR[n?.status ?? "live"];
  const meta = useHubs((s) => s.meta[roomId]);
  const sec = useRoomSecurity();
  const spectator = sec.kind !== "owner-creator" && sec.kind !== "co-creator";
  const [reporting, setReporting] = useState(false);
  const hostName = meta?.handle ?? n?.name ?? "host";
  const title = meta?.title ?? cardLine(n);
  const next = n?.status === "risk" ? "war" : "commons";

  return (
    <div className="relative h-full overflow-hidden bg-deep">
      <LoopVideo
        src={BROADCAST_SRC}
        active={layer === 2 && room === "stream" && trans?.from !== 2}
        audio={false}
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
        style={{filter: `hue-rotate(${i * 47 % 360}deg)`}}
      />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/85 via-transparent to-black/50" />
      <div className="absolute top-14 left-4 right-4 flex items-start justify-between gap-3 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar handle={hostName} size={36} className="ring-2 ring-live/40 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-mono text-xs text-live">
              <i className="w-2 h-2 rounded-full bg-live pulse shrink-0" />
              LIVE · @{hostName}
            </div>
            <div className="text-[11px] text-neutral-300 truncate">{title}</div>
            <div className="font-mono text-[10px] text-neutral-500">
              <RoomCounts id={roomId} mode="people" />
            </div>
          </div>
        </div>
        {spectator && (
          <button
            type="button"
            onClick={() => setReporting((r) => !r)}
            aria-label="Report this stream"
            onPointerDown={(e) => e.stopPropagation()}
            className="btn glass rounded-full px-3 py-1 text-[10px] font-mono text-neutral-300 hover:text-risk shrink-0"
          >
            Report
          </button>
        )}
      </div>
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
        <button
          type="button"
          onClick={() => setRoom(next as "war" | "commons")}
          className="btn glass rounded-full px-4 py-2 font-mono text-[11px] text-neutral-200 hover:text-white"
        >
          Open {next === "war" ? "Project" : "Commons"} →
        </button>
      </div>
      {reporting && <ReportSheet onClose={() => setReporting(false)} />}
    </div>
  );
}
