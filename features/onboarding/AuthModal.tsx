"use client";

import { useEffect, useState } from "react";
import { useOnboarding } from "./OnboardingProvider";

type Props = {
  open: boolean;
  reason?: string;
  onClose: () => void;
  onSuccess?: () => void;
};

type Mode = "join" | "signin" | "link";
type JoinStep = "email" | "handle";

const PREVIEW_IMAGES = [
  "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=500&q=80",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=500&q=80",
  "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=500&q=80",
];

export default function AuthModal({ open, reason, onClose, onSuccess }: Props) {
  const { update, data } = useOnboarding();
  const [mode, setMode] = useState<Mode>("join");
  const [joinStep, setJoinStep] = useState<JoinStep>("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [track, setTrack] = useState<"creator" | "client">(data.track === "client" ? "client" : "creator");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode(reason?.toLowerCase().includes("email sign-in") ? "link" : "join");
    setJoinStep("email");
    setOtpSent(false);
    setEmail("");
    setName("");
    setToken("");
    setErr("");
  }, [open, reason]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setErr("");

    if (!otpSent && mode === "join" && joinStep === "email") {
      if (!email.trim()) {
        setErr("Enter your email address.");
        return;
      }
      setJoinStep("handle");
      return;
    }

    setBusy(true);
    try {
      if (!otpSent) {
        const endpoint = mode === "join"
          ? "/api/invite"
          : mode === "link"
            ? "/api/auth/email/link"
            : "/api/auth/email/request";
        const body = mode === "join"
          ? { name: name.trim(), email: email.trim(), track }
          : { email: email.trim() };
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Could not send a verification code.");
        setOtpSent(true);
        return;
      }

      const response = await fetch("/api/auth/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), token: token.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not verify your email.");
      const account = result.account;
      if (!account?.id || !account?.handle) throw new Error("Verified account response was incomplete.");
      update({
        uid: account.id,
        name: account.handle,
        auth: "invite",
        explored: true,
        track: account.track || track,
      });
      onSuccess?.();
      onClose();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Could not continue. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const continueAsGuest = () => {
    update({ explored: true, auth: "guest", name: "", uid: "", track: "guest" });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#080b11] text-white">
      <div className="grid min-h-full lg:grid-cols-2">
        <section className="flex min-h-full flex-col justify-center px-5 py-8 sm:px-10 lg:px-14">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-7 flex items-center justify-between">
              <a href="/discover" aria-label="Wippo Discover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/wippo-logo.png" alt="Wippo" className="h-8 w-auto object-contain" />
              </a>
              <button type="button" onClick={onClose} className="text-[12px] text-white/50 hover:text-white">
                Close
              </button>
            </div>

            <h1 className="text-[24px] font-semibold tracking-tight">
              {otpSent
                ? "Check your inbox"
                : mode === "join"
                  ? joinStep === "email" ? "Join Wippo" : "Choose your handle"
                  : mode === "link"
                    ? "Add sign-in email"
                    : "Welcome back"}
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-white/50">
              {otpSent
                ? `Enter the one-time code sent to ${email}.`
                : reason
                  ? `${reason.charAt(0).toUpperCase()}${reason.slice(1)}. Sign in or create an account to continue.`
                  : mode === "join"
                    ? joinStep === "email"
                      ? "Enter your email to create an account. No invite is needed to join Wippo."
                      : `We'll send a verification code to ${email}.`
                    : mode === "link"
                      ? "Verify an email address to make this account recoverable after sign-out."
                      : "We’ll email you a one-time sign-in code."}
            </p>

            <form onSubmit={(event) => void submit(event)} className="mt-7 space-y-4">
              {!otpSent && mode === "join" && joinStep === "handle" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ["creator", "I'm building"],
                      ["client", "I own a project"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTrack(value)}
                        aria-pressed={track === value}
                        className={`rounded-xl border px-3 py-3 text-[11px] font-medium ${track === value ? "border-emerald-400/60 bg-emerald-400/10 text-white" : "border-white/10 text-white/55"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <label className="block text-[11px] font-medium text-white/65">
                    Username
                    <div className="mt-1.5 flex items-center rounded-xl border border-white/15 bg-white/[0.04] px-3">
                      <span className="text-white/40">@</span>
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value.replace(/\s/g, "").slice(0, 24))}
                        autoComplete="username"
                        maxLength={24}
                        placeholder="yourname"
                        required
                        className="w-full bg-transparent px-2 py-3 text-[13px] text-white outline-none"
                      />
                    </div>
                  </label>
                </>
              )}

              {!otpSent && (
                <label className="block text-[11px] font-medium text-white/65">
                  Email address
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    disabled={otpSent || (mode === "join" && joinStep === "handle")}
                    placeholder="builder@domain.com"
                    required
                    className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-3 text-[13px] text-white outline-none placeholder:text-white/30 disabled:opacity-70"
                  />
                </label>
              )}

              {otpSent && (
                <label className="block text-[11px] font-medium text-white/65">
                  One-time code
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={token}
                    onChange={(event) => setToken(event.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="000000"
                    required
                    className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-3 text-center font-mono text-xl tracking-[0.35em] text-white outline-none"
                  />
                </label>
              )}

              {err && <p role="alert" className="text-[12px] text-red-300">{err}</p>}

              <button
                type="submit"
                disabled={busy || (otpSent && token.trim().length < 6) || (!otpSent && mode === "join" && joinStep === "handle" && name.trim().length < 2)}
                className="w-full rounded-xl bg-white py-3.5 text-[12px] font-bold uppercase tracking-wide text-black disabled:opacity-40"
              >
                {busy
                  ? "Please wait…"
                  : otpSent
                    ? "Verify and continue"
                    : mode === "join"
                      ? joinStep === "email" ? "Continue with email" : "Email me a code"
                      : "Email me a code"}
              </button>
            </form>

            {!otpSent && mode !== "link" && (
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "join" ? "signin" : "join");
                  setJoinStep("email");
                  setErr("");
                }}
                className="mt-4 w-full text-[12px] text-white/55 hover:text-white"
              >
                {mode === "join" ? "Already have an account? Sign in" : "New to Wippo? Create an account"}
              </button>
            )}
            {!otpSent && mode === "join" && joinStep === "handle" && (
              <button type="button" onClick={() => setJoinStep("email")} className="mt-3 w-full text-[12px] text-white/40 hover:text-white/70">
                Back
              </button>
            )}
            {otpSent && (
              <button
                type="button"
                onClick={() => {
                  setOtpSent(false);
                  setToken("");
                  if (mode === "join") setJoinStep("email");
                }}
                className="mt-4 w-full text-[12px] text-white/45 hover:text-white/75"
              >
                Use a different email or resend
              </button>
            )}

            <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/35">
              <span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" />
            </div>
            <button
              type="button"
              onClick={continueAsGuest}
              className="w-full rounded-xl border border-white/15 py-3 text-[12px] font-semibold text-white/80 hover:bg-white/[0.05]"
            >
              Continue as guest · explore first
            </button>
            <p className="mt-3 text-center text-[10px] text-white/35">
              Browsing is open. You can create an account whenever an action needs it.
            </p>
          </div>
        </section>

        <aside className="relative hidden min-h-full overflow-hidden border-l border-white/10 bg-[#10141b] p-8 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_45%_40%,rgba(255,118,95,.14),transparent_60%)]" />
          <div className="relative z-10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
              The work is the story
            </p>
            <h2 className="mt-4 max-w-lg text-[38px] font-semibold leading-[1.05] tracking-tight">
              A live atlas of work in progress.
            </h2>
            <p className="mt-4 max-w-md text-[14px] leading-relaxed text-white/55">
              Follow work as it happens. Watch makers build, see what gets stuck, and find a place to help.
            </p>
          </div>
          <div className="relative z-10 grid h-[52vh] max-h-[560px] min-h-[360px] grid-cols-2 grid-rows-2 gap-2 overflow-hidden rounded-2xl border border-white/10 p-2">
            {PREVIEW_IMAGES.map((src, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt=""
                className={`h-full w-full rounded-xl object-cover ${index === 0 ? "row-span-2" : ""}`}
              />
            ))}
          </div>
          <p className="relative z-10 text-[11px] text-white/40">
            Discover is public · Studio publishing requires a creator code
          </p>
        </aside>
      </div>
    </div>
  );
}
