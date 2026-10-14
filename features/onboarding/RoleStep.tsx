"use client";
import {useOnboarding} from "./OnboardingProvider";
import type {Track} from "@/lib/onboarding";
import {ROLE_IMG} from "@/lib/skillMedia";

const PANELS: {track: Track; title: string; sub: string; border: string; img: string}[] = [
  {
    track: "creator",
    title: "I AM AN OPERATOR",
    sub: "Streaming my daily craft, co-working with peers, and taking on high-risk contracts.",
    border: "hover:border-live focus-visible:border-live",
    img: ROLE_IMG.creator,
  },
  {
    track: "client",
    title: "I AM A BUILDER",
    sub: "Scouting elite live talent, securing milestones, and funding high-stakes projects.",
    border: "hover:border-community focus-visible:border-community",
    img: ROLE_IMG.client,
  },
];

export default function RoleStep() {
  const {data, update} = useOnboarding();
  return (
    <div role="group" aria-label="Choose your track" className="grid h-full grid-rows-2 md:grid-cols-2 md:grid-rows-1">
      {PANELS.map((p) => (
        <button
          key={p.track}
          onClick={() => update({track: p.track, tags: data.track === p.track ? data.tags : []})}
          className={`btn relative flex flex-col items-start justify-end overflow-hidden border-line p-8 pb-12 text-left outline-none first:border-b md:first:border-b-0 md:first:border-r md:p-14 md:pb-20 ${p.border}`}
        >
          <img
            src={p.img}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-40 transition-opacity duration-300 hover:opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D0E11] via-[#0D0E11]/70 to-transparent" />
          <span className="relative font-mono text-2xl font-medium tracking-wide text-white md:text-4xl">{p.title}</span>
          <span className="relative mt-3 max-w-sm text-sm text-neutral-300 md:text-base">{p.sub}</span>
        </button>
      ))}
    </div>
  );
}
