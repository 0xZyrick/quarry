"use client";
import {useEffect, useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {useShellUi} from "@/lib/shellUi";
import type {Vault} from "@/lib/vault";
import ReputationHeader from "./ReputationHeader";
import MetricsPanel from "./MetricsPanel";
import CapsuleCard from "./CapsuleCard";
import CapsuleModal from "./CapsuleModal";
import SoonChip from "../shared/SoonChip";

/** Compact right drawer — not full-bleed. */
export default function VaultSheet() {
  const handle = useShellUi((s) => s.vaultHandle);
  const close = useShellUi((s) => s.closeVault);
  const [vault, setVault] = useState<Vault | null>(null);
  const [err, setErr] = useState("");
  const [openCap, setOpenCap] = useState<string | null>(null);
  const [f, setF] = useState<"all" | "war" | "commons">("all");

  useEffect(() => {
    if (!handle) {
      setVault(null);
      return;
    }
    let live = true;
    setErr("");
    setVault(null);
    fetch(`/api/vault/${encodeURIComponent(handle)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((v) => {
        if (live) setVault(v);
      })
      .catch(() => {
        if (live) setErr("Vault unavailable");
      });
    return () => {
      live = false;
    };
  }, [handle]);

  const list = vault?.capsules.filter((c) => f === "all" || c.kind === f) ?? [];
  const cur = vault?.capsules.find((c) => c.id === openCap) ?? null;

  return (
    <AnimatePresence>
      {handle && (
        <>
          <motion.button
            type="button"
            aria-label="Close vault"
            className="fixed inset-0 z-[60] bg-black/50"
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            onClick={close}
          />
          {/* subtle perspective shift of the world behind */}
          <motion.div
            aria-hidden
            className="fixed inset-0 z-[55] pointer-events-none origin-left"
            initial={{scale: 1, x: 0}}
            animate={{scale: 0.94, x: -18}}
            exit={{scale: 1, x: 0}}
            transition={{type: "spring", stiffness: 280, damping: 30}}
            style={{transformPerspective: 1200}}
          />
          <motion.aside
            role="dialog"
            aria-label={`PoE Vault @${handle}`}
            initial={{x: "110%", rotateY: -8}}
            animate={{x: 0, rotateY: 0}}
            exit={{x: "110%", rotateY: -6}}
            transition={{type: "spring", stiffness: 340, damping: 34}}
            style={{transformPerspective: 1200, transformOrigin: "right center"}}
            className="fixed top-2 right-2 bottom-2 z-[70] w-[min(100%-1rem,20rem)] rounded-2xl border border-line bg-[#0D0E11] shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5 shrink-0">
              <div className="font-mono text-[10px] tracking-wide text-neutral-400 truncate">
                PoE · <span className="text-white">@{handle}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <SoonChip className="!py-0.5 !px-1.5 !text-[9px]">Wallet</SoonChip>
                <button onClick={close} className="btn glass rounded-full w-7 h-7 grid place-items-center text-neutral-400 hover:text-white text-sm">
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-4">
              {err && <p className="text-xs text-risk font-mono">{err}</p>}
              {!vault && !err && <p className="text-xs text-neutral-500 font-mono">Loading…</p>}
              {vault && (
                <>
                  {vault.preview && (
                    <div className="rounded-lg border border-line bg-[#12141a] px-2.5 py-1 font-mono text-[9px] text-neutral-500">
                      Preview data
                    </div>
                  )}
                  <ReputationHeader
                    v={vault}
                    onSkill={(id) => {
                      setF("all");
                      setOpenCap(id);
                    }}
                  />
                  <MetricsPanel m={vault.metrics} />
                  <div>
                    <div className="font-mono text-[9px] text-neutral-500 mb-2">CAPSULES</div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(["all", "war", "commons"] as const).map((k) => (
                        <button
                          key={k}
                          onClick={() => setF(k)}
                          className={`btn rounded-full border px-2 py-0.5 text-[9px] font-mono ${
                            f === k ? "border-live text-live" : "border-line text-neutral-400"
                          }`}
                        >
                          {k === "all" ? "All" : k === "war" ? "War" : "Commons"}
                        </button>
                      ))}
                    </div>
                    {list.length ? (
                      <div className="space-y-2">
                        {list.map((c) => (
                          <CapsuleCard key={c.id} c={c} onOpen={setOpenCap} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] font-mono text-neutral-500 py-4 text-center">No capsules yet.</p>
                    )}
                  </div>
                </>
              )}
            </div>
            {cur && vault && (
              <CapsuleModal c={cur} preview={vault.preview} onClose={() => setOpenCap(null)} />
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
