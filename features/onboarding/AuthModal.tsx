"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useOnboarding } from "./OnboardingProvider";

type Props = {
  open: boolean;
  reason?: string;
  onClose: () => void;
  onSuccess?: () => void;
};

type Mode = "join" | "signin" | "link";

export default function AuthModal({ open, reason, onClose, onSuccess }: Props) {
  const { update, data } = useOnboarding();
  const [mode, setMode] = useState<Mode>("join");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [track, setTrack] = useState<"creator" | "client">(data.track === "client" ? "client" : "creator");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode(reason?.toLowerCase().includes("email sign-in") ? "link" : "join");
    setOtpSent(false);
    setToken("");
    setErr("");
  }, [open, reason]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      if (!otpSent) {
        const endpoint = mode === "join"
          ? "/api/invite"
          : mode === "link"
            ? "/api/auth/email/link"
            : "/api/auth/email/request";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mode === "join"
            ? { code: code.trim(), name: name.trim(), email: email.trim(), track }
            : { email: email.trim() }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Could not send a verification code");
        setOtpSent(true);
        return;
      }

      const response = await fetch("/api/auth/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), token: token.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not verify your email");
      const account = result.account;
      if (!account?.id || !account?.handle) throw new Error("Verified account response was incomplete");
      update({
        uid: account.id,
        name: account.handle,
        auth: "invite",
        explored: true,
        track: account.track || track,
      } as any);
      onSuccess?.();
      onClose();
      setOtpSent(false);
      setToken("");
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Could not continue. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6 overflow-y-auto">
          <motion.button
            type="button"
            aria-label="Close"
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="relative z-10 my-auto w-full max-w-sm rounded-3xl border border-[var(--line-strong)] bg-[var(--surface)] p-6 shadow-[0_24px_80px_rgba(0,0,0,.55)]"
          >
            <div className="flex justify-center mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/wippo-logo.png" alt="" className="h-7 w-auto object-contain" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--cream)] text-center">
              {otpSent ? "Check your inbox" : mode === "join" ? "Join Wippo" : mode === "link" ? "Add sign-in email" : "Welcome back"}
            </h2>
            <p className="mt-1.5 text-[12px] text-[var(--text-muted)] text-center leading-relaxed">
              {otpSent
                ? `Enter the one-time code sent to ${email}.`
                : mode === "link"
                  ? "Verify an email address to make this account recoverable after sign-out."
                  : reason
                    ? reason.charAt(0).toUpperCase() + reason.slice(1) + (reason.endsWith(".") ? "" : ".")
                    : mode === "join"
                      ? "Create an account with an invite code and verify your email."
                      : "We’ll send a one-time sign-in code to your email."}
            </p>

            {!otpSent && mode === "join" && (
              <div className="mt-5 grid grid-cols-2 gap-2">
                {([
                  ["creator", "I'm building"],
                  ["client", "I own a project"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={track === value}
                    onClick={() => setTrack(value)}
                    className={`rounded-xl border px-3 py-2.5 text-[11px] font-medium ${
                      track === value
                        ? "border-[var(--coral)]/70 bg-[var(--coral)]/10 text-white"
                        : "border-white/10 text-white/55 hover:bg-white/[0.04]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {!otpSent && mode === "join" && (
              <label className="mt-5 block">
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">Display name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="username"
                  maxLength={24}
                  placeholder="yourname"
                  required
                  className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--cream)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--coral)]/60"
                />
              </label>
            )}

            <label className="mt-4 block">
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                disabled={otpSent}
                placeholder="you@example.com"
                required
                className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--cream)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--coral)]/60 disabled:opacity-60"
              />
            </label>

            {!otpSent && mode === "join" && (
              <label className="mt-3 block">
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">Invite code</span>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  maxLength={64}
                  placeholder="Your invitation code"
                  required
                  className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-sm font-mono text-[var(--cream)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--coral)]/60"
                />
              </label>
            )}

            {otpSent && (
              <label className="mt-4 block">
                <span className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">One-time code</span>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={token}
                  onChange={(event) => setToken(event.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="000000"
                  required
                  className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 text-center font-mono text-xl tracking-[0.35em] text-[var(--cream)] outline-none focus:border-[var(--coral)]/60"
                />
              </label>
            )}

            {err && <p role="alert" className="mt-3 text-[12px] text-[var(--coral)] text-center">{err}</p>}

            {!otpSent && mode !== "link" && (
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "join" ? "signin" : "join");
                  setErr("");
                }}
                className="mt-4 w-full text-[12px] text-white/50 hover:text-white"
              >
                {mode === "join" ? "Already have an account? Sign in" : "New to Wippo? Join with an invite"}
              </button>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full py-3 text-[13px] font-medium border border-[var(--line)] text-[var(--text-muted)] hover:text-[var(--cream)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || (otpSent
                  ? token.trim().length < 6
                  : !email.trim() || (mode === "join" && (name.trim().length < 2 || !code.trim())))}
                className="flex-[1.3] rounded-full py-3 text-[13px] font-semibold bg-[var(--coral)] text-[#170b09] disabled:opacity-40 hover:brightness-110"
              >
                {busy ? "…" : otpSent ? "Verify and continue" : "Email me a code"}
              </button>
            </div>
            {otpSent && (
              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setToken("");
                }}
                className="mt-3 w-full text-[12px] text-white/40 hover:text-white/70"
              >
                Use a different email or resend
              </button>
            )}
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}
