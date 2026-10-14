"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useGuild } from "@/lib/store";
import JourneyRail from "./JourneyRail";
import ConnectionCockpit from "./ConnectionCockpit";
import CreatorJourney from "./CreatorJourney";

type MediaDrop = { id: string; type: string; videoUrl: string; durationSecs: number; decisionMetric: string | null; tag: string | null; isLiveExtract: boolean };
type Contribution = { id: string; type: "SUGGESTION" | "CRITIQUE" | "ENCOURAGEMENT"; messageText: string; isPinnedByHost: boolean; createdAt: string; user: { id: string; handle: string | null } };
type JourneyNode = { id: string; position: number; dayLabel: string; phaseTitle: string; summaryText: string; evolutionDelta: string | null; prevSnapshotUrl: string | null; nextSnapshotUrl: string | null; mediaDrops: MediaDrop[]; discussions: Contribution[]; createdAt: string };
type Project = { id: string; title: string; intentStatement: string; currentState?: string | null; nextStep?: string | null; status: string; creator: { id: string; handle: string | null; levelTrack: string }; journeyNodes: JourneyNode[]; updatedAt: string };

export default function ProjectWorkspace({ projectId, onClose }: { projectId: string; onClose?: () => void }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [cockpitOpen, setCockpitOpen] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const profile = useGuild((s) => s.profile);
  const userId = (profile as any)?.id ?? profile?.handle ?? "";

  useEffect(() => {
    let dead = false;
    setLoading(true);
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((d) => {
        if (dead) return;
        if (d.error) setError(d.error);
        else {
          setProject(d.project);
          if (d.project?.journeyNodes?.length) {
            setSelectedNodeId(d.project.journeyNodes[d.project.journeyNodes.length - 1].id);
          }
        }
      })
      .catch(() => !dead && setError("Failed to load project"))
      .finally(() => !dead && setLoading(false));
    return () => { dead = true; };
  }, [projectId]);

  // Check follow status + mark seen on open (Return loop)
  useEffect(() => {
    if (!userId || !projectId) return;
    fetch(`/api/follows?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => {
        const hit = (d.follows ?? []).some((f: any) => f.projectId === projectId);
        setFollowing(hit);
        if (hit) {
          fetch("/api/follows", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, projectId }),
          }).catch(() => {});
        }
      })
      .catch(() => {});
  }, [userId, projectId]);

  const toggleFollow = async () => {
    if (followBusy || !userId || !project) return;
    setFollowBusy(true);
    try {
      if (following) {
        await fetch("/api/follows", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, projectId: project.id }),
        });
        setFollowing(false);
      } else {
        await fetch("/api/follows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, projectId: project.id }),
        });
        setFollowing(true);
      }
    } finally {
      setFollowBusy(false);
    }
  };

  if (showCreator && project?.creator.handle) {
    return (
      <CreatorJourney
        handle={project.creator.handle}
        onClose={() => setShowCreator(false)}
      />
    );
  }

  if (loading) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-deep text-neutral-400 font-mono text-sm">
        Loading narrative…
      </div>
    );
  }
  if (error || !project) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-deep text-risk font-mono text-sm">
        {error ?? "Project not found"}
        {onClose && (
          <button onClick={onClose} className="mt-4 btn glass px-3 py-1.5 rounded-full text-xs">
            Back to Mosaic
          </button>
        )}
      </div>
    );
  }

  const selected =
    project.journeyNodes.find((n) => n.id === selectedNodeId) ??
    project.journeyNodes[project.journeyNodes.length - 1] ??
    null;

  return (
    <div className="absolute inset-0 flex flex-col bg-deep overflow-hidden">
      <header className="shrink-0 border-b border-white/5 px-4 py-3 flex items-start gap-3">
        {onClose && (
          <button
            onClick={onClose}
            className="btn glass rounded-full w-8 h-8 grid place-items-center text-neutral-300 hover:text-white mt-0.5"
            aria-label="Back"
          >
            ←
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-semibold text-white truncate">{project.title}</h1>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-400">
              {project.status.replace("_", " ")}
            </span>
          </div>
          <p className="mt-1 text-sm text-live leading-snug">
            <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider mr-1.5">
              Goal
            </span>
            {project.intentStatement}
          </p>
          {(project.currentState || project.nextStep) && (
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-neutral-400">
              {project.currentState && (
                <span>
                  <span className="font-mono text-neutral-600 uppercase mr-1">Now</span>
                  {project.currentState}
                </span>
              )}
              {project.nextStep && (
                <span>
                  <span className="font-mono text-neutral-600 uppercase mr-1">Next</span>
                  {project.nextStep}
                </span>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => project.creator.handle && setShowCreator(true)}
            className="mt-0.5 text-[11px] text-neutral-500 font-mono hover:text-live"
          >
            @{project.creator.handle ?? "anon"} · {project.creator.levelTrack}
          </button>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          {userId && (
            <button
              onClick={toggleFollow}
              disabled={followBusy}
              className={`btn glass rounded-full px-2.5 py-1 font-mono text-[11px] ${
                following ? "text-live" : "text-neutral-300 hover:text-white"
              }`}
            >
              {following ? "Following" : "Follow"}
            </button>
          )}
          <button
            onClick={() => setCockpitOpen((v) => !v)}
            className="btn glass rounded-full px-2.5 py-1 font-mono text-[11px] text-neutral-300 hover:text-white"
          >
            {cockpitOpen ? "Hide" : "Participate"}
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0 overflow-y-auto px-4 py-4">
          <JourneyRail
            nodes={project.journeyNodes}
            selectedId={selectedNodeId}
            onSelect={setSelectedNodeId}
          />
        </div>
        {cockpitOpen && selected && (
          <motion.aside
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="w-full max-w-sm shrink-0 border-l border-white/5 bg-card/80 backdrop-blur-md overflow-y-auto"
          >
            <ConnectionCockpit
              node={selected}
              projectId={project.id}
              hostId={project.creator.id}
              onContribution={() => {
                fetch(`/api/projects/${projectId}`)
                  .then((r) => r.json())
                  .then((d) => d.project && setProject(d.project));
              }}
            />
          </motion.aside>
        )}
      </div>
    </div>
  );
}
