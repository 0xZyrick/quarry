"use client";
/**
 * Contextual Live Workspace — canvas-first room.
 * Journey rail prefers real Project.journeyNodes; falls back to demo steps.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useGuild, useRoomSecurity } from "@/lib/store";
import { NODES, cardLine } from "@/lib/map";
import { useHubs } from "@/lib/hubs";
import { useChat, connectChat } from "@/lib/chat";
import { isInCircle, currentUid } from "@/lib/circle";
import { useShellUi } from "@/lib/shellUi";
import { parseStreamUrl } from "@/lib/streamEmbed";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";

type RailTab = "chat" | "work" | "about";

type JourneyStep = {
  id: string;
  label: string;
  current?: boolean;
  summary?: string;
};

type ProjectPayload = {
  id: string;
  creatorId?: string;
  title: string;
  intentStatement?: string;
  currentState?: string | null;
  nextStep?: string | null;
  creator?: { handle?: string | null };
  journeyNodes?: {
    id: string;
    position: number;
    dayLabel: string;
    phaseTitle: string;
    summaryText: string;
    evolutionDelta?: string | null;
    liveUrl?: string | null;
    vodUrl?: string | null;
    sessionEndedAt?: string | null;
    nextSnapshotUrl?: string | null;
    prevSnapshotUrl?: string | null;
    mediaDrops?: { imageUrl?: string | null; nextSnapshotUrl?: string | null; prevSnapshotUrl?: string | null }[];
  }[];
};

type HelpRequest = {
  id: string;
  title: string;
  body?: string | null;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  tags: string[];
  claimedById?: string | null;
  claimedByHandle?: string | null;
};

const PROMPTS = ["How did you build that?", "Can I help?", "Show the code"];

function stepsFromProject(p: ProjectPayload | null): JourneyStep[] {
  const nodes = p?.journeyNodes;
  if (!nodes?.length) return [];
  return nodes.map((n, i) => ({
    id: n.id,
    label: n.phaseTitle || n.dayLabel || `Step ${i + 1}`,
    current: i === nodes.length - 1,
    summary: n.summaryText || n.evolutionDelta || undefined,
  }));
}

export default function LiveRoom() {
  const { layer, roomId, setLayer } = useGuild();
  const { signedIn, ready } = useOnboarding();
  const sec = useRoomSecurity();
  const meta = useHubs((s) => s.meta[roomId]);
  const node = NODES.find((n) => n.id === roomId) ?? NODES[0];

  const [project, setProject] = useState<ProjectPayload | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [sendError, setSendError] = useState("");
  const [followError, setFollowError] = useState("");
  const [projectFollowerCount, setProjectFollowerCount] = useState<number | null>(null);
  const [helpItems, setHelpItems] = useState<HelpRequest[]>([]);
  const [helpLoading, setHelpLoading] = useState(false);
  const [helpError, setHelpError] = useState("");
  const [helpActionError, setHelpActionError] = useState("");
  const [helpTitle, setHelpTitle] = useState("");
  const [helpBody, setHelpBody] = useState("");
  const [helpBusy, setHelpBusy] = useState(false);
  const [claimingHelpId, setClaimingHelpId] = useState<string | null>(null);

  const hostName =
    project?.creator?.handle || meta?.handle || node?.name || "host";
  const title =
    project?.title || meta?.title || cardLine(node) || "Live project";
  const statusLine =
    project?.currentState ||
    project?.nextStep ||
    "tuning the sky so it reacts to who walks in";

  const [tab, setTab] = useState<RailTab>("chat");
  const [text, setText] = useState("");
  const [inCircle, setInCircleState] = useState(false);
  const [joinedRoomId, setJoinedRoomId] = useState<string | null>(null);
  const joined = signedIn && joinedRoomId === roomId;
  const chatLogRef = useRef<HTMLDivElement>(null);

  const log = useChat((s) => s.log);
  const chatConnection = useChat((s) => s.connection);
  const roomLog = useMemo(
    () => log.filter((m) => m.room === roomId && m.kind !== "system"),
    [log, roomId]
  );

  useEffect(() => {
    setJoinedRoomId(null);
  }, [roomId]);

  useEffect(() => {
    if (!signedIn) setJoinedRoomId(null);
  }, [signedIn]);

  const steps = useMemo(() => stepsFromProject(project), [project]);
  const activeLiveUrl = useMemo(() => {
    const nodes = project?.journeyNodes || [];
    const liveNode = [...nodes].reverse().find((n) => n.liveUrl && !n.sessionEndedAt);
    return liveNode?.liveUrl || null;
  }, [project]);
  const replayUrl = useMemo(() => {
    const nodes = project?.journeyNodes || [];
    const withVod = [...nodes].reverse().find((n) => n.vodUrl);
    return withVod?.vodUrl || null;
  }, [project]);

  const [peerCount, setPeerCount] = useState(0);
  const [presenceError, setPresenceError] = useState("");
  const [presenceActionError, setPresenceActionError] = useState("");
  const [presenceBusy, setPresenceBusy] = useState(false);
  const [peers, setPeers] = useState<{ userId: string; handle?: string | null }[]>([]);
  const joinLabel = joined ? "Leave the table" : !ready ? "Sign in to join" : signedIn ? "Join the table" : "Sign in to join";
  const shortJoinLabel = joined ? "Leave" : ready && signedIn ? "Join" : "Sign in";

  useEffect(() => {
    if (!roomId) return;
    let stop = false;

    const loadPresence = async () => {
      try {
        const r2 = await fetch(`/api/presence?roomId=${encodeURIComponent(roomId)}`);
        const d2 = await r2.json().catch(() => ({}));
        if (!r2.ok) throw new Error(d2.error || "Could not load room presence.");
        if (!stop) {
          setPeerCount(d2.count || 0);
          setPeers(d2.peers || []);
          setPresenceError("");
        }
      } catch (error) {
        if (!stop) setPresenceError(error instanceof Error ? error.message : "Could not load room presence.");
      }
    };

    void loadPresence();
    const id = window.setInterval(loadPresence, 15000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !signedIn || !joined) return;
    let stop = false;

    const heartbeat = async () => {
      try {
        const response = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Could not update room presence.");
        if (!stop) setPresenceActionError("");
      } catch (error) {
        if (!stop) setPresenceActionError(error instanceof Error ? error.message : "Could not update room presence.");
      }
    };

    void heartbeat();
    const id = window.setInterval(heartbeat, 15000);
    return () => {
      stop = true;
      window.clearInterval(id);
      fetch("/api/presence", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      }).catch((error) => console.error("Could not clear room presence", error));
    };
  }, [roomId, joined, signedIn]);

  const toggleRoomPresence = async () => {
    if (!signedIn) {
      window.dispatchEvent(new CustomEvent("wippo:auth"));
      return;
    }
    if (!roomId || presenceBusy) return;

    setPresenceBusy(true);
    setPresenceActionError("");
    try {
      const response = await fetch("/api/presence", {
        method: joined ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || (joined ? "Could not leave the room." : "Could not join the room."));
      setJoinedRoomId(joined ? null : roomId);
      if (typeof result.count === "number") setPeerCount(result.count);
    } catch (error) {
      setPresenceActionError(error instanceof Error ? error.message : "Could not update room presence.");
    } finally {
      setPresenceBusy(false);
    }
  };

  const embed = useMemo(
    () => parseStreamUrl(activeLiveUrl || replayUrl || undefined),
    [activeLiveUrl, replayUrl]
  );
  const currentStep = steps.find((s) => s.current) || steps[steps.length - 1];
  const isProjectOwner = !!currentUid() && currentUid() === project?.creatorId;

  // Load journey when roomId looks like a project (uuid or demo id)
  useEffect(() => {
    let cancelled = false;
    const id = roomId;
    if (!id) return;
    setProjectLoading(true);
    setProjectError("");
    fetch(`/api/projects/${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "This project is no longer available." : "Could not load this project.");
        const d = await r.json();
        return (d.project || d) as ProjectPayload;
      })
      .then((p) => {
        if (!cancelled) {
          setProject(p);
          setProjectError("");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setProject(null);
          setProjectError(error instanceof Error ? error.message : "Could not load this project.");
        }
      })
      .finally(() => {
        if (!cancelled) setProjectLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useEffect(() => {
    if (!project?.id) {
      setProjectFollowerCount(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/follows?projectId=${encodeURIComponent(project.id)}&counts=1`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load followers.");
        const result = await response.json();
        if (!cancelled && typeof result.followerCount === "number") {
          setProjectFollowerCount(result.followerCount);
        }
      })
      .catch((error) => console.error("Could not load project follower count", error));
    return () => {
      cancelled = true;
    };
  }, [project?.id]);

  useEffect(() => {
    if (!project?.id || layer !== 2 || tab !== "work") {
      setHelpLoading(false);
      return;
    }
    const projectId = project.id;
    let cancelled = false;

    const loadHelp = async () => {
      if (!cancelled) setHelpLoading(true);
      try {
        const response = await fetch(`/api/help?projectId=${encodeURIComponent(projectId)}&status=ACTIVE`);
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Could not load project help requests.");
        if (!cancelled) {
          setHelpItems(Array.isArray(result.help) ? result.help : []);
          setHelpError("");
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setHelpError(error instanceof Error ? error.message : "Could not load project help requests.");
        }
      } finally {
        if (!cancelled) setHelpLoading(false);
      }
    };

    void loadHelp();
    const interval = window.setInterval(loadHelp, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [project?.id, layer, tab]);

  useEffect(() => {
    if (!project?.id) {
      setHelpItems([]);
      setHelpError("");
    }
  }, [project?.id]);

  useEffect(() => {
    connectChat(roomId);
  }, [roomId]);

  useEffect(() => {
    const chatLog = chatLogRef.current;
    if (layer !== 2 || !chatLog) return;
    chatLog.scrollTop = chatLog.scrollHeight;
  }, [layer, roomLog.length]);

  useEffect(() => {
    setInCircleState(isInCircle(roomId));
  }, [roomId]);

  const latestNode = project?.journeyNodes?.[project.journeyNodes.length - 1];
  const previewUrl =
    latestNode?.mediaDrops?.[0]?.imageUrl ||
    latestNode?.mediaDrops?.[0]?.nextSnapshotUrl ||
    latestNode?.nextSnapshotUrl ||
    latestNode?.mediaDrops?.[0]?.prevSnapshotUrl ||
    latestNode?.prevSnapshotUrl ||
    null;

  const send = async () => {
    const body = text.trim();
    if (body.length < 1) return;
    if (!signedIn) {
      window.dispatchEvent(new CustomEvent("wippo:auth", { detail: "join the room conversation" }));
      return;
    }
    setSendError("");
    const sent = await useChat.getState().say(roomId, sec.self || "you", body);
    if (sent) setText("");
    else setSendError(useChat.getState().error || "Message could not be sent.");
  };

  const postHelpRequest = async () => {
    if (!project || !isProjectOwner || helpTitle.trim().length < 3) return;
    setHelpBusy(true);
    setHelpActionError("");
    try {
      const response = await fetch("/api/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          title: helpTitle.trim(),
          body: helpBody.trim(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not post the help request.");
      setHelpItems((items) => [result.help, ...items]);
      setHelpTitle("");
      setHelpBody("");
    } catch (error) {
      setHelpActionError(error instanceof Error ? error.message : "Could not post the help request.");
    } finally {
      setHelpBusy(false);
    }
  };

  const claimHelpRequest = async (helpId: string) => {
    if (!signedIn) {
      window.dispatchEvent(new CustomEvent("wippo:auth", { detail: "offer to help on this project" }));
      return;
    }
    setClaimingHelpId(helpId);
    setHelpActionError("");
    try {
      const response = await fetch("/api/help", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: helpId, claim: true }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not claim this request.");
      const claimed = result.help as HelpRequest;
      setHelpItems((items) => items.map((item) => item.id === helpId ? claimed : item));
    } catch (error) {
      setHelpActionError(error instanceof Error ? error.message : "Could not claim this request.");
    } finally {
      setClaimingHelpId(null);
    }
  };

  const onCircle = async () => {
    if (!signedIn) {
      window.dispatchEvent(new CustomEvent("wippo:auth", { detail: "follow a project journey" }));
      return;
    }
    const projectId = project?.id || roomId;
    const userId = currentUid();
    if (!userId) {
      window.dispatchEvent(new CustomEvent("wippo:auth", { detail: "follow a project journey" }));
      return;
    }
    setFollowError("");
    try {
      const response = await fetch("/api/follows", {
        method: inCircle ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, projectId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not update this follow.");
      setInCircleState(!inCircle);
      if (typeof result.followerCount === "number") setProjectFollowerCount(result.followerCount);
    } catch (error) {
      setFollowError(error instanceof Error ? error.message : "Could not update this follow.");
    }
  };

  return (
    <div
      className="relative h-full overflow-hidden bg-[var(--page)] flex flex-col"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <header className="shrink-0 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-2 px-3 sm:px-4 pt-3 pb-2 border-b border-[var(--line)] sm:flex sm:gap-3">
        <button
          type="button"
          onClick={() => setLayer(0)}
          className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text)] shrink-0 sm:hidden"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => useShellUi.getState().openProject(roomId)}
              className="text-[14px] sm:text-[15px] font-semibold text-[var(--text)] truncate text-left hover:underline"
            >
              {title}
            </button>
            <span className="rounded-full border border-white/[0.09] bg-white/[0.04] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/55">
              {sec.kind === "owner-creator" ? "Your room" : sec.kind === "client-owner" ? "Project owner" : sec.kind === "co-creator" ? "Crew" : "Visitor"}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${
              activeLiveUrl
                ? "border-[var(--coral)]/70 bg-[var(--coral)]/10 text-[var(--coral)]"
                : "border-white/[0.09] bg-white/[0.04] text-white/55"
            }`}>
              {activeLiveUrl && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-[var(--coral)] animate-ping opacity-50" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-[var(--coral)]" />
                </span>
              )}
              {activeLiveUrl ? "Live session" : "Work room"}
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-faint)] truncate">
            {sec.kind === "owner-creator" ? "You're hosting" : sec.kind === "client-owner" ? "Your project, with" : sec.kind === "co-creator" ? "Building together with" : "Working alongside"}{" "}
            <button
              type="button"
              onClick={() => useShellUi.getState().openVault(hostName.replace(/^@/, ""))}
              className="hover:text-[var(--text)] hover:underline"
            >
              @{hostName}
            </button>
            {peerCount > 0 ? ` · ${peerCount} here` : ""}
            {currentStep ? ` · ${currentStep.label}` : ""}
          </p>
        </div>
        <div className="col-span-2 flex items-center justify-end gap-1.5 sm:ml-auto sm:shrink-0">
          <button
            type="button"
            onClick={onCircle}
            className={`rounded-full border px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-[11px] font-medium ${
              inCircle
                ? "border-white/20 bg-white/10 text-[var(--text)]"
                : "border-[var(--line)] text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            <span className="sm:hidden">{inCircle ? "Following" : "+ Follow"}</span>
            <span className="hidden sm:inline">{inCircle ? "Following journey" : "+ Follow journey"}</span>
          </button>
          <button
            type="button"
            onClick={() => void toggleRoomPresence()}
            disabled={presenceBusy}
            className="rounded-full bg-[var(--coral)] px-3 py-1.5 text-[10px] sm:text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            <span className="sm:hidden">{presenceBusy ? "…" : shortJoinLabel}</span>
            <span className="hidden sm:inline">{presenceBusy ? "Connecting…" : joinLabel}</span>
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-y-auto px-3 sm:px-4 py-3 gap-3">
          <div className="relative w-full rounded-2xl overflow-hidden border border-[var(--line)] bg-[var(--surface)] aspect-video">
              {embed?.embedUrl ? (
                <iframe
                  title="Live session"
                  src={embed.embedUrl}
                  className="absolute inset-0 w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              ) : previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt={`Latest work on ${title}`} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 grid place-items-center bg-[var(--surface)] px-6 text-center">
                  <p role={projectError ? "alert" : undefined} className={`max-w-xs text-[13px] ${projectError ? "text-red-400" : "text-[var(--text-muted)]"}`}>
                    {projectLoading
                      ? "Opening the project room…"
                      : projectError
                        ? projectError
                        : activeLiveUrl
                          ? "The live stream could not be embedded. Open the project journey to view its latest work."
                          : "No stream or project image has been added yet."}
                  </p>
                </div>
              )}
              <span className="absolute left-3 top-3 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white z-10">
                {peerCount} here now
              </span>
              <button
                type="button"
                onClick={() => {
                  try {
                    useShellUi.getState().openVault(hostName);
                  } catch {}
                }}
                className="absolute left-3 top-10 rounded-md bg-[#8b5cf6] px-1.5 py-0.5 text-[10px] font-semibold text-white z-10 hover:opacity-90"
              >
                @{hostName}
              </button>
              <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                <p className="rounded-full bg-black/55 backdrop-blur-sm px-3 py-1.5 text-[11px] text-white max-w-[100%]">
                  @{hostName} is {statusLine}
                </p>
              </div>
            </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] text-[var(--text-muted)] tabular-nums">
              {peerCount} here now
            </span>
            <div className="flex -space-x-1.5">
              {peers.map((p) => (
                <button
                  key={p.userId}
                  type="button"
                  title={p.handle || "Room member"}
                  onClick={() => {
                    if (p.handle) useShellUi.getState().openVault(p.handle.replace(/^@/, ""));
                  }}
                  className="w-7 h-7 rounded-full border-2 border-[var(--page)] bg-[var(--surface)] grid place-items-center text-[10px] font-bold text-white"
                >
                  {String(p.handle || "?")[0].toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {presenceError && <p role="status" className="text-[10px] text-red-300">{presenceError}</p>}
          {presenceActionError && <p role="alert" className="text-[10px] text-red-300">{presenceActionError}</p>}

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 sm:px-4 py-3 sticky bottom-0 z-10 shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-[12px] font-semibold text-[var(--text)]">The journey so far</p>
              {projectLoading && (
                <span className="text-[10px] text-[var(--text-faint)]">Loading trail…</span>
              )}
            </div>
            <div className="flex items-center gap-0 overflow-x-auto pb-1">
              {steps.map((step, i) => (
                <div key={step.id} className="flex items-center shrink-0">
                  {i > 0 && (
                    <div
                      className={`w-6 sm:w-10 h-px ${
                        step.current ? "bg-[var(--coral)]/50" : "bg-white/15"
                      }`}
                    />
                  )}
                  <div className="flex flex-col items-center gap-1 min-w-[3.25rem] max-w-[4.5rem]">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        step.current
                          ? "bg-[var(--coral)] shadow-[0_0_0_3px_rgba(255,92,53,0.25)]"
                          : "bg-transparent border border-white/30"
                      }`}
                    />
                    <span
                      className={`text-[10px] text-center leading-tight line-clamp-2 ${
                        step.current ? "text-[var(--text)] font-medium" : "text-[var(--text-faint)]"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[12px] text-[var(--text-muted)] mt-3">
              {currentStep?.summary || (projectLoading ? "Loading the project journey…" : statusLine)}
            </p>
          </section>
        </div>

        <aside className="lg:w-[20rem] shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--line)] bg-[var(--surface)] flex flex-col min-h-[40vh] lg:min-h-0 max-h-[45vh] lg:max-h-none">
          <div className="flex border-b border-[var(--line)] px-1 shrink-0">
            {(
              [
                ["chat", "Room chat"],
                ["work", "Work together"],
                ["about", "About"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`relative flex-1 px-2 py-2.5 text-[12px] font-medium ${
                  tab === id ? "text-[var(--text)]" : "text-[var(--text-faint)] hover:text-[var(--text-muted)]"
                }`}
              >
                {label}
                {tab === id && (
                  <span className="absolute left-2 right-2 bottom-0 h-0.5 rounded-full bg-[var(--coral)]" />
                )}
              </button>
            ))}
          </div>

          {tab === "chat" && (
            <>
              <div ref={chatLogRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
                {chatConnection !== "server" && (
                  <p className="text-center text-[10px] text-[var(--text-faint)]">
                    {chatConnection === "connecting"
                      ? "Connecting to room chat…"
                      : "Room chat is reconnecting; messages are not being sent."}
                  </p>
                )}
                {roomLog.length === 0 && (
                  <>
                    <p className="py-8 text-center text-[12px] text-[var(--text-faint)]">
                      No messages yet. Start the conversation with the room.
                    </p>
                  </>
                )}
                {roomLog.map((m) => (
                  <ChatBubble key={m.id} handle={m.by} color="#8b5cf6" text={m.text} />
                ))}
              </div>
              <div className="shrink-0 border-t border-[var(--line)] p-2 space-y-2">
                {signedIn ? (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {PROMPTS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setText(p)}
                          className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--line-strong)]"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") send();
                        }}
                        placeholder="Say something to the room"
                        className="flex-1 min-w-0 rounded-full border border-[var(--line)] bg-[var(--page)] px-3 py-2 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--line-strong)]"
                      />
                      <button
                        type="button"
                        onClick={send}
                        disabled={text.trim().length < 1}
                        className="rounded-full bg-[var(--coral)] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-40"
                      >
                        Send
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("wippo:auth", { detail: "join the room conversation" }))}
                    className="w-full rounded-full border border-[var(--line)] px-3 py-2 text-[12px] font-medium text-[var(--text)] hover:border-[var(--line-strong)]"
                  >
                    Sign in to join the conversation
                  </button>
                )}
                {(sendError || followError) && <p role="alert" className="text-[11px] text-red-400">{sendError || followError}</p>}
              </div>
            </>
          )}

          {tab === "work" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-[13px] text-[var(--text-muted)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--text)]">Help requests</p>
                  <p className="mt-1 text-[11px] text-[var(--text-faint)]">A concrete way to move this project forward together.</p>
                </div>
                {isProjectOwner && project && (
                  <span className="rounded-full border border-[var(--coral)]/30 bg-[var(--coral)]/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-[var(--coral)]">Owner</span>
                )}
              </div>
              {helpLoading && <p className="text-[11px] text-[var(--text-faint)]">Checking for open requests…</p>}
              {helpError && (
                <div role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[0.04] p-3 text-[11px] text-red-300">
                  <p>{helpError}</p>
                  <button type="button" onClick={() => {
                    if (project?.id) {
                      setHelpLoading(true);
                      fetch(`/api/help?projectId=${encodeURIComponent(project.id)}&status=ACTIVE`)
                        .then(async (response) => {
                          const result = await response.json().catch(() => ({}));
                          if (!response.ok) throw new Error(result.error || "Could not load project help requests.");
                          setHelpItems(Array.isArray(result.help) ? result.help : []);
                          setHelpError("");
                        })
                        .catch((error: unknown) => setHelpError(error instanceof Error ? error.message : "Could not load project help requests."))
                        .finally(() => setHelpLoading(false));
                    }
                  }} className="mt-2 font-medium text-[var(--coral)] hover:underline">Try again</button>
                </div>
              )}
              {!helpLoading && !helpError && helpItems.length === 0 && (
                <p className="rounded-xl border border-dashed border-[var(--line)] px-3 py-3 text-[12px] text-[var(--text-faint)]">
                  {isProjectOwner ? "No one is being asked for help yet. Post a specific blocker below when you want another perspective." : "No open asks on this project right now. Follow its journey to catch the next one."}
                </p>
              )}
              {helpItems.map((item) => (
                <article key={item.id} className="rounded-xl border border-[var(--line)] bg-[var(--page)]/70 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-semibold text-[var(--text)]">{item.title}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${item.status === "IN_PROGRESS" ? "bg-[var(--growth)]/10 text-[var(--growth)]" : "bg-amber-300/10 text-amber-200"}`}>
                      {item.status === "IN_PROGRESS" ? "In progress" : "Open"}
                    </span>
                  </div>
                  {item.body && <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">{item.body}</p>}
                  {item.status === "IN_PROGRESS" ? (
                    <p className="text-[10px] text-[var(--text-faint)]">{item.claimedByHandle ? `@${item.claimedByHandle} offered to help` : "A builder offered to help"}</p>
                  ) : !isProjectOwner && (
                    <button
                      type="button"
                      disabled={claimingHelpId === item.id}
                      onClick={() => void claimHelpRequest(item.id)}
                      className="rounded-full border border-amber-300/30 px-3 py-1.5 text-[10px] font-semibold text-amber-100 hover:bg-amber-300/[0.08] disabled:opacity-50"
                    >
                      {claimingHelpId === item.id ? "Offering…" : "Offer to help"}
                    </button>
                  )}
                </article>
              ))}
              {isProjectOwner && (
                <form className="space-y-2 border-t border-[var(--line)] pt-3" onSubmit={(event) => {
                  event.preventDefault();
                  void postHelpRequest();
                }}>
                  <label className="block text-[11px] font-medium text-[var(--text)]" htmlFor="room-help-title">Ask for a hand</label>
                  <input
                    id="room-help-title"
                    value={helpTitle}
                    onChange={(event) => setHelpTitle(event.target.value)}
                    maxLength={120}
                    placeholder="What is blocking the next step?"
                    className="w-full rounded-lg border border-[var(--line)] bg-[var(--page)] px-3 py-2 text-[12px] text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--line-strong)]"
                  />
                  <textarea
                    value={helpBody}
                    onChange={(event) => setHelpBody(event.target.value)}
                    maxLength={500}
                    rows={2}
                    placeholder="What have you tried? What kind of perspective would help?"
                    className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--page)] px-3 py-2 text-[12px] text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--line-strong)]"
                  />
                  <button type="submit" disabled={helpBusy || helpTitle.trim().length < 3} className="w-full rounded-full bg-[var(--coral)] py-2 text-[11px] font-semibold text-white hover:brightness-110 disabled:opacity-40">
                    {helpBusy ? "Posting ask…" : "Post help request"}
                  </button>
                </form>
              )}
              {helpActionError && <p role="alert" className="text-[11px] text-red-400">{helpActionError}</p>}
              {project?.nextStep && (
                <button
                  type="button"
                  onClick={() => useShellUi.getState().openProject(roomId)}
                  className="w-full text-left rounded-xl border border-[var(--line)] px-3 py-2.5 text-[11px] hover:border-[var(--line-strong)]"
                >
                  Project next step: {project.nextStep}
                </button>
              )}
            </div>
          )}

          {tab === "about" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-2 text-[13px]">
              <button type="button" onClick={() => useShellUi.getState().openProject(roomId)} className="font-semibold text-[var(--text)] text-left hover:underline">{title}</button>
              <p className="text-[13px] text-[var(--text-muted)] leading-relaxed">
                {project?.intentStatement ||
                  `Live workshop with @${hostName}. Progress is saved as milestones on the project journey — not lost in a stream archive.`}
              </p>
              <button
                type="button"
                onClick={() => useShellUi.getState().openProject(roomId)}
                className="mt-3 w-full rounded-full border border-[var(--line)] py-2 text-[12px] font-medium text-[var(--text)] hover:bg-white/[0.04]"
              >
                Open project world
              </button>
              <button
                type="button"
                onClick={() => useShellUi.getState().openProject(roomId)}
                className="text-[12px] text-[var(--coral)] pt-2 hover:underline"
              >
                Open this update in the project journey
              </button>
              {projectFollowerCount !== null && (
                <p className="text-[12px] text-[var(--text-faint)]">{projectFollowerCount} following this journey</p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ChatBubble({
  handle,
  color,
  text,
}: {
  handle: string;
  color: string;
  text: string;
}) {
  return (
    <div className="flex gap-2">
      <span
        className="w-7 h-7 rounded-full shrink-0 grid place-items-center text-[10px] font-bold text-white mt-0.5"
        style={{ background: color }}
      >
        {handle[0]?.toUpperCase() || "?"}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[var(--text)]">{handle}</p>
        <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">{text}</p>
      </div>
    </div>
  );
}