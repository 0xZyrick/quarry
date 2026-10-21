"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useOnboarding } from "../onboarding/OnboardingProvider";
import { useGuild } from "@/lib/store";
import CreateProjectFlow, { type CreatedProject } from "../project/CreateProjectFlow";
import SocialExportCard, { type ExportCardData } from "../project/SocialExportCard";
import { parseStreamUrl } from "@/lib/streamEmbed";
import { navigateToRoute } from "@/lib/appRoutes";

type MediaSource = "live" | "upload";
type ProjectOption = { id: string; title: string };
type Phase = "Idea" | "Prototype" | "Deploy";

async function uploadVideo(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/upload", { method: "POST", body: form });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Video upload failed.");
  return result as { url: string };
}

function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Math.ceil(video.duration));
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this video file."));
    };
    video.src = url;
  });
}

export default function CreateEntrance({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: account, signedIn, requireAuth } = useOnboarding();
  const studioUnlocked = useGuild((s) => !!s.profile?.studioUnlocked);
  const [studioCode, setStudioCode] = useState("");
  const [studioCodeError, setStudioCodeError] = useState("");
  const [studioCodeBusy, setStudioCodeBusy] = useState(false);
  const creatorId = account.uid || null;
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [phase, setPhase] = useState<Phase>("Prototype");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [source, setSource] = useState<MediaSource>("live");
  const [liveUrl, setLiveUrl] = useState("");
  const [video, setVideo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [published, setPublished] = useState<ExportCardData | null>(null);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setSummary("");
      setLiveUrl("");
      setVideo(null);
      setPhase("Prototype");
      setSource("live");
      setError("");
      setPublished(null);
      return;
    }
    if (!creatorId) return;
    let cancelled = false;
    fetch(`/api/projects?creatorId=${encodeURIComponent(creatorId)}`)
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Could not load your projects.");
        const list = (result.projects || result.mosaic || []).map((project: ProjectOption) => ({
          id: project.id,
          title: project.title,
        }));
        if (!cancelled) {
          setProjects(list);
          setProjectId((current) => current || list[0]?.id || "");
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load your projects.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, creatorId]);

  const onProjectCreated = (project: CreatedProject) => {
    setProjects((current) => [{ id: project.id, title: project.title }, ...current]);
    setProjectId(project.id);
    setCreateOpen(false);
  };

  const submit = async () => {
    if (!signedIn || !creatorId) {
      requireAuth("create a Studio update", () => void submit());
      return;
    }
    if (!projectId) {
      setError("Create or select a project first.");
      return;
    }
    if (title.trim().length < 3 || summary.trim().length < 3) {
      setError("Add an update title and a short description.");
      return;
    }
    const projectName = projects.find((project) => project.id === projectId)?.title || "Project";
    setBusy(true);
    setError("");
    try {
      if (source === "live") {
        const parsed = parseStreamUrl(liveUrl);
        if (!parsed?.embedUrl || (parsed.platform !== "twitch" && parsed.platform !== "youtube")) {
          throw new Error("Paste a valid Twitch or YouTube live stream link.");
        }
        const nodeResponse = await fetch(`/api/projects/${encodeURIComponent(projectId)}/nodes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            updateTitle: title.trim(),
            phaseTitle: phase,
            summaryText: summary.trim(),
            liveUrl: liveUrl.trim(),
            startSession: true,
            acknowledgedPolicy: true,
            domain: "build",
            currentState: summary.trim(),
          }),
        });
        const nodeResult = await nodeResponse.json().catch(() => ({}));
        if (!nodeResponse.ok) throw new Error(nodeResult.error || "Could not create the live update.");

        const sessionResponse = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creatorId,
            projectId,
            journeyNodeId: nodeResult.node?.id,
            title: title.trim(),
            currentState: summary.trim(),
            liveUrl: liveUrl.trim(),
            roomId: projectId,
            mode: "LIVE",
          }),
        });
        const sessionResult = await sessionResponse.json().catch(() => ({}));
        if (!sessionResponse.ok) {
          await fetch(`/api/projects/${encodeURIComponent(projectId)}/nodes`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nodeId: nodeResult.node?.id, endSession: true }),
          });
          throw new Error(sessionResult.error || "The update was created, but the live room could not start.");
        }
        onClose();
        navigateToRoute({ kind: "room", id: projectId });
        return;
      }

      if (!video) throw new Error("Choose a video file to upload.");
      if (!video.type.startsWith("video/")) throw new Error("Choose a video file.");
      const durationSecs = await videoDuration(video);
      if (!Number.isFinite(durationSecs) || durationSecs < 1 || durationSecs > 90) {
        throw new Error("Video updates must be 90 seconds or shorter.");
      }
      const uploaded = await uploadVideo(video);
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updateTitle: title.trim(),
          phaseTitle: phase,
          summaryText: summary.trim(),
          media: { videoUrl: uploaded.url, durationSecs, tag: phase },
          acknowledgedPolicy: true,
          domain: "build",
          currentState: summary.trim(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not publish this video update.");
      const updateNumber = Number(result.node?.position) || 1;
      setPublished({
        projectId,
        projectName,
        title: title.trim(),
        summary: summary.trim(),
        updateNumber,
        phase,
        handle: account.name?.replace(/^@/, "") || "builder",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not publish this update.");
    } finally {
      setBusy(false);
    }
  };


  const unlockStudio = async (event: FormEvent) => {
    event.preventDefault();
    setStudioCodeBusy(true);
    setStudioCodeError("");
    try {
      const response = await fetch("/api/studio/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: studioCode }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not unlock Studio.");
      useGuild.setState((state) => ({
        profile: state.profile ? { ...state.profile, studioUnlocked: true } : state.profile,
      }));
      setStudioCode("");
    } catch (error) {
      setStudioCodeError(error instanceof Error ? error.message : "Could not unlock Studio.");
    } finally {
      setStudioCodeBusy(false);
    }
  };

  if (!open) return null;

  // Invite only when trying to create — studio itself stays viewable
  if (!studioUnlocked) {
    return (
      <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/70 px-4 py-8">
        <section className="relative w-full max-w-md rounded-2xl border border-white/15 bg-[#111318] p-6 shadow-2xl">
          <button type="button" onClick={onClose} className="absolute right-5 top-5 text-[12px] text-white/50 hover:text-white">
            Cancel
          </button>
          <div className="border-y border-white/15 py-3 text-center">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-white">
              {signedIn ? "Creator invite code" : "Studio is locked"}
            </h2>
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-white/55">
            {signedIn
              ? "Enter your creator invite code to publish projects, updates, and live sessions."
              : "Sign in or create an account, then unlock Studio with a creator invite code."}
          </p>
          {signedIn ? (
            <form onSubmit={unlockStudio} className="mt-5 space-y-3">
              <label className="block text-[11px] font-medium text-white/60" htmlFor="create-studio-code">
                Creator code
              </label>
              <input
                id="create-studio-code"
                autoComplete="off"
                value={studioCode}
                onChange={(e) => setStudioCode(e.target.value)}
                placeholder="Enter your creator code"
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-3 text-[13px] text-white outline-none focus:border-white/35"
              />
              {studioCodeError && <p role="alert" className="text-[12px] text-red-300">{studioCodeError}</p>}
              <button
                type="submit"
                disabled={!studioCode.trim() || studioCodeBusy}
                className="w-full rounded-xl bg-white py-3 text-[12px] font-bold uppercase tracking-wide text-black disabled:opacity-40"
              >
                {studioCodeBusy ? "Checking…" : "Unlock create"}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("wippo:auth", { detail: "unlock Studio create" }))}
              className="mt-5 w-full rounded-xl bg-white py-3 text-[12px] font-bold uppercase tracking-wide text-black"
            >
              Sign in to unlock
            </button>
          )}
        </section>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/70 px-4 py-8">
        <section className="relative w-full max-w-2xl rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7 shadow-2xl">
          <button type="button" onClick={onClose} className="absolute right-5 top-5 text-[12px] text-[var(--text-muted)] hover:text-[var(--text)]">Cancel</button>
          <h2 className="pr-16 text-[17px] font-semibold text-[var(--text)]">Launch session / post update</h2>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">
            Choose a project, name this update, then go live or publish a video.
          </p>

          <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-[11px] font-medium text-[var(--text-muted)]">
                Project
                <select
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--page)] px-3 py-3 text-[13px] text-[var(--text)]"
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
                </select>
              </label>
              <label className="block text-[11px] font-medium text-[var(--text-muted)]">
                Pipeline node
                <select
                  value={phase}
                  onChange={(event) => setPhase(event.target.value as Phase)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--page)] px-3 py-3 text-[13px] text-[var(--text)]"
                >
                  {(["Idea", "Prototype", "Deploy"] as const).map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
            </div>
            {projects.length === 0 && (
              <button type="button" onClick={() => setCreateOpen(true)} className="text-[12px] font-medium text-[var(--coral)]">
                + Create your first project
              </button>
            )}
            {projects.length > 0 && (
              <button type="button" onClick={() => setCreateOpen(true)} className="text-[11px] text-[var(--coral)]">
                + New project
              </button>
            )}


            <label className="block text-[11px] font-medium text-[var(--text-muted)]">
              Update title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                placeholder="Fixing ICE memory leaks"
                className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--page)] px-3 py-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)]"
              />
            </label>
            <label className="block text-[11px] font-medium text-[var(--text-muted)]">
              What are you working on?
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Refactoring WebRTC signaling to fix ICE candidate leaks…"
                className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--page)] px-3 py-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)]"
              />
            </label>

            <fieldset>
              <legend className="text-[11px] font-medium text-[var(--text-muted)]">Choose media source</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {([
                  ["live", "Live stream", "Paste a Twitch or YouTube Live link"],
                  ["upload", "Video upload", "Publish a replayable video update"],
                ] as const).map(([value, label, hint]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={source === value}
                    onClick={() => setSource(value)}
                    className={`rounded-xl border p-3 text-left ${source === value ? "border-[var(--coral)] bg-[var(--coral)]/10" : "border-[var(--line)]"}`}
                  >
                    <span className="block text-[12px] font-semibold text-[var(--text)]">{label}</span>
                    <span className="mt-1 block text-[10px] text-[var(--text-faint)]">{hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {source === "live" ? (
              <label className="block text-[11px] font-medium text-[var(--text-muted)]">
                Live stream URL
                <input
                  type="url"
                  value={liveUrl}
                  onChange={(event) => setLiveUrl(event.target.value)}
                  placeholder="https://www.twitch.tv/... or YouTube Live"
                  className="mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--page)] px-3 py-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)]"
                />
              </label>
            ) : (
              <label className="block text-[11px] font-medium text-[var(--text-muted)]">
                Video file (up to 40 MB, 90 seconds)
                <input
                  type="file"
                  accept="video/*"
                  onChange={(event) => setVideo(event.target.files?.[0] || null)}
                  className="mt-1.5 block w-full text-[12px] text-[var(--text-muted)]"
                />
                {video && <span className="mt-1 block text-[10px] text-[var(--text-faint)]">{video.name}</span>}
              </label>
            )}

            {error && <p role="alert" className="text-[12px] text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-[var(--coral)] py-3 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              {busy ? (source === "live" ? "Starting…" : "Uploading…") : source === "live" ? "Go live / Start session" : "Publish video update"}
            </button>
          </form>
        </section>

        <CreateProjectFlow
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={onProjectCreated}
          creatorId={creatorId}
          handle={account.name || ""}
        />
      </div>
      {published && <SocialExportCard data={published} onClose={onClose} />}
    </>
  );
}
