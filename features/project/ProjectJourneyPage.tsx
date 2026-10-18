"use client";
/**
 * Project journey — process-first record matching the production sample.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { isInCircle, currentUid } from "@/lib/circle";
import { useShellUi } from "@/lib/shellUi";
import { navigateToRoute } from "@/lib/appRoutes";

type MediaDrop = { id?: string; videoUrl?: string | null; imageUrl?: string | null };
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
      setProject(null);
      setLoadError(error instanceof Error ? error.message : "Could not load this project.");
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
    if (isGuest) {
      window.dispatchEvent(new CustomEvent("wippo:auth", { detail: "follow a project journey" }));
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

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[var(--page)] z-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-4 pb-20">
        <button
          type="button"
          onClick={onClose}
          className="mb-4 text-[12px] text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          ← Back
        </button>
        {/* Header */}
        <header className="mb-5 rounded-3xl border border-[var(--line)] bg-[radial-gradient(ellipse_at_top_right,rgba(255,118,95,.10),transparent_48%),linear-gradient(145deg,var(--surface),rgba(14,19,28,.54))] p-4 sm:p-6">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--text-faint)] uppercase">
            Project journey
          </p>
          <div className="mt-1 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[26px] sm:text-[34px] font-semibold text-[var(--text)] tracking-tight">
                {project.title}
              </h1>
              <p className="text-[13px] sm:text-[14px] text-[var(--text-muted)] mt-2 max-w-2xl leading-relaxed">
                {project.intentStatement || "Built in the open."}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] sm:text-[12px] text-[var(--text-faint)]">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-2.5 py-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${project.status === "COMPLETED" ? "bg-emerald-400" : project.status === "PAUSED" ? "bg-amber-400" : "bg-sky-400"}`} />
                  {project.status === "COMPLETED" ? "Complete" : project.status === "PAUSED" ? "Paused" : "In progress"}
                </span>
                <span>{updateCount} updates</span>
                {typeof followers === "number" && <span>{followers} following</span>}
                <span>{weeks} weeks</span>
                <button
                  type="button"
                  onClick={() => useShellUi.getState().openVault(handle.replace(/^@/, ""))}
                  className="hover:text-[var(--text)] hover:underline"
                >
                  by @{handle}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={enterWorkRoom}
                className="rounded-full bg-[var(--coral)] px-4 py-2.5 text-[12px] font-semibold text-white shadow-[0_8px_24px_rgba(255,118,95,.16)] hover:brightness-110"
              >
                Enter work room
              </button>
            </div>
          </div>
        </header>

        {/* Lifecycle */}
        <div className="grid grid-cols-4 gap-1 mb-6">
          {PHASES.map((label, i) => (
            <div
              key={label}
              className={`rounded-lg border px-2 py-2.5 text-center text-[11px] sm:text-[12px] ${
                i === activePhase
                  ? "border-[var(--coral)] text-[var(--text)] bg-[var(--coral)]/10"
                  : "border-[var(--line)] text-[var(--text-faint)]"
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_16.5rem] gap-6">
          {/* Main */}
          <div className="min-w-0 space-y-5">
            {/* Scrubber */}
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-[12px] text-[var(--text-muted)]">
                  Update{" "}
                  <span className="text-[var(--text)] font-medium">
                    {selected ? selected.position : "—"} of {nodes.length}
                  </span>
                </p>
                <p className="text-[11px] text-[var(--text-faint)]">{selected?.dayLabel}</p>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {nodes.map((n) => {
                  const active = selected?.id === n.id;
                  const setback = n.isSetback || n.updateKind === "DEAD_END";
                  const prompt = n.promptShared || !!n.promptUsed;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => setSelectedId(n.id)}
                      className={`relative w-9 h-9 rounded-lg text-[12px] font-medium border ${
                        active
                          ? "bg-[var(--coral)] border-[var(--coral)] text-white"
                          : "border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--line-strong)]"
                      }`}
                    >
                      {n.position}
                      {setback && (
                        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-400" />
                      )}
                      {prompt && !setback && (
                        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] text-[var(--text-faint)] flex flex-wrap gap-3">
                <span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1" />
                  Setback
                </span>
                <span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1" />
                  Prompt shared
                </span>
                <span>Use ← → to move between updates</span>
              </p>
            </div>

            {/* Media */}
            <div className="relative aspect-video rounded-2xl overflow-hidden border border-[var(--line)] bg-[#0c0c0e]">
              {mediaUrl ? (
                mediaUrl.includes("youtube") || mediaUrl.includes("twitch") || mediaUrl.includes("embed") ? (
                  <iframe title="Update media" src={mediaUrl} className="absolute inset-0 w-full h-full border-0" allowFullScreen />
                ) : (
                  <video src={mediaUrl} controls className="absolute inset-0 w-full h-full object-cover" />
                )
              ) : imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt={`Work update: ${selected?.phaseTitle || project.title}`} className="absolute inset-0 w-full h-full object-contain" />
              ) : (
                <div className="absolute inset-0 grid place-items-center">
                  <span className="text-[12px] text-white/40">No media attached to this update</span>
                </div>
              )}
              {mediaUrl && (
                <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-black/60 to-transparent flex items-end px-3 pb-2">
                  <input
                    type="range"
                    min={0}
                    max={48}
                    value={playhead}
                    onChange={(e) => setPlayhead(Number(e.target.value))}
                    className="w-full accent-[var(--coral)] h-1"
                    aria-label="Video update position"
                  />
                </div>
              )}
            </div>

            {/* How I built it */}
            {selected && (
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5 space-y-5">
                {(selected.isSetback || selected.updateKind === "DEAD_END") && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-red-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    Setback
                  </span>
                )}
                <div>
                  <h2 className="text-[18px] font-semibold text-[var(--text)]">{selected.phaseTitle}</h2>
                  <p className="text-[12px] text-[var(--text-faint)] mt-1">
                    {selected.dayLabel}
                    {selected.summaryText ? ` · ${selected.summaryText.slice(0, 80)}` : ""}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold tracking-wider text-[var(--text-faint)] uppercase">Goal</p>
                  <p className="text-[13px] text-[var(--text-muted)] mt-1 leading-relaxed">
                    {selected.summaryText || "Ship this stop cleanly."}
                  </p>
                </div>

                {tried.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-wider text-[var(--text-faint)] uppercase mb-2">
                      What was tried
                    </p>
                    <ul className="space-y-2">
                      {tried.map((row, i) => (
                        <li key={i} className="flex gap-3 text-[13px]">
                          <span className={`shrink-0 w-16 font-medium ${kindColor(row.kind)}`}>{row.kind}</span>
                          <span className="text-[var(--text-muted)]">{row.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {project.currentState && (
                  <div>
                    <p className="text-[10px] font-semibold tracking-wider text-[var(--text-faint)] uppercase">
                      Decision
                    </p>
                    <p className="text-[13px] text-[var(--text-muted)] mt-1 leading-relaxed">
                      {project.currentState}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-semibold tracking-wider text-[var(--text-faint)] uppercase">
                    Prompt used
                  </p>
                  <div className="mt-1.5 flex gap-2 items-start rounded-xl border border-[var(--line)] bg-[var(--page)] px-3 py-2.5">
                    <p className="flex-1 text-[12px] text-[var(--text-muted)] font-mono leading-relaxed">
                      {selected.promptUsed || "No prompt logged on this update."}
                    </p>
                    {selected.promptUsed && (
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(selected.promptUsed || "")}
                        className="shrink-0 text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] border border-[var(--line)] rounded-md px-1.5 py-0.5"
                      >
                        Copy
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold tracking-wider text-[var(--text-faint)] uppercase mb-1.5">
                    Tools
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(selected.tools?.length ? selected.tools : ["Figma", "Claude"]).map((tool) => (
                      <span
                        key={tool}
                        className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--text-muted)]"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1 text-[12px]">
                  <span className="text-[var(--text-faint)]">Was this useful?</span>
                  <button
                    type="button"
                    onClick={() => setUseful((v) => !v)}
                    className={`rounded-full border px-3 py-1 ${
                      useful
                        ? "border-[var(--coral)] text-[var(--coral)]"
                        : "border-[var(--line)] text-[var(--text-muted)]"
                    }`}
                  >
                    Useful{useful ? " · you" : " (24)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTriedIt((v) => !v)}
                    className={`rounded-full border px-3 py-1 ${
                      triedIt
                        ? "border-emerald-500/50 text-emerald-300"
                        : "border-[var(--line)] text-[var(--text-muted)]"
                    }`}
                  >
                    Tried it{triedIt ? " · you" : " (6)"}
                  </button>
                </div>
              </div>
            )}

            {/* Discussion */}
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--text)] mb-3">Discussion on this update</h3>
              <ul className="space-y-3 mb-4">
                {discussions.map((d) => (
                  <li key={d.id} className="flex gap-2.5">
                    <span className="w-7 h-7 rounded-full bg-white/10 grid place-items-center text-[10px] font-bold text-white shrink-0">
                      {(d.handle || "?")[0].toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[12px] font-medium text-[var(--text)]">{d.handle}</span>
                        <button
                          type="button"
                          onClick={() => setPlayhead(14)}
                          className="text-[11px] text-[var(--coral)] hover:underline"
                        >
                          {d.timeLabel || "0:00"}
                        </button>
                      </div>
                      <p className="text-[13px] text-[var(--text-muted)] mt-0.5">{d.messageText}</p>
                    </div>
                  </li>
                ))}
                {discussions.length === 0 && (
                  <p className="text-[12px] text-[var(--text-faint)]">No comments on this update yet.</p>
                )}
              </ul>
              <div className="flex gap-2">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Comment at the current moment"
                  className="flex-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
                  onKeyDown={(e) => e.key === "Enter" && postComment()}
                />
                <button
                  type="button"
                  disabled={posting || !comment.trim()}
                  onClick={postComment}
                  className="rounded-full bg-[var(--coral)] px-4 py-2.5 text-[12px] font-semibold text-white disabled:opacity-40"
                >
                  Post at {String(Math.floor(playhead / 60)).padStart(1, "0")}:
                  {String(playhead % 60).padStart(2, "0")}
                </button>
              </div>
            </div>

            {/* All updates table */}
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--text)] mb-3">All updates</h3>
              <ul className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-2xl overflow-hidden">
                {[...nodes].reverse().map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(n.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] ${
                        selected?.id === n.id ? "bg-white/[0.04]" : ""
                      }`}
                    >
                      <span className="text-[12px] text-[var(--text-faint)] tabular-nums w-6">
                        {String(n.position).padStart(2, "0")}
                      </span>
                      <span className="flex-1 text-[13px] text-[var(--text)] truncate">{n.phaseTitle}</span>
                      <span className="text-[11px] text-[var(--text-faint)] shrink-0">{n.dayLabel}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Side panel */}
          <aside className="space-y-3 lg:sticky lg:top-4 self-start">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              {isOwner ? (
                <p className="text-[13px] text-[var(--text-muted)]">This is your journey.</p>
              ) : isGuest ? (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      window.dispatchEvent(new CustomEvent("wippo:auth", { detail: "follow this project journey" }));
                    } catch {}
                    onClose();
                  }}
                  className="w-full rounded-full bg-[var(--coral)] py-2.5 text-[13px] font-semibold text-white"
                >
                  Sign in to follow
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void toggleProjectFollow()}
                    disabled={followBusy}
                    className={`w-full rounded-full py-2.5 text-[13px] font-semibold ${
                      inCircle
                        ? "border border-[var(--line)] text-[var(--text)]"
                        : "bg-[var(--coral)] text-white"
                    }`}
                  >
                    {followBusy ? "Updating…" : inCircle ? "Following · Unfollow" : "Follow this journey"}
                  </button>
                  {followError && <p role="alert" className="mt-2 text-[11px] text-red-400">{followError}</p>}
                  <p className="text-[11px] text-[var(--text-faint)] mt-2 leading-relaxed">
                    You will see each new update in Circle. Unfollow any time.
                  </p>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="text-[12px] font-semibold text-[var(--text)]">Next working session</p>
              <p className="text-[12px] text-[var(--text-muted)] mt-1.5 leading-relaxed">
                {project.nextStep || "Friday build night, 8:00 pm."}
              </p>
              <button
                type="button"
                onClick={enterWorkRoom}
                className="mt-3 w-full rounded-full border border-[var(--line)] py-2 text-[12px] text-[var(--text)]"
              >
                Step into the work room
              </button>
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3">
              <p className="text-[12px] font-semibold text-[var(--text)]">Help wanted</p>
              {helpLoading && <p className="text-[12px] text-[var(--text-faint)]">Checking for open asks…</p>}
              {helpItems.length === 0 && !helpLoading && !helpError && <p className="text-[12px] text-[var(--text-faint)]">No open asks on this project.</p>}
              {helpItems.map((h) => (
                <div key={h.id} className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[12px] text-[var(--text)]">{h.title}</p>
                    {h.body && <p className="mt-1 text-[11px] text-[var(--text-muted)]">{h.body}</p>}
                    {h.tags[0] && <p className="text-[10px] text-[var(--text-faint)]">{h.tags.join(" · ")}</p>}
                    {h.status === "IN_PROGRESS" && (
                      <p className="mt-1 text-[10px] text-[var(--growth)]">
                        {h.claimedByHandle ? `@${h.claimedByHandle} offered to help` : "A builder offered to help"}
                      </p>
                    )}
                  </div>
                  {h.status === "OPEN" && !isOwner && <button
                    type="button"
                    disabled={claimingHelpId === h.id}
                    onClick={async () => {
                      if (isGuest) {
                        window.dispatchEvent(new CustomEvent("wippo:auth", { detail: "offer to help on a project" }));
                        return;
                      }
                      setClaimingHelpId(h.id);
                      setHelpError("");
                      try {
                        const response = await fetch("/api/help", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: h.id, claim: true }),
                        });
                        const result = await response.json().catch(() => ({}));
                        if (!response.ok) throw new Error(result.error || "Could not claim this ask.");
                        setHelpItems((items) => items.map((item) => item.id === h.id ? result.help as HelpItem : item));
                        enterWorkRoom();
                      } catch (error) {
                        setHelpError(error instanceof Error ? error.message : "Could not claim this ask.");
                      } finally {
                        setClaimingHelpId(null);
                      }
                    }}
                    className="text-[11px] text-[var(--coral)] shrink-0 disabled:opacity-50"
                  >
                    {claimingHelpId === h.id ? "Offering…" : "Offer help"}
                  </button>}
                </div>
              ))}
              {isOwner && (
                <div className="border-t border-[var(--line)] pt-3 space-y-2">
                  <p className="text-[11px] text-[var(--text-muted)]">Ask the community</p>
                  <input value={helpTitle} onChange={(event) => setHelpTitle(event.target.value)} maxLength={120} placeholder="What are you stuck on?" className="w-full rounded-lg border border-[var(--line)] bg-[var(--page)] px-3 py-2 text-[12px] text-[var(--text)]" />
                  <textarea value={helpBody} onChange={(event) => setHelpBody(event.target.value)} maxLength={500} rows={2} placeholder="Add context or what you have tried (optional)" className="w-full rounded-lg border border-[var(--line)] bg-[var(--page)] px-3 py-2 text-[12px] text-[var(--text)]" />
                  <button type="button" disabled={helpBusy || helpTitle.trim().length < 3} onClick={() => void postHelpRequest()} className="w-full rounded-full bg-[var(--coral)] py-2 text-[12px] font-semibold text-white disabled:opacity-40">{helpBusy ? "Posting…" : "Post a help request"}</button>
                </div>
              )}
              {helpError && (
                <div role="alert" className="text-[11px] text-red-400">
                  <p>{helpError}</p>
                  <button type="button" onClick={() => void loadHelpRequests()} className="mt-1 text-[var(--coral)] hover:underline">
                    Try again
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="text-[12px] font-semibold text-[var(--text)] mb-2">Contributors</p>
              <ul className="space-y-2.5">
                <li className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-violet-500/80 grid place-items-center text-[10px] font-bold text-white">
                    {(handle || "M")[0].toUpperCase()}
                  </span>
                  <div>
                    <p className="text-[12px] text-[var(--text)]">{handle}</p>
                    <p className="text-[10px] text-[var(--text-faint)]">Creator</p>
                  </div>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-teal-500/80 grid place-items-center text-[10px] font-bold text-white">
                    N
                  </span>
                  <div>
                    <p className="text-[12px] text-[var(--text)]">nia</p>
                    <p className="text-[10px] text-[var(--text-faint)]">Sound design</p>
                  </div>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-orange-500/80 grid place-items-center text-[10px] font-bold text-white">
                    A
                  </span>
                  <div>
                    <p className="text-[12px] text-[var(--text)]">ada</p>
                    <p className="text-[10px] text-[var(--text-faint)]">Reviewed shaders</p>
                  </div>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
