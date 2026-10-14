"use client";
import {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {useGuild} from "@/lib/store";
import {media, Clip} from "@/lib/media";
import {RoomCounts} from "../shared/Counts";
import {createPool, Pool} from "@/lib/videoPool";
import Avatar from "../shared/Avatar";
import {IconChat, IconCoin, IconMic} from "../shared/Icons";
import type {Gender} from "@/lib/skillMedia";

const GRAD = ["from-[#0b2a1a]", "from-[#2a1a0b]", "from-[#0b1a2a]"];
const POOL = 3;
// Alternate genders for demo clips when unknown
const demoGender = (name: string): Gender =>
  /mira|ayo|sade|lena|nia/i.test(name) ? "female" : "male";

export default function Feed({playing}: {playing: boolean}) {
  const {setLayer, setClip, sound, toggleSound, setRoomId} = useGuild();
  const [clips, setClips] = useState<Clip[]>([]);
  const len = clips.length,
    P = len * POOL,
    [abs, setAbs] = useState(0);
  const root = useRef<HTMLDivElement>(null),
    hosts = useRef(new Map<number, HTMLDivElement>()),
    pool = useRef<Pool | null>(null),
    started = useRef(false),
    settle = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    media.clips().then(setClips);
  }, []);
  useEffect(() => {
    pool.current = createPool(POOL);
    return () => {
      pool.current?.all().forEach((v) => {
        v.pause();
        v.removeAttribute("src");
        v.load();
        v.remove();
      });
      pool.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    if (!len || !root.current) return;
    root.current.scrollTop = P * root.current.clientHeight;
    started.current = true;
    setAbs(P);
  }, [len]);
  useEffect(() => {
    const pl = pool.current;
    if (!pl || !len || !started.current) return;
    for (let d = -1; d <= 1; d++) {
      const i = abs + d,
        host = hosts.current.get(i),
        c = clips[((i % len) + len) % len];
      if (!host || !c) continue;
      const v = pl.assign(i, host, c.src, c.hue),
        cur = d === 0;
      v.muted = !(sound && cur);
      if (cur && playing) v.play().catch(() => {});
      else v.pause();
    }
  }, [abs, len, clips, playing, sound]);
  const items = useMemo(() => Array.from({length: len ? P * 3 : 0}, (_, i) => i), [len, P]);
  const onScroll = () => {
    const el = root.current;
    if (!el || !len) return;
    const i = Math.round(el.scrollTop / el.clientHeight);
    if (i !== abs) {
      setAbs(i);
      setClip(((i % len) + len) % len);
      navigator.vibrate?.(6);
    }
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const j = Math.round(el.scrollTop / el.clientHeight);
      if (j < P || j >= 2 * P) {
        const t = (j % P) + P;
        el.scrollTop = t * el.clientHeight;
        setAbs(t);
      }
    }, 140);
  };

  return (
    <div ref={root} className="snap-y-feed h-full no-scrollbar" onScroll={onScroll}>
      {items.map((i) => {
        const c = clips[((i % len) + len) % len],
          near = Math.abs(i - abs) <= 2;
        return (
          <article
            key={i}
            aria-label={c ? `@${c.name}` : undefined}
            {...({inert: i !== abs ? "" : undefined} as any)}
            onClick={toggleSound}
            className={`snap-item relative overflow-hidden bg-gradient-to-b ${GRAD[i % 3]} to-[#0D0E11]`}
          >
            {/* poster under video host */}
            {c?.poster && (
              <img src={c.poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
            )}
            <div
              ref={(el) => {
                if (el) hosts.current.set(i, el);
                else hosts.current.delete(i);
              }}
              className="absolute inset-0"
            />
            {near && c && (
              <>
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/35 pointer-events-none" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSound();
                  }}
                  aria-pressed={sound}
                  className="absolute top-3 left-4 text-[10px] font-mono text-neutral-300 hover:text-white z-10"
                >
                  {sound ? "Sound on" : "Tap for sound"}
                </button>
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-3 bottom-28 flex flex-col items-center gap-3 z-10"
                >
                  <Avatar gender={demoGender(c.name)} handle={c.name} size={44} className="ring-2 ring-live/40" />
                  <button
                    type="button"
                    aria-label="Tip this creator"
                    className="glass btn w-11 h-11 rounded-full grid place-items-center text-live hover:bg-live hover:text-black"
                  >
                    <IconCoin size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Comments"
                    className="glass btn w-11 h-11 rounded-full grid place-items-center hover:bg-community"
                  >
                    <IconChat size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Request mic"
                    className="glass btn w-11 h-11 rounded-full grid place-items-center text-neutral-300 hover:text-white"
                  >
                    <IconMic size={16} />
                  </button>
                </div>
                <div onClick={(e) => e.stopPropagation()} className="absolute left-4 right-16 bottom-10 z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar gender={demoGender(c.name)} handle={c.name} size={28} />
                    <div className="font-semibold">@{c.name}</div>
                  </div>
                  <RoomCounts id={c.nodeId} className="text-[10px] text-neutral-300" />
                  <div className="flex flex-wrap gap-1.5 my-2">
                    {c.skills.map((s) => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-full border border-line text-community">
                        {s}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRoomId(c.nodeId);
                      setLayer(2);
                    }}
                    className="btn rounded-full bg-live text-black font-semibold px-5 py-2.5 hover:bg-white"
                  >
                    Join Full Live Room
                  </button>
                </div>
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}
