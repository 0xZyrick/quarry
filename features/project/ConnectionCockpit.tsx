"use client";
import { useState } from "react";
import { useGuild } from "@/lib/store";
import { useOnboarding } from "../onboarding/OnboardingProvider";

type Contribution = { id: string; type: "SUGGESTION" | "CRITIQUE" | "ENCOURAGEMENT"; messageText: string; isPinnedByHost: boolean; createdAt: string; user: { id: string; handle: string | null } };
type JourneyNode = { id: string; dayLabel: string; phaseTitle: string; discussions: Contribution[] };

const TYPE_META: Record<Contribution["type"], { label: string; color: string; placeholder: string }> = {
  SUGGESTION: { label: "Suggestion", color: "text-sky-300", placeholder: "Propose a concrete code or design adjustment…" },
  CRITIQUE: { label: "Critique", color: "text-amber-300", placeholder: "Point out a risk, edge case, or trade-off…" },
  ENCOURAGEMENT: { label: "Encouragement", color: "text-emerald-300", placeholder: "Acknowledge progress or a sharp decision…" },
};

export default function ConnectionCockpit({ node, projectId, hostId, onContribution }: { node: JourneyNode; projectId: string; hostId: string; onContribution: () => void }) {
  const profile = useGuild((s) => s.profile);
  const { signedIn, requireAuth, data: onb } = useOnboarding();
  const userId = signedIn ? ((profile as any)?.id ?? onb.uid ?? "guest") : "guest";
  const isHost = (profile as any)?.id === hostId || profile?.handle === hostId;
  const [type, setType] = useState<Contribution["type"]>("SUGGESTION");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!signedIn) {
      requireAuth("participate with a suggestion or critique");
      return;
    }
    if (!text.trim() || sending) return;
    setSending(true); setErr(null);
    try {
      const r = await fetch("/api/contributions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyNodeId: node.id, userId, type, messageText: text.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setText(""); onContribution();
    } catch (e: any) { setErr(e.message ?? "Failed"); }
    finally { setSending(false); }
  };

  const togglePin = async (id: string, currentlyPinned: boolean) => {
    if (!isHost) return;
    await fetch("/api/contributions", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isPinnedByHost: !currentlyPinned, hostUserId: hostId }),
    });
    onContribution();
  };

  const pinned = node.discussions.filter((c) => c.isPinnedByHost);
  const rest = node.discussions.filter((c) => !c.isPinnedByHost);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/5">
        <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Participate · {node.dayLabel}</p>
        <h2 className="text-sm font-semibold text-white mt-0.5">{node.phaseTitle}</h2>
        <p className="text-[11px] text-neutral-500 mt-1">Structured contributions only. No generic chat.</p>
      </div>
      <div className="px-4 py-3 border-b border-white/5 space-y-2">
        <div className="flex gap-1">
          {(Object.keys(TYPE_META) as Contribution["type"][]).map((t) => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-mono transition-colors ${type === t ? "bg-white/10 text-white" : "bg-transparent text-neutral-500 hover:text-neutral-300"}`}>
              {TYPE_META[t].label}
            </button>
          ))}
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={TYPE_META[type].placeholder} rows={3}
          className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-neutral-600 resize-none focus:outline-none focus:border-live/40" />
        {err && <p className="text-[11px] text-risk">{err}</p>}
        <button type="button" onClick={submit} disabled={sending || !text.trim()}
          className="w-full btn glass rounded-lg py-2 text-xs font-mono text-live disabled:opacity-40">
          {sending ? "Filing…" : `File ${TYPE_META[type].label}`}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {pinned.length > 0 && (
          <section>
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-live mb-2">Pinned to history</h3>
            <ul className="space-y-2">{pinned.map((c) => <ContribCard key={c.id} c={c} isHost={!!isHost} onTogglePin={() => togglePin(c.id, true)} />)}</ul>
          </section>
        )}
        <section>
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 mb-2">Balcony</h3>
          {rest.length === 0 && pinned.length === 0 ? (
            <p className="text-[12px] text-neutral-600 font-mono">Be the first to contribute to this phase.</p>
          ) : (
            <ul className="space-y-2">{rest.map((c) => <ContribCard key={c.id} c={c} isHost={!!isHost} onTogglePin={() => togglePin(c.id, false)} />)}</ul>
          )}
        </section>
      </div>
    </div>
  );
}

function ContribCard({ c, isHost, onTogglePin }: { c: Contribution; isHost: boolean; onTogglePin: () => void }) {
  const meta = TYPE_META[c.type];
  return (
    <li className="rounded-lg border border-white/5 bg-black/20 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className={`font-mono text-[10px] ${meta.color}`}>{meta.label}</span>
        <span className="text-[10px] text-neutral-600 font-mono truncate">@{c.user.handle ?? "anon"}</span>
      </div>
      <p className="mt-1 text-[12px] text-neutral-300 leading-snug">{c.messageText}</p>
      {isHost && (
        <button type="button" onClick={onTogglePin} className="mt-1.5 text-[10px] font-mono text-neutral-500 hover:text-live">
          {c.isPinnedByHost ? "Unpin" : "Pin to timeline"}
        </button>
      )}
    </li>
  );
}
