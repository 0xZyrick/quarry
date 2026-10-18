"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadCircleIds, loadFollowsFeed, currentUid } from "@/lib/circle";
import { useShellUi } from "@/lib/shellUi";
import { navigateToRoute } from "@/lib/appRoutes";
import MilestoneEpisode, { type EpisodeData } from "./MilestoneEpisode";
import { useOnboarding } from "../onboarding/OnboardingProvider";

type LiveCard = {
  projectId: string;
  title: string;
  handle: string;
  blurb: string;
  viewers: number;
  roomId: string;
  imageUrl: string | null;
};

type HelpRow = {
  id: string;
  title: string;
  projectTitle: string;
  handle: string;
  tags: string;
  projectId: string;
};

function mapFollowToEpisode(f: any): EpisodeData | null {
  const p = f.project || f;
  if (!p?.id && !f.projectId) return null;
  const node = p.latestNode || {};
  const projectId = p.id || f.projectId;
  return {
    projectId,
    projectTitle: p.title || "Project",
    handle: p.creator?.handle || "anon",
    headline: node.summary || p.intent || p.title || "Update",
    subline: node.phaseTitle ? String(node.phaseTitle) : undefined,
    changelog: [],
    mediaUrl: node.mediaUrl || node.thumbUrl || node.vodUrl || null,
    thumbUrl: node.thumbUrl || node.mediaUrl || null,
    hasVideo: !!(node.mediaUrl || node.vodUrl || node.liveUrl),
    durationLabel: "0:48",
    newUpdatesCount: f.hasUpdates || p.hasUpdates ? f.newCount || 3 : f.newCount || 0,
    live: !!(p.live || f.live || (node.liveUrl && !node.sessionEndedAt)),
    liveViewers: p.liveViewers || f.viewers || 0,
    roomId: p.roomId || projectId,
    phases: [],
    updatedAt: p.updatedAt || node.createdAt || new Date().toISOString(),
  };
}

