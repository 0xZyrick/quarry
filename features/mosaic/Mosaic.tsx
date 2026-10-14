"use client";
import {motion, useAnimationControls, useReducedMotion} from "framer-motion";
import {useEffect, useMemo, useRef, useState} from "react";
import {useGuild} from "@/lib/store";
import {arrange, tiles, Tile, ROOM} from "@/lib/mosaic";
import {mosaicClock} from "@/lib/mosaicClock";
import {CREATOR_TAGS, nodeName, zoneCity} from "@/lib/onboarding";
import {useHubs, isVisible} from "@/lib/hubs";
import {useOnboarding} from "../onboarding/OnboardingProvider";
import MosaicTile from "./MosaicTile";
import ZoomDive from "./ZoomDive";
import {IconSearch, IconBolt, IconMap, IconPin} from "../shared/Icons";

const chip =
  "btn glass rounded-full px-2.5 py-1 font-mono text-[11px] sm:text-xs text-neutral-200 hover:text-white inline-flex items-center gap-1.5";
const cols = (w: number) => (w < 560 ? 2 : w < 900 ? 3 : w < 1300 ? 4 : 5);

export default function Mosaic({playing, onReels}: {playing: boolean; onReels: () => void}) {
  const {data, active} = useOnboarding(),
    zone = data.zone,
    city = zoneCity(zone);
  const nv = useGuild((s) => s.nodesV),
    all = useMemo(tiles, [nv]);
  const [skills, setSkills] = useState<string[]>([]),
    [local, setLocal] = useState(false),
    [menu, setMenu] = useState(false);
  const [n, setN] = useState(2),
    [dive, setDive] = useState<{t: Tile; r: DOMRect} | null>(null);
  // Single-play: one tile loops at a time. Hover overrides the featured default.
  const [featuredId, setFeaturedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const playingId = hoverId ?? featuredId;
  const box = useRef<HTMLDivElement>(null),
    wrap = useRef<HTMLDivElement>(null),
    land = useAnimationControls(),
    reduce = useReducedMotion();
  const live = useHubs((s) => s.live),
    sus = useHubs((s) => s.suspended),
    tags = data.tags;
  const list = useMemo(
    () => arrange(all, {zone, skills, local, city, tags, visible: (id) => isVisible(id, {live, suspended: sus})}),
    [all, zone, skills, local, city, tags, live, sus]
  );
  const columns = useMemo(() => {
    const c: Tile[][] = Array.from({length: n}, () => []),
      h = Array(n).fill(0);
    for (const t of list) {
      let k = 0;
      for (let i = 1; i < n; i++) if (h[i] < h[k]) k = i;
      c[k].push(t);
      h[k] += 1 / t.ar + 0.06;
    }
    return c;
  }, [list, n]);
  useEffect(() => {
    mosaicClock.setPaused(!playing || !active);
  }, [playing, active, dive]);
  // Default featured = first arranged tile (only one autoplays)
  useEffect(() => {
    setFeaturedId(list[0]?.id ?? null);
  }, [list]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const f = () => setN(cols(el.clientWidth));
    f();
    const ro = new ResizeObserver(f);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const was = useRef(zone);
  useEffect(() => {
    if (!was.current && zone && !reduce)
      land.start({scale: [1.12, 1], opacity: [0, 1], transition: {duration: 0.8, ease: [0.2, 0.7, 0.2, 1]}});
    was.current = zone;
  }, [zone]);
  const open = (t: Tile, r: DOMRect) => {
    if (dive || useGuild.getState().trans) return;
    setMenu(false);
    setDive({t, r});
  };
  const enter = () => {
    if (!dive) return;
    const g = useGuild.getState();
    g.select(dive.t.nodeId);
    g.setRoomId(dive.t.nodeId);
    g.setRoom(ROOM[dive.t.kind]);
    useGuild.setState({instant: true});
    g.setLayer(2);
  };
  const toggle = (s: string) => setSkills((a) => (a.includes(s) ? a.filter((x) => x !== s) : [...a, s]));
  const wr = wrap.current?.getBoundingClientRect();
  const goMap = () => useGuild.getState().setLayer(1);

  return (
    <motion.div animate={land} className="absolute inset-0 bg-deep">
      <motion.div
        ref={wrap}
        className="absolute inset-0 will-change-transform"
        style={{
          transformOrigin:
            dive && wr
              ? `${dive.r.left + dive.r.width / 2 - wr.left}px ${dive.r.top + dive.r.height / 2 - wr.top}px`
              : "50% 50%",
        }}
        animate={{scale: dive && !reduce ? 1.14 : 1, opacity: dive ? 0.55 : 1}}
        transition={{duration: 0.6, ease: [0.5, 0, 0.2, 1]}}
      >
        <div ref={box} className="h-full overflow-y-auto overscroll-contain no-scrollbar" style={{touchAction: "pan-y"}}>
          {/* Top nav: name · map · zone · counts — does not cover tile content */}
          <header className="sticky top-0 z-10 border-b border-line/60 bg-deep/95 px-3 pt-14 pb-2 pr-[min(42vw,13rem)] backdrop-blur-md">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="whitespace-nowrap font-mono text-xs sm:text-sm font-medium tracking-[0.14em] sm:tracking-[0.2em] text-white">
                QUARRY
              </h1>
              <button
                onClick={goMap}
                aria-label="Open map"
                title="Open map"
                className="btn glass rounded-full w-7 h-7 grid place-items-center text-community hover:bg-community hover:text-black"
              >
                <IconMap size={13} />
              </button>
              <span
                className="glass rounded-full px-2 py-0.5 font-mono text-[10px] text-community truncate max-w-[120px] sm:max-w-none inline-flex items-center gap-1"
                title={nodeName(zone)}
              >
                <IconPin size={10} />
                {nodeName(zone)}
              </span>
              <div className="ml-auto" />
            </div>
            <div className="relative mt-2 flex flex-wrap gap-1.5">
              <button className={chip} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                <IconSearch size={12} />
                {skills.length ? (
                  `Skills: ${skills.length}`
                ) : (
                  <>
                    <span className="sm:hidden">Skills</span>
                    <span className="hidden sm:inline">Filter Skills</span>
                  </>
                )}
              </button>
              <button
                className={`${chip} ${local ? "!border-live !text-live" : ""}`}
                aria-pressed={local}
                disabled={!city}
                onClick={() => setLocal((v) => !v)}
              >
                <IconBolt size={12} />
                <span className="sm:hidden">Local</span>
                <span className="hidden sm:inline">Local Beacons</span>
              </button>
              <button className={chip} onClick={onReels}>
                Reels
              </button>
              {menu && (
                <div
                  role="group"
                  aria-label="Filter by skill"
                  className="glass absolute left-0 top-full z-20 mt-1.5 flex max-w-[min(26rem,100%)] flex-wrap gap-1.5 rounded-xl p-2.5"
                >
                  <button
                    className={`${chip} ${!skills.length ? "!border-live !text-live" : ""}`}
                    aria-pressed={!skills.length}
                    onClick={() => setSkills([])}
                  >
                    All
                  </button>
                  {CREATOR_TAGS.map((s) => (
                    <button
                      key={s}
                      aria-pressed={skills.includes(s)}
                      onClick={() => toggle(s)}
                      className={`${chip} ${skills.includes(s) ? "!border-live !text-live" : ""}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </header>

          <div className="flex items-start gap-2 px-3 pt-2 pb-16">
            {columns.map((c, i) => (
              <div key={i} className="flex min-w-0 flex-1 flex-col gap-2">
                {c.map((t) => (
                  <MosaicTile
                    key={t.id}
                    tile={t}
                    playing={playing && playingId === t.id}
                    onOpen={open}
                    onHoverPlay={(id) => setHoverId(id)}
                    onHoverEnd={(id) => setHoverId((h) => (h === id ? null : h))}
                  />
                ))}
              </div>
            ))}
          </div>
          {!list.length && (
            <div className="px-6 py-16 text-center text-sm text-neutral-400">
              No live rooms match.
              <button
                className="ml-2 text-community underline"
                onClick={() => {
                  setSkills([]);
                  setLocal(false);
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </motion.div>
      {dive && <ZoomDive tile={dive.t} rect={dive.r} onEnter={enter} onDone={() => setDive(null)} />}
    </motion.div>
  );
}
