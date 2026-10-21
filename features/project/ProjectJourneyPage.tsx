"use client";
/**
 * Project journey — process-first record matching the production sample.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { isInCircle, currentUid } from "@/lib/circle";
import { useShellUi } from "@/lib/shellUi";
import { navigateToRoute } from "@/lib/appRoutes";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { isDemoMode } from "@/lib/demoMode";
import { demoJourneyProject, isDemoProjectId } from "@/lib/demoData";

type MediaDrop = { id?: string; videoUrl?: string | null; imageUrl?: string | null; nextSnapshotUrl?: string | null; prevSnapshotUrl?: string | null };
type Tried = { kind: string; text: string };
type Discussion = {
  id: string;
  handle: string;
  messageText: string;
  createdAt?: string;
  timeLabel?: string;
};

type Node = {
  id: string;
  position: number;
  dayLabel: string;
  updateTitle?: string | null;
  phaseTitle: string;
  summaryText: string;
  evolutionDelta?: string | null;
  liveUrl?: string | null;
  vodUrl?: string | null;
  prevSnapshotUrl?: string | null;
  nextSnapshotUrl?: string | null;
  imageUrls?: string[];
  updateKind?: string | null;
  promptUsed?: string | null;
  tools?: string[];
  triedAttempts?: { outcome: string; detail: string }[];
  sessionEndedAt?: string | null;
  mediaDrops?: MediaDrop[];
  discussions?: Discussion[];
  isSetback?: boolean;
  promptShared?: boolean;
};

type Project = {
  id: string;
  title: string;
  intentStatement?: string | null;
  currentState?: string | null;
  nextStep?: string | null;
  status?: string;
  createdAt?: string;
  creator?: { handle?: string | null };
  _count?: { followers?: number; journeyNodes?: number };
  journeyNodes?: Node[];
};

type HelpItem = {
  id: string;
  title: string;
  body?: string | null;
  tags: string[];
  status: "OPEN" | "IN_PROGRESS";
  claimedByHandle?: string | null;
};

const PHASES = ["Idea", "Prototype", "Alpha", "Public launch"] as const;

function parseTried(delta?: string | null): Tried[] {
  if (!delta) return [];
  const lines = delta.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.slice(0, 6).map((line) => {
    if (/dead\s*end/i.test(line)) return { kind: "Dead end", text: line.replace(/^.*?:\s*/, "") };
    if (/partial/i.test(line)) return { kind: "Partial", text: line.replace(/^.*?:\s*/, "") };
    if (/worked|artifact/i.test(line)) return { kind: "Worked", text: line.replace(/^.*?:\s*/, "") };
    return { kind: "Worked", text: line };
  });
}

function kindColor(k: string) {
  if (k === "Dead end") return "text-red-400";
  if (k === "Partial") return "text-amber-300";
  return "text-emerald-400";
}

function weeksSince(iso?: string) {
  if (!iso) return 7;
  const w = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / (7 * 864e5)));
  return w;
}