export default function CirclesHome() {
  const { signedIn, requireAuth } = useOnboarding();
  const [episodes, setEpisodes] = useState<EpisodeData[]>([]);
  const [liveCards, setLiveCards] = useState<LiveCard[]>([]);
  const [helpRows, setHelpRows] = useState<HelpRow[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [feedError, setFeedError] = useState("");
  const [liveError, setLiveError] = useState("");
  const [helpError, setHelpError] = useState("");
  const [loading, setLoading] = useState(true);
  const [caughtUp, setCaughtUp] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setFeedError("");
    setLiveError("");
    setHelpError("");
    try {
      await loadCircleIds();
      const follows = await loadFollowsFeed();
      const mapped = follows.map(mapFollowToEpisode).filter(Boolean) as EpisodeData[];
      setEpisodes(mapped);
      try {
        const r = await fetch("/api/sessions?active=1");
        if (!r.ok) throw new Error("Could not load live work sessions.");
        const d = await r.json();
        const sessions = d.sessions || [];
        const uniqueSessions = new Map<string, LiveCard>();
        for (const s of sessions) {
          const projectId = s.projectId || s.roomId || s.id;
          if (uniqueSessions.has(projectId)) continue;
          uniqueSessions.set(projectId, {
            projectId,
            title: s.project?.title || s.title || "Live session",
            handle: s.project?.creator?.handle || "builder",
            blurb: s.currentState || s.goal || "Building together",
            viewers: 0,
            roomId: s.roomId || s.projectId || s.id,
            imageUrl: s.project?.latestNode?.thumbUrl || s.project?.latestNode?.mediaUrl || s.project?.coverImageUrl || s.project?.journeyNodes?.[0]?.nextSnapshotUrl || s.project?.journeyNodes?.[0]?.prevSnapshotUrl || null,
          });
        }
        setLiveCards([...uniqueSessions.values()].slice(0, 8));
      } catch (error) {
        setLiveError(error instanceof Error ? error.message : "Could not load live work sessions.");
        setLiveCards([]);
      }
      try {
        const hr = await fetch("/api/help?status=OPEN&take=12");
        const hd = await hr.json().catch(() => ({}));
        if (!hr.ok) throw new Error(hd.error || "Could not load open help requests.");
        const list = (hd.help || []).map((h: any) => ({
          id: h.id,
          title: h.title,
          projectTitle: h.projectTitle || "Project",
          handle: h.handle || "anon",
          tags: (h.tags || []).join(" / ") || "Help",
          projectId: h.projectId,
        }));
        setHelpRows(list);
      } catch (error) {
        setHelpError(error instanceof Error ? error.message : "Could not load open help requests.");
        setHelpRows([]);
      }
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : "Could not load your studio.");
      setEpisodes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () => episodes.filter((e) => !caughtUp[e.projectId]),
    [episodes, caughtUp]
  );

  const walkIn = (roomId: string, projectId: string) => {
    const id = roomId || projectId;
    navigateToRoute({kind: "room", id});
  };

  const claimHelp = async (h: HelpRow) => {
    if (!signedIn) {
      requireAuth("offer to help on a project");
      return;
    }
    const uid = currentUid();
    if (!uid) {
      setActionError("Sign in again to offer help.");
      return;
    }
    setClaiming(h.id);
    setActionError("");
    try {
      const response = await fetch("/api/help", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: h.id, claim: true }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not claim this request.");
      setHelpRows((rows) => rows.filter((x) => x.id !== h.id));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not claim this request.");
      setClaiming(null);
      return;
    }
    setClaiming(null);
    // Offer help → walk into the room, not the journey page
    walkIn(h.projectId, h.projectId);
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--page)]">
      <div className="h-full max-w-[1600px] mx-auto flex flex-col">
        <main className="flex-1 min-h-0 min-w-0 overflow-y-auto px-4 sm:px-8 py-5">
          <div className="max-w-6xl mx-auto space-y-8 sm:space-y-10">
            <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-[var(--line)] pb-5 sm:pb-6">
              <div className="max-w-2xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--coral)]">Your workbench</p>
                <h1 className="mt-2 text-[28px] sm:text-[36px] font-semibold tracking-tight text-[var(--text)]">Studio</h1>
                <p className="mt-2 text-[13px] sm:text-[14px] leading-relaxed text-[var(--text-muted)]">
                  Pick up where your circle left off, join a work session, or step into a project that needs a hand.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    useShellUi.getState().setActiveTab("explore");
                    window.dispatchEvent(new CustomEvent("wippo:nav", { detail: "stories" }));
                  }}
                  className="rounded-full border border-[var(--line-strong)] px-4 py-2 text-[12px] font-medium text-[var(--text)] hover:bg-white/[0.05]"
                >
                  Discover work
                </button>
                <button
                  type="button"
                  onClick={() => useShellUi.getState().openLaunch()}
                  className="rounded-full bg-[var(--coral)] px-4 py-2 text-[12px] font-semibold text-white shadow-[0_8px_24px_rgba(255,118,95,.16)] hover:brightness-110"
                >
                  Start a project
                </button>
              </div>
            </header>

            <section>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold text-[var(--text)]">Work happening now</h2>
                  <p className="mt-1 text-[11px] text-[var(--text-faint)]">Step into a room to quietly build alongside someone.</p>
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-faint)]">{liveCards.length} live</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 snap-x">
                {liveCards.map((card, i) => (
                  <button
                    key={card.projectId + i}
                    type="button"
                    onClick={() => walkIn(card.roomId, card.projectId)}
                    className="relative snap-start shrink-0 w-[16rem] sm:w-[18rem] aspect-[2/1] rounded-2xl overflow-hidden bg-[var(--surface)] p-3 flex flex-col justify-between text-left"
                  >
                    {card.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    )}
                    <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/25" />
                    <span className="self-start rounded-full bg-[var(--coral)] px-2 py-0.5 text-[10px] font-bold text-white">
                      Live{card.viewers ? ` · ${card.viewers}` : ""}
                    </span>
                    <div className="relative">
                      <p className="text-[14px] font-semibold text-white leading-snug line-clamp-1">
                        {card.title}
                      </p>
                      <p className="text-[11px] text-white/85 mt-0.5 truncate">
                        @{card.handle}: {card.blurb}
                      </p>
                    </div>
                  </button>
                ))}
                {!loading && liveCards.length === 0 && (
                  <div className="w-full rounded-2xl border border-dashed border-[var(--line)] px-4 py-5 text-center">
                    <p role={liveError ? "alert" : undefined} className={`text-[12px] ${liveError ? "text-red-300" : "text-[var(--text-faint)]"}`}>
                      {liveError || "No public work sessions are live right now."}
                    </p>
                    {liveError && <button type="button" onClick={() => void load()} className="mt-2 text-[11px] font-medium text-[var(--coral)] hover:underline">Try again</button>}
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-6">
              {loading && <div className="h-48 rounded-xl bg-white/[0.03] animate-pulse" />}
              {feedError && (
                <div role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/[0.04] px-4 py-4">
                  <p className="text-[13px] font-medium text-red-200">Your circle updates could not be loaded.</p>
                  <p className="mt-1 text-[11px] text-red-200/70">{feedError}</p>
                  <button type="button" onClick={() => void load()} className="mt-3 rounded-full border border-red-300/20 px-3 py-1.5 text-[11px] text-red-200 hover:bg-red-300/[0.06]">Retry</button>
                </div>
              )}
              {!loading && visible.length === 0 && (
                !feedError && <div className="rounded-2xl border border-dashed border-[var(--line-strong)] px-5 py-8 text-center">
                  <p className="text-[14px] font-medium text-[var(--text)]">{signedIn ? "Your circle is ready for its first update." : "Your studio starts with the work you follow."}</p>
                  <p className="mx-auto mt-1.5 max-w-md text-[12px] leading-relaxed text-[var(--text-faint)]">
                    {signedIn ? "Follow a project journey and its next milestone will find its way here." : "Explore project journeys, follow the ones that interest you, and return to see how they change."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      useShellUi.getState().setActiveTab("explore");
                      window.dispatchEvent(new CustomEvent("wippo:nav", { detail: "stories" }));
                    }}
                    className="mt-4 rounded-full border border-[var(--line-strong)] px-4 py-2 text-[12px] font-medium text-[var(--text)] hover:bg-white/[0.05]"
                  >
                    Explore project journeys
                  </button>
                </div>
              )}
              {visible.map((ep) => (
                <MilestoneEpisode
                  key={ep.projectId}
                  episode={ep}
                  compact
                  bare
                  onOpenJourney={() => useShellUi.getState().openProject(ep.projectId)}
                />
              ))}
            </section>
            <section className="rounded-3xl border border-[var(--line)] bg-[linear-gradient(120deg,rgba(255,118,95,.07),rgba(14,19,28,.7)_48%,rgba(159,227,192,.04))] p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">Open collaboration</p>
                  <h2 className="mt-1 text-[16px] font-semibold text-[var(--text)]">Projects that need a hand</h2>
                  <p className="mt-1 text-[12px] text-[var(--text-muted)]">Offer a useful perspective, then continue the conversation in the project room.</p>
                </div>
                <span className="text-[11px] text-[var(--text-faint)]">{helpRows.length} open {helpRows.length === 1 ? "ask" : "asks"}</span>
              </div>
              {helpError ? (
                <div role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/[0.04] px-4 py-4">
                  <p className="text-[12px] text-red-200">{helpError}</p>
                  <button type="button" onClick={() => void load()} className="mt-2 text-[11px] font-medium text-[var(--coral)] hover:underline">Retry</button>
                </div>
              ) : helpRows.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--line-strong)] px-4 py-5 text-[12px] text-[var(--text-faint)]">
                  No open requests right now. New asks from project owners will appear here.
                </p>
              ) : (
                <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {helpRows.map((h) => (
                    <li key={h.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]/90 p-3 sm:p-4">
                      <p className="text-[13px] font-semibold text-[var(--text)]">{h.title}</p>
                      <p className="mt-1 text-[11px] text-[var(--text-faint)]">{h.projectTitle} · @{h.handle} · {h.tags}</p>
                      <button type="button" disabled={claiming === h.id} onClick={() => void claimHelp(h)} className="mt-3 rounded-full border border-amber-300/30 px-3.5 py-1.5 text-[11px] font-medium text-amber-200 hover:bg-amber-300/10 disabled:opacity-50">
                        {claiming === h.id ? "Claiming…" : "Offer to help"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {actionError && <p role="alert" className="mt-3 text-[11px] text-red-400">{actionError}</p>}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
