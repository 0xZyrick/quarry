"use client";
/**
 * STEP 04 — Ask to join only when Follow / Participate / Publish is attempted.
 */
import { useState } from "react";
import { useOnboarding } from "./OnboardingProvider";

export default function AuthGate({
  reason = "follow projects and participate",
  onClose,
}: {
  reason?: string;
  onClose?: () => void;
}) {
  const { update } = useOnboarding();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (name.trim().length < 2) {
      setErr("Display name (min 2 characters)");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      // Invite code optional in explore-first; accept empty or known test code
      const ok =
        !code.trim() ||
        code.trim().toUpperCase() === "QUARRY-ALPHA-27" ||
        (process.env.NEXT_PUBLIC_INVITE_CODES || "").split(",").includes(code.trim());
      if (!ok) {
        setErr("Invalid invite code (try QUARRY-ALPHA-27 in alpha)");
        setBusy(false);
        return;
      }
      const uid = `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      update({
        uid,
        name: name.trim(),
        auth: "invite",
        explored: true,
      });
      onClose?.();
    } catch {
      setErr("Could not create account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-card p-5 shadow-2xl">
        <h2 className="text-base font-semibold text-white">Create account or sign in</h2>
        <p className="mt-1 text-[12px] text-neutral-500">
          You need an account to {reason}. Browsing stays free.
        </p>
        <label className="block mt-4">
          <span className="font-mono text-[10px] uppercase text-neutral-500">Display name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. kodo.dev"
            className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-live/40"
          />
        </label>
        <label className="block mt-3">
          <span className="font-mono text-[10px] uppercase text-neutral-500">Invite code · optional in alpha</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="QUARRY-ALPHA-27"
            className="mt-1 w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-live/40"
          />
        </label>
        {err && <p className="mt-2 text-[12px] text-risk">{err}</p>}
        <div className="mt-4 flex gap-2">
          {onClose && (
            <button type="button" onClick={onClose} className="flex-1 btn glass rounded-lg py-2 text-xs text-neutral-400">
              Keep browsing
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="flex-1 btn glass rounded-lg py-2 text-xs text-live disabled:opacity-40"
          >
            {busy ? "…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
