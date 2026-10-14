"use client";
/**
 * Creator Launch Portal — Experience C
 * Starts with what the creator wants to share, not room type.
 * 1. Start or update a project
 * 2. Work live (session linked to a project or standalone)
 * 3. Share a quick discovery (Tease / clip)
 * Then: which project, lightweight context (goal / current / next), who can see it.
 */
import { useEffect, useState } from "react";
import { useShellUi } from "@/lib/shellUi";
import { useGuild } from "@/lib/store";
import { useHubs } from "@/lib/hubs";
import { useCapture } from "@/lib/capture";

type Action = "project" | "live" | "discovery" | null;

type ProjectOpt = { id: string; title: string; intent: string };

export default function LaunchPortal() {
  const profile = useGuild((s) => s.profile);
  const open = useShellUi((s) => s.launchOpen);
  const setOpen = (v: boolean) =>
    v ? useShellUi.getState().openLaunch() : useShellUi.getState().closeLaunch();

  const [action, setAction] = useState<Action>(null);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [newProject, setNewProject] = useState(false);

  // Lightweight context — optional, not a long form
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [currentState, setCurrentState] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [path, setPath] = useState<"digital" | "physical" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const creatorId = (profile as any)?.id ?? profile?.handle ?? "";
  const canLaunch = !!profile?.creatorNodeId;

  useEffect(() => {
    if (!open || !creatorId) return;
    fetch(`/api/projects?creatorId=${encodeURIComponent(creatorId)}`)
      .then((r) => r.json())
      .then((d) => setProjects((d.projects ?? []).map((p: any) => ({ id: p.id, title: p.title, intent: p.intent }))))
      .catch(() => {});
  }, [open, creatorId]);

  if (!open) return null;
  if (!canLaunch) return null;

  const reset = () => {
    setAction(null);
    setProjectId("");
    setNewProject(false);
    setTitle("");
    setGoal("");
    setCurrentState("");
    setNextStep("");
    setVisibility("PUBLIC");
    setPath(null);
    setErr("");
  };

  const close = () => {
    reset();
    setOpen(false);
  };

  // --- Start / update project ---
  const submitProject = async () => {
    if (!creatorId || goal.trim().length < 10) {
      setErr("Add a short goal (what you're trying to accomplish).");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      if (newProject || !projectId) {
        if (title.trim().length < 3) {
          setErr("Project title needed (min 3 chars).");
          setBusy(false);
          return;
        }
        const r = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creatorId,
            title: title.trim(),
            intentStatement: goal.trim(),
            currentState: currentState.trim() || undefined,
            nextStep: nextStep.trim() || undefined,
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Failed");
      } else {
        const r = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intentStatement: goal.trim() || undefined,
            currentState: currentState.trim() || null,
            nextStep: nextStep.trim() || null,
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Failed");
      }
      close();
    } catch (e: any) {
      setErr(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  // --- Work live ---
  const submitLive = async () => {
    if (!path) {
      setErr("Choose digital (screen) or physical (camera) path.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      // Optional project link + context via session API
      if (creatorId) {
        await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creatorId,
            projectId: projectId || null,
            title: title.trim() || goal.trim() || "Live session",
            goal: goal.trim() || null,
            currentState: currentState.trim() || null,
            nextStep: nextStep.trim() || null,
            visibility,
            mode: "LIVE",
            roomId: profile!.creatorNodeId,
          }),
        }).catch(() => {});
      }

      const ok = await useCapture.getState().start(path === "digital" ? "digital" : "physical");
      if (!ok) {
        setErr(useCapture.getState().error || "Could not start capture");
        setBusy(false);
        return;
      }
      const roomId = profile!.creatorNodeId!;
      await useHubs.getState().goLive(roomId, {
        canvas: path === "digital" ? "Screen share" : null,
        skill: "build",
      });
      if (visibility === "PRIVATE") {
        useGuild.setState((s) => ({ quiet: { ...s.quiet, [roomId]: true } }));
      }
      useGuild.getState().setRoomId(roomId);
      useGuild.getState().setRoom("commons");
      useGuild.getState().setLayer(2);
      close();
    } catch (e: any) {
      setErr(e.message ?? "Launch failed");
    } finally {
      setBusy(false);
    }
  };

  // --- Quick discovery (Tease) ---
  const submitDiscovery = async () => {
    if (!projectId && !newProject) {
      setErr("Link this discovery to a project (or start one).");
      return;
    }
    if (goal.trim().length < 5 && currentState.trim().length < 5) {
      setErr("Add a short goal or current state so visitors understand the clip.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      let pid = projectId;
      if (newProject || !pid) {
        if (title.trim().length < 3) {
          setErr("Project title needed.");
          setBusy(false);
          return;
        }
        const r = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creatorId,
            title: title.trim(),
            intentStatement: goal.trim() || currentState.trim(),
            currentState: currentState.trim() || undefined,
            nextStep: nextStep.trim() || undefined,
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Failed");
        pid = d.project.id;
      }
      // Append a journey node as the discovery phase
      const nr = await fetch(`/api/projects/${pid}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayLabel: "UPDATE",
          phaseTitle: "QUICK DISCOVERY",
          summaryText: currentState.trim() || goal.trim(),
          evolutionDelta: nextStep.trim() || null,
          media: undefined, // host attaches media later / capture pipeline
        }),
      });
      const nd = await nr.json();
      if (!nr.ok) throw new Error(nd.error ?? "Failed to post update");
      close();
    } catch (e: any) {
      setErr(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-card shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">
              {action === null && "What would you like to share?"}
              {action === "project" && "Start or update a project"}
              {action === "live" && "Work live"}
              {action === "discovery" && "Share a quick discovery"}
            </h2>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {action === null
                ? "Your real work creates the material. Quarry adds context."
                : "Lightweight context — not a lengthy form."}
            </p>
          </div>
          <button onClick={close} className="btn glass rounded-full w-8 h-8 grid place-items-center text-neutral-400">
            ×
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {action === null && (
            <div className="space-y-2">
              {(
                [
                  {
                    id: "project" as const,
                    title: "Start or update a project",
                    sub: "Define what you're building and preserve its progress over time.",
                  },
                  {
                    id: "live" as const,
                    title: "Work live",
                    sub: "Open a session connected to a project, or a standalone session.",
                  },
                  {
                    id: "discovery" as const,
                    title: "Share a quick discovery",
                    sub: "Post a short clip, experiment, insight, or work-in-progress update.",
                  },
                ] as const
              ).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAction(a.id)}
                  className="w-full text-left rounded-xl border border-white/8 bg-black/20 hover:border-live/40 hover:bg-live/5 p-4 transition-colors"
                >
                  <p className="text-sm font-medium text-white">{a.title}</p>
                  <p className="text-[12px] text-neutral-500 mt-1">{a.sub}</p>
                </button>
              ))}
            </div>
          )}

          {action !== null && (
            <>
              {/* Project picker */}
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">
                  Project {action === "live" ? "(optional)" : ""}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewProject(true);
                      setProjectId("");
                    }}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-mono border ${
                      newProject ? "border-live text-live bg-live/10" : "border-white/10 text-neutral-400"
                    }`}
                  >
                    + New project
                  </button>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setNewProject(false);
                        setProjectId(p.id);
                        setGoal(p.intent);
                      }}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-mono border truncate max-w-[10rem] ${
                        projectId === p.id ? "border-live text-live bg-live/10" : "border-white/10 text-neutral-400"
                      }`}
                    >
                      {p.title}
                    </button>
                  ))}
                </div>
                {newProject && (
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Project title"
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-live/40"
                  />
                )}
              </div>

              {/* Context triad — lightweight */}
              <div className="space-y-2">
                <label className="block">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                    Goal {action === "project" ? "· required" : "· optional"}
                  </span>
                  <input
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="What am I trying to accomplish?"
                    className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-live/40"
                  />
                </label>
                <label className="block">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                    Current state · optional
                  </span>
                  <input
                    value={currentState}
                    onChange={(e) => setCurrentState(e.target.value)}
                    placeholder="What am I working on or figuring out?"
                    className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-live/40"
                  />
                </label>
                <label className="block">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                    Next step · optional
                  </span>
                  <input
                    value={nextStep}
                    onChange={(e) => setNextStep(e.target.value)}
                    placeholder="What am I trying next?"
                    className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-live/40"
                  />
                </label>
              </div>

              {/* Visibility */}
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">Who can see this</p>
                <div className="flex gap-2">
                  {(
                    [
                      { id: "PUBLIC" as const, label: "Public — Mosaic & followers" },
                      { id: "PRIVATE" as const, label: "Private — authorized only" },
                    ] as const
                  ).map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVisibility(v.id)}
                      className={`flex-1 rounded-lg px-2 py-2 text-[11px] font-mono border ${
                        visibility === v.id ? "border-live text-live bg-live/10" : "border-white/10 text-neutral-400"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                {visibility === "PRIVATE" && (
                  <p className="mt-1.5 text-[10px] text-neutral-600">
                    Private content never appears on the public Mosaic or Map.
                  </p>
                )}
              </div>

              {/* Live-only: capture path */}
              {action === "live" && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">How you work</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPath("digital")}
                      className={`flex-1 rounded-lg px-2 py-2 text-[11px] border ${
                        path === "digital" ? "border-live text-live bg-live/10" : "border-white/10 text-neutral-400"
                      }`}
                    >
                      Digital · screen share
                    </button>
                    <button
                      type="button"
                      onClick={() => setPath("physical")}
                      className={`flex-1 rounded-lg px-2 py-2 text-[11px] border ${
                        path === "physical" ? "border-live text-live bg-live/10" : "border-white/10 text-neutral-400"
                      }`}
                    >
                      Physical · camera
                    </button>
                  </div>
                </div>
              )}

              {err && <p className="text-[12px] text-risk">{err}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAction(null)}
                  className="flex-1 btn glass rounded-lg py-2.5 text-xs text-neutral-400"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (action === "project") submitProject();
                    else if (action === "live") submitLive();
                    else submitDiscovery();
                  }}
                  className="flex-1 btn glass rounded-lg py-2.5 text-xs text-live disabled:opacity-40"
                >
                  {busy ? "Working…" : action === "live" ? "Go live" : action === "discovery" ? "Share update" : "Save project"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
