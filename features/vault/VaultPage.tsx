"use client";
import {useCallback, useEffect, useMemo, useState} from "react";
import type {Vault} from "@/lib/vault";
import SoonChip from "../shared/SoonChip";
import ReputationHeader from "./ReputationHeader";
import MetricsPanel from "./MetricsPanel";
import CapsuleCard from "./CapsuleCard";
import CapsuleModal from "./CapsuleModal";
type F = "all" | "war" | "commons";

export default function VaultPage({vault: v}: {vault: Vault}) {
  const [f, setF] = useState<F>("all"),
    [open, setOpen] = useState<string | null>(null);
  const show = useCallback((id: string) => {
    setF("all");
    setOpen(id);
  }, []);
  useEffect(() => {
    const h = location.hash.match(/^#capsule-(.+)$/);
    if (h && v.capsules.some((c) => c.id === h[1])) setOpen(h[1]);
  }, [v.capsules]);
  const list = useMemo(() => v.capsules.filter((c) => f === "all" || c.kind === f), [v.capsules, f]);
  const cur = v.capsules.find((c) => c.id === open) ?? null,
    count = (k: F) => (k === "all" ? v.capsules.length : v.capsules.filter((c) => c.kind === k).length);
  const tab = (k: F, l: string) => (
    <button
      role="tab"
      aria-selected={f === k}
      onClick={() => setF(k)}
      className="btn rounded-full border border-line px-3 py-1 text-xs aria-selected:border-live aria-selected:text-live"
    >
      {l} <span className="text-neutral-500">{count(k)}</span>
    </button>
  );
  return (
    <main className="min-h-screen bg-deep text-neutral-200">
      {/* subtle top wash for depth without noise */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64"
        style={{background: "radial-gradient(60% 80% at 50% 0%, rgba(0,163,255,.07), transparent)"}}
      />
      <div className="relative mx-auto max-w-5xl space-y-6 px-4 py-6">
        <nav className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <a
              href="/"
              className="btn glass rounded-full px-3 py-1.5 font-mono text-xs text-neutral-300 hover:text-white"
            >
              ← Feed
            </a>
            <a
              href="/?view=map"
              className="btn glass rounded-full px-3 py-1.5 font-mono text-xs text-neutral-300 hover:text-white"
            >
              Map
            </a>
          </div>
          <SoonChip>Wallet</SoonChip>
        </nav>
        {v.preview && (
          <div
            role="note"
            className="rounded-lg border border-line bg-[#12141a] px-3 py-1.5 font-mono text-[10px] text-neutral-500"
          >
            Preview data · capsules sample until payment rails go live
          </div>
        )}
        <ReputationHeader v={v} onSkill={show} />
        <div className="flex flex-wrap items-stretch gap-4">
          <MetricsPanel m={v.metrics} />
          <section
            aria-label="Capsule archive filter"
            className="glass flex-1 min-w-[16rem] rounded-xl border border-line p-4 space-y-2 bg-[#12141a]/80"
          >
            <div className="font-mono text-[10px] text-neutral-500">CAPSULE ARCHIVE</div>
            <div role="tablist" aria-label="Filter capsules" className="flex flex-wrap gap-2">
              {tab("all", "All")}
              {tab("war", "Projects")}
              {tab("commons", "Commons Builds")}
            </div>
          </section>
        </div>
        <section aria-label="Proof of Execution capsule vault">
          <h2 className="mb-3 font-mono text-[11px] tracking-wide text-neutral-500">PoE CAPSULE VAULT</h2>
          {list.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {list.map((c) => (
                <CapsuleCard key={c.id} c={c} onOpen={setOpen} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-[#12141a] p-8 text-center font-mono text-xs text-neutral-500">
              No capsules yet. Finish a funded phase or a paid Commons session and its proof will appear here.
            </div>
          )}
        </section>
      </div>
      {cur && <CapsuleModal c={cur} preview={v.preview} onClose={() => setOpen(null)} />}
    </main>
  );
}
