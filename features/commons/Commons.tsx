"use client";
/**
 * Structured Crew Workbench — One Mission, One Captain
 *
 * Layout:
 *  - Project header (title + LIVE)
 *  - Master Viewport ~70%: host screen/camera + transparent annotation overlay
 *  - Sub-Crew Bench ~30%: max 4 mini tiles (hover-to-expand)
 *  - Tips → host ledger; sticky note can land on host or sub-tile
 *  - Dual-layer: media under transparent interaction canvas (cursors + neon pings)
 */
import {motion, AnimatePresence} from "framer-motion";
import {useEffect, useRef, useState, useCallback, useMemo} from "react";
import {useRT, Stroke, startRealtime, liveRef} from "@/lib/realtime";
import {useGuild, useRoomSecurity} from "@/lib/store";
import {useRoomCtl} from "@/lib/roomCtl";
import {PAYMENTS_ON, TOKENS_ON, SOON} from "@/lib/flags";
import ControlBar from "../room/ControlBar";
import ChatPanel from "../room/ChatPanel";
import {NODES} from "@/lib/map";
import {startMedia} from "@/lib/roomMedia";
import {isLow} from "@/lib/perf";
import {useHubs} from "@/lib/hubs";
import {poke} from "@/lib/nodeShape";
import {RoomCounts} from "../shared/Counts";
import TileVideo from "./TileVideo";

function NeonPing({x, y, color, label}: {x: number; y: number; color: string; label?: string}) {
  return (
    <motion.div
      className="absolute pointer-events-none z-30"
      style={{left: `${x * 100}%`, top: `${y * 100}%`, transform: "translate(-50%, -50%)"}}
      initial={{scale: 0.35, opacity: 1}}
      animate={{scale: 2.2, opacity: 0}}
      transition={{duration: 0.85, ease: "easeOut"}}
    >
      <div
        className="w-7 h-7 rounded-full border-2"
        style={{borderColor: color, boxShadow: `0 0 12px ${color}, 0 0 22px ${color}55`}}
      />
      {label && (
        <span
          className="absolute left-1/2 -translate-x-1/2 top-full mt-1 whitespace-nowrap text-[9px] font-mono px-1.5 py-0.5 rounded"
          style={{background: color, color: "#0D0E11"}}
        >
          {label}
        </span>
      )}
    </motion.div>
  );
}


/** Frosted tip sticker — pins to stream coords, then falls away. */
function TipSticker({
  x,
  y,
  text,
  amount,
  onDone,
}: {
  x: number;
  y: number;
  text: string;
  amount: number;
  onDone?: () => void;
}) {
  return (
    <motion.div
      className="absolute z-30 pointer-events-none max-w-[9rem]"
      style={{left: `${x * 100}%`, top: `${y * 100}%`}}
      initial={{opacity: 0, scale: 0.7, y: -8, rotate: -4}}
      animate={{opacity: 1, scale: 1, y: 0, rotate: [-3, 2, -1]}}
      exit={{
        opacity: 0,
        y: 48,
        rotate: 12,
        scale: 0.85,
        transition: {duration: 0.7, ease: [0.4, 0, 0.2, 1]},
      }}
      transition={{type: "spring", stiffness: 380, damping: 22}}
      onAnimationComplete={(def) => {
        if (def === "exit") onDone?.();
      }}
    >
      <div
        className="rounded-lg border border-white/15 px-2 py-1.5 shadow-lg"
        style={{
          background: "rgba(22,25,32,0.72)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          transform: "translate(-50%, -50%)",
        }}
      >
        <div className="font-mono text-[10px] text-live tabular-nums">${amount}</div>
        <div className="text-[11px] text-white/90 leading-snug line-clamp-3">{text}</div>
      </div>
    </motion.div>
  );
}

