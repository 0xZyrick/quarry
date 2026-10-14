"use client";
/**
 * Profile drawer — Experience C
 * Answers: Who is this? What are they working on? What can I discover by following?
 * Not LinkedIn. Not escrow metrics. Work first.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useShellUi } from "@/lib/shellUi";
import { useGuild } from "@/lib/store";
import { useOnboarding } from "../onboarding/OnboardingProvider";
import ProjectWorkspace from "../project/ProjectWorkspace";
import CreatorJourney from "../project/CreatorJourney";

type Journey = {
  id: string;
  title: string;
  intent: string;
  status: string;
  followerCount: number;
  updatedAt: string;
  phases: {
    dayLabel: string;
    phaseTitle: string;
    summary: string;
    evolutionDelta: string | null;
    mediaUrl: string | null;
    tag: string | null;
  }[];
};

type CreatorPayload = {
  creator: { id: string; handle: string | null; levelTrack: string; joinedAt?: string };
  journeys: Journey[];
};

export default function VaultSheet() {
  const handle = useShellUi((s) => s.vaultHandle);
  const close = useShellUi((s) => s.closeVault);
  const profile = useGuild((s) => s.profile);
  const { signedIn, requireAuth, data: onb } = useOnboarding();

  const [data, setData] = useState<CreatorPayload | null>(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<"projects" | "updates" | "sessions">("projects");
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [fullProfile, setFullProfile] = useState(false);
  const [following, setFollowing] = useState(false);
  const [bio] = useState("Building things. Sharing the process.");
  const [interests] = useState(["Developer", "Game design", "Experiments"]);

  const selfHandle = (profile?.handle || onb.name || "").replace(/^@/, "");
  const isSelf =
    !!handle &&
    !!selfHandle &&
    selfHandle.toLowerCase() === handle.toLowerCase();

  useEffect(() => {
    if (!handle) {
      setData(null);
      setOpenProjectId(null);
      setFullProfile(false);
      return;
    }
    let live = true;
    setErr("");
    setData(null);
    fetch(`/api/creators/${encodeURIComponent(handle)}`)
      .then(async (r) => {
        if (!r.ok) {
          // Soft empty profile for handles without DB rows yet
          if (r.status === 404) {
            return {
              creator: { id: handle, handle, levelTrack: "rising_craftsman" },
              journeys: [],
            } as CreatorPayload;
          }
          throw new Error("unavailable");
        }
        return r.json();
      })
      .then((v) => {
        if (live) setData(v);
      })
      .catch(() => {
        if (live) setErr("Profile unavailable");
      });
    return () => {
      live = false;
    };
  }, [handle]);

  const journeys = data?.journeys ?? [];
  const active = journeys.find((j) => j.status === "IN_PROGRESS") ?? journeys[0] ?? null;
  const projectCount = journeys.length;
  const updateCount = journeys.reduce((n, j) => n + j.phases.length, 0);
  const followerCount = journeys.reduce((n, j) => n + (j.followerCount || 0), 0);

  // Flatten recent activity from phases
  const activity = journeys
    .flatMap((j) =>
      j.phases.map((ph) => ({
        projectId: j.id,
        projectTitle: j.title,
        ...ph,
      }))
    )
    .slice()
    .reverse()
    .slice(0, 8);

  const onFollow = async () => {
    if (!signedIn) {
      requireAuth("follow this creator's work");
      return;
    }
    if (!active) {
      setFollowing(true);
      return;
    }
    const userId = (profile as any)?.id ?? onb.uid ?? "";
    await fetch("/api/follows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, projectId: active.id }),
    }).catch(() => {});
    setFollowing(true);
  };

  if (fullProfile && handle) {
    return (
      <AnimatePresence>
        {handle && (
          <motion.div className="fixed inset-0 z-[80] bg-deep">
            <CreatorJourney handle={handle} onClose={() => setFullProfile(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  if (openProjectId) {
    return (
      <AnimatePresence>
        <motion.div className="fixed inset-0 z-[80] bg-deep">
          <ProjectWorkspace projectId={openProjectId} onClose={() => setOpenProjectId(null)} />
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {handle && (
        <>
          <motion.button
            type="button"
            aria-label="Close profile"
            className="fixed inset-0 z-[60] bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.aside
            role="dialog"
            aria-label={`Profile @${handle}`}
            initial={{ x: "110%" }}
            animate={{ x: 0 }}
            exit={{ x: "110%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className="fixed top-2 right-2 bottom-2 z-[70] w-[min(100%-1rem,22rem)] rounded-2xl border border-line bg-[#0D0E11] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3 shrink-0">
              <div className="font-mono text-[10px] tracking-wide text-neutral-400 truncate">
                QUARRY / PROFILE
              </div>
              <button
                onClick={close}
                className="btn glass rounded-full w-7 h-7 grid place-items-center text-neutral-400 hover:text-white text-sm shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-5">
              {err && <p className="text-xs text-risk font-mono">{err}</p>}
              {!data && !err && (
                <p className="text-xs text-neutral-500 font-mono">Loading…</p>
              )}

              {data && (
                <>
                  {/* Identity — compact avatar */}
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2a3140] to-[#12141a] border border-line shrink-0 grid place-items-center text-sm font-semibold text-neutral-300">
                      {(handle[0] || "?").toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">@{handle}</p>
                      <p className="text-[12px] text-neutral-400 mt-0.5 leading-snug">{bio}</p>
                      <p className="text-[11px] text-neutral-500 mt-1 font-mono truncate">
                        {interests.join(" · ")}
                      </p>
                    </div>
                  </div>

                  {/* Counts */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { n: projectCount, l: "Projects" },
                      { n: updateCount, l: "Updates" },
                      { n: followerCount, l: "Followers" },
                    ].map((c) => (
                      <div
                        key={c.l}
                        className="rounded-xl border border-line bg-[#12141a] px-2 py-2.5 text-center"
                      >
                        <p className="text-base font-semibold text-white tabular-nums">
                          {String(c.n).padStart(2, "0")}
                        </p>
                        <p className="text-[10px] font-mono text-neutral-500 mt-0.5">{c.l}</p>
                      </div>
                    ))}
                  </div>

                  {/* Viewer actions */}
                  <div className="flex flex-wrap gap-1.5">
                    {isSelf ? (
                      <>
                        <button
                          type="button"
                          className="btn glass rounded-full px-3 py-1.5 font-mono text-[11px] text-neutral-300"
                          onClick={() => requireAuth("edit your profile")}
                        >
                          Edit profile
                        </button>
                        <button
                          type="button"
                          className="btn glass rounded-full px-3 py-1.5 font-mono text-[11px] text-live"
                          onClick={() => {
                            if (!signedIn) requireAuth("share your work");
                            else useShellUi.getState().openLaunch?.();
                          }}
                        >
                          Share work
                        </button>
                        <button
                          type="button"
                          className="btn glass rounded-full px-3 py-1.5 font-mono text-[11px] text-live"
                          onClick={() => {
                            if (!signedIn) requireAuth("start a project");
                            else useShellUi.getState().openLaunch?.();
                          }}
                        >
                          Start project
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={onFollow}
                          className={`btn glass rounded-full px-3 py-1.5 font-mono text-[11px] ${
                            following ? "text-live" : "text-neutral-300"
                          }`}
                        >
                          {following ? "Following" : "Follow"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFullProfile(true)}
                          className="btn glass rounded-full px-3 py-1.5 font-mono text-[11px] text-neutral-300"
                        >
                          Open full profile
                        </button>
                      </>
                    )}
                  </div>

                  {/* Currently building */}
                  <section>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                        Currently building
                      </h3>
                      {journeys.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setFullProfile(true)}
                          className="text-[10px] font-mono text-live hover:underline"
                        >
                          View all
                        </button>
                      )}
                    </div>

                    {active ? (
                      <button
                        type="button"
                        onClick={() => setOpenProjectId(active.id)}
                        className="w-full text-left rounded-xl border border-line overflow-hidden bg-[#12141a] hover:border-white/20 transition-colors"
                      >
                        <div className="aspect-video bg-black/60 relative grid place-items-center">
                          {active.phases[active.phases.length - 1]?.mediaUrl ? (
                            <video
                              src={active.phases[active.phases.length - 1].mediaUrl!}
                              className="absolute inset-0 w-full h-full object-cover opacity-80"
                              muted
                              playsInline
                            />
                          ) : (
                            <span className="text-2xl opacity-40" aria-hidden>
                              🔨
                            </span>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-[13px] font-medium text-white">{active.title}</p>
                          <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2">
                            {active.intent}
                          </p>
                          <div className="mt-2 flex items-center gap-2 text-[10px] font-mono">
                            <span className="text-live">
                              {active.status === "IN_PROGRESS" ? "In progress" : "Completed"}
                            </span>
                            <span className="text-neutral-600">Updated recently</span>
                          </div>
                        </div>
                      </button>
                    ) : (
                      <div className="rounded-xl border border-dashed border-line px-3 py-6 text-center">
                        <p className="text-[12px] text-neutral-400">
                          {isSelf
                            ? "No projects yet. Start one to show what you're building."
                            : "Nothing public yet. Follow to catch the first update."}
                        </p>
                        {isSelf && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!signedIn) requireAuth("start a project");
                              else useShellUi.getState().openLaunch?.();
                            }}
                            className="mt-3 btn glass rounded-full px-4 py-1.5 font-mono text-[11px] text-live"
                          >
                            Start a project
                          </button>
                        )}
                      </div>
                    )}
                  </section>

                  {/* Filters: Projects / Updates / Sessions */}
                  <section>
                    <div className="flex gap-1 mb-3">
                      {(
                        [
                          { id: "projects" as const, label: "Projects" },
                          { id: "updates" as const, label: "Updates" },
                          { id: "sessions" as const, label: "Sessions" },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setFilter(t.id)}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-mono border ${
                            filter === t.id
                              ? "border-live text-live bg-live/10"
                              : "border-line text-neutral-500"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {filter === "projects" && (
                      <ul className="space-y-2">
                        {journeys.length === 0 && (
                          <p className="text-[11px] text-neutral-600 font-mono">No projects yet.</p>
                        )}
                        {journeys.map((j) => (
                          <li key={j.id}>
                            <button
                              type="button"
                              onClick={() => setOpenProjectId(j.id)}
                              className="w-full text-left rounded-lg border border-line bg-[#12141a] px-3 py-2.5 hover:border-white/15"
                            >
                              <p className="text-[12px] font-medium text-white truncate">{j.title}</p>
                              <p className="text-[10px] text-neutral-500 line-clamp-1 mt-0.5">
                                {j.intent}
                              </p>
                              <p className="text-[10px] font-mono text-neutral-600 mt-1">
                                {j.phases.length} update{j.phases.length === 1 ? "" : "s"} ·{" "}
                                {j.status.replace("_", " ")}
                              </p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {filter === "updates" && (
                      <ul className="space-y-2">
                        {activity.length === 0 && (
                          <p className="text-[11px] text-neutral-600 font-mono">No updates yet.</p>
                        )}
                        {activity.map((a, i) => (
                          <li key={i}>
                            <button
                              type="button"
                              onClick={() => setOpenProjectId(a.projectId)}
                              className="w-full text-left rounded-lg border border-line bg-[#12141a] px-3 py-2.5 hover:border-white/15"
                            >
                              <p className="text-[12px] text-white">
                                <span className="font-mono text-[10px] text-neutral-500 mr-1.5">
                                  {a.dayLabel}
                                </span>
                                {a.phaseTitle}
                              </p>
                              <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-2">
                                {a.summary}
                              </p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {filter === "sessions" && (
                      <p className="text-[11px] text-neutral-600 font-mono py-2">
                        Live and recorded sessions linked to projects will appear here. Work sessions stay optional — not required to show progress.
                      </p>
                    )}
                  </section>

                  {/* Recent activity summary */}
                  {activity.length > 0 && filter === "projects" && (
                    <section>
                      <h3 className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 mb-2">
                        Recent activity
                      </h3>
                      <ul className="space-y-2.5">
                        {activity.slice(0, 3).map((a, i) => (
                          <li key={i} className="flex gap-2.5">
                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-live/60 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[12px] text-white truncate">{a.phaseTitle}</p>
                              <p className="text-[11px] text-neutral-500 line-clamp-1">{a.summary}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
