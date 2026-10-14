"use client";
import {useGuild} from "@/lib/store";
import {useStats} from "@/lib/stats";
import {MapNode,zoneOf} from "@/lib/map";
import {RoomCounts} from "../shared/Counts";
import {shapeOf,heldFor,laserOf,money,crowdWord} from "@/lib/nodeShape";
// Hover or focus a node on the map and this card appears beside it. It is pure CSS visibility (see .peek in globals.css),
// so 14 of them cost nothing while hidden. Touch has no hover; there the selected-creator card at the bottom does the job.
export default function NodePeek({n}:{n:MapNode}){
  const kind=shapeOf(n),roomId=useGuild(s=>s.roomId),ms=useGuild(s=>s.milestones),online=useStats(s=>s.rooms[n.id]?.online??0);
  const held=kind==="monolith"?heldFor(n.id,roomId,ms):0;
  return <div aria-hidden className="peek glass rounded-lg p-2 font-mono text-[10px] leading-snug">
    <div className="flex items-center justify-between gap-2"><b className="text-white">@{n.name}</b>
      <span style={{color:"var(--c)"}}>{kind==="crystal"?"COMMONS":"PROJECT"}</span></div>
    <div className="text-neutral-400">{zoneOf(n).name}</div>
    <RoomCounts id={n.id} className="text-neutral-300 block"/>
    {kind==="monolith"
      ?<div className="mt-1" style={{color:"var(--c)"}}>{money(held)} in escrow · laser {Math.round(laserOf(held)*100)}%</div>
      :<div className="mt-1" style={{color:"var(--c)"}}>{crowdWord(online)} · crystal grows with cursor activity</div>}
    <div className="mt-1 text-neutral-500">double-tap to enter</div></div>;
}
