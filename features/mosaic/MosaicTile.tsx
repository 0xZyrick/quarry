"use client";
import {useRef, useState} from "react";
import {Tile, TAG} from "@/lib/mosaic";
import {RoomCounts} from "../shared/Counts";
import {imgForSkills, loopForTile} from "@/lib/skillMedia";
import LoopVideo from "../shared/LoopVideo";

const TAGSTYLE = {
  live: "border-live/70 text-live",
  war: "border-risk text-risk",
  commons: "border-community/70 text-community",
} as const;

/**
 * Active–Passive tile.
 * - Poster still always present (calm grid).
 * - Exactly one tile in the mosaic has `playing` — that one runs a muted loop.
 * - Hover/focus also requests play (parent switches the single active id).
 */
export default function MosaicTile({
  tile,
  playing,
  onOpen,
  onHoverPlay,
  onHoverEnd,
}: {
  tile: Tile;
  playing: boolean;
  onOpen: (t: Tile, r: DOMRect) => void;
  onHoverPlay: (id: string) => void;
  onHoverEnd: (id: string) => void;
}) {
  const el = useRef<HTMLButtonElement>(null);
  const [imgOk, setImgOk] = useState(true);
  const poster = imgForSkills(tile.skills);
  const loop = loopForTile(tile.id);
  const local = tile.skills.join(", ");

  return (
    <button
      ref={el}
      data-node={tile.nodeId}
      onClick={() => onOpen(tile, el.current!.getBoundingClientRect())}
      onPointerEnter={() => onHoverPlay(tile.id)}
      onPointerLeave={() => onHoverEnd(tile.id)}
      onFocus={() => onHoverPlay(tile.id)}
      onBlur={() => onHoverEnd(tile.id)}
      style={{aspectRatio: tile.ar}}
      aria-label={`${TAG[tile.kind]}: @${tile.name} in ${tile.city}. ${local}. Enter room`}
      className={`btn group relative block w-full overflow-hidden rounded-xl border border-line bg-deep text-left
        transition-[filter,border-color] duration-200
        hover:border-white/25 focus-visible:border-community
        ${playing ? "brightness-100 border-white/20" : "brightness-[.62]"}`}
    >
      {/* Poster still */}
      {imgOk ? (
        <img
          src={poster}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setImgOk(false)}
          className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 ${
            playing ? "scale-[1.02]" : "group-hover:scale-[1.03]"
          }`}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1b1f2a] to-[#0D0E11]" />
      )}

      {/* Single active loop — only mounts/plays when this tile is the one playing */}
      {playing && (
        <LoopVideo
          src={loop}
          active={playing}
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Passive mask — off while playing */}
      <div
        aria-hidden
        className={`absolute inset-0 pointer-events-none bg-black/45 transition-opacity duration-200 ${
          playing ? "opacity-0" : "opacity-100 group-hover:opacity-0"
        }`}
      />

      <div aria-hidden className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/85 via-transparent to-black/30" />

      {/* Live pulse when this tile is the one playing */}
      {playing && (
        <span className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border border-live/50 bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-live backdrop-blur-sm">
          <i className="h-1.5 w-1.5 rounded-full bg-live animate-pulse" />
          PLAYING
        </span>
      )}

      <span
        className={`absolute left-2 top-2 max-w-[calc(100%-4rem)] truncate rounded-md border bg-black/55 px-1.5 py-0.5 font-mono text-[10px] backdrop-blur-sm ${TAGSTYLE[tile.kind]}`}
      >
        <i className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle bg-current" />
        {TAG[tile.kind]} | @{tile.name}
      </span>

      <div className="absolute inset-x-0 bottom-0 border-t border-white/5 bg-black/55 px-2 py-1.5 backdrop-blur-md">
        <div className="flex flex-wrap gap-1">
          {tile.skills.map((s) => (
            <span key={s} className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-200">
              {s}
            </span>
          ))}
        </div>
        <RoomCounts id={tile.nodeId} className="mt-0.5 block text-[9px] text-neutral-400" />
      </div>
    </button>
  );
}
