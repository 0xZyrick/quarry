"use client";
/** STEP 01 — Enter Quarry. Explore before any registration. */
import { useOnboarding } from "./OnboardingProvider";

export default function WelcomeStep() {
  const { update } = useOnboarding();
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-live mb-4">Quarry</p>
      <h1 className="text-2xl sm:text-3xl font-semibold text-white max-w-md leading-tight">
        Discover what people are building
      </h1>
      <p className="mt-3 text-sm text-neutral-400 max-w-sm leading-relaxed">
        Follow the process behind the work — projects as stories, not endless streams of silent screens.
      </p>
      <button
        type="button"
        onClick={() => update({ explored: true, auth: "guest" })}
        className="mt-8 btn glass rounded-full px-8 py-3 text-sm font-medium text-live hover:text-white border border-live/30"
      >
        Explore Quarry
      </button>
      <p className="mt-4 text-[11px] text-neutral-600 font-mono">
        No account needed to browse
      </p>
    </div>
  );
}
