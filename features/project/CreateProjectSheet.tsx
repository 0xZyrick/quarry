"use client";
import { useState } from "react";
import { useGuild } from "@/lib/store";

export default function CreateProjectSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (projectId: string) => void }) {
  const profile = useGuild((s) => s.profile);
  const creatorId = (profile as any)?.id ?? profile?.handle ?? "";
  const [title, setTitle] = useState("");
  const [intent, setIntent] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!open) return null;
  const canSubmit = title.trim().length >= 3 && intent.trim().length >= 10 && !!creatorId && !busy;
  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId, title: title.trim(), intentStatement: intent.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      onCreated(d.project.id); setTitle(""); setIntent(""); onClose();
    } catch (e: any) { setErr(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-card p-5 shadow-2xl">
        <h2 className="text-base font-semibold text-white">Start a Project</h2>
        <p className="mt-1 text-[12px] text-neutral-500">QUARRY turns progression into story. State the problem you are solving.</p>
        <label className="block mt-4">
          <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Building Game Without Tutorials"
            className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-live/40" />
        </label>
        <label className="block mt-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Intent — required</span>
          <textarea value={intent} onChange={(e) => setIntent(e.target.value)} rows={3}
            placeholder='What problem are you solving right now? e.g. "Optimizing Paystack webhook response latency beneath 200ms."'
            className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-neutral-600 resize-none focus:outline-none focus:border-live/40" />
          <span className="text-[10px] text-neutral-600 font-mono">{intent.trim().length}/10 min</span>
        </label>
        {err && <p className="mt-2 text-[12px] text-risk">{err}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 btn glass rounded-lg py-2 text-xs text-neutral-400">Cancel</button>
          <button type="button" onClick={submit} disabled={!canSubmit} className="flex-1 btn glass rounded-lg py-2 text-xs text-live disabled:opacity-40">
            {busy ? "Creating…" : "Lock Intent & Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
