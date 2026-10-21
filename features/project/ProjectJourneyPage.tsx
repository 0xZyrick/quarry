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
      <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-4 pb-24 font-mono">
        <button
          type="button"
          onClick={onClose}
          className="mb-4 text-[12px] text-white/45 hover:text-white"
        >
          ← Back
        </button>

        {/* Wireframe header */}
        <header className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 text-[13px] sm:text-[14px] text-white tracking-wide">
              <span className="font-semibold uppercase">{project.title}</span>
              <span className="text-white/40"> · By </span>
              <button
                type="button"
                onClick={() => useShellUi.getState().openVault(handle.replace(/^@/, ""))}
                className="text-white/70 hover:text-white hover:underline"
              >
                @{handle}
              </button>
              <span className="text-white/40"> · </span>
              <span className="text-white/55">
                [Lifecycle: {PHASES[Math.min(activePhase, PHASES.length - 1)] || "Alpha"} Node]
              </span>
            </div>
            <button
              type="button"
              onClick={() => void toggleProjectFollow()}
              disabled={followBusy}
              className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-[11px] uppercase tracking-wider text-white/80 hover:border-white/50 hover:text-white"
            >
              {inCircle ? "Following" : "+ Follow Journey"}
            </button>
          </div>
          {followError && <p role="alert" className="mt-2 text-[11px] text-red-300">{followError}</p>}
        </header>

        {/* Chronological log entries */}
        <div className="space-y-5">
          {logNodes.length === 0 && (
            <p className="py-16 text-center text-[13px] text-white/40">No log entries yet.</p>
          )}
          {logNodes.map((n) => {
            const tried = parseTried(n.evolutionDelta);
            const attempts = (n.triedAttempts || []).map((a) => ({
              kind: a.outcome || "Tried",
              text: a.detail || "",
            }));
            const decisions = attempts.length ? attempts : tried;
            const media =
              n.vodUrl ||
              n.liveUrl ||
              n.mediaDrops?.[0]?.videoUrl ||
              n.mediaDrops?.[0]?.imageUrl ||
              n.nextSnapshotUrl ||
              n.imageUrls?.[0] ||
              null;
            const isVideo = !!(media && /\.(mp4|webm|mov)(\?|$)/i.test(media));
            const active = selected?.id === n.id;
            return (
              <section
                key={n.id}
                className={`rounded-xl border ${
                  active ? "border-white/40 bg-white/[0.03]" : "border-white/20"
                } overflow-hidden`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(n.id)}
                  className="w-full px-4 py-2.5 text-left text-[12px] sm:text-[13px] text-white/90 border-b border-white/10 hover:bg-white/[0.02]"
                >
                  <span className="text-white/50">[ LOG #{String(n.position).padStart(3, "0")} ]</span>
                  <span className="text-white/40"> — </span>
                  <span>{n.dayLabel || `Update ${n.position}`}</span>
                  <span className="text-white/40"> · </span>
                  <span className="font-medium">&ldquo;{n.updateTitle || n.phaseTitle}&rdquo;</span>
                </button>

                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-0">
                  {/* 15s autoplaying canvas / video reel */}
                  <div className="relative aspect-video bg-[#0a0b0d] border-b md:border-b-0 md:border-r border-white/10">
                    {media ? (
                      isVideo ? (
                        <video
                          src={media}
                          muted
                          playsInline
                          loop
                          autoPlay={active}
                          className="absolute inset-0 h-full w-full object-cover"
                          onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
                          onMouseLeave={(e) => {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0;
                          }}
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={media} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      )
                    ) : (
                      <div className="absolute inset-0 grid place-items-center text-[11px] text-white/30 uppercase tracking-wider">
                        [ 15s autoplaying canvas video reel ]
                      </div>
                    )}
                    <p className="absolute bottom-2 left-2 text-[10px] text-white/40 bg-black/40 px-1.5 py-0.5 rounded">
                      Hover to scrub or play full VOD
                    </p>
                  </div>

                  {/* Decision log */}
                  <div className="p-4 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                      Decision log
                    </p>
                    <ul className="space-y-1.5 text-[12px] text-white/70 leading-relaxed">
                      <li>
                        <span className="text-white/40">· Goal: </span>
                        {n.summaryText || "Ship this stop cleanly."}
                      </li>
                      {decisions.map((d, i) => (
                        <li key={i}>
                          <span className="text-white/40">· {d.kind}: </span>
                          {d.text}
                        </li>
                      ))}
                      {!decisions.length && project.currentState && active && (
                        <li>
                          <span className="text-white/40">· Decision: </span>
                          {project.currentState}
                        </li>
                      )}
                    </ul>
                    {(n.vodUrl || n.liveUrl) && (
                      <a
                        href={n.vodUrl || n.liveUrl || undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block mt-2 text-[11px] text-sky-300/80 hover:text-sky-200 underline"
                      >
                        Open full VOD
                      </a>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
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
