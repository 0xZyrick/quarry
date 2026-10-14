"use client";
/**
 * Spectator: short clip / discovery
 * Show clip, creator, what they were trying to do, why it matters.
 * Next steps: full project · related work · follow · contribute.
 * No milestone ladder if there is no project history.
 */
import { useState } from "react";
import { useGuild } from "@/lib/store";

type Props = {
  videoUrl: string;
  title?: string;
  goal?: string | null;
  currentState?: string | null;
  whyItMatters?: string | null;
  creatorHandle?: string | null;
  projectId?: string | null;
  projectTitle?: string | null;
  onOpenProject?: (id: string) => void;
  onOpenCreator?: (handle: string) => void;
  onClose?: () => void;
};

export default function ClipSpectator({
  videoUrl,
  title,
  goal,
  currentState,
  whyItMatters,
  creatorHandle,
  projectId,
  projectTitle,
  onOpenProject,
  onOpenCreator,
  onClose,
}: Props) {
  const profile = useGuild((s) => s.profile);
  const userId = (profile as any)?.id ?? profile?.handle ?? "";
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  const follow = async () => {
    if (!userId || !projectId || busy) return;
    setBusy(true);
    try {
      await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, projectId }),
      });
      setFollowing(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-deep">
      <div className="relative flex-1 min-h-0 bg-black">
        <video src={videoUrl} className="absolute inset-0 w-full h-full object-contain" controls autoPlay playsInline />
        {onClose && (
          <button onClick={onClose} className="absolute top-3 left-3 btn glass rounded-full px-3 py-1 text-[11px] font-mono text-white z-10">
            ← Back
          </button>
        )}
      </div>
      <div className="shrink-0 border-t border-white/5 px-4 py-3 space-y-2">
        {title && <p className="text-sm font-semibold text-white">{title}</p>}
        {creatorHandle && (
          <button
            type="button"
            onClick={() => onOpenCreator?.(creatorHandle)}
            className="text-[11px] font-mono text-neutral-400 hover:text-live"
          >
            @{creatorHandle}
          </button>
        )}
        {(goal || currentState) && (
          <div className="text-[12px] text-neutral-300 space-y-1">
            {goal && (
              <p>
                <span className="font-mono text-[10px] text-neutral-500 uppercase mr-1">Trying to</span>
                {goal}
              </p>
            )}
            {currentState && (
              <p>
                <span className="font-mono text-[10px] text-neutral-500 uppercase mr-1">Working on</span>
                {currentState}
              </p>
            )}
            {whyItMatters && (
              <p>
                <span className="font-mono text-[10px] text-neutral-500 uppercase mr-1">Why it matters</span>
                {whyItMatters}
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {projectId && onOpenProject && (
            <button
              type="button"
              onClick={() => onOpenProject(projectId)}
              className="btn glass rounded-full px-3 py-1 font-mono text-[11px] text-live"
            >
              Explore full project{projectTitle ? `: ${projectTitle}` : ""}
            </button>
          )}
          {creatorHandle && onOpenCreator && (
            <button
              type="button"
              onClick={() => onOpenCreator(creatorHandle)}
              className="btn glass rounded-full px-3 py-1 font-mono text-[11px] text-neutral-300"
            >
              Related work
            </button>
          )}
          {projectId && userId && (
            <button
              type="button"
              onClick={follow}
              disabled={busy || following}
              className="btn glass rounded-full px-3 py-1 font-mono text-[11px] text-neutral-300 disabled:text-live"
            >
              {following ? "Following" : "Follow updates"}
            </button>
          )}
        </div>
        <p className="text-[10px] text-neutral-600 font-mono">
          No milestone ladder — this is a standalone discovery. Open the project for the full journey.
        </p>
      </div>
    </div>
  );
}
