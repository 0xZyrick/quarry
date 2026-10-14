"use client";
/**
 * Network — creator profile as evolving work history (not a static portfolio).
 */
import { useEffect, useState } from "react";
import ProjectWorkspace from "./ProjectWorkspace";

type Journey = {
  id: string;
  title: string;
  intent: string;
  status: string;
  followerCount: number;
  updatedAt: string;
  phases: {
    dayLabel: string;
    phaseTitle: string;
    summary: string;
    evolutionDelta: string | null;
    mediaUrl: string | null;
    tag: string | null;
  }[];
};

export default function CreatorJourney({
  handle,
  onClose,
}: {
  handle: string;
  onClose?: () => void;
}) {
  const [creator, setCreator] = useState<{ id: string; handle: string | null; levelTrack: string } | null>(null);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/creators/${encodeURIComponent(handle)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setCreator(d.creator);
          setJourneys(d.journeys ?? []);
        }
      })
      .catch(() => setError("Failed to load"));
  }, [handle]);

  if (openId) {
    return <ProjectWorkspace projectId={openId} onClose={() => setOpenId(null)} />;
  }

  if (error) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-deep text-risk font-mono text-sm">
        {error}
        {onClose && <button onClick={onClose} className="mt-4 btn glass px-3 py-1.5 rounded-full text-xs">Back</button>}
      </div>
    );
  }

  if (!creator) {
    return <div className="absolute inset-0 grid place-items-center bg-deep text-neutral-500 font-mono text-sm">Loading journey…</div>;
  }

  return (
    <div className="absolute inset-0 overflow-y-auto bg-deep px-4 py-4">
      <div className="flex items-start gap-3 mb-6">
        {onClose && (
          <button onClick={onClose} className="btn glass rounded-full w-8 h-8 grid place-items-center text-neutral-300 mt-0.5">←</button>
        )}
        <div>
          <h1 className="text-lg font-semibold text-white">@{creator.handle}</h1>
          <p className="text-[11px] font-mono text-neutral-500 mt-0.5">{creator.levelTrack.replace("_", " ")}</p>
          <p className="text-[12px] text-neutral-400 mt-2 max-w-md">
            Work that unfolds over time — projects as stories, not a gallery of finished outcomes.
          </p>
        </div>
      </div>

      {journeys.length === 0 ? (
        <p className="text-neutral-500 font-mono text-sm">No projects yet.</p>
      ) : (
        <ul className="space-y-4">
          {journeys.map((j) => (
            <li key={j.id}>
              <button
                type="button"
                onClick={() => setOpenId(j.id)}
                className="w-full text-left rounded-xl border border-white/8 bg-card/40 hover:border-white/15 p-4 transition-colors"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white text-sm">{j.title}</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-400">
                    {j.status.replace("_", " ")}
                  </span>
                  <span className="font-mono text-[10px] text-neutral-600">{j.followerCount} following</span>
                </div>
                <p className="mt-1.5 text-[12px] text-live/90">
                  <span className="font-mono text-[10px] text-neutral-500 uppercase mr-1">Intent</span>
                  {j.intent}
                </p>
                {j.phases.length > 0 && (
                  <ol className="mt-3 space-y-1.5 border-t border-white/5 pt-2">
                    {j.phases.map((ph, i) => (
                      <li key={i} className="text-[11px] text-neutral-400 flex gap-2">
                        <span className="font-mono text-neutral-600 shrink-0">{ph.dayLabel}</span>
                        <span>
                          <span className="text-neutral-300">{ph.phaseTitle}</span>
                          {ph.evolutionDelta ? ` — Δ ${ph.evolutionDelta}` : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
