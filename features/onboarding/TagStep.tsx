"use client";
import {useState} from "react";
import {tagsFor} from "@/lib/onboarding";
import {useOnboarding} from "./OnboardingProvider";

const ON = {
  creator: "border-live bg-live/15 text-live",
  client: "border-community bg-community/15 text-community",
} as const;

export default function TagStep() {
  const {data, update} = useOnboarding();
  const track = data.track;
  const [sel, setSel] = useState<string[]>(data.tags);
  if (!track) {
    return (
      <div className="grid h-full place-items-center text-sm text-neutral-400">
        Pick a track first.
        <button onClick={() => update({track: null, gender: null})} className="mt-4 text-community underline">
          Back
        </button>
      </div>
    );
  }
  const options = tagsFor(track);
  const toggle = (t: string) => setSel((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]));

  return (
    <div className="grid h-full place-items-center px-5">
      <div className="w-full max-w-2xl text-center">
        <h1 className="font-mono text-lg tracking-wide text-white md:text-2xl">
          {track === "creator" ? "Choose your weapons" : "What are you here to do?"}
        </h1>
        <p className="mt-2 text-sm text-neutral-400">Pick as many as apply. Selected tags appear on your profile.</p>
        <div
          role="group"
          aria-label={track === "creator" ? "Skills" : "Project objectives"}
          className="mt-8 flex flex-wrap justify-center gap-2.5"
        >
          {options.map((t) => {
            const on = sel.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(t)}
                className={`btn rounded-full border-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  on
                    ? ON[track]
                    : "border-neutral-600 bg-[#161920] text-white hover:border-neutral-400"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
        {sel.length > 0 && (
          <p className="mt-4 font-mono text-[11px] text-neutral-400">
            Selected: <span className="text-white">{sel.join(" · ")}</span>
          </p>
        )}
        <div className="mt-10 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => update({gender: null, tags: []})}
            className="btn rounded-full px-4 py-2 text-sm text-neutral-400 hover:text-white"
          >
            ← Back
          </button>
          <button
            type="button"
            disabled={!sel.length}
            onClick={() => update({tags: sel})}
            className="btn rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black hover:bg-live disabled:opacity-30"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
