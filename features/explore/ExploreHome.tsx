"use client";
/** Discover work as a field of active project journeys. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useShellUi } from "@/lib/shellUi";
import { navigateToRoute } from "@/lib/appRoutes";

type RoomStatus = "live" | "needs_hand" | "offline";

type MatrixCard = {
  id: string;
  title: string;
  stack: string;
  phaseLabel: string;
  target: string;
  status: RoomStatus;
  people?: number;
  duration?: string;
  nextBuild?: string;
  creatorHandle: string;
  imageUrl: string | null;
};

const STATUSES: { id: "all" | RoomStatus; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "live", label: "Live now" },
  { id: "needs_hand", label: "Needs a hand" },
  { id: "offline", label: "Quiet journeys" },
];

export default function ExploreHome() {
  const [status, setStatus] = useState<"all" | RoomStatus>("all");
  const [cards, setCards] = useState<MatrixCard[]>([]);
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState("");

  const getSafeMediaUrl = useCallback((value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const url = value.trim();
    if (!url) return null;
    if (/^(https?:\/\/|\/)/i.test(url)) return url;
    return null;
  }, []);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const [helpResponse, sessionResponse, projectsResponse] = await Promise.all([
        fetch("/api/help?status=OPEN&take=40"),
        fetch("/api/sessions?active=1"),
        fetch("/api/projects?status=IN_PROGRESS"),
      ]);
      if (!helpResponse.ok || !sessionResponse.ok || !projectsResponse.ok) {
        const failedResponses = [helpResponse, sessionResponse, projectsResponse].filter((response) => !response.ok);
        const failedResponse = failedResponses.find((response) => response.status === 503) || failedResponses[0];
        const detail = await failedResponse?.json().catch(() => ({}));
        throw new Error(detail?.error || "The work field could not be loaded. Try again in a moment.");
      }
      const [helpData, sessionData, data] = await Promise.all([
        helpResponse.json(),
        sessionResponse.json(),
        projectsResponse.json(),
      ]);
      const helpProjectIds = new Set((helpData.help || []).map((h: any) => h.projectId));
      const liveProjectIds = new Set((sessionData.sessions || []).map((s: any) => s.projectId).filter(Boolean));
      const projects = data.projects || data.mosaic || [];
      const mapped: MatrixCard[] = projects.slice(0, 24).map((p: any) => {
        const node = p.latestNode || {};
        const live = liveProjectIds.has(p.id);
        const needs = helpProjectIds.has(p.id);
        const fallbackMedia =
          getSafeMediaUrl(node.thumbUrl) ||
          getSafeMediaUrl(node.mediaUrl) ||
          getSafeMediaUrl(p.coverImageUrl) ||
          getSafeMediaUrl(p.latestNode?.nextSnapshotUrl) ||
          getSafeMediaUrl(p.latestNode?.prevSnapshotUrl) ||
          getSafeMediaUrl(p.journeyNodes?.[0]?.nextSnapshotUrl) ||
          getSafeMediaUrl(p.journeyNodes?.[0]?.prevSnapshotUrl) ||
          null;
        return {
          id: p.id,
          title: p.title || "Project",
          stack: (p.intent || "").slice(0, 40) || "Build",
          phaseLabel: node.phaseTitle || node.dayLabel || "In progress",
          target: node.summary || p.intent || "Working session",
          status: (live ? "live" : needs ? "needs_hand" : "offline") as RoomStatus,
          creatorHandle: p.creator?.handle || "builder",
          imageUrl: fallbackMedia,
        };
      });
      setCards(mapped);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load projects.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return cards.filter((c) => {
    const needle = query.trim().toLowerCase();
      if (
        needle &&
        ![c.title, c.creatorHandle, c.stack, c.phaseLabel, c.target]
          .some((value) => value.toLowerCase().includes(needle))
      ) return false;
      if (status !== "all" && c.status !== status) return false;
      return true;
    });
    }, [cards, status, query]);

  const walkIn = (id: string) => {
    navigateToRoute({kind: "room", id});
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--page)]">
      <div className="h-full max-w-[1600px] mx-auto flex flex-col">
        <div className="shrink-0 px-4 sm:px-8 pt-4 sm:pt-6">
          <div className="mx-auto max-w-6xl flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--growth)]">The open workbench</p>
              <h1 className="mt-2 text-[28px] sm:text-[36px] font-semibold tracking-tight text-[var(--text)]">Discover work in progress</h1>
              <p className="mt-2 text-[13px] sm:text-[14px] leading-relaxed text-[var(--text-muted)]">
                Explore the decisions, experiments, and live rooms behind the finished-looking work.
              </p>
            </div>
            <div className="flex min-w-0 flex-col sm:flex-row gap-2 lg:w-[min(100%,29rem)]">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search projects and builders</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search projects, builders, or goals"
                  className="w-full rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-[12px] text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--line-strong)]"
                />
              </label>
            </div>
          </div>
        </div>
        <nav aria-label="Explore work by activity" className="shrink-0 overflow-x-auto border-y border-[var(--line)] px-4 sm:px-8">
          <div className="mx-auto flex max-w-6xl min-w-max items-center gap-2 py-3">
            {STATUSES.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={status === option.id}
                onClick={() => setStatus(option.id)}
                className={`rounded-full px-3.5 py-2 text-[11px] font-medium transition-colors ${
                  status === option.id
                    ? "bg-[var(--text)] text-[var(--page)]"
                    : "border border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--line-strong)] hover:text-[var(--text)]"
                }`}
              >
                {option.label}
              </button>
            ))}
            <span className="ml-auto pl-3 text-[10px] tabular-nums text-[var(--text-faint)]">
              {filtered.length} {filtered.length === 1 ? "journey" : "journeys"}
            </span>
          </div>
        </nav>

        <main className="flex-1 min-h-0 min-w-0 overflow-y-auto px-4 sm:px-8 py-5">
          {loadError && (
            <div role="alert" className="mx-auto max-w-6xl rounded-2xl border border-red-400/20 bg-red-400/[0.04] p-4">
              <p className="text-[13px] text-red-200">{loadError}</p>
              <button type="button" onClick={() => void load()} className="mt-2 text-[11px] font-medium text-[var(--coral)] hover:underline">
                Try again
              </button>
            </div>
          )}
          {!loadError && cards.length === 0 && (
            <div className="mx-auto grid min-h-[24rem] max-w-2xl place-items-center text-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--growth)]">A little room to begin</p>
                <h2 className="mt-3 text-[24px] font-semibold tracking-tight text-[var(--text)]">The field is still quiet</h2>
                <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[var(--text-muted)]">Public project journeys appear here as builders share what they are making, trying, and learning.</p>
              </div>
            </div>
          )}
          {cards.length > 0 && filtered.length === 0 && (
            <p className="py-16 text-center text-[13px] text-[var(--text-muted)]">Nothing in this part of the field yet.</p>
          )}
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c, index) => (
              <article
                key={c.id}
                className={`group relative flex min-h-[26rem] flex-col justify-between overflow-hidden rounded-[2rem] border bg-[#0a0f16] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.18)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_54px_rgba(0,0,0,0.24)] ${
                  c.status === "needs_hand" ? "border-amber-300/25" : "border-[var(--line)]"
                }`}
              >
                <div className="absolute inset-0 overflow-hidden">
                  {c.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.imageUrl}
                      alt={`Latest work on ${c.title}`}
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.2] group-hover:brightness-110"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  {!c.imageUrl && (
                    <div className="h-full w-full bg-[radial-gradient(circle_at_top_right,rgba(255,122,92,.22),transparent_25%),linear-gradient(145deg,#121923,#090c12_70%)]" />
                  )}
                </div>

                <div className={`absolute inset-0 ${c.imageUrl ? "bg-gradient-to-t from-[#090c12] via-[#090c12]/68 to-[#090c12]/15" : "bg-[radial-gradient(ellipse_at_top_right,rgba(148,163,184,.10),transparent_55%),linear-gradient(145deg,#121923,#090c12_70%)]"}`} />

                <div className="relative z-10 flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold ${
                    c.status === "live"
                      ? "border-[var(--coral)]/40 bg-black/35 text-white"
                      : c.status === "needs_hand"
                        ? "border-amber-200/30 bg-black/35 text-amber-100"
                        : "border-white/15 bg-black/30 text-white/70"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${c.status === "live" ? "bg-[var(--coral)] animate-pulse" : c.status === "needs_hand" ? "bg-amber-300" : "bg-white/40"}`} />
                    {c.status === "live" ? "Building now" : c.status === "needs_hand" ? "Could use a hand" : "Journey"}
                  </span>
                  <span className="text-[10px] tabular-nums text-white/55">{String(index + 1).padStart(2, "0")}</span>
                </div>

                <div className="relative z-10 mt-auto space-y-3">
                  <div className="flex items-center justify-between gap-3 text-white/60">
                    <p className="text-[10px] uppercase tracking-[0.18em]">{c.phaseLabel}</p>
                    <span className="text-[10px] tabular-nums">{c.imageUrl ? "Preview" : "Draft"}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => useShellUi.getState().openProject(c.id)}
                    className="block max-w-full text-left text-[22px] font-semibold leading-[1.05] tracking-tight text-white hover:underline"
                  >
                    {c.title}
                  </button>

                  <button type="button" onClick={() => useShellUi.getState().openVault(c.creatorHandle)} className="text-[11px] text-white/70 hover:text-white hover:underline">
                    @{c.creatorHandle}
                  </button>

                  <p className="line-clamp-3 max-w-lg text-[12px] leading-relaxed text-white/75">{c.target}</p>

                  <div className="flex items-center justify-between gap-3 border-t border-white/15 pt-3">
                    <span className="text-[10px] text-white/60">{c.imageUrl ? "Latest artifact" : "No artifact yet"}</span>
                    <button
                      type="button"
                      onClick={() => c.status === "offline" ? useShellUi.getState().openProject(c.id) : walkIn(c.id)}
                      className={`rounded-full px-3.5 py-2 text-[10px] font-semibold transition-colors ${
                        c.status === "needs_hand"
                          ? "bg-amber-200 text-[#211906] hover:bg-amber-100"
                          : c.status === "live"
                            ? "bg-[var(--coral)] text-white hover:brightness-110"
                            : "border border-white/20 text-white hover:bg-white/10"
                      }`}
                    >
                      {c.status === "live" ? "Step into room" : c.status === "needs_hand" ? "Offer a hand" : "Follow the journey"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