function demoProject(id: string): Project {
  return {
    id,
    title: "Little Worlds",
    intentStatement:
      "A small interactive world that reacts to whoever is looking at it. Built in the open by mike, with nia on sound.",
    currentState: "Keep night warm in one place. Still needs a designer eye.",
    nextStep: "Friday build night, 8:00 pm. mike is working on the night palette.",
    status: "IN_PROGRESS",
    createdAt: new Date(Date.now() - 7 * 7 * 864e5).toISOString(),
    creator: { handle: "mike" },
    _count: { followers: 312, journeyNodes: 9 },
    journeyNodes: [
      {
        id: "n1",
        position: 1,
        dayLabel: "Week 1",
        phaseTitle: "Idea: a world that notices you",
        summaryText: "Started with presence, not a whole world.",
        updateKind: "MILESTONE",
      },
      {
        id: "n2",
        position: 2,
        dayLabel: "Week 1",
        phaseTitle: "First sky, gradient only",
        summaryText: "Simple gradient sky as the first canvas.",
        updateKind: "MILESTONE",
      },
      {
        id: "n3",
        position: 3,
        dayLabel: "Week 2",
        phaseTitle: "Cursor awareness",
        summaryText: "Sky begins to lean toward the cursor.",
        updateKind: "MILESTONE",
      },
      {
        id: "n4",
        position: 4,
        dayLabel: "Week 3",
        phaseTitle: "Why the clouds looked wrong",
        summaryText: "Photographed clouds felt pasted on.",
        updateKind: "DEAD_END",
        isSetback: true,
      },
      {
        id: "n5",
        position: 5,
        dayLabel: "Week 5",
        phaseTitle: "nia joins, sound begins",
        summaryText: "Sound design starts.",
        updateKind: "MILESTONE",
      },
      {
        id: "n6",
        position: 6,
        dayLabel: "Week 5",
        phaseTitle: "Performance pass",
        summaryText: "Frame budget tightened.",
        updateKind: "MILESTONE",
      },
      {
        id: "n7",
        position: 7,
        dayLabel: "Week 6",
        phaseTitle: "Day and night shift",
        summaryText: "Local-time palette shift.",
        updateKind: "MILESTONE",
        promptShared: true,
      },
      {
        id: "n8",
        position: 8,
        dayLabel: "Week 7",
        phaseTitle: "Cursor trails and light",
        summaryText: "Light follows attention.",
        updateKind: "MILESTONE",
      },
      {
        id: "n9",
        position: 9,
        dayLabel: "Week 7",
        phaseTitle: "Night palette, rough version",
        summaryText: "Get a night palette that is not muddy.",
        evolutionDelta:
          "Dead end: Darkening the day palette: looks dirty\nPartial: Cool blues: better, but flat\nWorked: Adding one warm accent light",
        updateKind: "MILESTONE",
        isSetback: true,
        promptShared: true,
        promptUsed:
          "Suggest three night-time palettes for a violet-to-cyan sky that keep contrast without muddy mid-tones. Give hex values.",
        tools: ["Figma", "Claude"],
        discussions: [
          {
            id: "d1",
            handle: "nia",
            timeLabel: "0:14",
            messageText: "The warm accent helps. Try it lower on the horizon.",
          },
          {
            id: "d2",
            handle: "ada",
            timeLabel: "0:31",
            messageText: "Banding shows around here on my laptop.",
          },
        ],
      },
    ],
  };
}