function Flash() {
  return (
    <>
      {Array.from({length: isLow() ? 4 : 10}).map((_, i, arr) => {
        const a = (i / arr.length) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full bg-live"
            initial={{x: 0, y: 0, opacity: 1, scale: 1}}
            animate={{x: Math.cos(a) * 30, y: Math.sin(a) * 30, opacity: 0, scale: 0.3}}
            transition={{duration: 0.5, ease: "easeOut"}}
          />
        );
      })}
    </>
  );
}

/** Sub-crew mini tile — fixed ratio, hover expands slightly, never covers master */
function BenchTile({
  id,
  name,
  color,
  self,
  empty,
  isHost,
  expanded,
  onHover,
  onLeave,
  onAllocate,
  tipBadge,
}: {
  id: string;
  name?: string;
  color?: string;
  self?: boolean;
  empty?: boolean;
  isHost?: boolean;
  expanded?: boolean;
  onHover?: () => void;
  onLeave?: () => void;
  onAllocate?: (id: string) => void;
  tipBadge?: string | null;
}) {
  if (empty) {
    return (
      <div className="relative rounded-xl border border-dashed border-line/50 bg-[#0D0E11]/50 aspect-[16/10] grid place-items-center">
        <span className="text-[10px] font-mono text-neutral-600">OPEN SEAT</span>
      </div>
    );
  }
  return (
    <div
      data-tile={id}
      onPointerEnter={onHover}
      onPointerLeave={onLeave}
      className={`relative rounded-xl border-2 bg-gradient-to-br from-[#1b1f2a] to-[#0D0E11] overflow-hidden shadow-lg aspect-[16/10] group transition-transform duration-200 ${
        expanded ? "scale-[1.06] z-20 border-community shadow-[0_0_24px_rgba(0,163,255,.25)]" : "border-line"
      }`}
    >
      <TileVideo i={0} id={id} self={!!self} />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-1.5 flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{background: color ?? "#00A3FF", boxShadow: `0 0 6px ${color ?? "#00A3FF"}`}}
        />
        <span className="text-[10px] font-mono text-white truncate">@{name ?? id}</span>
        {self && <span className="ml-auto text-[8px] font-mono text-live">YOU</span>}
      </div>
      {tipBadge && (
        <div className="absolute top-1 left-1 right-1 rounded-md border border-live/40 bg-black/70 px-1.5 py-0.5 text-[8px] font-mono text-live truncate">
          {tipBadge}
        </div>
      )}
      {isHost && !self && onAllocate && (
        <button
          type="button"
          onClick={() => onAllocate(id)}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 btn text-[9px] font-mono px-1.5 py-0.5 rounded border border-community text-community hover:bg-community hover:text-black"
        >
          SPLIT
        </button>
      )}
    </div>
  );
}

const TOKENS = [
  {a: 2, c: "border-community text-community"},
  {a: 5, c: "border-live text-live"},
  {a: 10, c: "border-risk text-risk"},
];

type Draft = {tile: string; x: number; y: number; amount: number};
type Ping = {id: string; x: number; y: number; color: string; label: string};

