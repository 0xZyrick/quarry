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
    if (!currentUid()) {
      requireAuth("offer to help on a project", () => void claimHelp(h));
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
    <div className="absolute inset-0 overflow-hidden bg-[#0B0C0E]">
      <div className="h-full max-w-[1600px] mx-auto flex flex-col px-3 sm:px-5 pt-3 pb-24 sm:pb-3 gap-3 overflow-y-auto">
        {(feedError || actionError) && (
          <p role="alert" className="text-[12px] text-red-300 shrink-0">{actionError || feedError}</p>
        )}

        {/* Split: launchpad 65% · network pulse 35% */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] gap-3">
          {/* LEFT — Quick launchpad */}
          <section className="flex flex-col rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.25)] lg:min-h-0">
            <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between gap-2">
              <h1 className="text-h3 text-white">Your quick launchpad</h1>
              <button
                type="button"
                onClick={() => {
                  if (!signedIn) {
                    requireAuth("start a live canvas session");
                    return;
                  }
                  useShellUi.getState().openLaunch();
                }}
                className="rounded-full bg-[#10B981] px-3 py-1.5 text-[11px] font-semibold text-[#04120c] hover:brightness-110"
              >
                ● Go live
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4 lg:flex-1 lg:min-h-0">
              <div className="space-y-2">
                <p className="text-caption uppercase tracking-wider text-white/45">Session context</p>
                <p className="text-[13px] text-white/70">
                  Pick a project, set 1–2 micro-goals, then start screen share into your table.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (!signedIn) {
                      requireAuth("start a session");
                      return;
                    }
                    useShellUi.getState().openLaunch();
                  }}
                  className="w-full rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center hover:bg-white/[0.04] transition"
                >
                  <p className="text-[14px] font-semibold text-white">Start screen share / co-work</p>
                  <p className="mt-1 text-[11px] text-white/40">Drops you into a silent virtual table</p>
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-caption uppercase tracking-wider text-white/45">Your journeys</p>
                {loading && <p className="text-[12px] text-white/40">Loading…</p>}
                {!loading && visible.length === 0 && (
                  <p className="text-[12px] text-white/40">No followed projects yet — start one or follow from Discover.</p>
                )}
                <ul className="space-y-2">
                  {visible.slice(0, 6).map((ep) => (
                    <li key={ep.projectId}>
                      <button
                        type="button"
                        onClick={() => useShellUi.getState().openProject(ep.projectId)}
                        className="w-full text-left rounded-xl bg-white/[0.03] hover:bg-white/[0.06] px-3 py-2.5 transition"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-white truncate">{ep.projectTitle}</span>
                          {ep.live && (
                            <span className="shrink-0 text-[10px] font-semibold text-[#10B981]">LIVE</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-white/45 line-clamp-1">{ep.headline}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* RIGHT — Network pulse */}
          <section className="flex flex-col gap-3 lg:min-h-0">
            <div className="rounded-xl border border-white/[0.06] bg-[#111318] overflow-hidden flex flex-col lg:flex-1 lg:min-h-0">
              <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-white flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
                  Work happening now
                </h2>
                <span className="text-[11px] tabular-nums text-white/35">{liveCards.length}</span>
              </div>
              <div className="overflow-y-auto p-3 space-y-2 max-h-64 lg:flex-1 lg:min-h-0 lg:max-h-none">
                {liveError && <p className="text-[11px] text-red-300">{liveError}</p>}
                {!loading && liveCards.length === 0 && (
                  <p className="text-[12px] text-white/40 px-1 py-4">No live tables right now.</p>
                )}
                {liveCards.map((card, i) => (
                  <button
                    key={card.projectId + i}
                    type="button"
                    onClick={() => walkIn(card.roomId, card.projectId)}
                    className="w-full text-left rounded-xl overflow-hidden bg-black/30 hover:bg-black/40 ring-1 ring-[#10B981]/20 transition"
                  >
                    <div className="relative aspect-[16/9] bg-[#0a0b0d]">
                      {card.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={card.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      <span className="absolute left-2 top-2 rounded-full bg-[#10B981] px-2 py-0.5 text-[9px] font-bold text-[#04120c]">
                        LIVE
                      </span>
                      <div className="absolute bottom-2 left-2 right-2">
                        <p className="text-[12px] font-semibold text-white truncate">{card.title}</p>
                        <p className="text-[10px] text-white/60 truncate">@{card.handle} · {card.blurb}</p>
                      </div>
                    </div>
                    <div className="px-2.5 py-2">
                      <span className="text-[10px] font-semibold text-[#10B981]">Join table →</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="shrink-0 rounded-xl border border-[#F59E0B]/25 bg-[#111318] overflow-hidden flex flex-col">
              <div className="px-4 py-2.5 border-b border-white/[0.05] flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-amber-100 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />
                  Needs a hand
                </h2>
                <span className="text-[11px] text-white/35">{helpRows.length}</span>
              </div>
              <div className="overflow-y-auto p-3 space-y-2 max-h-48">
                {helpError && <p className="text-[11px] text-red-300">{helpError}</p>}
                {helpRows.length === 0 && (
                  <p className="text-[12px] text-white/40">No open bottlenecks.</p>
                )}
                {helpRows.map((h) => (
                  <div key={h.id} className="rounded-xl bg-white/[0.03] px-3 py-2.5">
                    <p className="text-[12px] font-medium text-white line-clamp-1">{h.title}</p>
                    <p className="text-[10px] text-white/45 mt-0.5">
                      @{h.handle} · {h.projectTitle}
                    </p>
                    <button
                      type="button"
                      disabled={claiming === h.id}
                      onClick={() => void claimHelp(h)}
                      className="mt-2 rounded-full bg-[#F59E0B] px-2.5 py-1 text-[10px] font-semibold text-[#1a1200] hover:brightness-110 disabled:opacity-50"
                    >
                      {claiming === h.id ? "…" : "Jump in & help"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Bottom — recent log reels */}
        <section className="shrink-0 rounded-xl border border-white/[0.06] bg-[#111318] px-3 py-3 mb-2">
          <p className="text-[10px] uppercase tracking-wider text-white/35 mb-2 px-1">Recent video log reels</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {episodes.slice(0, 8).map((ep) => (
              <button
                key={ep.projectId}
                type="button"
                onClick={() => useShellUi.getState().openProject(ep.projectId)}
                className="shrink-0 w-40 rounded-xl bg-black/40 overflow-hidden text-left hover:ring-1 hover:ring-white/15"
              >
                <div className="aspect-video bg-[#0a0b0d] relative">
                  {ep.thumbUrl || ep.mediaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ep.thumbUrl || ep.mediaUrl || ""}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="p-2">
                  <p className="text-[11px] font-medium text-white truncate">{ep.projectTitle}</p>
                  <p className="text-[10px] text-white/40 line-clamp-1">{ep.headline}</p>
                </div>
              </button>
            ))}
            {episodes.length === 0 && (
              <p className="text-[12px] text-white/40 px-2 py-3">Log reels from your circle appear here.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