export default function ProjectJourneyPage({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const { requireAuth } = useOnboarding();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inCircle, setInCircle] = useState(false);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState("");
  const [comment, setComment] = useState("");
  const [playhead, setPlayhead] = useState(0);
  const [useful, setUseful] = useState(false);
  const [triedIt, setTriedIt] = useState(false);
  const [helpItems, setHelpItems] = useState<HelpItem[]>([]);
  const [helpTitle, setHelpTitle] = useState("");
  const [helpBody, setHelpBody] = useState("");
  const [helpError, setHelpError] = useState("");
  const [helpLoading, setHelpLoading] = useState(false);
  const [helpBusy, setHelpBusy] = useState(false);
  const [claimingHelpId, setClaimingHelpId] = useState<string | null>(null);

  const loadHelpRequests = useCallback(async () => {
    setHelpLoading(true);
    setHelpError("");
    try {
      const response = await fetch(`/api/help?projectId=${encodeURIComponent(projectId)}&status=ACTIVE`);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not load help requests.");
      setHelpItems(Array.isArray(result.help) ? result.help : []);
    } catch (error) {
      setHelpError(error instanceof Error ? error.message : "Could not load help requests.");
    } finally {
      setHelpLoading(false);
    }
  }, [projectId]);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    if (isDemoMode() || isDemoProjectId(projectId)) {
      const p = demoJourneyProject(projectId) as any;
      setProject(p);
      setFollowerCount(p._count?.followers ?? 120);
      const nodes = p.journeyNodes || [];
      setSelectedId(nodes[nodes.length - 1]?.id || null);
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(`/api/projects/${encodeURIComponent(projectId)}`);
      if (!r.ok) throw new Error(r.status === 404 ? "This project could not be found." : "Could not load this project.");
      const d = await r.json();
      const p = d.project || d;
      if (p?.id && (p.journeyNodes?.length || p.title)) {
        setProject(p);
        setFollowerCount(typeof p._count?.followers === "number" ? p._count.followers : null);
        const nodes = p.journeyNodes || [];
        setSelectedId(nodes[nodes.length - 1]?.id || null);
      } else {
        throw new Error("This project has no journey data yet.");
      }
    } catch (error) {
      // Soft fallback so demo cards still open a full journey
      if (isDemoProjectId(projectId) || projectId.startsWith("mock-")) {
        const p = demoJourneyProject(projectId) as any;
        setProject(p);
        setFollowerCount(p._count?.followers ?? 120);
        const nodes = p.journeyNodes || [];
        setSelectedId(nodes[nodes.length - 1]?.id || null);
        setLoadError("");
      } else {
        setProject(null);
        setLoadError(error instanceof Error ? error.message : "Could not load this project.");
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
    setInCircle(isInCircle(projectId));
    void loadHelpRequests();
  }, [load, loadHelpRequests, projectId]);

  const nodes = project?.journeyNodes || [];
  const selected = nodes.find((n) => n.id === selectedId) || nodes[nodes.length - 1] || null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!nodes.length || !selected) return;
      const idx = nodes.findIndex((n) => n.id === selected.id);
      if (e.key === "ArrowRight" && idx < nodes.length - 1) setSelectedId(nodes[idx + 1].id);
      if (e.key === "ArrowLeft" && idx > 0) setSelectedId(nodes[idx - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nodes, selected]);

  const tried = useMemo(() => {
    if (selected?.triedAttempts?.length) {
      return selected.triedAttempts.map((a) => ({
        kind:
          a.outcome === "DEAD_END"
            ? "Dead end"
            : a.outcome === "PARTIAL"
              ? "Partial"
              : "Worked",
        text: a.detail,
      }));
    }
    return parseTried(selected?.evolutionDelta);
  }, [selected]);

  const mediaUrl =
    selected?.vodUrl || selected?.liveUrl || selected?.mediaDrops?.[0]?.videoUrl || null;
  const imageUrl =
    selected?.nextSnapshotUrl ||
    selected?.prevSnapshotUrl ||
    selected?.imageUrls?.[0] ||
    selected?.mediaDrops?.[0]?.imageUrl ||
    null;

  const handle = project?.creator?.handle || "mike";
  const myUid = currentUid();
  const isGuest = !myUid;
  let isOwner = false;
  try {
    const onb = JSON.parse(localStorage.getItem("guild.onboarding.v3") || "{}");
    const myHandle = String(onb.name || "").replace(/^@/, "").toLowerCase();
    isOwner =
      (!!myUid && !!project?.creator && (project as any).creatorId === myUid) ||
      (!!myHandle && myHandle === handle.toLowerCase());
  } catch {}

  const weeks = weeksSince(project?.createdAt);
  const followers = followerCount ?? project?._count?.followers;
  const updateCount = nodes.length || project?._count?.journeyNodes || 0;
  const activePhase =
    project?.status === "COMPLETED" ? 3 : project?.status === "PAUSED" ? 1 : 2;

  const postComment = async () => {
    if (!comment.trim() || !selected) return;
    setPosting(true);
    try {
      const uid = currentUid();
      await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journeyNodeId: selected.id,
          userId: uid,
          messageText: comment.trim(),
          type: "COMMENT",
        }),
      });
      setComment("");
      load();
    } catch {}
    setPosting(false);
  };

  const postHelpRequest = async () => {
    if (!project || !isOwner || helpTitle.trim().length < 3) return;
    setHelpBusy(true);
    setHelpError("");
    try {
      const response = await fetch("/api/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          creatorId: myUid,
          title: helpTitle.trim(),
          body: helpBody.trim(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not post the help request.");
      setHelpItems((items) => [result.help as HelpItem, ...items]);
      setHelpTitle("");
      setHelpBody("");
    } catch (error) {
      setHelpError(error instanceof Error ? error.message : "Could not post the help request.");
    } finally {
      setHelpBusy(false);
    }
  };

  const toggleProjectFollow = async () => {
    if (!project) return;
    if (!currentUid()) {
      requireAuth("follow a project journey", () => void toggleProjectFollow());
      return;
    }
    const uid = currentUid();
    if (!uid) {
      setFollowError("Your sign-in has expired. Please sign in again.");
      return;
    }
    setFollowBusy(true);
    setFollowError("");
    try {
      const response = await fetch("/api/follows", {
        method: inCircle ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, projectId: project.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not update your follow.");
      setInCircle(!inCircle);
      if (typeof result.followerCount === "number") setFollowerCount(result.followerCount);
    } catch (error) {
      setFollowError(error instanceof Error ? error.message : "Could not update your follow.");
    } finally {
      setFollowBusy(false);
    }
  };

  const enterWorkRoom = () => {
    navigateToRoute({kind: "room", id: projectId});
  };

  if (loading && !project) {
    return (
      <div className="h-full bg-[var(--page)] grid place-items-center text-[13px] text-[var(--text-muted)]">
        Loading journey…
      </div>
    );
  }
  if (!project) {
    return (
      <div className="absolute inset-0 z-20 grid place-items-center bg-[var(--page)] p-6">
        <div className="max-w-sm text-center">
          <p role="alert" className="text-[14px] text-[var(--text)]">{loadError || "This project is unavailable."}</p>
          <button type="button" onClick={() => void load()} className="mt-4 rounded-full bg-[var(--coral)] px-5 py-2 text-[12px] font-semibold text-white">Try again</button>
          <button type="button" onClick={onClose} className="ml-2 mt-4 rounded-full border border-[var(--line)] px-5 py-2 text-[12px] text-[var(--text-muted)]">Back</button>
        </div>
      </div>
    );
  }

  const discussions: Discussion[] =
    selected?.discussions?.map((d: any) => ({
      id: d.id,
      handle: d.handle || d.user?.handle || "anon",
      messageText: d.messageText || d.message || "",
      timeLabel: d.timeLabel || "0:00",
    })) || [];

    // Newest first for the log list
  const logNodes = [...nodes].sort((a, b) => (b.position || 0) - (a.position || 0));

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#0B0C0E] z-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-4 pb-28 sm:pb-24">
        <button
          type="button"
          onClick={onClose}
          className="mb-4 text-small text-white/45 hover:text-white transition-colors"
        >
          ← Back
        </button>

        {/* Banner — loop video from latest upload, else brand gradient */}
        <header className="mb-6 relative overflow-hidden rounded-xl border border-white/10 min-h-[12rem] sm:min-h-[16rem] shadow-[0_16px_48px_rgba(0,0,0,0.4)]">
          {(() => {
            const latest = logNodes[0];
            const media =
              latest?.mediaDrops?.find((d: any) => d.videoUrl)?.videoUrl ||
              (latest as any)?.mediaUrl ||
              latest?.vodUrl ||
              null;
            const isVideo = media && /\.(mp4|webm|mov)(\?|$)/i.test(media);
            return isVideo ? (
              <video
                src={media}
                muted
                playsInline
                loop
                autoPlay
                preload="metadata"
                className="absolute inset-0 h-full w-full object-cover opacity-70"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#3d2a28] via-[#1a2230] to-[#0e131c]" />
            );
          })()}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C0E] via-[#0B0C0E]/55 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_20%,rgba(255,118,95,0.25),transparent_50%)]" />
          <div className="relative flex flex-col justify-end min-h-[12rem] sm:min-h-[16rem] px-5 sm:px-8 pb-5 sm:pb-6 pt-16">
            <p className="text-caption uppercase tracking-[0.16em] text-white/50 mb-2">Project journey</p>
            <h1 className="text-[1.75rem] sm:text-[2.75rem] font-bold text-white tracking-tight leading-none">
              {project.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => useShellUi.getState().openVault(handle.replace(/^@/, ""))}
                className="text-small text-white/70 hover:text-white hover:underline"
              >
                @{handle}
              </button>
              <span className="text-white/25">·</span>
              <span className="text-small text-white/50">
                {PHASES[Math.min(activePhase, PHASES.length - 1)] || "Alpha"}
              </span>
              <button
                type="button"
                onClick={() => void toggleProjectFollow()}
                disabled={followBusy}
                className="ml-auto shrink-0 rounded-full bg-white text-[#0B0C0E] px-4 py-1.5 text-[12px] font-semibold hover:scale-[1.02] transition"
              >
                {inCircle ? "Following" : "Follow"}
              </button>
            </div>
            {followError && <p role="alert" className="mt-2 text-[12px] text-red-300">{followError}</p>}
          </div>
        </header>

        {/* Horizontal phase rail (Spotify-style left→right) */}
        <div className="mb-6 overflow-x-auto pb-2 -mx-1 px-1">
          <div className="flex items-center gap-0 min-w-min">
            {PHASES.map((phase, i) => {
              const active = i === Math.min(activePhase, PHASES.length - 1);
              return (
                <div key={phase} className="flex items-center shrink-0">
                  {i > 0 && (
                    <div className={`w-8 sm:w-12 h-px ${active || i < activePhase ? "bg-[var(--coral)]/40" : "bg-white/15"}`} />
                  )}
                  <div className="flex flex-col items-center gap-1 min-w-[4rem] max-w-[5.5rem] px-1">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        active
                          ? "bg-[var(--coral)] shadow-[0_0_0_3px_rgba(255,118,95,0.25)]"
                          : i < activePhase
                            ? "bg-[var(--coral)]/50"
                            : "border border-white/30 bg-transparent"
                      }`}
                    />
                    <span className={`text-[11px] text-center leading-tight line-clamp-2 ${active ? "text-white font-medium" : "text-white/40"}`}>
                      {phase}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {logNodes.length === 0 && (
            <p className="py-16 text-center text-small text-white/40">No log entries yet.</p>
          )}
          {logNodes.length > 0 && (() => {
            const ordered = logNodes; // already newest-first
            const [latest, ...rest] = ordered;
            const renderMedia = (n: typeof latest) => {
              const media =
                n.mediaDrops?.find((d: any) => d.videoUrl)?.videoUrl ||
                (n as any).mediaUrl ||
                n.vodUrl ||
                null;
              const isVideo = media && /\.(mp4|webm|mov)(\?|$)/i.test(String(media));
              return { media, isVideo };
            };
            const latestMedia = renderMedia(latest);
            return (
              <>
                {/* Latest update — full information + goal */}
                <section className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
                  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                    <div className="relative aspect-video bg-[#0a0b0d]">
                      {latestMedia.media && latestMedia.isVideo ? (
                        <video
                          src={String(latestMedia.media)}
                          muted
                          playsInline
                          loop
                          preload="metadata"
                          className="absolute inset-0 h-full w-full object-cover"
                          onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
                          onMouseLeave={(e) => {
                            e.currentTarget.pause();
                            try { e.currentTarget.currentTime = 0.05; } catch { /* */ }
                          }}
                          onLoadedMetadata={(e) => {
                            try { e.currentTarget.currentTime = 0.05; } catch { /* */ }
                            e.currentTarget.pause();
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-[#2a3548] to-[#0a0b0d]" />
                      )}
                    </div>
                    <div className="p-4 sm:p-5 flex flex-col gap-2">
                      <p className="text-caption uppercase tracking-[0.14em] text-[var(--coral)]">Latest update</p>
                      <h2 className="text-h3 text-white">
                        {latest.updateTitle || latest.phaseTitle || latest.dayLabel || `Update ${latest.position}`}
                      </h2>
                      <p className="text-small text-white/45">
                        {latest.dayLabel || `Log #${String(latest.position).padStart(3, "0")}`}
                        {latest.phaseTitle ? ` · ${latest.phaseTitle}` : ""}
                      </p>
                      <p className="text-body text-white/80 leading-relaxed mt-1">
                        {latest.summaryText || project.currentState || "No summary yet."}
                      </p>
                      {(latest as any).target || project.currentState ? (
                        <p className="mt-2 rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-small text-white/70">
                          <span className="text-white/40">Goal · </span>
                          {(latest as any).target || project.currentState}
                        </p>
                      ) : null}
                      {(latest.vodUrl || latest.liveUrl) && (
                        <a
                          href={latest.vodUrl || latest.liveUrl || undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-auto text-small text-sky-300/80 hover:text-sky-200 underline w-fit"
                        >
                          Open full VOD
                        </a>
                      )}
                    </div>
                  </div>
                </section>

                {/* Earlier updates — compact horizontal rows */}
                {rest.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-caption uppercase tracking-[0.14em] text-white/40 px-1">Earlier updates</p>
                    {rest.map((n) => {
                      const { media, isVideo } = renderMedia(n);
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => setSelectedId(n.id)}
                          className="w-full flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] px-2.5 py-2 text-left transition"
                        >
                          <div className="relative h-14 w-24 shrink-0 rounded-md overflow-hidden bg-[#0a0b0d]">
                            {media && isVideo ? (
                              <video
                                src={String(media)}
                                muted
                                playsInline
                                preload="metadata"
                                className="absolute inset-0 h-full w-full object-cover"
                                onLoadedMetadata={(e) => {
                                  try { e.currentTarget.currentTime = 0.05; } catch { /* */ }
                                  e.currentTarget.pause();
                                }}
                              />
                            ) : (
                              <div className="absolute inset-0 bg-gradient-to-br from-[#1b2532] to-[#0a0b0d]" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-small font-medium text-white truncate">
                              {n.updateTitle || n.phaseTitle || n.dayLabel || `Update ${n.position}`}
                            </p>
                            <p className="text-caption text-white/40 truncate mt-0.5">
                              {n.dayLabel || `#${n.position}`}
                              {n.summaryText ? ` · ${n.summaryText}` : ""}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Owner help request — keep capability, quieter chrome */}
        {isOwner && (
          <div className="mt-8 rounded-xl border border-white/10 p-4 space-y-3">
            <p className="text-[11px] uppercase tracking-wider text-white/45">Ask for a hand</p>
            <input
              value={helpTitle}
              onChange={(e) => setHelpTitle(e.target.value)}
              placeholder="What are you stuck on?"
              className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[13px] text-white outline-none focus:border-white/30"
            />
            <textarea
              value={helpBody}
              onChange={(e) => setHelpBody(e.target.value)}
              rows={2}
              placeholder="Optional context"
              className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-[13px] text-white outline-none focus:border-white/30"
            />
            {helpError && <p role="alert" className="text-[12px] text-red-300">{helpError}</p>}
            <button
              type="button"
              disabled={helpBusy || helpTitle.trim().length < 3}
              onClick={() => void postHelpRequest()}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] uppercase tracking-wider text-white/80 disabled:opacity-40"
            >
              {helpBusy ? "Posting…" : "Post help request"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
