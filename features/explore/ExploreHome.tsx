"use client";
/** Discover — video-first network feed (live · needs a hand · log reels). */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useShellUi } from "@/lib/shellUi";
import { navigateToRoute } from "@/lib/appRoutes";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { currentUid } from "@/lib/circle";
import { isDemoMode } from "@/lib/demoMode";
import { DEMO_FEED } from "@/lib/demoData";

type RoomStatus = "live" | "needs_hand" | "offline";

type MatrixCard = {
  id: string;
  title: string;
  projectTitle: string;
  stack: string;
  phaseLabel: string;
  target: string;
  status: RoomStatus;
  people?: number;
  duration?: string;
  nextBuild?: string;
  creatorHandle: string;
  imageUrl: string | null;
  mediaUrl: string | null;
  hasVideo: boolean;
  helpId?: string;
};

const STATUSES: { id: "all" | RoomStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "Live now" },
  { id: "needs_hand", label: "Needs a hand" },
  { id: "offline", label: "Log reels" },
];

export default function ExploreHome() {
  const { requireAuth } = useOnboarding();
  const [status, setStatus] = useState<"all" | RoomStatus>("all");
  const [cards, setCards] = useState<MatrixCard[]>([]);
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState("");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [claimingHelpId, setClaimingHelpId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  /** Avoid hydration mismatch: localStorage demo flag only exists on the client */
  const [ready, setReady] = useState(false);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  const getSafeMediaUrl = useCallback((value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const url = value.trim();
    if (!url) return null;
    if (/^(https?:\/\/|\/)/i.test(url)) return url;
    return null;
  }, []);

  const load = useCallback(async () => {
    setLoadError("");
    setLoading(true);
    if (demo) {
      setCards(
        DEMO_FEED.map((c) => ({
          id: c.id,
          title: c.title,
          projectTitle: c.projectTitle,
          stack: c.stack,
          phaseLabel: c.phaseLabel,
          target: c.target,
          status: c.status,
          people: c.people,
          duration: c.duration,
          creatorHandle: c.creatorHandle,
          imageUrl: c.imageUrl,
          mediaUrl: c.mediaUrl,
          hasVideo: true,
          helpId: c.helpId,
        }))
      );
      setLoading(false);
      return;
    }
    try {
      const [helpResponse, sessionResponse, projectsResponse] = await Promise.all([
        fetch("/api/help?status=OPEN&take=40").catch(() => null),
        fetch("/api/sessions?active=1").catch(() => null),
        fetch("/api/projects?status=IN_PROGRESS"),
      ]);
      if (!projectsResponse.ok) {
        const detail = await projectsResponse.json().catch(() => ({}));
        throw new Error(detail?.error || "Could not load the feed.");
      }
      const [helpData, sessionData, data] = await Promise.all([
        helpResponse && helpResponse.ok ? helpResponse.json() : Promise.resolve({ help: [] }),
        sessionResponse && sessionResponse.ok ? sessionResponse.json() : Promise.resolve({ sessions: [] }),
        projectsResponse.json(),
      ]);
      const helpByProject = new Map<string, any>();
      for (const help of helpData.help || []) {
        if (typeof help.projectId === "string" && !helpByProject.has(help.projectId)) {
          helpByProject.set(help.projectId, help);
        }
      }
      const helpProjectIds = new Set(helpByProject.keys());
      const liveProjectIds = new Set(
        (sessionData.sessions || []).map((s: any) => s.projectId).filter(Boolean)
      );
      const projects = data.projects || data.mosaic || [];
      const mapped: MatrixCard[] = projects.slice(0, 48).map((p: any) => {
        const node = p.latestNode || {};
        const live = liveProjectIds.has(p.id);
        const needs = helpProjectIds.has(p.id);
        const media =
          getSafeMediaUrl(node.mediaUrl) ||
          getSafeMediaUrl(node.thumbUrl) ||
          getSafeMediaUrl(p.coverImageUrl) ||
          getSafeMediaUrl(node.nextUrl) ||
          getSafeMediaUrl(node.prevUrl) ||
          null;
        return {
          id: p.id,
          title: node.updateTitle || p.title || "Project",
          projectTitle: p.title || "Project",
          stack: (p.intent || "").slice(0, 48) || "",
          phaseLabel: node.phaseTitle || node.dayLabel || "",
          target: node.summary || p.intent || "",
          status: (live ? "live" : needs ? "needs_hand" : "offline") as RoomStatus,
          creatorHandle: p.creator?.handle || "builder",
          imageUrl: media,
          mediaUrl: media,
          hasVideo: !!(node.hasVideo || (media && /\.(mp4|webm|mov)(\?|$)/i.test(media))),
          helpId: helpByProject.get(p.id)?.id,
        };
      });
      // Live + needs first, then reels with media, then the rest
      mapped.sort((a, b) => {
        const rank = (s: RoomStatus) => (s === "live" ? 0 : s === "needs_hand" ? 1 : 2);
        const r = rank(a.status) - rank(b.status);
        if (r !== 0) return r;
        return (b.imageUrl ? 1 : 0) - (a.imageUrl ? 1 : 0);
      });
      setCards(mapped);
      setLoading(false);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load projects.");
      setLoading(false);
    }
  }, [demo, getSafeMediaUrl]);

  useEffect(() => {
    const on = isDemoMode();
    setDemo(on);
    setReady(true);
    // Fill immediately so we never flash an empty demo grid
    if (on) {
      setCards(
        DEMO_FEED.map((c) => ({
          id: c.id,
          title: c.title,
          projectTitle: c.projectTitle,
          stack: c.stack,
          phaseLabel: c.phaseLabel,
          target: c.target,
          status: c.status,
          people: c.people,
          duration: c.duration,
          creatorHandle: c.creatorHandle,
          imageUrl: c.imageUrl,
          mediaUrl: c.mediaUrl,
          hasVideo: true as const,
          helpId: c.helpId,
        }))
      );
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, demo, load]);

  const filtered = useMemo(() => {
    if (!ready) return [];
    // Real feed only. Demo/guest still maps DEMO_FEED in load(); never pad signed-in with mocks.
    return cards.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      const needle = query.trim().toLowerCase();
      if (!needle) return true;
      return [c.title, c.creatorHandle, c.stack, c.phaseLabel, c.target, c.projectTitle].some(
        (value) => value && value.toLowerCase().includes(needle)
      );
    });
  }, [cards, status, query, ready]);

  const walkIn = (id: string) => navigateToRoute({ kind: "room", id });

  const jumpInAndUnblock = async (card: MatrixCard) => {
    if (!card.helpId) {
      walkIn(card.id);
      return;
    }
    if (!currentUid()) {
      requireAuth("jump in and unblock this project", () => void jumpInAndUnblock(card));
      return;
    }
    setClaimingHelpId(card.helpId);
    setActionError("");
    try {
      const response = await fetch("/api/help", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: card.helpId, claim: true }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not offer help.");
      walkIn(card.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not offer help.");
    } finally {
      setClaimingHelpId(null);
    }
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0B0C0E]">
      <div className="h-full max-w-[1600px] mx-auto flex flex-col">
        {/* Filters only — search lives in the nav bar */}
        <div className="shrink-0 px-4 sm:px-6 pt-3 pb-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {STATUSES.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={status === option.id}
                onClick={() => setStatus(option.id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[14px] font-medium transition-colors ${
                  status === option.id
                    ? "bg-white text-[#0B0C0E]"
                    : "text-white/55 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                {option.id === "live" && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#10B981]" />}
                {option.id === "needs_hand" && (
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />
                )}
                {option.label}
              </button>
            ))}
            <span className="ml-auto shrink-0 text-[11px] tabular-nums text-white/30" suppressHydrationWarning>
              {ready ? filtered.length : "—"}
            </span>
          </div>
        </div>

        <main className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 pb-20 sm:pb-8">
          {actionError && <p role="alert" className="mb-3 text-[12px] text-red-300">{actionError}</p>}
          {loadError && (
            <div role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[0.05] p-4 mb-4">
              <p className="text-[13px] text-red-200">{loadError}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-2 text-[11px] font-medium text-[var(--coral)] hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {!loadError && ready && !loading && cards.length === 0 && (
            <div className="grid min-h-[30vh] place-items-center text-center px-6">
              <div className="max-w-sm">
                <p className="text-body text-white/55">Discover is quiet right now</p>
                <p className="mt-1 text-small text-white/35">Live sessions and log reels will appear here as builders post.</p>
              </div>
            </div>
          )}

          {cards.length > 0 && filtered.length === 0 && (
            <p className="py-12 text-center text-small text-white/40">Nothing in this filter.</p>
          )}

          {/* Feed cards — header / media+actions / caption (Instagram-style) */}
          <div className="flex flex-col gap-5 sm:block sm:columns-2 sm:gap-4 sm:space-y-4">
            {filtered.map((c) => {
              const isHover = hoverId === c.id;
              const isLive = c.status === "live";
              const isHelp = c.status === "needs_hand";
              const videoPreview = c.hasVideo && !!c.mediaUrl && /\.(mp4|webm|mov)(\?|$)/i.test(c.mediaUrl);
              const worldTitle = c.projectTitle || c.title || "Untitled";
              const updateText = c.target || c.title || "";
              return (
                <article
                  key={c.id}
                  className="break-inside-avoid mb-0 sm:mb-0"
                  ref={(node) => {
                    if (!node || typeof IntersectionObserver === "undefined") return;
                    const video = node.querySelector("video");
                    if (!video) return;
                    const obs = new IntersectionObserver(
                      ([entry]) => {
                        const v = node.querySelector("video");
                        if (!v) return;
                        if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
                          v.dataset.inview = "1";
                          const coarse = window.matchMedia("(hover: none)").matches;
                          if (coarse) void v.play().catch(() => {});
                        } else {
                          v.dataset.inview = "0";
                          v.pause();
                          try { v.currentTime = 0.05; } catch { /* ignore */ }
                        }
                      },
                      { threshold: [0.55] }
                    );
                    obs.observe(node);
                    (node as any)._wippoObs?.disconnect?.();
                    (node as any)._wippoObs = obs;
                  }}
                  onMouseEnter={() => {
                    setHoverId(c.id);
                    const video = document.querySelector(`article[data-card="${c.id}"] video`) as HTMLVideoElement | null;
                    if (video) void video.play().catch(() => {});
                  }}
                  onMouseLeave={() => {
                    setHoverId(null);
                    const video = document.querySelector(`article[data-card="${c.id}"] video`) as HTMLVideoElement | null;
                    if (video) {
                      video.pause();
                      try { video.currentTime = 0.05; } catch { /* ignore */ }
                    }
                  }}
                  data-card={c.id}
                >
                  {/* Top: world title, then username — both clickable */}
                  <div className="px-0.5 mb-2 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (c.id.startsWith("mock-")) return;
                        walkIn(c.id);
                      }}
                      className="block w-full text-left text-[15px] sm:text-body font-semibold text-white hover:text-white/90 transition-colors line-clamp-1"
                    >
                      {worldTitle}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (c.id.startsWith("mock-")) return;
                        useShellUi.getState().openVault(c.creatorHandle);
                      }}
                      className="block text-left text-small text-white/50 hover:text-white/80 transition-colors"
                    >
                      @{c.creatorHandle}
                    </button>
                  </div>

                  {/* Media + right rail actions */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        if (c.id.startsWith("mock-")) return;
                        walkIn(c.id);
                      }}
                      className={`relative block w-full overflow-hidden rounded-lg bg-[#111318] aspect-video focus:outline-none focus:ring-2 focus:ring-white/30 ${
                        isHelp ? "ring-1 ring-[#F59E0B]/45" : isLive ? "ring-1 ring-[#10B981]/35" : ""
                      }`}
                    >
                      <div className="absolute inset-0 bg-[#0a0b0d] overflow-hidden">
                        {videoPreview ? (
                          <video
                            key={c.mediaUrl || c.id}
                            src={c.mediaUrl || undefined}
                            muted
                            playsInline
                            loop
                            preload="metadata"
                            controls={false}
                            ref={(el) => {
                              if (!el) return;
                              el.muted = true;
                              const wantPlay = isHover || el.dataset.inview === "1";
                              if (wantPlay) void el.play().catch(() => {});
                              else {
                                el.pause();
                                if (el.readyState >= 1) {
                                  try { el.currentTime = 0.05; } catch { /* ignore */ }
                                }
                              }
                            }}
                            onLoadedMetadata={(event) => {
                              const el = event.currentTarget;
                              try { el.currentTime = 0.05; } catch { /* ignore */ }
                              el.pause();
                            }}
                            onTimeUpdate={(event) => {
                              if (event.currentTarget.currentTime >= 12) {
                                event.currentTarget.currentTime = 0.05;
                              }
                            }}
                            className={`absolute inset-0 h-full w-full object-cover transition duration-500 ${
                              isHover ? "scale-[1.02]" : "scale-100"
                            }`}
                          />
                        ) : (
                          <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,.14),transparent_45%),linear-gradient(160deg,#14171c,#0a0b0d)]" />
                        )}
                        {isLive && (
                          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white ring-1 ring-white/10">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
                            LIVE
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Right-side interactions: + follow · branch need-a-hand */}
                    <div className="absolute right-2.5 bottom-2.5 sm:right-3 sm:bottom-3 flex flex-col items-center gap-2.5 z-10">
                      <button
                        type="button"
                        aria-label={`Follow @${c.creatorHandle}`}
                        title="Follow"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (c.id.startsWith("mock-")) return;
                          useShellUi.getState().openVault(c.creatorHandle);
                        }}
                        className="grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/15 backdrop-blur-md hover:bg-black/70 hover:scale-105 transition"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label={isHelp ? "Jump in and help" : "Needs a hand"}
                        title={isHelp ? "Jump in & help" : "Offer a hand"}
                        disabled={claimingHelpId === c.helpId || c.id.startsWith("mock-")}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (c.id.startsWith("mock-")) return;
                          if (isHelp) void jumpInAndUnblock(c);
                          else walkIn(c.id);
                        }}
                        className={`grid h-10 w-10 place-items-center rounded-full ring-1 backdrop-blur-md transition hover:scale-105 disabled:opacity-40 ${
                          isHelp
                            ? "bg-[#F59E0B]/90 text-[#1a1200] ring-[#F59E0B]/50"
                            : "bg-black/55 text-white ring-white/15 hover:bg-black/70"
                        }`}
                      >
                        {/* Git branch icon */}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="6" cy="6" r="2.25" />
                          <circle cx="6" cy="18" r="2.25" />
                          <circle cx="18" cy="6" r="2.25" />
                          <path d="M6 8.25v7.5" />
                          <path d="M8.25 6H15a3 3 0 0 1 3 3v0" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Caption below media — update text */}
                  {updateText ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (c.id.startsWith("mock-")) return;
                        if (isHelp) void jumpInAndUnblock(c);
                        else walkIn(c.id);
                      }}
                      className="mt-2 px-0.5 block w-full text-left text-small sm:text-body text-white/75 hover:text-white leading-snug line-clamp-2 transition-colors"
                    >
                      <span className="font-medium text-white/90">@{c.creatorHandle}</span>
                      <span className="text-white/35"> · </span>
                      {updateText}
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
