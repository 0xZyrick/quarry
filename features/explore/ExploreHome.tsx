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

        <main className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 pb-20 sm:pb-8 snap-y-feed sm:snap-none">
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

          {/* Video-first masonry-ish grid */}
          <div className="flex flex-col gap-3 sm:block sm:columns-2 sm:gap-3 sm:space-y-3">
            {filtered.map((c) => {
              const isHover = hoverId === c.id;
              const isLive = c.status === "live";
              const isHelp = c.status === "needs_hand";
              const videoPreview = c.hasVideo && !!c.mediaUrl && /\.(mp4|webm|mov)(\?|$)/i.test(c.mediaUrl);
              return (
                <article
                  key={c.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => { if (!c.id.startsWith("mock-")) walkIn(c.id); }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      if (!c.id.startsWith("mock-")) walkIn(c.id);
                    }
                  }}
                  onMouseEnter={(event) => {
                    setHoverId(c.id);
                    const video = event.currentTarget.querySelector("video");
                    if (video) void video.play().catch(() => {});
                  }}
                  onMouseLeave={(event) => {
                    setHoverId(null);
                    const video = event.currentTarget.querySelector("video");
                    if (video) {
                      video.pause();
                      video.currentTime = 0;
                    }
                  }}
                  className={`break-inside-avoid relative overflow-hidden rounded-lg bg-[#111318] group snap-item sm:snap-align-none min-h-[calc(100dvh-8.5rem)] sm:min-h-0 ${
                    isHelp ? "ring-1 ring-[#F59E0B]/50" : isLive ? "ring-1 ring-[#10B981]/35" : ""
                  } cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/40`}
                >
                  {/* Full-bleed media with text overlays */}
                  <div className="relative aspect-[9/16] sm:aspect-video min-h-[calc(100dvh-8.5rem)] sm:min-h-0 h-full bg-[#0a0b0d] overflow-hidden">
                    {videoPreview ? (
                      <>
                        {/* Poster always underneath so empty/black video never wins */}
                        {c.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.imageUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : null}
                        <video
                          key={c.mediaUrl || c.id}
                          src={isHover ? (c.mediaUrl || undefined) : undefined}
                          poster={c.imageUrl || undefined}
                          muted
                          playsInline
                          loop
                          preload="none"
                          controls={false}
                          ref={(el) => {
                            if (!el) return;
                            el.muted = true;
                            if (isHover) {
                              void el.play().catch(() => {});
                            } else {
                              el.pause();
                              el.removeAttribute("src");
                              el.load();
                            }
                          }}
                          onTimeUpdate={(event) => {
                            if (event.currentTarget.currentTime >= 12) {
                              event.currentTarget.currentTime = 0;
                            }
                          }}
                          className={`absolute inset-0 h-full w-full object-cover transition duration-500 ${
                            isHover ? "scale-[1.03] opacity-100" : "scale-100 opacity-0"
                          }`}
                        />
                      </>
                    ) : c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.imageUrl}
                        alt=""
                        className={`h-full w-full object-cover transition duration-700 ${
                          isHover ? "scale-[1.05] brightness-110" : ""
                        }`}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,.14),transparent_45%),linear-gradient(160deg,#14171c,#0a0b0d)]" />
                    )}

                    {/* Readability gradients */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/15 to-transparent" />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                    {/* Top: status chips only */}
                    <div className="absolute inset-x-0 top-0 p-3 sm:p-3.5">
                      <div className="flex items-center gap-1.5">
                        {isLive && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white ring-1 ring-white/10 backdrop-blur-md">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
                            LIVE
                          </span>
                        )}
                        {isHelp && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F59E0B]/20 px-2 py-0.5 text-[10px] font-semibold text-amber-100 ring-1 ring-[#F59E0B]/40 backdrop-blur-md">
                            Needs a hand
                          </span>
                        )}
                        {!isLive && !isHelp && c.hasVideo && (
                          <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/80 ring-1 ring-white/10 backdrop-blur-md">
                            Log reel
                          </span>
                        )}
                        {(c.id.startsWith("mock-") || c.id.startsWith("demo-")) && (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/50 ring-1 ring-white/10 backdrop-blur-md">
                            Sample
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom: white goal (was yellow slot) · green handle — no yellow */}
                    <div className="absolute inset-x-0 bottom-0 p-3 sm:p-3.5 space-y-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (c.id.startsWith("mock-")) return;
                          if (isHelp) void jumpInAndUnblock(c);
                          else walkIn(c.id);
                        }}
                        disabled={claimingHelpId === c.helpId || c.id.startsWith("mock-")}
                        className="block max-w-[95%] text-left text-[16px] sm:text-[18px] font-semibold leading-snug line-clamp-2 text-white drop-shadow-[0_1px_8px_rgba(0,0,0,.85)] hover:text-white/90 transition-colors"
                      >
                        {c.target || c.title || "Open room"}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (c.id.startsWith("mock-")) return;
                          useShellUi.getState().openVault(c.creatorHandle);
                        }}
                        className="block text-left text-[14px] text-white/55 drop-shadow-[0_1px_6px_rgba(0,0,0,.7)] hover:text-white/80"
                      >
                        @{c.creatorHandle}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
