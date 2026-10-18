"use client";
import { useState } from "react";
import { useShellUi } from "@/lib/shellUi";
import { navigateToRoute } from "@/lib/appRoutes";

export type EpisodePhase = { id: string; label: string; thumbUrl?: string | null };

export type EpisodeData = {
  projectId: string;
  projectTitle: string;
  handle: string;
  headline: string;
  subline?: string | null;
  changelog: { text: string; tag?: string }[];
  mediaUrl?: string | null;
  thumbUrl?: string | null;
  hasVideo?: boolean;
  durationLabel?: string;
  newUpdatesCount?: number;
  live?: boolean;
  liveViewers?: number;
  roomId?: string | null;
  phases?: EpisodePhase[];
  updatedAt?: string;
  sessionBanner?: string | null;
};

type Props = {
  episode: EpisodeData;
  compact?: boolean;
  bare?: boolean;
  onOpenJourney?: () => void;
  onCaughtUp?: () => void;
};

function IconCommentPlay({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M10 8.5v5l4-2.5-4-2.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconPullRequest({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="6" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M6 8v8" />
      <path d="M18 16V8a2 2 0 0 0-2-2h-2" />
      <path d="M14 6l2 2-2 2" />
    </svg>
  );
}

export default function MilestoneEpisode({ episode, bare = true, onOpenJourney }: Props) {
  const [playing, setPlaying] = useState(false);
  const media = episode.mediaUrl || episode.thumbUrl || null;

  const walkIn = () => {
    const id = episode.roomId || episode.projectId;
    navigateToRoute({ kind: "room", id });
  };

  return (
    <article className={bare ? "" : "rounded-2xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden"}>
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <span className="w-2 h-2 rounded-full bg-[var(--coral)] shrink-0" />
        <button type="button" onClick={onOpenJourney} className="text-[14px] font-semibold text-[var(--text)] hover:underline">
          {episode.projectTitle}
        </button>
        {(episode.newUpdatesCount ?? 0) > 0 && (
          <span className="rounded-full bg-[var(--coral)]/15 text-[var(--coral)] px-2 py-0.5 text-[10px] font-semibold">
            {episode.newUpdatesCount} new
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            useShellUi.getState().openVault(episode.handle.replace(/^@/, ""));
          }}
          className="text-[12px] text-[var(--text-faint)] hover:text-[var(--text)] hover:underline"
        >
          by @{episode.handle}
        </button>
        {episode.live && (
          <button type="button" onClick={walkIn} className="ml-auto rounded-full bg-[var(--coral)] px-3 py-1 text-[11px] font-semibold text-white">
            Walk in
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_3.25rem] gap-2">
        <button
          type="button"
          onClick={() => {
            if (episode.live) walkIn();
            else if (episode.hasVideo || media) setPlaying(true);
            else onOpenJourney?.();
          }}
          className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-sky-600/80 to-violet-700/80 text-left"
        >
          {media && playing ? (
            <video src={media} controls autoPlay className="absolute inset-0 w-full h-full object-cover" />
          ) : media ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : null}
          {!playing && (
            <span className="absolute inset-0 grid place-items-center">
              <span className="w-12 h-12 rounded-full bg-black/50 grid place-items-center text-white text-lg">▶</span>
            </span>
          )}
          {episode.durationLabel && (
            <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white tabular-nums">
              0:00 / {episode.durationLabel}
            </span>
          )}
        </button>

        <div className="flex md:flex-col items-center justify-center gap-2">
          <button
            type="button"
            title="Say something at this moment"
            onClick={onOpenJourney}
            className="w-10 h-10 rounded-xl border border-[var(--line)] grid place-items-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/[0.04]"
          >
            <IconCommentPlay />
          </button>
          <button
            type="button"
            title="Pick up the task"
            onClick={onOpenJourney}
            className="w-10 h-10 rounded-xl border border-[var(--line)] grid place-items-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/[0.04]"
          >
            <IconPullRequest />
          </button>
        </div>
      </div>

      <div className="pt-3">
        <button type="button" onClick={onOpenJourney} className="text-left w-full">
          <p className="text-[15px] font-medium text-[var(--text)] leading-snug hover:underline">{episode.headline}</p>
          {episode.subline && <p className="text-[12px] text-[var(--text-faint)] mt-1">{episode.subline}</p>}
        </button>
      </div>
    </article>
  );
}
