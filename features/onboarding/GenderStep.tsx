"use client";
import {useOnboarding} from "./OnboardingProvider";
import type {Gender} from "@/lib/skillMedia";
import Avatar from "../shared/Avatar";

const CHOICES: {id: Gender; label: string}[] = [
  {id: "male", label: "Male"},
  {id: "female", label: "Female"},
];

export default function GenderStep() {
  const {data, update} = useOnboarding();
  return (
    <div className="grid h-full place-items-center px-5">
      <div className="w-full max-w-lg text-center">
        <h1 className="font-mono text-lg tracking-wide text-white md:text-2xl">Choose your presence</h1>
        <p className="mt-2 text-sm text-neutral-400">Simple character for your profile — not a photo.</p>
        <div role="group" aria-label="Gender" className="mt-10 flex flex-wrap justify-center gap-8">
          {CHOICES.map((c) => {
            const on = data.gender === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => update({gender: c.id})}
                aria-pressed={on}
                className={`btn flex flex-col items-center gap-3 rounded-2xl border p-5 transition-all ${
                  on ? "border-live bg-live/10 shadow-[0_0_24px_rgba(0,255,102,.12)]" : "border-line hover:border-neutral-500"
                }`}
              >
                <Avatar gender={c.id} handle={c.id} size={112} className="!border-0" />
                <span className={`font-mono text-sm ${on ? "text-live" : "text-neutral-300"}`}>{c.label}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => update({track: null, gender: null})}
          className="btn mt-10 rounded-full px-4 py-2 text-sm text-neutral-400 hover:text-white"
        >
          ← Change track
        </button>
      </div>
    </div>
  );
}
