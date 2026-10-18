"use client";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { currentUid } from "@/lib/circle";

type Status = "idea" | "in_progress" | "paused" | "completed";
type Visibility = "public" | "circle" | "private";
type SetupStep = 0 | 1 | 2;

export type CreatedProject = {
  id: string;
  title: string;
  intentStatement: string;
};

const STATUS_OPTS: { id: Status; label: string; hint: string }[] = [
  { id: "idea", label: "Idea", hint: "Exploring — nothing shipped yet" },
  { id: "in_progress", label: "In progress", hint: "Actively making" },
  { id: "paused", label: "Paused", hint: "On hold for now" },
  { id: "completed", label: "Completed", hint: "This chapter is done" },
];

const VIS_OPTS: { id: Visibility; label: string; hint: string }[] = [
  { id: "public", label: "Public", hint: "Anyone on Wippo can find it" },
  { id: "circle", label: "Circle", hint: "People who follow this project" },
  { id: "private", label: "Private", hint: "Only you (for now)" },
];

async function uploadFile(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Upload failed");
  return d as { url: string };
}

/**
 * Short create-project flow.
 * Idea → first artifact → stage and visibility → publish.
 * Posts belong to a project so every update can live in a journey.
 */
export default function CreateProjectFlow({
  open,
  onClose,
  onCreated,
  creatorId,
  handle,
}: {
  open: boolean;
  onClose: () => void;
  /** Called after publish. Second arg: whether to open first-update flow */
  onCreated: (project: CreatedProject, postFirstUpdate: boolean) => void;
  creatorId?: string | null;
  handle?: string | null;
}) {
  const [title, setTitle] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [intent, setIntent] = useState("");
  const [status, setStatus] = useState<Status>("in_progress");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [step, setStep] = useState<SetupStep>(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setCover(null);
    setCoverPreview(null);
    setIntent("");
    setStatus("in_progress");
    setVisibility("public");
    setStep(0);
    setBusy(false);
    setErr("");
  }, [open]);

  useEffect(() => {
    if (!cover) {
      setCoverPreview(null);
      return;
    }
    const u = URL.createObjectURL(cover);
    setCoverPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [cover]);

  const uid = creatorId || currentUid();

  const nextStep = () => {
    setErr("");
    if (step === 0) {
      if (title.trim().length < 2) {
        setErr("Give this project a name before moving on.");
        return;
      }
      if (intent.trim().length < 10) {
        setErr("Add a little context about what you want to make possible.");
        return;
      }
    }
    setStep((current) => Math.min(2, current + 1) as SetupStep);
  };

  const publish = async (postFirstUpdate: boolean) => {
    if (!uid) {
      setErr("Sign in to create a project");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const coverImageUrl = cover ? (await uploadFile(cover)).url : undefined;

      const apiStatus = status === "completed" ? "COMPLETED" : "IN_PROGRESS";
      const r = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: uid,
          handle: handle || null,
          title: title.trim(),
          intentStatement: intent.trim(),
          status: apiStatus,
          // visibility stored client-side until schema supports it
          visibility,
          coverImageUrl,
          currentState:
            status === "idea"
              ? "Idea stage"
              : status === "paused"
                ? "Paused"
                : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not create project");

      const project: CreatedProject = {
        id: d.project.id,
        title: d.project.title,
        intentStatement: d.project.intentStatement,
      };

      // Remember visibility locally
      try {
        const key = "wippo.project.visibility";
        const map = JSON.parse(localStorage.getItem(key) || "{}");
        map[project.id] = visibility;
        localStorage.setItem(key, JSON.stringify(map));
      } catch {}

      onCreated(project, postFirstUpdate);
    } catch (e: any) {
      setErr(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
        <motion.button
          type="button"
          aria-label="Close"
          className="absolute inset-0 bg-black/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.div
          role="dialog"
          aria-labelledby="create-project-title"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          className="relative w-full sm:max-w-2xl max-h-[94dvh] sm:max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 pt-4 pb-3 border-b border-[var(--line)] bg-[var(--surface)]">
            <div>
              <p id="create-project-title" className="text-[15px] font-semibold text-[var(--text)]">Give the work a place to grow</p>
              <p className="text-[11px] text-[var(--text-faint)]">Start with the idea. The journey can take shape as you build.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[11px] text-[var(--text-muted)]">Close</button>
          </div>

          <div className="px-4 sm:px-6 py-5 space-y-4">
            <ol aria-label="Project setup" className="grid grid-cols-3 gap-2">
              {[
                ["01", "Name the work"],
                ["02", "Leave a trace"],
                ["03", "Set its pace"],
              ].map(([number, label], index) => (
                <li key={number} className="flex items-center gap-2 border-b border-[var(--line)] pb-2">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[9px] font-semibold ${index === step ? "bg-[var(--coral)] text-white" : index < step ? "bg-[var(--growth)]/20 text-[var(--growth)]" : "bg-white/[0.05] text-[var(--text-faint)]"}`}>
                    {number}
                  </span>
                  <span className={`text-[10px] sm:text-[11px] ${index === step ? "text-[var(--text)]" : "text-[var(--text-faint)]"}`}>{label}</span>
                </li>
              ))}
            </ol>
            {step === 0 && (
              <section className="min-h-[15rem] space-y-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--coral)]">First, name the intention</p>
                  <h2 className="mt-1 text-[18px] font-semibold text-[var(--text)]">What are you making possible?</h2>
                  <p className="mt-1 text-[12px] text-[var(--text-muted)]">This is the beginning of a project journey, not a pitch deck. It can stay rough.</p>
                </div>
                <input
                  autoFocus
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Give the work a name"
                  maxLength={80}
                  aria-label="Project name"
                  className="w-full border-b border-[var(--line)] bg-transparent px-1 py-3 text-[24px] font-semibold tracking-tight text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--coral)]"
                />
                <textarea
                  value={intent}
                  onChange={(event) => setIntent(event.target.value)}
                  rows={3}
                  maxLength={280}
                  placeholder="A few lines about the idea, the problem, or what you want to explore."
                  aria-label="Project intent"
                  className="w-full resize-none rounded-2xl border border-[var(--line)] bg-[var(--page)] px-4 py-3 text-[14px] leading-relaxed text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--line-strong)]"
                />
              </section>
            )}

            {step === 1 && (
              <section className="min-h-[15rem] space-y-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--coral)]">Leave a trace</p>
                  <h2 className="mt-1 text-[18px] font-semibold text-[var(--text)]">What exists so far?</h2>
                  <p className="mt-1 text-[12px] text-[var(--text-muted)]">A sketch, a screenshot, a frame, or a prototype gives people a place to begin with you. This is optional.</p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => setCover(event.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="relative w-full aspect-[16/9] max-h-[17rem] rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--page)] overflow-hidden grid place-items-center text-left"
                >
                  {coverPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverPreview} alt="Project artifact preview" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <span className="px-4 text-center">
                      <span className="block text-[13px] font-medium text-[var(--text)]">Choose a first artifact</span>
                      <span className="mt-1 block text-[11px] text-[var(--text-faint)]">PNG, JPG, or another image from the work</span>
                    </span>
                  )}
                  {coverPreview && <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-3 py-1 text-[10px] text-white">Change artifact</span>}
                </button>
                {cover && <p className="text-[11px] text-[var(--text-faint)] truncate">{cover.name}</p>}
              </section>
            )}

            {step === 2 && (
              <section className="min-h-[15rem] grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--coral)]">Set its pace</p>
                    <h2 className="mt-1 text-[18px] font-semibold text-[var(--text)]">Where is the work today?</h2>
                    <p className="mt-1 text-[12px] text-[var(--text-muted)]">Projects can move between stages as the real work changes.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {STATUS_OPTS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={status === option.id}
                        onClick={() => setStatus(option.id)}
                        className={`rounded-xl border p-3 text-left transition-colors ${status === option.id ? "border-[var(--coral)]/60 bg-[var(--coral)]/10" : "border-[var(--line)] hover:bg-white/[0.03]"}`}
                      >
                        <span className={`block text-[12px] font-medium ${status === option.id ? "text-[var(--text)]" : "text-[var(--text-muted)]"}`}>{option.label}</span>
                        <span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-faint)]">{option.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[12px] font-semibold text-[var(--text)]">Who can find this journey?</p>
                  <p className="text-[11px] leading-relaxed text-[var(--text-faint)]">Choose how open the project is while it takes shape.</p>
                  {VIS_OPTS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={visibility === option.id}
                      onClick={() => setVisibility(option.id)}
                      className={`w-full rounded-xl border p-3 text-left ${visibility === option.id ? "border-[var(--growth)]/50 bg-[var(--growth)]/[0.07]" : "border-[var(--line)] hover:bg-white/[0.03]"}`}
                    >
                      <span className="block text-[12px] font-medium text-[var(--text)]">{option.label}</span>
                      <span className="mt-1 block text-[10px] text-[var(--text-faint)]">{option.hint}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {err && <p role="alert" className="text-[12px] text-red-400">{err}</p>}
            <div className="sticky bottom-0 -mx-4 sm:-mx-6 -mb-5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] bg-[var(--surface)] px-4 sm:px-6 py-3">
              {step > 0 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setErr("");
                    setStep((current) => Math.max(0, current - 1) as SetupStep);
                  }}
                  className="rounded-full border border-[var(--line)] px-4 py-2.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40"
                >
                  Back
                </button>
              ) : <span />}
              {step < 2 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={nextStep}
                  className="ml-auto rounded-full bg-[var(--coral)] px-5 py-2.5 text-[13px] font-semibold text-white hover:brightness-110 disabled:opacity-40"
                >
                  Continue
                </button>
              ) : (
                <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row">
                  <button
                    type="button"
                    disabled={busy || title.trim().length < 2 || intent.trim().length < 10}
                    onClick={() => publish(false)}
                    className="rounded-full border border-[var(--line)] px-4 py-2.5 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40"
                  >
                    {busy ? "Opening…" : "Open project canvas"}
                  </button>
                  <button
                    type="button"
                    disabled={busy || title.trim().length < 2 || intent.trim().length < 10}
                    onClick={() => publish(true)}
                    className="rounded-full bg-[var(--coral)] px-5 py-2.5 text-[12px] font-semibold text-white hover:brightness-110 disabled:opacity-40"
                  >
                    {busy ? "Opening…" : "Create · add first update"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
