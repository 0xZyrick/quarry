"use client";
/**
 * Single entrance: "What are you working on?"
 * Pick existing project or create → then update (images/video) or go live (URL).
 */
import { useEffect, useState } from "react";
import { useOnboarding } from "../onboarding/OnboardingProvider";
import CreateProjectFlow, { type CreatedProject } from "../project/CreateProjectFlow";
import CustomDropdown from "../shared/CustomDropdown";
import { navigateToRoute } from "@/lib/appRoutes";

type Step = "ask" | "pick" | "update" | "live" | "new-project";

async function uploadFile(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Upload failed");
  return d as { url: string };
}

export default function CreateEntrance({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: onb, signedIn, requireAuth } = useOnboarding();
  const creatorId = onb.uid || null;
  const [step, setStep] = useState<Step>("ask");
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [context, setContext] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [updateKind, setUpdateKind] = useState<"MILESTONE" | "DEAD_END" | "DECISION" | "PARTIAL">("MILESTONE");
  const [triedLines, setTriedLines] = useState("");
  const [promptUsed, setPromptUsed] = useState("");
  const [toolsLine, setToolsLine] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("ask");
      setErr("");
      setContext("");
      setLiveUrl("");
      setImages([]);
      return;
    }
    if (!creatorId) return;
    fetch(`/api/projects?creatorId=${encodeURIComponent(creatorId)}`)
      .then((r) => r.json())
      .then((d) => {
        const list = (d.projects || d.mosaic || []).map((p: any) => ({
          id: p.id,
          title: p.title,
        }));
        setProjects(list);
        if (list[0]) setProjectId(list[0].id);
      })
      .catch(() => {});
  }, [open, creatorId]);

  if (!open) return null;

  const needAuth = (why: string) => {
    if (signedIn) return false;
    requireAuth?.(why);
    return true;
  };

  const goPick = (next: "update" | "live") => {
    if (needAuth("share what you're building")) return;
    if (projects.length === 0) {
      setCreateOpen(true);
      return;
    }
    setStep("pick");
    // stash intent in data attribute via state: after pick go to next
    (window as any).__wippoCreateNext = next;
  };

  const afterPick = () => {
    const next = (window as any).__wippoCreateNext as "update" | "live";
    setStep(next === "live" ? "live" : "update");
  };

  const onCreated = (p: CreatedProject, postFirst: boolean) => {
    setProjects((list) => [{ id: p.id, title: p.title }, ...list]);
    setProjectId(p.id);
    setCreateOpen(false);
    setStep(postFirst ? "update" : "ask");
  };

  const submitUpdate = async () => {
    if (!projectId) {
      setErr("Pick a project");
      return;
    }
    if (context.trim().length < 3) {
      setErr("Add a short note about this update");
      return;
    }
    if (images.length < 1) {
      setErr("Add at least one image (max 3)");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const urls: string[] = [];
      for (const f of images.slice(0, 3)) {
        const u = await uploadFile(f);
        urls.push(u.url);
      }
      const r = await fetch(`/api/projects/${projectId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summaryText: context.trim(),
          imageUrls: urls,
          prevSnapshotUrl: urls[0],
          nextSnapshotUrl: urls[1] || urls[0],
          updateKind,
          promptUsed: promptUsed.trim() || undefined,
          tools: toolsLine
            .split(/,/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 8),
          tried: triedLines
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
              const m = line.match(/^(DEAD_END|PARTIAL|WORKED|ARTIFACT)\s*[:—-]\s*(.+)$/i);
              if (m) {
                return {
                  outcome: m[1].toUpperCase().replace(" ", "_"),
                  detail: m[2],
                };
              }
              return { outcome: "WORKED", detail: line };
            }),
          acknowledgedPolicy: true,
          domain: "code",
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Failed");
      onClose();
    } catch (e: any) {
      setErr(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const submitLive = async () => {
    if (!projectId) {
      setErr("Pick a project");
      return;
    }
    const url = liveUrl.trim();
    if (url.length < 12 || !/^https?:\/\//i.test(url)) {
      setErr("Paste a full Twitch or YouTube Live URL");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const nodeRes = await fetch(`/api/projects/${projectId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summaryText: context.trim() || "Live session",
          phaseTitle: "LIVE",
          liveUrl: url,
          startSession: true,
          acknowledgedPolicy: true,
          domain: "build",
        }),
      });
      const nodeData = await nodeRes.json().catch(() => ({}));
      if (!nodeRes.ok) throw new Error(nodeData.error || "Could not start");

      if (creatorId) {
        await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creatorId,
            projectId,
            journeyNodeId: nodeData.node?.id,
            title: context.trim() || "Live session",
            liveUrl: url,
            roomId: projectId,
            mode: "LIVE",
          }),
        }).catch(() => {});
      }

      onClose();
      navigateToRoute({ kind: "room", id: projectId });
    } catch (e: any) {
      setErr(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <button type="button" className="absolute inset-0 bg-black/70" onClick={onClose} aria-label="Close" />
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {step === "ask" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-[18px] font-semibold text-[var(--text)]">What are you working on?</h2>
              <p className="text-[13px] text-[var(--text-muted)] mt-1">
                Every update belongs to a project journey — live link, stills, or a short clip.
              </p>
            </div>
            <button
              type="button"
              onClick={() => goPick("update")}
              className="w-full rounded-2xl border border-[var(--line)] px-4 py-4 text-left hover:border-[var(--line-strong)]"
            >
              <p className="text-[14px] font-semibold text-[var(--text)]">Post an update</p>
              <p className="text-[12px] text-[var(--text-faint)] mt-0.5">Images + context on a project</p>
            </button>
            <button
              type="button"
              onClick={() => goPick("live")}
              className="w-full rounded-2xl border border-[var(--line)] px-4 py-4 text-left hover:border-[var(--line-strong)]"
            >
              <p className="text-[14px] font-semibold text-[var(--text)]">Go live</p>
              <p className="text-[12px] text-[var(--text-faint)] mt-0.5">
                Paste Twitch or YouTube Live — Wippo embeds it
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                if (needAuth("start a project")) return;
                setCreateOpen(true);
              }}
              className="w-full rounded-2xl border border-dashed border-[var(--line-strong)] px-4 py-4 text-left"
            >
              <p className="text-[14px] font-semibold text-[var(--coral)]">New project</p>
              <p className="text-[12px] text-[var(--text-faint)] mt-0.5">Name it, optional description and tags</p>
            </button>
            <button type="button" onClick={onClose} className="w-full text-[12px] text-[var(--text-muted)] py-2">
              Cancel
            </button>
          </div>
        )}

        {step === "pick" && (
          <div className="space-y-4">
            <h2 className="text-[16px] font-semibold text-[var(--text)]">Which project?</h2>
            <CustomDropdown
              label="Choose a project"
              value={projectId}
              options={projects.map((project) => ({ value: project.id, label: project.title }))}
              onChange={setProjectId}
            />
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="text-[12px] text-[var(--coral)]"
            >
              + New project
            </button>
            <button
              type="button"
              onClick={afterPick}
              disabled={!projectId}
              className="w-full rounded-full bg-[var(--coral)] py-3 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              Continue
            </button>
            <button type="button" onClick={() => setStep("ask")} className="w-full text-[12px] text-[var(--text-muted)]">
              Back
            </button>
          </div>
        )}

        {step === "update" && (
          <div className="space-y-4">
            <h2 className="text-[16px] font-semibold text-[var(--text)]">This update</h2>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
              placeholder="What changed? What are you trying?"
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--page)] px-3 py-2.5 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
            />
            <div>
              <label className="text-[11px] text-[var(--text-faint)]">Update kind</label>
              <div className="mt-1 flex flex-wrap gap-1">
                {(
                  [
                    ["MILESTONE", "Milestone"],
                    ["DEAD_END", "Dead end"],
                    ["DECISION", "Decision"],
                    ["PARTIAL", "Partial"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setUpdateKind(id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] border ${
                      updateKind === id
                        ? "border-[var(--coral)] bg-[var(--coral)]/15 text-[var(--text)]"
                        : "border-[var(--line)] text-[var(--text-muted)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-faint)]">
                What was tried (one per line, optional: DEAD_END: …)
              </label>
              <textarea
                value={triedLines}
                onChange={(e) => setTriedLines(e.target.value)}
                rows={3}
                placeholder={"DEAD_END: Photographed clouds felt flat\nWORKED: Procedural soft noise"}
                className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--page)] px-3 py-2 text-[12px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-faint)]">Prompt used (optional)</label>
              <input
                value={promptUsed}
                onChange={(e) => setPromptUsed(e.target.value)}
                placeholder="LLM / helper prompt"
                className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--page)] px-3 py-2 text-[12px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-faint)]">Tools (comma-separated)</label>
              <input
                value={toolsLine}
                onChange={(e) => setToolsLine(e.target.value)}
                placeholder="Figma, Claude, Three.js"
                className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--page)] px-3 py-2 text-[12px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-faint)]">Images (1–3)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setImages(Array.from(e.target.files || []).slice(0, 3))}
                className="mt-1 block w-full text-[12px] text-[var(--text-muted)]"
              />
              {images.length > 0 && (
                <p className="text-[11px] text-[var(--text-faint)] mt-1">{images.length} selected</p>
              )}
            </div>
            {err && <p className="text-[12px] text-red-400">{err}</p>}
            <button
              type="button"
              disabled={busy}
              onClick={submitUpdate}
              className="w-full rounded-full bg-[var(--coral)] py-3 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Posting…" : "Post update"}
            </button>
            <button type="button" onClick={() => setStep("pick")} className="w-full text-[12px] text-[var(--text-muted)]">
              Back
            </button>
          </div>
        )}

        {step === "live" && (
          <div className="space-y-4">
            <h2 className="text-[16px] font-semibold text-[var(--text)]">Go live</h2>
            <input
              value={liveUrl}
              onChange={(e) => setLiveUrl(e.target.value)}
              placeholder="https://www.twitch.tv/… or youtube live URL"
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--page)] px-3 py-2.5 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
            />
            <input
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="What are you working on in this session?"
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--page)] px-3 py-2.5 text-[13px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
            />
            <p className="text-[11px] text-[var(--text-faint)]">
              Wippo embeds your stream. When you finish, attach the VOD on the journey update.
            </p>
            {err && <p className="text-[12px] text-red-400">{err}</p>}
            <button
              type="button"
              disabled={busy}
              onClick={submitLive}
              className="w-full rounded-full bg-[var(--coral)] py-3 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Starting…" : "Go live"}
            </button>
            <button type="button" onClick={() => setStep("pick")} className="w-full text-[12px] text-[var(--text-muted)]">
              Back
            </button>
          </div>
        )}
      </div>

      <CreateProjectFlow
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={onCreated}
        creatorId={creatorId}
        handle={onb.name || ""}
      />
    </div>
  );
}