export default function Commons() {
  const roomId = useGuild((s) => s.roomId);
  const meta = useHubs((s) => s.meta[roomId]);
  const inRoom = useGuild((s) => s.layer === 2);
  const sec = useRoomSecurity();
  const {kind, caps, self: selfHandle} = sec;
  const isHost = kind === "owner-creator";
  const isCo = kind === "co-creator";
  const isGuest = kind === "guest";

  const people = useRT((s) => s.people);
  const cursors = useRT((s) => s.cursors);
  const strokes = useRT((s) => s.strokes);
  const notes = useRT((s) => s.notes);
  const tips = useRT((s) => s.tips);
  const presence = useRT((s) => s.presence);
  const addTip = useRT((s) => s.addTip);
  const removeTip = useRT((s) => s.removeTip);
  const myColor = useRT((s) => s.myColor);

  const own = roomId.startsWith("own:");
  const hubMeta = useHubs((s) => s.meta[roomId]);
  const simulated = own && !liveRef.cur;
  const hostName =
    hubMeta?.handle ?? meta?.title ?? NODES.find((n) => n.id === roomId)?.name ?? "host";
  const projectTitle =
    meta?.title ?? NODES.find((n) => n.id === roomId)?.name ?? "Commons Mission";

  // Sub-crew only lists invited co-creators. Guests never appear on someone else's bench.
  // Host sees seated peers from the realtime roster (excluding self/host). Guests see empty seats until invited (isCo).
  const roster = useMemo(() => {
    const hostSeat = {id: "host", name: hostName, color: "#00FF66", self: isHost};
    if (isGuest && !isCo) {
      // Spectator: no team membership → empty bench only
      return [hostSeat];
    }
    const peers = people
      .filter((p: {self?: boolean; id: string}) => !p.self && p.id !== "host")
      .slice(0, 4)
      .map((p: {id: string; name?: string; color?: string; self?: boolean}) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        self: !!p.self,
      }));
    // Co-creator may appear as self on the bench
    if (isCo && !isHost) {
      const me = people.find((p: {self?: boolean}) => p.self);
      if (me && !peers.some((x) => x.id === me.id)) {
        peers.unshift({id: me.id, name: me.name, color: me.color, self: true});
      }
    }
    return [hostSeat, ...peers];
  }, [hostName, isHost, isGuest, isCo, people]);

  const selfId = isHost
    ? "host"
    : people.find((p: {self?: boolean}) => p.self)?.id;

  const crewSeats: Array<{
    id: string;
    name?: string;
    color?: string;
    self?: boolean;
    empty?: boolean;
  }> = roster.filter((p: {id: string}) => p.id !== "host").slice(0, 4);
  while (crewSeats.length < 4) crewSeats.push({id: `empty${crewSeats.length}`, empty: true});
  const teamCount = crewSeats.filter((s) => !s.empty).length;

  const [msg, setMsg] = useState("");
  const say = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 1800);
  };

  const seen = useRef(new Set<string>());
  const joined = useRef(Date.now());
  useEffect(() => {
    seen.current.clear();
    joined.current = Date.now();
  }, [roomId, inRoom]);

  // Single-point ledger: tips credit HOST only
  useEffect(() => {
    for (const n of notes) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      if (PAYMENTS_ON && isHost && n.by !== selfId && Date.now() - joined.current > 1500) {
        useGuild.getState().credit(n.amount);
      }
    }
  }, [notes.length, isHost, selfId]);

  const masterRef = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const live = useRef<Stroke | null>(null);
  const [tick, setTick] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [armed, setArmed] = useState<number | null>(null);
  const [flash, setFlash] = useState<{k: number; tile: string; x: number; y: number} | null>(null);
  const [pings, setPings] = useState<Ping[]>([]);
  const chatOpen = useRoomCtl((s) => s.chatOpen);
  const [allocTarget, setAllocTarget] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string>("host"); // main viewport focus
  const [tileTipBadge, setTileTipBadge] = useState<Record<string, string>>({});

  useEffect(() => {
    if (armed === null) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setArmed(null);
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [armed]);

  useEffect(() => {
    if (!inRoom) return;
    let dead = false,
      stop = () => {},
      stopM = () => {};
    (async () => {
      const room = `guild-${roomId}`;
      const f = await startRealtime(room);
      if (dead) return f();
      stop = f;
      const g = await startMedia(room);
      if (dead) g();
      else stopM = g;
    })();
    return () => {
      dead = true;
      stop();
      stopM();
    };
  }, [roomId, inRoom]);

  useEffect(() => {
    if (inRoom) poke(roomId, 0.25);
  }, [cursors, strokes]);

  const dKey = cursors.map((c: {draft?: number[][]}) => c.draft?.at(-1)?.join("") ?? "").join("|");
  useEffect(() => {
    if (!cv.current) return;
    const remote = cursors
      .filter((c: {draft?: number[][]}) => c.draft?.length)
      .map((c: {id: string; color: string; draft: number[][]}) => ({
        id: "d" + c.id,
        color: c.color,
        pts: c.draft!,
      }));
    const draw = (c: HTMLCanvasElement, list: Stroke[]) => {
      const r = c.getBoundingClientRect();
      c.width = r.width;
      c.height = r.height;
      const g = c.getContext("2d")!;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.lineWidth = 2.5;
      for (const s of list) {
        g.strokeStyle = s.color;
        g.beginPath();
        s.pts.forEach(([x, y], i) =>
          i ? g.lineTo(x * r.width, y * r.height) : g.moveTo(x * r.width, y * r.height)
        );
        g.stroke();
      }
    };
    draw(cv.current, [...strokes, ...remote, ...(live.current ? [live.current] : [])]);
  }, [strokes, tick, dKey]);

  const norm = useCallback((e: React.PointerEvent): [number, number] => {
    const r = masterRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  }, []);

  const injectPing = useCallback(
    (x: number, y: number) => {
      if (!caps.draw && !isCo) return;
      const ping: Ping = {
        id: crypto.randomUUID(),
        x,
        y,
        color: myColor || "#00FF66",
        label: `@${selfHandle}`,
      };
      setPings((prev) => [...prev.slice(-8), ping]);
      setTimeout(() => setPings((prev) => prev.filter((p) => p.id !== ping.id)), 1100);
      presence(x, y);
      poke(roomId, 0.5);
    },
    [caps.draw, isCo, selfHandle, myColor, presence, roomId]
  );

  /** Hit-test: master or a sub-crew tile; money always posts to host ledger */
  const drop = (amount: number, px: number, py: number) => {
    // Prefer sub-tile if pointer is over one
    for (const el of document.querySelectorAll<HTMLElement>("[data-tile]")) {
      const r = el.getBoundingClientRect();
      if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) {
        const tile = el.dataset.tile!;
        const x = (px - r.left) / r.width;
        const y = (py - r.top) / r.height;
        setDraft({tile, x, y, amount});
        return;
      }
    }
    const r = masterRef.current?.getBoundingClientRect();
    if (!r) return;
    if (px < r.left || px > r.right || py < r.top || py > r.bottom) return;
    setDraft({
      tile: "host",
      x: (px - r.left) / r.width,
      y: (py - r.top) / r.height,
      amount,
    });
  };

  const commit = async (text: string) => {
    if (!draft) return;
    const d = draft;
    setDraft(null);
    if (PAYMENTS_ON && useGuild.getState().wallet < d.amount) return say("not enough funds");
    // Ledger always host; visual note can sit on sub-tile
    const note = {
      id: crypto.randomUUID(),
      tile: d.tile,
      x: d.x,
      y: d.y,
      text: text || "🔥",
      amount: d.amount,
      by: selfId ?? "guest",
    };
    addTip(note);
    // dwell on stream ~6.5s then dissolve / fall off
    setTimeout(() => removeTip(note.id), 6500);
    setFlash({k: Date.now(), tile: d.tile, x: d.x, y: d.y});
    setTimeout(() => setFlash(null), 500);
    if (d.tile !== "host") {
      const badge = `Tip split earned by @${d.tile}`;
      setTileTipBadge((m) => ({...m, [d.tile]: badge}));
      setTimeout(() => setTileTipBadge((m) => {
        const n = {...m};
        delete n[d.tile];
        return n;
      }), 3200);
    }
    if (
      !(await useGuild.getState().tip("host", d.amount, {
        id: note.id,
        x: note.x,
        y: note.y,
        text: note.text,
      }))
    ) {
      removeTip(note.id);
      say("tip failed · refunded");
    }
  };

  const handleAllocate = (crewId: string) => setAllocTarget(crewId);
  const confirmSplit = (amount: number) => {
    if (!allocTarget || !isHost) return;
    setAllocTarget(null);
    say(`Split $${amount} → @${allocTarget}`);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!caps.draw && !isCo) {
      if (armed) {
        const [x, y] = norm(e);
        setDraft({tile: "host", x, y, amount: armed});
        setArmed(null);
      }
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = norm(e);
    live.current = {id: crypto.randomUUID(), color: myColor || "#00FF66", pts: [[x, y]]};
    injectPing(x, y);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const [x, y] = norm(e);
    if (caps.draw || isCo) {
      presence(x, y);
      poke(roomId, 0.5);
    }
    if (live.current) {
      live.current.pts.push([x, y]);
      setTick((t) => t + 1);
    }
  };
  const onPointerUp = () => {
    if (live.current && live.current.pts.length > 1) {
      (useRT.getState() as {addStroke?: (s: Stroke) => void}).addStroke?.(live.current);
    }
    live.current = null;
  };

  return (
    <div className="h-full pt-14 pb-24 px-2 md:px-3 relative flex flex-col gap-1.5">
      {/* Project node header */}
      <div className="flex items-center gap-2 px-1 min-w-0 shrink-0">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inset-0 rounded-full bg-live animate-ping opacity-60" />
          <span className="relative h-2 w-2 rounded-full bg-live" />
        </span>
        <h2 className="font-mono text-[11px] sm:text-xs text-white truncate flex-1 min-w-0">
          {projectTitle}
        </h2>
        <span className="shrink-0 rounded-md border border-live/50 bg-live/10 px-1.5 py-0.5 font-mono text-[9px] text-live">
          LIVE
        </span>
        <span className="font-mono text-[10px] text-neutral-400 truncate shrink-0">
          {teamCount} team · <RoomCounts id={roomId} mode="people" />
          {isGuest && !isCo ? " · spectator" : isCo ? " · co-creator" : isHost ? " · captain" : ""}
        </span>
      </div>

      {/* Body: compact 2×2 bench + master with PiP when focus leaves host */}
      <div className="flex-1 min-h-0 flex gap-2">
        {/* SUB-CREW — vertical stack; empty until host invites (co-creator) */}
        <div className="w-[5.5rem] sm:w-[6.5rem] shrink-0 flex flex-col gap-1.5 min-h-0">
          <div className="text-[9px] font-mono text-community px-0.5">
            CREW · {teamCount}/4
          </div>
          <div className="flex flex-col gap-1.5 overflow-y-auto no-scrollbar content-start">
            {crewSeats.map((seat) => (
              <button
                key={seat.id}
                type="button"
                disabled={!!seat.empty}
                onClick={() => !seat.empty && setFocusId(seat.id)}
                onPointerEnter={() => !seat.empty && setExpanded(seat.id)}
                onPointerLeave={() => setExpanded((e) => (e === seat.id ? null : e))}
                className={`relative rounded-lg border overflow-hidden aspect-video w-full btn text-left transition-all shrink-0 ${
                  seat.empty
                    ? "border-dashed border-line/40 bg-[#0D0E11]/40 cursor-default"
                    : focusId === seat.id
                    ? "border-live ring-1 ring-live/40"
                    : expanded === seat.id
                    ? "border-community scale-[1.03] z-10"
                    : "border-line hover:border-neutral-500"
                }`}
              >
                {seat.empty ? (
                  <span className="absolute inset-0 grid place-items-center text-[8px] font-mono text-neutral-600">—</span>
                ) : (
                  <>
                    <div className="absolute inset-0" data-tile={seat.id}>
                      <TileVideo i={0} id={seat.id} self={!!seat.self} />
                    </div>
                    <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-[8px] font-mono text-white truncate">
                      @{seat.name ?? seat.id}
                    </span>
                    {tileTipBadge[seat.id] && (
                      <span className="absolute top-0.5 left-0.5 right-0.5 text-[7px] font-mono text-live truncate bg-black/60 rounded px-0.5">
                        tip
                      </span>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>
          {isHost && (
            <button
              type="button"
              onClick={() => useRoomCtl.getState().set({sheet: "crew"})}
              className="btn text-[9px] font-mono py-1 rounded-full border border-community text-community"
            >
              + Invite
            </button>
          )}
          {isGuest && caps.requestMic && (
            <button
              type="button"
              onClick={() => say("Apply sent to captain")}
              className="btn text-[9px] font-mono py-1 rounded-full border border-community text-community"
            >
              Apply to Join
            </button>
          )}
        </div>

        {/* PRIMARY VIEWPORT */}
        <div
          ref={masterRef}
          className="relative flex-1 min-w-0 rounded-xl overflow-hidden border border-line bg-[#0D0E11]"
          style={{
            backgroundImage: "radial-gradient(#242936 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        >
          {/* Focused media */}
          <div className="absolute inset-0" data-tile={focusId}>
            <TileVideo i={0} id={focusId} self={focusId === "host" ? isHost : focusId === selfId} />
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 pointer-events-none">
              <span className="text-[10px] font-mono text-live bg-black/65 px-1.5 py-0.5 rounded border border-live/30">
                {focusId === "host" ? `@${hostName} · HOST` : `@${focusId}`}
              </span>
            </div>
          </div>

          {/* Host PiP when another tile is focused */}
          {focusId !== "host" && (
            <button
              type="button"
              onClick={() => setFocusId("host")}
              className="absolute bottom-2 left-2 z-30 w-28 sm:w-36 aspect-video rounded-lg border border-live/50 overflow-hidden shadow-lg btn"
              title="Return host to focus"
            >
              <TileVideo i={0} id="host" self={isHost} />
              <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] font-mono text-live px-1 py-0.5 truncate">
                @{hostName}
              </span>
            </button>
          )}

          {/* Annotation layer — only active for host/co */}
          <div
            className="absolute inset-0 z-20 touch-none"
            style={{cursor: caps.draw || isCo ? "crosshair" : "default"}}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <canvas ref={cv} className="absolute inset-0 w-full h-full pointer-events-none" />
            {(simulated ? [] : cursors)
              .filter((c: {self?: boolean}) => !c.self)
              .slice(0, 4)
              .map((c: {id: string; x: number; y: number; color: string; name: string}) => (
                <div
                  key={c.id}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${c.x * 100}%`,
                    top: `${c.y * 100}%`,
                    transition: "left 90ms linear, top 90ms linear",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 14 14">
                    <path d="M1 1l11 4-5 2-2 5z" fill={c.color} />
                  </svg>
                  <span style={{background: c.color}} className="text-[9px] text-black px-1 rounded -mt-0.5 ml-2 block w-fit">
                    {c.name}
                  </span>
                </div>
              ))}
            <AnimatePresence>
              {pings.map((p) => (
                <NeonPing key={p.id} x={p.x} y={p.y} color={p.color} label={p.label} />
              ))}
            </AnimatePresence>
            {flash?.tile === "host" && (
              <div key={flash.k} className="absolute z-30" style={{left: `${flash.x * 100}%`, top: `${flash.y * 100}%`}}>
                <Flash />
              </div>
            )}
            {/* Frosted tip stickers pinned to stream coords, then fall off */}
            <AnimatePresence>
              {tips
                .filter((n) => n.tile === "host" || n.tile === focusId)
                .map((n) => (
                  <TipSticker key={n.id} x={n.x} y={n.y} text={n.text} amount={n.amount} />
                ))}
            </AnimatePresence>
            {armed !== null && (
              <button
                type="button"
                onClick={(e) => {
                  const [x, y] = norm(e as unknown as React.PointerEvent);
                  setDraft({tile: "host", x, y, amount: armed});
                  setArmed(null);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="pointer-events-auto absolute inset-0 z-20 rounded-xl border-2 border-dashed border-live bg-live/10 text-live text-xs font-mono grid place-items-center"
              >
                Tap canvas to tip ${armed}
              </button>
            )}
          </div>

          {draft && (
            <div className="absolute inset-0 z-40 grid place-items-center bg-black/50 backdrop-blur-sm">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  commit((fd.get("note") as string) || "");
                }}
                className="glass rounded-xl p-4 w-64 border border-line space-y-3"
              >
                <p className="text-[11px] font-mono text-neutral-400">
                  Tip ${draft.amount} → host @{hostName}
                </p>
                <input
                  name="note"
                  autoFocus
                  placeholder="Leave a note…"
                  className="w-full bg-[#0D0E11] border border-line rounded-lg px-3 py-2 text-sm font-mono text-white outline-none focus:border-community"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setDraft(null)} className="btn flex-1 text-[11px] font-mono py-1.5 rounded-lg border border-line text-neutral-400">
                    Cancel
                  </button>
                  <button type="submit" className="btn flex-1 text-[11px] font-mono py-1.5 rounded-lg border border-live text-live hover:bg-live hover:text-black">
                    Send
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{opacity: 0, x: 40}}
            animate={{opacity: 1, x: 0}}
            exit={{opacity: 0, x: 40}}
            className="absolute right-2 top-14 bottom-20 w-64 md:w-72 z-30"
          >
            <ChatPanel className="h-full" />
          </motion.div>
        )}
      </AnimatePresence>

      {(msg || armed) && (
        <div
          role="status"
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 glass rounded-full px-3 py-1 text-[10px] font-mono text-risk"
        >
          {msg || `Tip $${armed} — drop on host or sub-crew tile. Esc cancels.`}
        </div>
      )}

      {allocTarget && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-xl p-5 w-72 border border-line space-y-3">
            <p className="text-[12px] font-mono text-white">
              Allocate to <span className="text-community">@{allocTarget}</span>
            </p>
            <p className="text-[10px] text-neutral-400 font-mono">
              From host ledger → co-creator (captain payout)
            </p>
            <div className="flex gap-2">
              {[5, 10, 25].map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => confirmSplit(a)}
                  className="btn flex-1 text-[12px] font-mono py-2 rounded-lg border border-live text-live hover:bg-live hover:text-black"
                >
                  ${a}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAllocTarget(null)}
              className="w-full text-[11px] font-mono text-neutral-500 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ControlBar
        tray={
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] text-neutral-400 font-mono">
              {PAYMENTS_ON
                ? "DRAG TO TIP (HOST LEDGER)"
                : TOKENS_ON
                ? "PLAY TOKENS · HOST LEDGER"
                : "TIPS · COMING SOON"}
            </span>
            {TOKENS.map((t) => (
              <motion.button
                key={t.a}
                type="button"
                drag={TOKENS_ON}
                dragSnapToOrigin
                whileDrag={{scale: 1.25, zIndex: 60}}
                onTap={() => {
                  if (!TOKENS_ON) say(SOON);
                }}
                aria-disabled={!TOKENS_ON}
                dragTransition={{bounceStiffness: 300, bounceDamping: 30}}
                onDragEnd={(_, i) => drop(t.a, i.point.x, i.point.y)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!TOKENS_ON) return say(SOON);
                    setArmed((a) => (a === t.a ? null : t.a));
                  }
                  if (e.key === "Escape") setArmed(null);
                }}
                className={`btn w-10 h-10 rounded-full border font-mono text-sm bg-card touch-none ${t.c} ${
                  TOKENS_ON ? "" : "opacity-50 cursor-not-allowed"
                }`}
              >
                ${t.a}
              </motion.button>
            ))}
            <button
              type="button"
              onClick={() =>
                useRoomCtl.getState().set({chatOpen: !useRoomCtl.getState().chatOpen})
              }
              className="btn text-[10px] font-mono px-2.5 py-1.5 rounded-full border border-line text-neutral-300 hover:border-community hover:text-community"
            >
              {chatOpen ? "Close Chat" : "Chat Log"}
            </button>
            {(isCo || isHost) && (
              <button
                type="button"
                onClick={() => say("Mic channel ready")}
                className="btn text-[10px] font-mono px-2.5 py-1.5 rounded-full border border-live text-live hover:bg-live hover:text-black"
              >
                Request to Mic
              </button>
            )}
          </div>
        }
      />
    </div>
  );
}
